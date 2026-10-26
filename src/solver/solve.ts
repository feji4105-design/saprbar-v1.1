import type { Project } from "../model";
import { createFrameElementState, globalElementLoad, globalElementStiffness, recoverLocalResponse, type FrameElementState } from "./frameElement";
import { multiplyMatrixVector, solveSymmetricPositiveDefinite, SingularMatrixError, zeros } from "./matrix";
import { createAnalysisInput } from "./normalize";
import { SOLVER_VERSION, type AnalysisFailure, type AnalysisInput, type AnalysisResult, type AnalysisSuccess, type ElementAnalysisResult, type SolverDiagnostic } from "./types";

const DOF_NAMES = ["ux", "uy", "rz"] as const;

function failure(diagnostics: SolverDiagnostic[]): AnalysisFailure {
  return { ok: false, solverVersion: SOLVER_VERSION, diagnostics };
}

function finiteInput(input: AnalysisInput): boolean {
  const values = [
    input.singularityTolerance,
    ...input.nodes.flatMap((item) => [item.x, item.y]),
    ...input.elements.flatMap((item) => [item.elasticModulus, item.area, item.inertiaZ, item.yMinus, item.yPlus]),
    ...input.nodalLoads.flatMap((item) => [item.fx, item.fy, item.mz]),
    ...input.uniformLoads.flatMap((item) => [item.qx, item.qy])
  ];
  return values.every(Number.isFinite);
}

export function solveLinearStatic(input: AnalysisInput): AnalysisResult {
  if (!finiteInput(input)) return failure([{ code: "MODEL_INVALID", message: "Вход расчёта содержит нечисловые значения." }]);
  if (input.singularityTolerance <= 0) return failure([{ code: "MODEL_INVALID", message: "Допуск сингулярности должен быть больше нуля." }]);
  const nodeIndex = new Map(input.nodes.map((node, index) => [node.id, index]));
  const elementIndex = new Map(input.elements.map((element) => [element.id, element]));
  if (nodeIndex.size !== input.nodes.length || elementIndex.size !== input.elements.length) {
    return failure([{ code: "MODEL_INVALID", message: "ID узлов или элементов не уникальны." }]);
  }
  for (const element of input.elements) {
    if (!nodeIndex.has(element.nodeI) || !nodeIndex.has(element.nodeJ)) return failure([{ code: "MODEL_INVALID", message: `Стержень «${element.id}» ссылается на отсутствующий узел.` }]);
    if (element.nodeI === element.nodeJ) return failure([{ code: "MODEL_INVALID", message: `Стержень «${element.id}» имеет одинаковые концевые узлы.` }]);
    if (element.elasticModulus <= 0 || element.area <= 0 || element.inertiaZ <= 0 || element.yMinus <= 0 || element.yPlus <= 0) {
      return failure([{ code: "MODEL_INVALID", message: `Стержень «${element.id}» содержит неположительные E/A/Iz/y−/y+.` }]);
    }
  }
  for (const support of input.supports) {
    if (!nodeIndex.has(support.nodeId)) return failure([{ code: "MODEL_INVALID", message: `Опора ссылается на отсутствующий узел «${support.nodeId}».` }]);
  }
  for (const load of input.uniformLoads) {
    if (!elementIndex.has(load.elementId)) return failure([{ code: "MODEL_INVALID", message: `Распределённая нагрузка ссылается на отсутствующий стержень «${load.elementId}».` }]);
  }
  const dofCount = input.nodes.length * 3;
  const stiffness = zeros(dofCount, dofCount);
  const loads = Array<number>(dofCount).fill(0);
  const uniformByElement = new Map<string, { qx: number; qy: number }>();
  for (const load of input.uniformLoads) {
    const current = uniformByElement.get(load.elementId) ?? { qx: 0, qy: 0 };
    current.qx += load.qx;
    current.qy += load.qy;
    uniformByElement.set(load.elementId, current);
  }
  for (const load of input.nodalLoads) {
    const index = nodeIndex.get(load.nodeId);
    if (index === undefined) return failure([{ code: "MODEL_INVALID", message: `Узел нагрузки «${load.nodeId}» не найден.` }]);
    loads[index * 3] = loads[index * 3]! + load.fx;
    loads[index * 3 + 1] = loads[index * 3 + 1]! + load.fy;
    loads[index * 3 + 2] = loads[index * 3 + 2]! + load.mz;
  }

  const states = new Map<string, FrameElementState>();
  for (const element of input.elements) {
    const indexI = nodeIndex.get(element.nodeI);
    const indexJ = nodeIndex.get(element.nodeJ);
    if (indexI === undefined || indexJ === undefined) return failure([{ code: "MODEL_INVALID", message: `Стержень «${element.id}» ссылается на отсутствующий узел.` }]);
    const nodeI = input.nodes[indexI]!;
    const nodeJ = input.nodes[indexJ]!;
    const distributed = uniformByElement.get(element.id) ?? { qx: 0, qy: 0 };
    let state: FrameElementState;
    try {
      state = createFrameElementState(element, nodeI, nodeJ, distributed.qx, distributed.qy);
    } catch (cause) {
      return failure([{ code: "NUMERICAL_FAILURE", message: cause instanceof Error ? cause.message : `Ошибка элемента «${element.id}».` }]);
    }
    if (!Number.isFinite(state.length) || state.length <= 0) return failure([{ code: "MODEL_INVALID", message: `Стержень «${element.id}» имеет нулевую длину.` }]);
    states.set(element.id, state);
    const indices = [indexI * 3, indexI * 3 + 1, indexI * 3 + 2, indexJ * 3, indexJ * 3 + 1, indexJ * 3 + 2];
    const globalK = globalElementStiffness(state);
    const globalF = globalElementLoad(state);
    indices.forEach((globalRow, localRow) => {
      loads[globalRow] = loads[globalRow]! + globalF[localRow]!;
      indices.forEach((globalColumn, localColumn) => { stiffness[globalRow]![globalColumn] = stiffness[globalRow]![globalColumn]! + globalK[localRow]![localColumn]!; });
    });
  }

  const constrained = new Set<number>();
  input.supports.forEach((support) => {
    const index = nodeIndex.get(support.nodeId);
    if (index === undefined) return;
    if (support.ux) constrained.add(index * 3);
    if (support.uy) constrained.add(index * 3 + 1);
    if (support.rz) constrained.add(index * 3 + 2);
  });
  const maxDiagonal = Math.max(0, ...stiffness.map((row, index) => Math.abs(row[index]!)));
  if (!Number.isFinite(maxDiagonal) || maxDiagonal <= 0) return failure([{ code: "MECHANISM_OR_SINGULAR", message: "Глобальная матрица жёсткости пуста или вырождена." }]);
  // Only structurally disconnected DOFs are omitted. A user tolerance must not
  // erase a legitimate but small stiffness (for example, a very slender beam).
  const inactiveThreshold = maxDiagonal * Number.EPSILON * 100;
  const loadScale = Math.max(1, ...loads.map(Math.abs));
  const free: number[] = [];
  const inactive: number[] = [];
  for (let dof = 0; dof < dofCount; dof += 1) {
    if (constrained.has(dof)) continue;
    if (Math.abs(stiffness[dof]![dof]!) <= inactiveThreshold) inactive.push(dof);
    else free.push(dof);
  }
  for (const dof of inactive) {
    if (Math.abs(loads[dof]!) > loadScale * input.singularityTolerance) {
      const node = input.nodes[Math.floor(dof / 3)]!;
      const dofName = DOF_NAMES[dof % 3]!;
      return failure([{ code: "INACTIVE_DOF_LOADED", message: `Ненулевая нагрузка действует на степень свободы без жёсткости (${dofName}).`, nodeId: node.id, dof: dofName }]);
    }
  }
  const reducedK = free.map((row) => free.map((column) => stiffness[row]![column]!));
  const reducedF = free.map((row) => loads[row]!);
  let freeSolution: number[];
  let solverResidual = 0;
  try {
    const solved = solveSymmetricPositiveDefinite(reducedK, reducedF, input.singularityTolerance);
    freeSolution = solved.solution;
    solverResidual = solved.relativeResidual;
  } catch (cause) {
    if (cause instanceof SingularMatrixError) return failure([{ code: "MECHANISM_OR_SINGULAR", message: `Неустойчивая или вырожденная модель: ${cause.message}` }]);
    return failure([{ code: "NUMERICAL_FAILURE", message: cause instanceof Error ? cause.message : "Неизвестная численная ошибка." }]);
  }
  const displacementsVector = Array<number>(dofCount).fill(0);
  free.forEach((dof, index) => { displacementsVector[dof] = freeSolution[index]!; });
  if (!displacementsVector.every(Number.isFinite)) return failure([{ code: "NUMERICAL_FAILURE", message: "Получены нечисловые перемещения." }]);
  const residual = multiplyMatrixVector(stiffness, displacementsVector).map((value, index) => value - loads[index]!);

  const displacements = input.nodes.map((node, index) => ({ nodeId: node.id, ux: displacementsVector[index * 3]!, uy: displacementsVector[index * 3 + 1]!, rz: displacementsVector[index * 3 + 2]! }));
  const reactions = input.supports.map((support) => {
    const index = nodeIndex.get(support.nodeId)!;
    return { nodeId: support.nodeId, fx: support.ux ? residual[index * 3]! : 0, fy: support.uy ? residual[index * 3 + 1]! : 0, mz: support.rz ? residual[index * 3 + 2]! : 0 };
  });
  const elements: ElementAnalysisResult[] = input.elements.map((element) => {
    const indexI = nodeIndex.get(element.nodeI)!;
    const indexJ = nodeIndex.get(element.nodeJ)!;
    const elementDofs = [indexI * 3, indexI * 3 + 1, indexI * 3 + 2, indexJ * 3, indexJ * 3 + 1, indexJ * 3 + 2].map((index) => displacementsVector[index]!);
    const state = states.get(element.id)!;
    const response = recoverLocalResponse(state, elementDofs, element);
    return {
      elementId: element.id,
      length: state.length,
      localDisplacements: response.localDisplacements as ElementAnalysisResult["localDisplacements"],
      localNodeActions: response.nodeActions as ElementAnalysisResult["localNodeActions"],
      localEndForces: response.nodeActions.map((value) => -value) as ElementAnalysisResult["localEndForces"],
      diagram: response.diagram
    };
  });

  let externalFx = 0;
  let externalFy = 0;
  let externalMz = 0;
  input.nodalLoads.forEach((load) => {
    const node = input.nodes[nodeIndex.get(load.nodeId)!]!;
    externalFx += load.fx;
    externalFy += load.fy;
    externalMz += load.mz + node.x * load.fy - node.y * load.fx;
  });
  input.uniformLoads.forEach((load) => {
    const element = elementIndex.get(load.elementId)!;
    const nodeI = input.nodes[nodeIndex.get(element.nodeI)!]!;
    const nodeJ = input.nodes[nodeIndex.get(element.nodeJ)!]!;
    const length = Math.hypot(nodeJ.x - nodeI.x, nodeJ.y - nodeI.y);
    const c = (nodeJ.x - nodeI.x) / length;
    const s = (nodeJ.y - nodeI.y) / length;
    const fx = (c * load.qx - s * load.qy) * length;
    const fy = (s * load.qx + c * load.qy) * length;
    const midX = (nodeI.x + nodeJ.x) / 2;
    const midY = (nodeI.y + nodeJ.y) / 2;
    externalFx += fx;
    externalFy += fy;
    externalMz += midX * fy - midY * fx;
  });
  let reactionFx = 0;
  let reactionFy = 0;
  let reactionMz = 0;
  reactions.forEach((reaction) => {
    const node = input.nodes[nodeIndex.get(reaction.nodeId)!]!;
    reactionFx += reaction.fx;
    reactionFy += reaction.fy;
    reactionMz += reaction.mz + node.x * reaction.fy - node.y * reaction.fx;
  });
  const forceXResidual = externalFx + reactionFx;
  const forceYResidual = externalFy + reactionFy;
  const momentZResidual = externalMz + reactionMz;
  const equilibriumScale = Math.max(1, Math.abs(externalFx), Math.abs(externalFy), Math.abs(externalMz), Math.abs(reactionFx), Math.abs(reactionFy), Math.abs(reactionMz));
  const equilibriumResidual = Math.max(Math.abs(forceXResidual), Math.abs(forceYResidual), Math.abs(momentZResidual)) / equilibriumScale;
  if (!Number.isFinite(equilibriumResidual) || equilibriumResidual > Math.max(1e-8, input.singularityTolerance * 1000, solverResidual * 100)) {
    return failure([{ code: "NUMERICAL_FAILURE", message: `Не выполнена проверка глобального равновесия: ${equilibriumResidual}.` }]);
  }
  const success: AnalysisSuccess = {
    ok: true,
    solverVersion: SOLVER_VERSION,
    displacements,
    reactions,
    elements,
    equilibrium: { forceXResidual, forceYResidual, momentZResidual, relativeResidual: Math.max(equilibriumResidual, solverResidual) }
  };
  return success;
}

export function analyzeProject(project: Project): AnalysisResult {
  const normalized = createAnalysisInput(project);
  return normalized.input ? solveLinearStatic(normalized.input) : failure(normalized.diagnostics);
}

import { multiplyMatrixVector, quadraticTransform, solveSmallDense, zeros, type Matrix } from "./matrix";
import type { AnalysisElement, DiagramPoint } from "./types";

export interface FrameElementState {
  length: number;
  cosine: number;
  sine: number;
  transform: Matrix;
  originalStiffness: Matrix;
  originalLoad: number[];
  condensedStiffness: Matrix;
  condensedLoad: number[];
  retained: number[];
  released: number[];
  qx: number;
  qy: number;
}

export function localFrameStiffness(elasticModulus: number, area: number, inertia: number, length: number): Matrix {
  const axial = elasticModulus * area / length;
  const b12 = 12 * elasticModulus * inertia / length ** 3;
  const b6 = 6 * elasticModulus * inertia / length ** 2;
  const b4 = 4 * elasticModulus * inertia / length;
  const b2 = 2 * elasticModulus * inertia / length;
  return [
    [axial, 0, 0, -axial, 0, 0],
    [0, b12, b6, 0, -b12, b6],
    [0, b6, b4, 0, -b6, b2],
    [-axial, 0, 0, axial, 0, 0],
    [0, -b12, -b6, 0, b12, -b6],
    [0, b6, b2, 0, -b6, b4]
  ];
}

export function transformation(cosine: number, sine: number): Matrix {
  return [
    [cosine, sine, 0, 0, 0, 0],
    [-sine, cosine, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, cosine, sine, 0],
    [0, 0, 0, -sine, cosine, 0],
    [0, 0, 0, 0, 0, 1]
  ];
}

export function uniformLocalLoad(qx: number, qy: number, length: number): number[] {
  return [qx * length / 2, qy * length / 2, qy * length ** 2 / 12, qx * length / 2, qy * length / 2, -qy * length ** 2 / 12];
}

function condense(stiffness: Matrix, load: readonly number[], released: number[]): { stiffness: Matrix; load: number[]; retained: number[] } {
  const retained = [0, 1, 2, 3, 4, 5].filter((index) => !released.includes(index));
  if (released.length === 0) return { stiffness: stiffness.map((row) => [...row]), load: [...load], retained };
  const krr = released.map((row) => released.map((column) => stiffness[row]![column]!));
  const kra = released.map((row) => retained.map((column) => stiffness[row]![column]!));
  const kar = retained.map((row) => released.map((column) => stiffness[row]![column]!));
  const kaa = retained.map((row) => retained.map((column) => stiffness[row]![column]!));
  const fr = released.map((index) => load[index]!);
  const fa = retained.map((index) => load[index]!);
  const invKrrKra = retained.map((_, column) => solveSmallDense(krr, kra.map((row) => row[column]!)));
  const invKrrFr = solveSmallDense(krr, fr);
  const resultStiffness = zeros(6, 6);
  const resultLoad = Array<number>(6).fill(0);
  retained.forEach((rowIndex, row) => {
    resultLoad[rowIndex] = fa[row]! - kar[row]!.reduce((sum, value, r) => sum + value * invKrrFr[r]!, 0);
    retained.forEach((columnIndex, column) => {
      const correction = kar[row]!.reduce((sum, value, r) => sum + value * invKrrKra[column]![r]!, 0);
      resultStiffness[rowIndex]![columnIndex] = kaa[row]![column]! - correction;
    });
  });
  return { stiffness: resultStiffness, load: resultLoad, retained };
}

export function createFrameElementState(
  element: AnalysisElement,
  nodeI: { x: number; y: number },
  nodeJ: { x: number; y: number },
  qx: number,
  qy: number
): FrameElementState {
  const dx = nodeJ.x - nodeI.x;
  const dy = nodeJ.y - nodeI.y;
  const length = Math.hypot(dx, dy);
  const cosine = dx / length;
  const sine = dy / length;
  const transform = transformation(cosine, sine);
  const originalStiffness = localFrameStiffness(element.elasticModulus, element.area, element.inertiaZ, length);
  const originalLoad = uniformLocalLoad(qx, qy, length);
  const released: number[] = [];
  if (element.releases.rotationI) released.push(2);
  if (element.releases.rotationJ) released.push(5);
  const condensed = condense(originalStiffness, originalLoad, released);
  return {
    length, cosine, sine, transform, originalStiffness, originalLoad,
    condensedStiffness: condensed.stiffness, condensedLoad: condensed.load,
    retained: condensed.retained, released, qx, qy
  };
}

export function globalElementStiffness(state: FrameElementState): Matrix {
  return quadraticTransform(state.condensedStiffness, state.transform);
}

export function globalElementLoad(state: FrameElementState): number[] {
  const transposed = state.transform[0]!.map((_, column) => state.transform.map((row) => row[column]!));
  return multiplyMatrixVector(transposed, state.condensedLoad);
}

export function recoverLocalResponse(
  state: FrameElementState,
  globalDisplacements: readonly number[],
  element: AnalysisElement,
  sampleCount = 21
): { localDisplacements: number[]; nodeActions: number[]; diagram: DiagramPoint[] } {
  const local = multiplyMatrixVector(state.transform, globalDisplacements);
  if (state.released.length > 0) {
    const krr = state.released.map((row) => state.released.map((column) => state.originalStiffness[row]![column]!));
    const right = state.released.map((row) => {
      const coupling = state.retained.reduce((sum, column) => sum + state.originalStiffness[row]![column]! * local[column]!, 0);
      return state.originalLoad[row]! - coupling;
    });
    const releasedValues = solveSmallDense(krr, right);
    state.released.forEach((index, position) => { local[index] = releasedValues[position]!; });
  }
  const nodeActions = multiplyMatrixVector(state.originalStiffness, local).map((value, index) => value - state.originalLoad[index]!);
  const diagram: DiagramPoint[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const x = state.length * index / (sampleCount - 1);
    const axialForce = -nodeActions[0]! - state.qx * x;
    const shearForce = nodeActions[1]! + state.qy * x;
    const bendingMoment = -nodeActions[2]! + nodeActions[1]! * x + state.qy * x ** 2 / 2;
    const axialDisplacement = local[0]! + (-nodeActions[0]! * x - state.qx * x ** 2 / 2) / (element.elasticModulus * element.area);
    const transverseDisplacement = local[1]! + local[2]! * x + (-nodeActions[2]! * x ** 2 / 2 + nodeActions[1]! * x ** 3 / 6 + state.qy * x ** 4 / 24) / (element.elasticModulus * element.inertiaZ);
    diagram.push({
      x,
      axialDisplacement,
      transverseDisplacement,
      axialForce,
      shearForce,
      bendingMoment,
      stressLower: axialForce / element.area + bendingMoment * element.yMinus / element.inertiaZ,
      stressUpper: axialForce / element.area - bendingMoment * element.yPlus / element.inertiaZ
    });
  }
  return { localDisplacements: local, nodeActions, diagram };
}

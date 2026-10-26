import { describe, expect, it } from "vitest";
import { exampleProject } from "../examples/exampleProject";
import { analyzeProject, solveLinearStatic } from "./solve";
import type { AnalysisInput, AnalysisSuccess } from "./types";

const REL = 1e-9;

function expectNear(actual: number, expected: number, absoluteTolerance: number, relativeTolerance = REL): void {
  const allowed = Math.max(absoluteTolerance, Math.abs(expected) * relativeTolerance);
  expect(Math.abs(actual - expected), `${actual} ≈ ${expected}, допуск ${allowed}`).toBeLessThanOrEqual(allowed);
}

function success(result: ReturnType<typeof solveLinearStatic>): AnalysisSuccess {
  expect(result.ok, result.ok ? undefined : result.diagnostics.map((item) => item.message).join("; ")).toBe(true);
  if (!result.ok) throw new Error("Ожидался успешный расчёт.");
  return result;
}

function baseInput(): AnalysisInput {
  return { nodes: [], elements: [], supports: [], nodalLoads: [], uniformLoads: [], singularityTolerance: 1e-12 };
}

describe("линейная статика: аналитические эталоны", () => {
  it("осевое растяжение: u=PL/(EA), N=P", () => {
    const E = 200e9;
    const A = 0.01;
    const L = 2;
    const P = 100e3;
    const input = baseInput();
    input.nodes = [{ id: "i", x: 0, y: 0 }, { id: "j", x: L, y: 0 }];
    input.elements = [{ id: "e", nodeI: "i", nodeJ: "j", elasticModulus: E, area: A, inertiaZ: 1e-4, yMinus: 0.1, yPlus: 0.1, releases: { rotationI: false, rotationJ: false } }];
    input.supports = [{ nodeId: "i", ux: true, uy: true, rz: true }, { nodeId: "j", ux: false, uy: true, rz: true }];
    input.nodalLoads = [{ nodeId: "j", fx: P, fy: 0, mz: 0 }];

    const result = success(solveLinearStatic(input));
    expectNear(result.displacements[1]!.ux, P * L / (E * A), 1e-14);
    expectNear(result.reactions[0]!.fx, -P, 1e-7);
    expectNear(result.elements[0]!.diagram[10]!.axialForce, P, 1e-7);
  });

  it("консоль с силой на конце: v=-PL³/(3EI), theta=-PL²/(2EI)", () => {
    const E = 210e9;
    const I = 8e-6;
    const L = 3;
    const P = 1_000;
    const input = baseInput();
    input.nodes = [{ id: "i", x: 0, y: 0 }, { id: "j", x: L, y: 0 }];
    input.elements = [{ id: "e", nodeI: "i", nodeJ: "j", elasticModulus: E, area: 0.02, inertiaZ: I, yMinus: 0.1, yPlus: 0.1, releases: { rotationI: false, rotationJ: false } }];
    input.supports = [{ nodeId: "i", ux: true, uy: true, rz: true }];
    input.nodalLoads = [{ nodeId: "j", fx: 0, fy: -P, mz: 0 }];

    const result = success(solveLinearStatic(input));
    expectNear(result.displacements[1]!.uy, -P * L ** 3 / (3 * E * I), 1e-12);
    expectNear(result.displacements[1]!.rz, -P * L ** 2 / (2 * E * I), 1e-12);
    expectNear(result.reactions[0]!.fy, P, 1e-8);
    expectNear(result.reactions[0]!.mz, P * L, 1e-8);
    expectNear(result.elements[0]!.diagram[0]!.bendingMoment, -P * L, 1e-8);
  });

  it("шарнирно опёртая балка с равномерной нагрузкой: R=wL/2, Mmid=wL²/8", () => {
    const E = 200e9;
    const I = 5e-5;
    const L = 6;
    const w = 2_000;
    const input = baseInput();
    input.nodes = [{ id: "i", x: 0, y: 0 }, { id: "j", x: L, y: 0 }];
    input.elements = [{ id: "e", nodeI: "i", nodeJ: "j", elasticModulus: E, area: 0.02, inertiaZ: I, yMinus: 0.12, yPlus: 0.12, releases: { rotationI: true, rotationJ: true } }];
    input.supports = [{ nodeId: "i", ux: true, uy: true, rz: false }, { nodeId: "j", ux: false, uy: true, rz: false }];
    input.uniformLoads = [{ elementId: "e", qx: 0, qy: -w }];

    const result = success(solveLinearStatic(input));
    expectNear(result.reactions[0]!.fy, w * L / 2, 1e-8);
    expectNear(result.reactions[1]!.fy, w * L / 2, 1e-8);
    expectNear(result.elements[0]!.diagram[0]!.bendingMoment, 0, 1e-8);
    expectNear(result.elements[0]!.diagram[10]!.bendingMoment, w * L ** 2 / 8, 1e-8);
    expectNear(result.elements[0]!.diagram[20]!.bendingMoment, 0, 1e-8);
    expectNear(result.elements[0]!.localNodeActions[2], 0, 1e-8);
    expectNear(result.elements[0]!.localNodeActions[5], 0, 1e-8);
    expectNear(result.elements[0]!.diagram[0]!.transverseDisplacement, 0, 1e-12);
    expectNear(result.elements[0]!.diagram[10]!.transverseDisplacement, -5 * w * L ** 4 / (384 * E * I), 1e-12);
    expectNear(result.elements[0]!.diagram[20]!.transverseDisplacement, 0, 1e-12);
  });

  it("консоль с равномерной нагрузкой: прогиб свободного конца v=-wL⁴/(8EI)", () => {
    const E = 210e9;
    const I = 8e-6;
    const L = 3;
    const w = 1_000;
    const input = baseInput();
    input.nodes = [{ id: "i", x: 0, y: 0 }, { id: "j", x: L, y: 0 }];
    input.elements = [{ id: "e", nodeI: "i", nodeJ: "j", elasticModulus: E, area: 0.02, inertiaZ: I, yMinus: 0.1, yPlus: 0.1, releases: { rotationI: false, rotationJ: false } }];
    input.supports = [{ nodeId: "i", ux: true, uy: true, rz: true }];
    input.uniformLoads = [{ elementId: "e", qx: 0, qy: -w }];

    const result = success(solveLinearStatic(input));
    expectNear(result.elements[0]!.diagram[0]!.transverseDisplacement, 0, 1e-12);
    expectNear(result.elements[0]!.diagram[20]!.transverseDisplacement, -w * L ** 4 / (8 * E * I), 1e-12);
    expectNear(result.elements[0]!.diagram[20]!.transverseDisplacement, result.displacements[1]!.uy, 1e-12);
  });

  it("наклонный элемент: осевое перемещение корректно преобразуется в X/Y", () => {
    const E = 70e9;
    const A = 0.005;
    const L = 5;
    const c = 3 / 5;
    const s = 4 / 5;
    const P = 50e3;
    const delta = P * L / (E * A);
    const input = baseInput();
    input.nodes = [{ id: "i", x: 0, y: 0 }, { id: "j", x: 3, y: 4 }];
    input.elements = [{ id: "e", nodeI: "i", nodeJ: "j", elasticModulus: E, area: A, inertiaZ: 2e-4, yMinus: 0.1, yPlus: 0.1, releases: { rotationI: false, rotationJ: false } }];
    input.supports = [{ nodeId: "i", ux: true, uy: true, rz: true }];
    input.nodalLoads = [{ nodeId: "j", fx: P * c, fy: P * s, mz: 0 }];

    const result = success(solveLinearStatic(input));
    expectNear(result.displacements[1]!.ux, delta * c, 1e-13);
    expectNear(result.displacements[1]!.uy, delta * s, 1e-13);
    expectNear(result.displacements[1]!.rz, 0, 1e-13);
    expectNear(result.reactions[0]!.fx, -P * c, 1e-7);
    expectNear(result.reactions[0]!.fy, -P * s, 1e-7);
  });

  it("глобальные реакции замыкают силы и момент для портальной рамы", () => {
    const result = analyzeProject(structuredClone(exampleProject));
    expect(result.ok, result.ok ? undefined : result.diagnostics.map((item) => item.message).join("; ")).toBe(true);
    if (!result.ok) return;
    expectNear(result.equilibrium.forceXResidual, 0, 1e-6);
    expectNear(result.equilibrium.forceYResidual, 0, 1e-6);
    expectNear(result.equilibrium.momentZResidual, 0, 1e-5);
    expect(result.equilibrium.relativeResidual).toBeLessThan(1e-10);
  });

  it("отвергает заведомо неустойчивую свободную конструкцию", () => {
    const input = baseInput();
    input.nodes = [{ id: "i", x: 0, y: 0 }, { id: "j", x: 2, y: 0 }];
    input.elements = [{ id: "e", nodeI: "i", nodeJ: "j", elasticModulus: 200e9, area: 0.01, inertiaZ: 1e-4, yMinus: 0.1, yPlus: 0.1, releases: { rotationI: false, rotationJ: false } }];
    input.nodalLoads = [{ nodeId: "j", fx: 1_000, fy: 0, mz: 0 }];

    const result = solveLinearStatic(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics.some((item) => item.code === "MECHANISM_OR_SINGULAR")).toBe(true);
  });
});

import type { EndReleases, EntityId } from "../model";

export const SOLVER_VERSION = "linear-static-eb-1.0.0" as const;

export interface AnalysisNode {
  id: EntityId;
  x: number;
  y: number;
}

export interface AnalysisElement {
  id: EntityId;
  nodeI: EntityId;
  nodeJ: EntityId;
  elasticModulus: number;
  area: number;
  inertiaZ: number;
  yMinus: number;
  yPlus: number;
  releases: EndReleases;
}

export interface AnalysisSupport {
  nodeId: EntityId;
  ux: boolean;
  uy: boolean;
  rz: boolean;
}

export interface AnalysisNodalLoad {
  nodeId: EntityId;
  fx: number;
  fy: number;
  mz: number;
}

export interface AnalysisUniformLoad {
  elementId: EntityId;
  qx: number;
  qy: number;
}

export interface AnalysisInput {
  nodes: AnalysisNode[];
  elements: AnalysisElement[];
  supports: AnalysisSupport[];
  nodalLoads: AnalysisNodalLoad[];
  uniformLoads: AnalysisUniformLoad[];
  singularityTolerance: number;
}

export type SolverDiagnosticCode =
  | "MODEL_INVALID"
  | "MECHANISM_OR_SINGULAR"
  | "INACTIVE_DOF_LOADED"
  | "NUMERICAL_FAILURE";

export interface SolverDiagnostic {
  code: SolverDiagnosticCode;
  message: string;
  nodeId?: EntityId;
  dof?: "ux" | "uy" | "rz";
}

export interface NodeDisplacement {
  nodeId: EntityId;
  ux: number;
  uy: number;
  rz: number;
}

export interface NodeReaction {
  nodeId: EntityId;
  fx: number;
  fy: number;
  mz: number;
}

export interface DiagramPoint {
  x: number;
  axialDisplacement: number;
  transverseDisplacement: number;
  axialForce: number;
  shearForce: number;
  bendingMoment: number;
  stressLower: number;
  stressUpper: number;
}

export interface ElementAnalysisResult {
  elementId: EntityId;
  length: number;
  /** [u_i,v_i,theta_i,u_j,v_j,theta_j], including recovered released rotations. */
  localDisplacements: [number, number, number, number, number, number];
  /** Actions applied by nodes to the element. */
  localNodeActions: [number, number, number, number, number, number];
  /** Opposite actions applied by the element to nodes, per docs/spec.md. */
  localEndForces: [number, number, number, number, number, number];
  diagram: DiagramPoint[];
}

export interface EquilibriumCheck {
  forceXResidual: number;
  forceYResidual: number;
  momentZResidual: number;
  relativeResidual: number;
}

export interface AnalysisSuccess {
  ok: true;
  solverVersion: typeof SOLVER_VERSION;
  displacements: NodeDisplacement[];
  reactions: NodeReaction[];
  elements: ElementAnalysisResult[];
  equilibrium: EquilibriumCheck;
}

export interface AnalysisFailure {
  ok: false;
  solverVersion: typeof SOLVER_VERSION;
  diagnostics: SolverDiagnostic[];
}

export type AnalysisResult = AnalysisSuccess | AnalysisFailure;

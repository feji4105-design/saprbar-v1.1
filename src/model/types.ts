import type {SectionGeometry} from "../sections/types";
export const PROJECT_SCHEMA_VERSION = "1.0.0" as const;
export const APP_VERSION = "0.1.0" as const;

export type EntityId = string;

export interface ProjectMetadata {
  /** Optional provenance for a user-requested strength sizing; absent in older projects. */
  areaSizing?: {modelSnapshot:string;minimumBaseArea:number;tensionMPa:number;compressionMPa:number};
  id: EntityId;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface DisplayUnits {
  length: "m" | "mm";
  force: "N" | "kN";
  stress: "Pa" | "MPa";
  angle: "rad" | "deg";
}

export interface Node2D {
  id: EntityId;
  number: number;
  x: number;
  y: number;
}

export interface Material {
  id: EntityId;
  name: string;
  /** Модуль Юнга, Pa. */
  elasticModulus: number;
}

export type SectionSource =
  | { kind: "general" }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "circular"; diameter: number; innerDiameter: number };

export interface Section {
  calculator?: {geometry:SectionGeometry;axisAngle:number;principalPlaneConfirmed:boolean};
  id: EntityId;
  name: string;
  /** Площадь, m². */
  area: number;
  /** Момент инерции площади относительно локальной z, m⁴. */
  inertiaZ: number;
  /** Положительное расстояние до волокна y < 0, m. */
  yMinus: number;
  /** Положительное расстояние до волокна y > 0, m. */
  yPlus: number;
  source: SectionSource;
}

export interface EndReleases {
  rotationI: boolean;
  rotationJ: boolean;
}

export interface FrameElement2D {
  id: EntityId;
  number: number;
  nodeI: EntityId;
  nodeJ: EntityId;
  materialId: EntityId;
  sectionId: EntityId;
  releases: EndReleases;
}

export interface Support {
  nodeId: EntityId;
  ux: boolean;
  uy: boolean;
  rz: boolean;
}

export interface NodalLoad {
  id: EntityId;
  nodeId: EntityId;
  /** Глобальная сила по X, N. */
  fx: number;
  /** Глобальная сила по Y, N. */
  fy: number;
  /** Глобальный момент вокруг Z, N·m. */
  mz: number;
}

export interface UniformElementLoad {
  id: EntityId;
  elementId: EntityId;
  type: "uniform-local";
  /** Равномерная нагрузка по локальной x, N/m. */
  qx: number;
  /** Равномерная нагрузка по локальной y, N/m. */
  qy: number;
}

export interface LinearStaticLoadCase {
  id: EntityId;
  name: string;
  type: "linear-static";
  nodalLoads: NodalLoad[];
  elementLoads: UniformElementLoad[];
}

export interface Model2D {
  nodes: Node2D[];
  materials: Material[];
  sections: Section[];
  elements: FrameElement2D[];
  supports: Support[];
}

export interface AnalysisSettings {
  analysisType: "linear-static";
  activeLoadCaseId: EntityId;
  solverVersion: null;
  singularityTolerance: number;
}

export interface LegacyImportInfo {
  source: "SAPR-BAR-documented-structure";
  parserVersion: string;
  cnFile: string;
  ldFile: string;
  mdFile: string;
  variant: "B" | "R";
  unitSystem: "SI" | "mm-kN-MPa";
  importedAt: string;
  warnings: string[];
  calculationBlockedReasons: string[];
  compatibility: "parser-validated-not-original-verified";
  /** Исходный текст сохраняется без изменений, чтобы неподдерживаемые записи не терялись. */
  originalFiles: { cn: string; ld: string; md: string };
}

/** Explicit export-only properties; do not enter the solver. SI except allowable stresses in MPa. */
export interface LegacyExportSettings {
  profile: "B-SI-linear-static-v1";
  basename: string;
  density: number;
  thermalExpansion: number;
  tensionMPa: number;
  compressionMPa: number;
}

export interface Project {
  legacyExport?: LegacyExportSettings;
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  appVersion: string;
  metadata: ProjectMetadata;
  displayUnits: DisplayUnits;
  model: Model2D;
  loadCases: LinearStaticLoadCase[];
  analysisSettings: AnalysisSettings;
  legacyImport?: LegacyImportInfo;
}

export type DiagnosticSeverity = "error" | "warning";

export interface ValidationDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  diagnostics: ValidationDiagnostic[];
}

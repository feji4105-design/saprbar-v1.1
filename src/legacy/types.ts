import type { Project } from "../model";

export type LegacyVariant = "B" | "R";
export type LegacyUnitSystem = "SI" | "mm-kN-MPa";

export interface LegacyInputFile { name: string; text: string }
export interface LegacyImportOptions { variant: LegacyVariant; unitSystem: LegacyUnitSystem }
export interface LegacyIssue {
  severity: "error" | "warning";
  file: "CN" | "LD" | "MD";
  line: number;
  field: string;
  message: string;
}
export interface LegacyImportReport {
  files: { cn: string; ld: string; md: string };
  variant: LegacyVariant;
  unitSystem: LegacyUnitSystem;
  counts: { nodes: number; elements: number; propertyTypes: number; supports: number; nodalLoads: number; elementLoads: number };
  assumptions: string[];
  warnings: LegacyIssue[];
  blockers: LegacyIssue[];
  compatibilityStatement: string;
}
export interface LegacyImportSuccess { ok: true; project: Project; report: LegacyImportReport }
export interface LegacyImportFailure { ok: false; issues: LegacyIssue[] }
export type LegacyImportResult = LegacyImportSuccess | LegacyImportFailure;

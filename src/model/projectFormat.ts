import {assertSectionGeometry} from "../sections/calculate";
import { PROJECT_SCHEMA_VERSION, type Project, type ValidationDiagnostic } from "./types";
import { validateProject } from "./validation";

export class ProjectFormatError extends Error {
  constructor(
    message: string,
    public readonly diagnostics: ValidationDiagnostic[] = []
  ) {
    super(message);
    this.name = "ProjectFormatError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new ProjectFormatError(`${path}: ожидался объект.`);
}

function requireArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new ProjectFormatError(`${path}: ожидался массив.`);
}

function requireString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") throw new ProjectFormatError(`${path}: ожидалась строка.`);
}

function requireNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ProjectFormatError(`${path}: ожидалось конечное число.`);
}

function requireBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== "boolean") throw new ProjectFormatError(`${path}: ожидалось логическое значение.`);
}

function validateShape(data: unknown): asserts data is Project {
  requireRecord(data, "project");
  requireString(data.schemaVersion, "schemaVersion");
  if (data.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new ProjectFormatError(`Несовместимая версия проекта «${data.schemaVersion}». Поддерживается ${PROJECT_SCHEMA_VERSION}.`);
  }
  requireString(data.appVersion, "appVersion");

  requireRecord(data.metadata, "metadata");
  for (const key of ["id", "title", "description", "createdAt", "updatedAt"] as const) requireString(data.metadata[key], `metadata.${key}`);

  if(data.metadata.areaSizing!==undefined){
    const sizing=data.metadata.areaSizing;requireRecord(sizing,"metadata.areaSizing");requireString(sizing.modelSnapshot,"metadata.areaSizing.modelSnapshot");
    for(const key of ["minimumBaseArea","tensionMPa","compressionMPa"] as const){requireNumber(sizing[key],`metadata.areaSizing.${key}`);if(sizing[key]<=0)throw new ProjectFormatError(`metadata.areaSizing.${key}: нужно положительное значение.`);}
  }

  requireRecord(data.displayUnits, "displayUnits");
  for (const key of ["length", "force", "stress", "angle"] as const) requireString(data.displayUnits[key], `displayUnits.${key}`);
  if (!(["m", "mm"] as unknown[]).includes(data.displayUnits.length)) throw new ProjectFormatError("displayUnits.length: неподдерживаемая единица.");
  if (!(["N", "kN"] as unknown[]).includes(data.displayUnits.force)) throw new ProjectFormatError("displayUnits.force: неподдерживаемая единица.");
  if (!(["Pa", "MPa"] as unknown[]).includes(data.displayUnits.stress)) throw new ProjectFormatError("displayUnits.stress: неподдерживаемая единица.");
  if (!(["rad", "deg"] as unknown[]).includes(data.displayUnits.angle)) throw new ProjectFormatError("displayUnits.angle: неподдерживаемая единица.");

  requireRecord(data.model, "model");
  const nodes = data.model.nodes;
  const materials = data.model.materials;
  const sections = data.model.sections;
  const elements = data.model.elements;
  const supports = data.model.supports;
  requireArray(nodes, "model.nodes");
  requireArray(materials, "model.materials");
  requireArray(sections, "model.sections");
  requireArray(elements, "model.elements");
  requireArray(supports, "model.supports");

  nodes.forEach((value, index) => {
    requireRecord(value, `model.nodes[${index}]`);
    requireString(value.id, `model.nodes[${index}].id`);
    requireNumber(value.number, `model.nodes[${index}].number`);
    requireNumber(value.x, `model.nodes[${index}].x`);
    requireNumber(value.y, `model.nodes[${index}].y`);
  });
  materials.forEach((value, index) => {
    requireRecord(value, `model.materials[${index}]`);
    requireString(value.id, `model.materials[${index}].id`);
    requireString(value.name, `model.materials[${index}].name`);
    requireNumber(value.elasticModulus, `model.materials[${index}].elasticModulus`);
  });
  sections.forEach((value, index) => {
    requireRecord(value, `model.sections[${index}]`);
    requireString(value.id, `model.sections[${index}].id`);
    requireString(value.name, `model.sections[${index}].name`);
    for (const key of ["area", "inertiaZ", "yMinus", "yPlus"] as const) requireNumber(value[key], `model.sections[${index}].${key}`);
    if(value.calculator!==undefined){
      requireRecord(value.calculator,`model.sections[${index}].calculator`);
      requireNumber(value.calculator.axisAngle,`model.sections[${index}].calculator.axisAngle`);
      requireBoolean(value.calculator.principalPlaneConfirmed,`model.sections[${index}].calculator.principalPlaneConfirmed`);
      try{assertSectionGeometry(value.calculator.geometry);}catch(e){throw new ProjectFormatError(e instanceof Error?e.message:'Некорректная геометрия сечения.');}
    }
    requireRecord(value.source, `model.sections[${index}].source`);
    requireString(value.source.kind, `model.sections[${index}].source.kind`);
    if (value.source.kind === "rectangle") {
      requireNumber(value.source.width, `model.sections[${index}].source.width`);
      requireNumber(value.source.height, `model.sections[${index}].source.height`);
    } else if (value.source.kind === "circular") {
      requireNumber(value.source.diameter, `model.sections[${index}].source.diameter`);
      requireNumber(value.source.innerDiameter, `model.sections[${index}].source.innerDiameter`);
    } else if (value.source.kind !== "general") {
      throw new ProjectFormatError(`model.sections[${index}].source.kind: неподдерживаемый вид сечения.`);
    }
  });
  elements.forEach((value, index) => {
    requireRecord(value, `model.elements[${index}]`);
    for (const key of ["id", "nodeI", "nodeJ", "materialId", "sectionId"] as const) requireString(value[key], `model.elements[${index}].${key}`);
    requireNumber(value.number, `model.elements[${index}].number`);
    requireRecord(value.releases, `model.elements[${index}].releases`);
    requireBoolean(value.releases.rotationI, `model.elements[${index}].releases.rotationI`);
    requireBoolean(value.releases.rotationJ, `model.elements[${index}].releases.rotationJ`);
  });
  supports.forEach((value, index) => {
    requireRecord(value, `model.supports[${index}]`);
    requireString(value.nodeId, `model.supports[${index}].nodeId`);
    for (const key of ["ux", "uy", "rz"] as const) requireBoolean(value[key], `model.supports[${index}].${key}`);
  });

  requireArray(data.loadCases, "loadCases");
  data.loadCases.forEach((value, caseIndex) => {
    requireRecord(value, `loadCases[${caseIndex}]`);
    requireString(value.id, `loadCases[${caseIndex}].id`);
    requireString(value.name, `loadCases[${caseIndex}].name`);
    requireString(value.type, `loadCases[${caseIndex}].type`);
    requireArray(value.nodalLoads, `loadCases[${caseIndex}].nodalLoads`);
    requireArray(value.elementLoads, `loadCases[${caseIndex}].elementLoads`);
    value.nodalLoads.forEach((load, index) => {
      requireRecord(load, `loadCases[${caseIndex}].nodalLoads[${index}]`);
      requireString(load.id, `loadCases[${caseIndex}].nodalLoads[${index}].id`);
      requireString(load.nodeId, `loadCases[${caseIndex}].nodalLoads[${index}].nodeId`);
      for (const key of ["fx", "fy", "mz"] as const) requireNumber(load[key], `loadCases[${caseIndex}].nodalLoads[${index}].${key}`);
    });
    value.elementLoads.forEach((load, index) => {
      requireRecord(load, `loadCases[${caseIndex}].elementLoads[${index}]`);
      requireString(load.id, `loadCases[${caseIndex}].elementLoads[${index}].id`);
      requireString(load.elementId, `loadCases[${caseIndex}].elementLoads[${index}].elementId`);
      requireString(load.type, `loadCases[${caseIndex}].elementLoads[${index}].type`);
      requireNumber(load.qx, `loadCases[${caseIndex}].elementLoads[${index}].qx`);
      requireNumber(load.qy, `loadCases[${caseIndex}].elementLoads[${index}].qy`);
    });
  });

  requireRecord(data.analysisSettings, "analysisSettings");
  requireString(data.analysisSettings.analysisType, "analysisSettings.analysisType");
  requireString(data.analysisSettings.activeLoadCaseId, "analysisSettings.activeLoadCaseId");
  if (data.analysisSettings.solverVersion !== null) throw new ProjectFormatError("analysisSettings.solverVersion: в текущей версии ожидалось null.");
  requireNumber(data.analysisSettings.singularityTolerance, "analysisSettings.singularityTolerance");

  if (data.legacyExport !== undefined) {
    requireRecord(data.legacyExport, "legacyExport");
    requireString(data.legacyExport.profile, "legacyExport.profile");
    requireString(data.legacyExport.basename, "legacyExport.basename");
    for (const key of ["density", "thermalExpansion", "tensionMPa", "compressionMPa"] as const) requireNumber(data.legacyExport[key], `legacyExport.${key}`);
  }
  if (data.legacyImport !== undefined) {
    requireRecord(data.legacyImport, "legacyImport");
    for (const key of ["source", "parserVersion", "cnFile", "ldFile", "mdFile", "variant", "unitSystem", "importedAt", "compatibility"] as const) requireString(data.legacyImport[key], `legacyImport.${key}`);
    requireArray(data.legacyImport.warnings, "legacyImport.warnings");
    requireArray(data.legacyImport.calculationBlockedReasons, "legacyImport.calculationBlockedReasons");
    data.legacyImport.warnings.forEach((value, index) => requireString(value, `legacyImport.warnings[${index}]`));
    data.legacyImport.calculationBlockedReasons.forEach((value, index) => requireString(value, `legacyImport.calculationBlockedReasons[${index}]`));
    if (data.legacyImport.source !== "SAPR-BAR-documented-structure" || data.legacyImport.compatibility !== "parser-validated-not-original-verified") throw new ProjectFormatError("legacyImport: неподдерживаемое происхождение legacy-данных.");
    if (!["B", "R"].includes(data.legacyImport.variant as string)) throw new ProjectFormatError("legacyImport.variant: ожидался B или R.");
    if (!["SI", "mm-kN-MPa"].includes(data.legacyImport.unitSystem as string)) throw new ProjectFormatError("legacyImport.unitSystem: неподдерживаемая система единиц.");
    requireRecord(data.legacyImport.originalFiles, "legacyImport.originalFiles");
    for (const key of ["cn", "ld", "md"] as const) requireString(data.legacyImport.originalFiles[key], `legacyImport.originalFiles.${key}`);
  }
}

export function decodeProject(data: unknown): Project {
  validateShape(data);
  const validation = validateProject(data);
  if (!validation.valid) throw new ProjectFormatError("Проект содержит несовместимые или недопустимые данные.", validation.diagnostics);
  return structuredClone(data);
}

export function parseProjectJson(source: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(source) as unknown;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "неизвестная ошибка";
    throw new ProjectFormatError(`Некорректный JSON: ${detail}`);
  }
  return decodeProject(data);
}

export function serializeProject(project: Project): string {
  const validation = validateProject(project);
  if (!validation.valid) throw new ProjectFormatError("Нельзя сохранить проект с ошибками.", validation.diagnostics);
  return `${JSON.stringify(project, null, 2)}\n`;
}

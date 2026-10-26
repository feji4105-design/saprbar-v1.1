import {verifyCalculatedSection} from "../sections/projectSection";
import type {
  FrameElement2D,
  Project,
  Section,
  ValidationDiagnostic,
  ValidationResult
} from "./types";
import { PROJECT_SCHEMA_VERSION } from "./types";

const MIN_ELEMENT_LENGTH_METERS = 1e-9;

function error(code: string, path: string, message: string): ValidationDiagnostic {
  return { code, severity: "error", path, message };
}

function warning(code: string, path: string, message: string): ValidationDiagnostic {
  return { code, severity: "warning", path, message };
}

function finitePositive(
  diagnostics: ValidationDiagnostic[],
  value: number,
  path: string,
  label: string
): void {
  if (!Number.isFinite(value)) {
    diagnostics.push(error("NUMBER_NOT_FINITE", path, `${label}: требуется конечное число.`));
  } else if (value <= 0) {
    diagnostics.push(error("NUMBER_NOT_POSITIVE", path, `${label}: значение должно быть больше нуля.`));
  }
}

function finite(
  diagnostics: ValidationDiagnostic[],
  value: number,
  path: string,
  label: string
): void {
  if (!Number.isFinite(value)) {
    diagnostics.push(error("NUMBER_NOT_FINITE", path, `${label}: требуется конечное число.`));
  }
}

function validateUnique<T>(
  items: readonly T[],
  key: (item: T) => string | number,
  path: string,
  label: string,
  diagnostics: ValidationDiagnostic[]
): void {
  const seen = new Set<string | number>();
  items.forEach((item, index) => {
    const value = key(item);
    if (seen.has(value)) {
      diagnostics.push(error("DUPLICATE_VALUE", `${path}[${index}]`, `${label} «${value}» повторяется.`));
    }
    seen.add(value);
  });
}

function validateSection(section: Section, index: number, diagnostics: ValidationDiagnostic[]): void {
  const base = `model.sections[${index}]`;
  if(section.calculator){try{verifyCalculatedSection(section);}catch(e){diagnostics.push(error("SECTION_GEOMETRY_INVALID",base,e instanceof Error?e.message:"Геометрия сечения неверна."));}}
  finitePositive(diagnostics, section.area, `${base}.area`, "Площадь сечения");
  finitePositive(diagnostics, section.inertiaZ, `${base}.inertiaZ`, "Момент инерции сечения");
  finitePositive(diagnostics, section.yMinus, `${base}.yMinus`, "Расстояние y−");
  finitePositive(diagnostics, section.yPlus, `${base}.yPlus`, "Расстояние y+");

  if (section.source.kind === "rectangle") {
    finitePositive(diagnostics, section.source.width, `${base}.source.width`, "Ширина прямоугольника");
    finitePositive(diagnostics, section.source.height, `${base}.source.height`, "Высота прямоугольника");
  }
  if (section.source.kind === "circular") {
    finitePositive(diagnostics, section.source.diameter, `${base}.source.diameter`, "Наружный диаметр");
    finite(diagnostics, section.source.innerDiameter, `${base}.source.innerDiameter`, "Внутренний диаметр");
    if (Number.isFinite(section.source.innerDiameter) && section.source.innerDiameter < 0) {
      diagnostics.push(error("SECTION_INNER_DIAMETER_NEGATIVE", `${base}.source.innerDiameter`, "Внутренний диаметр не может быть отрицательным."));
    }
    if (section.source.innerDiameter >= section.source.diameter) {
      diagnostics.push(error("SECTION_DIAMETERS_INCOMPATIBLE", `${base}.source`, "Внутренний диаметр должен быть меньше наружного."));
    }
  }
}

function validateElementLength(
  element: FrameElement2D,
  index: number,
  nodeById: ReadonlyMap<string, { x: number; y: number }>,
  diagnostics: ValidationDiagnostic[]
): void {
  const nodeI = nodeById.get(element.nodeI);
  const nodeJ = nodeById.get(element.nodeJ);
  if (!nodeI || !nodeJ) return;
  const length = Math.hypot(nodeJ.x - nodeI.x, nodeJ.y - nodeI.y);
  if (!Number.isFinite(length) || length <= MIN_ELEMENT_LENGTH_METERS) {
    diagnostics.push(error(
      "ELEMENT_ZERO_LENGTH",
      `model.elements[${index}]`,
      `Стержень №${element.number} имеет нулевую или слишком малую длину.`
    ));
  }
}

export function validateProject(project: Project): ValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];

  if (project.legacyExport) {
    const settings=project.legacyExport;
    if(settings.profile!=="B-SI-linear-static-v1") diagnostics.push(error("EXPORT_PROFILE_UNSUPPORTED","legacyExport.profile","Неизвестный профиль экспорта."));
    if(!/^[A-Za-z0-9_]{1,8}$/.test(settings.basename)||/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(settings.basename)) diagnostics.push(error("EXPORT_NAME_INVALID","legacyExport.basename","Нужно допустимое DOS-имя из 1–8 латинских букв, цифр или _."));
    for(const key of ["density","thermalExpansion","tensionMPa","compressionMPa"] as const) finitePositive(diagnostics,settings[key],`legacyExport.${key}`,key);
    if(!Number.isFinite(settings.tensionMPa*1e6)||!Number.isFinite(settings.compressionMPa*1e6)) diagnostics.push(error("EXPORT_STRESS_OVERFLOW","legacyExport","Допускаемое напряжение не представимо в Па."));
  }
  if (project.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    diagnostics.push(error("SCHEMA_VERSION_UNSUPPORTED", "schemaVersion", `Поддерживается схема ${PROJECT_SCHEMA_VERSION}, получена ${project.schemaVersion}.`));
  }
  if (project.analysisSettings.analysisType !== "linear-static") {
    diagnostics.push(error("ANALYSIS_TYPE_UNSUPPORTED", "analysisSettings.analysisType", "Поддерживается только линейная статическая постановка."));
  }
  if (project.analysisSettings.solverVersion !== null) {
    diagnostics.push(error("SOLVER_VERSION_INCOMPATIBLE", "analysisSettings.solverVersion", "Версия решателя не хранится во входных параметрах проекта; solverVersion должен быть null."));
  }
  finitePositive(diagnostics, project.analysisSettings.singularityTolerance, "analysisSettings.singularityTolerance", "Допуск сингулярности");

  validateUnique(project.model.nodes, (item) => item.id, "model.nodes", "ID узла", diagnostics);
  validateUnique(project.model.nodes, (item) => item.number, "model.nodes", "Номер узла", diagnostics);
  validateUnique(project.model.materials, (item) => item.id, "model.materials", "ID материала", diagnostics);
  validateUnique(project.model.sections, (item) => item.id, "model.sections", "ID сечения", diagnostics);
  validateUnique(project.model.elements, (item) => item.id, "model.elements", "ID стержня", diagnostics);
  validateUnique(project.model.elements, (item) => item.number, "model.elements", "Номер стержня", diagnostics);
  validateUnique(project.model.supports, (item) => item.nodeId, "model.supports", "Закрепление узла", diagnostics);
  validateUnique(project.loadCases, (item) => item.id, "loadCases", "ID загружения", diagnostics);

  const nodeById = new Map(project.model.nodes.map((node) => [node.id, node]));
  const materialIds = new Set(project.model.materials.map((material) => material.id));
  const sectionIds = new Set(project.model.sections.map((section) => section.id));
  const elementIds = new Set(project.model.elements.map((element) => element.id));
  const loadCaseIds = new Set(project.loadCases.map((loadCase) => loadCase.id));

  project.model.nodes.forEach((node, index) => {
    finite(diagnostics, node.x, `model.nodes[${index}].x`, "Координата X");
    finite(diagnostics, node.y, `model.nodes[${index}].y`, "Координата Y");
    if (!Number.isInteger(node.number) || node.number <= 0) {
      diagnostics.push(error("NODE_NUMBER_INVALID", `model.nodes[${index}].number`, "Номер узла должен быть положительным целым числом."));
    }
  });

  project.model.materials.forEach((material, index) => {
    finitePositive(diagnostics, material.elasticModulus, `model.materials[${index}].elasticModulus`, "Модуль упругости");
  });
  project.model.sections.forEach((section, index) => validateSection(section, index, diagnostics));

  project.model.elements.forEach((element, index) => {
    const base = `model.elements[${index}]`;
    if (!nodeById.has(element.nodeI)) diagnostics.push(error("ELEMENT_NODE_NOT_FOUND", `${base}.nodeI`, `Начальный узел «${element.nodeI}» не найден.`));
    if (!nodeById.has(element.nodeJ)) diagnostics.push(error("ELEMENT_NODE_NOT_FOUND", `${base}.nodeJ`, `Конечный узел «${element.nodeJ}» не найден.`));
    if (element.nodeI === element.nodeJ) diagnostics.push(error("ELEMENT_SAME_NODE", base, "Начало и конец стержня не могут ссылаться на один узел."));
    if (!materialIds.has(element.materialId)) diagnostics.push(error("ELEMENT_MATERIAL_NOT_FOUND", `${base}.materialId`, `Материал «${element.materialId}» не найден.`));
    if (!sectionIds.has(element.sectionId)) diagnostics.push(error("ELEMENT_SECTION_NOT_FOUND", `${base}.sectionId`, `Сечение «${element.sectionId}» не найдено.`));
    if (!Number.isInteger(element.number) || element.number <= 0) diagnostics.push(error("ELEMENT_NUMBER_INVALID", `${base}.number`, "Номер стержня должен быть положительным целым числом."));
    validateElementLength(element, index, nodeById, diagnostics);
  });

  project.model.supports.forEach((support, index) => {
    if (!nodeById.has(support.nodeId)) diagnostics.push(error("SUPPORT_NODE_NOT_FOUND", `model.supports[${index}].nodeId`, `Узел опоры «${support.nodeId}» не найден.`));
    if (!support.ux && !support.uy && !support.rz) diagnostics.push(warning("SUPPORT_EMPTY", `model.supports[${index}]`, "Закрепление не ограничивает ни одной степени свободы."));
  });

  if (!loadCaseIds.has(project.analysisSettings.activeLoadCaseId)) {
    diagnostics.push(error("ACTIVE_LOAD_CASE_NOT_FOUND", "analysisSettings.activeLoadCaseId", "Активное загружение не найдено."));
  }
  if (project.loadCases.length !== 1) {
    diagnostics.push(error("LOAD_CASE_COUNT_UNSUPPORTED", "loadCases", "Первый релиз поддерживает ровно одно загружение."));
  }
  project.loadCases.forEach((loadCase, caseIndex) => {
    const base = `loadCases[${caseIndex}]`;
    if (loadCase.type !== "linear-static") diagnostics.push(error("LOAD_CASE_TYPE_UNSUPPORTED", `${base}.type`, "Поддерживается только linear-static."));
    validateUnique(loadCase.nodalLoads, (item) => item.id, `${base}.nodalLoads`, "ID узловой нагрузки", diagnostics);
    validateUnique(loadCase.elementLoads, (item) => item.id, `${base}.elementLoads`, "ID стержневой нагрузки", diagnostics);
    loadCase.nodalLoads.forEach((load, index) => {
      if (!nodeById.has(load.nodeId)) diagnostics.push(error("LOAD_NODE_NOT_FOUND", `${base}.nodalLoads[${index}].nodeId`, `Узел нагрузки «${load.nodeId}» не найден.`));
      finite(diagnostics, load.fx, `${base}.nodalLoads[${index}].fx`, "Fx");
      finite(diagnostics, load.fy, `${base}.nodalLoads[${index}].fy`, "Fy");
      finite(diagnostics, load.mz, `${base}.nodalLoads[${index}].mz`, "Mz");
    });
    loadCase.elementLoads.forEach((load, index) => {
      if (!elementIds.has(load.elementId)) diagnostics.push(error("LOAD_ELEMENT_NOT_FOUND", `${base}.elementLoads[${index}].elementId`, `Стержень нагрузки «${load.elementId}» не найден.`));
      if (load.type !== "uniform-local") diagnostics.push(error("ELEMENT_LOAD_TYPE_UNSUPPORTED", `${base}.elementLoads[${index}].type`, "Поддерживается только равномерная нагрузка в локальных осях."));
      finite(diagnostics, load.qx, `${base}.elementLoads[${index}].qx`, "qx");
      finite(diagnostics, load.qy, `${base}.elementLoads[${index}].qy`, "qy");
    });
  });

  if (project.model.nodes.length === 0) diagnostics.push(error("MODEL_EMPTY", "model.nodes", "В проекте нет узлов."));
  if (project.model.elements.length === 0) diagnostics.push(error("MODEL_NO_ELEMENTS", "model.elements", "В проекте нет стержней."));
  if (project.model.supports.length === 0) diagnostics.push(warning("MODEL_NO_SUPPORTS", "model.supports", "В проекте нет закреплений; расчётная схема, вероятно, неустойчива."));

  return { valid: !diagnostics.some((item) => item.severity === "error"), diagnostics };
}

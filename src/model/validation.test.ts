import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { exampleProject } from "../examples/exampleProject";
import { parseProjectJson, ProjectFormatError, serializeProject } from "./projectFormat";
import type { Project } from "./types";
import { validateProject } from "./validation";

const copy = (): Project => structuredClone(exampleProject);
const codes = (project: Project) => validateProject(project).diagnostics.map((item) => item.code);

describe("validateProject", () => {
  it("принимает встроенный пример", () => {
    expect(validateProject(copy())).toEqual({ valid: true, diagnostics: [] });
  });

  it("находит ссылку на несуществующий узел", () => {
    const project = copy();
    project.model.elements[0]!.nodeJ = "missing";
    expect(codes(project)).toContain("ELEMENT_NODE_NOT_FOUND");
  });

  it("находит нулевую длину элемента", () => {
    const project = copy();
    project.model.nodes[1]!.x = project.model.nodes[0]!.x;
    project.model.nodes[1]!.y = project.model.nodes[0]!.y;
    expect(codes(project)).toContain("ELEMENT_ZERO_LENGTH");
  });

  it("отклоняет недопустимый материал и сечение", () => {
    const project = copy();
    project.model.materials[0]!.elasticModulus = 0;
    project.model.sections[0]!.area = -1;
    project.model.sections[0]!.inertiaZ = Number.NaN;
    expect(codes(project)).toEqual(expect.arrayContaining(["NUMBER_NOT_POSITIVE", "NUMBER_NOT_FINITE"]));
  });

  it("проверяет несовместимые диаметры", () => {
    const project = copy();
    project.model.sections[0]!.source = { kind: "circular", diameter: 0.1, innerDiameter: 0.2 };
    expect(codes(project)).toContain("SECTION_DIAMETERS_INCOMPATIBLE");
  });

  it("отклоняет ссылку нагрузки на отсутствующий элемент", () => {
    const project = copy();
    project.loadCases[0]!.elementLoads[0]!.elementId = "missing";
    expect(codes(project)).toContain("LOAD_ELEMENT_NOT_FOUND");
  });
});

describe("project JSON", () => {
  it("читает поставляемый файловый пример", () => {
    const source = readFileSync(new URL("../../tests/fixtures/portal-frame.saprbar.json", import.meta.url), "utf8");
    expect(parseProjectJson(source)).toEqual(exampleProject);
  });

  it("выполняет round-trip без потери данных", () => {
    const project = copy();
    expect(parseProjectJson(serializeProject(project))).toEqual(project);
  });

  it("отклоняет несовместимую версию", () => {
    const raw = JSON.parse(serializeProject(copy())) as Record<string, unknown>;
    raw.schemaVersion = "2.0.0";
    expect(() => parseProjectJson(JSON.stringify(raw))).toThrow(ProjectFormatError);
  });

  it("отклоняет нечисловое значение из JSON", () => {
    const raw = JSON.parse(serializeProject(copy())) as { model: { nodes: Array<Record<string, unknown>> } };
    raw.model.nodes[0]!.x = "ноль";
    expect(() => parseProjectJson(JSON.stringify(raw))).toThrow(/конечное число/);
  });

  it("не сохраняет невалидный проект", () => {
    const project = copy();
    project.model.elements[0]!.sectionId = "missing";
    expect(() => serializeProject(project)).toThrow(ProjectFormatError);
  });
});

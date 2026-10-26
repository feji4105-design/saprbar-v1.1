import { APP_VERSION, PROJECT_SCHEMA_VERSION, type EntityId, type Project } from "../model";

export type Selection = { kind: "node" | "element"; id: EntityId } | null;

export function createEmptyProject(): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    metadata: { id: crypto.randomUUID(), title: "Новый проект", description: "", createdAt: now, updatedAt: now },
    displayUnits: { length: "m", force: "kN", stress: "MPa", angle: "deg" },
    model: {
      nodes: [],
      elements: [],
      materials: [{ id: crypto.randomUUID(), name: "Сталь", elasticModulus: 210e9 }],
      sections: [{ id: crypto.randomUUID(), name: "Сечение", area: 0.01, inertiaZ: 8.333333333e-6, yMinus: 0.05, yPlus: 0.05, source: { kind: "general" } }],
      supports: []
    },
    loadCases: [{ id: crypto.randomUUID(), name: "Основное", type: "linear-static", nodalLoads: [], elementLoads: [] }],
    analysisSettings: { analysisType: "linear-static", activeLoadCaseId: "", solverVersion: null, singularityTolerance: 1e-12 }
  } satisfies Project;
}

export function finalizeEmptyProject(project: Project): Project {
  project.analysisSettings.activeLoadCaseId = project.loadCases[0]!.id;
  return project;
}

export function nextNumber(items: ReadonlyArray<{ number: number }>): number {
  return Math.max(0, ...items.map((item) => item.number)) + 1;
}

export function removeSelection(project: Project, selection: Selection): Project {
  if (!selection) return project;
  if (selection.kind === "element") {
    project.model.elements = project.model.elements.filter((item) => item.id !== selection.id);
    project.loadCases.forEach((loadCase) => { loadCase.elementLoads = loadCase.elementLoads.filter((load) => load.elementId !== selection.id); });
    return project;
  }
  const connected = new Set(project.model.elements.filter((item) => item.nodeI === selection.id || item.nodeJ === selection.id).map((item) => item.id));
  project.model.nodes = project.model.nodes.filter((item) => item.id !== selection.id);
  project.model.elements = project.model.elements.filter((item) => !connected.has(item.id));
  project.model.supports = project.model.supports.filter((item) => item.nodeId !== selection.id);
  project.loadCases.forEach((loadCase) => {
    loadCase.nodalLoads = loadCase.nodalLoads.filter((load) => load.nodeId !== selection.id);
    loadCase.elementLoads = loadCase.elementLoads.filter((load) => !connected.has(load.elementId));
  });
  return project;
}

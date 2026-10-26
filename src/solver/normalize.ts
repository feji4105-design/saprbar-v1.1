import type { Project } from "../model";
import { validateProject } from "../model";
import type { AnalysisInput, SolverDiagnostic } from "./types";

export function createAnalysisInput(project: Project): { input?: AnalysisInput; diagnostics: SolverDiagnostic[] } {
  const validation = validateProject(project);
  if (!validation.valid) {
    return {
      diagnostics: validation.diagnostics
        .filter((item) => item.severity === "error")
        .map((item) => ({ code: "MODEL_INVALID", message: `${item.path}: ${item.message}` }))
    };
  }
  const materials = new Map(project.model.materials.map((item) => [item.id, item]));
  const sections = new Map(project.model.sections.map((item) => [item.id, item]));
  const loadCase = project.loadCases.find((item) => item.id === project.analysisSettings.activeLoadCaseId)!;
  return {
    diagnostics: [],
    input: {
      nodes: project.model.nodes.map(({ id, x, y }) => ({ id, x, y })),
      elements: project.model.elements.map((element) => {
        const material = materials.get(element.materialId)!;
        const section = sections.get(element.sectionId)!;
        return {
          id: element.id,
          nodeI: element.nodeI,
          nodeJ: element.nodeJ,
          elasticModulus: material.elasticModulus,
          area: section.area,
          inertiaZ: section.inertiaZ,
          yMinus: section.yMinus,
          yPlus: section.yPlus,
          releases: { ...element.releases }
        };
      }),
      supports: project.model.supports.map((item) => ({ ...item })),
      nodalLoads: loadCase.nodalLoads.map(({ nodeId, fx, fy, mz }) => ({ nodeId, fx, fy, mz })),
      uniformLoads: loadCase.elementLoads.map(({ elementId, qx, qy }) => ({ elementId, qx, qy })),
      singularityTolerance: project.analysisSettings.singularityTolerance
    }
  };
}

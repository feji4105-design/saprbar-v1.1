import type {Project} from '../model';
/** Exact snapshot, not rounded display text. Conservative invalidation on any calculation-data edit. */
export const sizingModelSnapshot=(project:Project)=>JSON.stringify({model:project.model,loadCases:project.loadCases,analysisSettings:project.analysisSettings});
export function hasCurrentAreaSizing(project:Project,tension:number|null,compression:number|null) {
  const record=project.metadata.areaSizing;
  return !!record && record.modelSnapshot===sizingModelSnapshot(project) && record.tensionMPa===tension && record.compressionMPa===compression;
}

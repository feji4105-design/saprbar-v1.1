import { validateProject, type Project } from "../model";
import { importLegacyFiles } from "./importLegacy";
import type { LegacyEditableSet } from "./templates";

export interface LegacyExportProperties { thermalExpansion: number; tensionMPa: number; compressionMPa: number }

/** Documented B numeric profile, SI; see docs/file-formats.md. */
export function exportLegacySI(project: Project, basename = project.legacyExport?.basename ?? "MODEL", density: number | undefined = project.legacyExport?.density, properties: LegacyExportProperties | undefined = project.legacyExport): LegacyEditableSet {
  if (density === undefined || !Number.isFinite(density) || density <= 0) throw new Error("Укажите положительную плотность Ro из задания или исходного CN, кг/м³. SAPR-BAR отклоняет Ro=0; в JSON плотности нет.");
  if (!properties || !Number.isFinite(properties.thermalExpansion) || properties.thermalExpansion <= 0) throw new Error("Укажите положительный коэффициент aT, 1/К, из задания или исходного CN. SAPR-BAR отклоняет aT=0.");
  if (![properties.tensionMPa,properties.compressionMPa].every(v=>Number.isFinite(v)&&v>0&&Number.isFinite(v*1e6))) throw new Error("Укажите положительные допускаемые напряжения Sp и Sc, МПа, из задания.");
  const validation = validateProject(project);
  if (!validation.valid) throw new Error(validation.diagnostics.filter(d => d.severity === "error").map(d => d.message).join("\n"));
  if (!/^[A-Za-z0-9_]{1,8}$/.test(basename) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(basename)) throw new Error("Имя должно содержать 1–8 латинских букв, цифр или _. ");
  if (project.loadCases.length !== 1) throw new Error("Экспорт поддерживает ровно одно загружение; остальные нельзя молча отбросить.");
  if (project.legacyImport?.calculationBlockedReasons.length) throw new Error("Экспорт заблокирован: исходный импорт содержит неподдерживаемые данные.");
  const load = project.loadCases.find(l => l.id === project.analysisSettings.activeLoadCaseId);
  if (!load) throw new Error("Активное загружение не найдено.");
  const {nodes, elements, supports, materials, sections} = project.model;
  // Row numbers are legacy identities. Sort by displayed numbers; resolve every reference by ID.
  const ns = [...nodes].sort((a,b) => a.number-b.number);
  const es = [...elements].sort((a,b) => a.number-b.number);
  const nodeIndex = new Map(ns.map((n,i) => [n.id,i+1]));
  const elementIndex = new Map(es.map((e,i) => [e.id,i+1]));
  const released = es.filter(e => e.releases.rotationI || e.releases.rotationJ);
  // One XC per element preserves arbitrary material/section combinations without deriving geometry.
  const cn: number[][] = [[ns.length,es.length,es.length,released.length,0], ...ns.map(n => [n.x,n.y]),
    ...es.map((e,i) => [nodeIndex.get(e.nodeI)!,nodeIndex.get(e.nodeJ)!,i+1]),
    ...es.map(e => {
      const m = materials.find(m => m.id === e.materialId)!;
      const s = sections.find(s => s.id === e.sectionId)!;
      // Original preprocessor rejects XC[1][6] >= 0: y− is a signed coordinate.
      return [1,m.elasticModulus,density,properties.thermalExpansion,s.area,s.inertiaZ,-s.yMinus,s.yPlus,properties.tensionMPa*1e6,properties.compressionMPa*1e6];
    }), ...released.map(e => [elementIndex.get(e.id)!,Number(e.releases.rotationI),Number(e.releases.rotationJ)])];
  const ld: number[][] = [[supports.length,load.nodalLoads.length,load.elementLoads.length,0],
    ...supports.map(s => [nodeIndex.get(s.nodeId)!,Number(s.ux),Number(s.uy),Number(s.rz),0,0,0]),
    ...load.nodalLoads.map(l => [nodeIndex.get(l.nodeId)!,l.fx,l.fy,l.mz]),
    ...load.elementLoads.map(l => [elementIndex.get(l.elementId)!,l.qx,l.qy,0,0])];
  const serialize = (rows: number[][], cnFile=false) => rows.map((row,i) => row.map((n,j) => {
    if (!Number.isFinite(n)) throw new Error("Не удалось сформировать конечное число или ссылку.");
    return cnFile && i>=1+ns.length+es.length && i<1+ns.length+2*es.length && j===3 ? n.toExponential() : String(n);
  }).join(" ")).join("\r\n") + "\r\n";
  const files: LegacyEditableSet = {
    CN: {name:`${basename}.CN`,text:serialize(cn,true)},
    LD: {name:`${basename}.LD`,text:serialize(ld)},
    MD: {name:`${basename}.MD`,text:"1e-8 1.0 1.0 1.0 0 0 0 0 9.81 0\r\n1 0 0 0 0 0 0 0 0 1\r\n"}
  };
  const check=importLegacyFiles(files.CN,files.LD,files.MD,{variant:"B",unitSystem:"SI"});
  if(!check.ok)throw new Error(`Не удалось проверить созданный комплект: ${check.issues.map(x=>x.message).join(" ")}`);
  if(check.report.blockers.length)throw new Error(`Созданный комплект не допускает поддерживаемый расчёт: ${check.report.blockers.map(x=>x.message).join(" ")}`);
  return files;
}

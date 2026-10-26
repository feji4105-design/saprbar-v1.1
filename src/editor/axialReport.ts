import type { Project, Node2D, FrameElement2D } from "../model";
import type { AnalysisSuccess } from "../solver";
import { RecordReader } from "../legacy/parser";

export interface RgrOptions {
  reportKind?: "full" | "short" | "assignment"; includeGraphics?: boolean;
  institution: string; discipline: string; student: string; group: string;
  teacher: string; city: string; year: string;
  tensionMPa: string; compressionMPa: string; displacementMM: string;
  modulusConfirmed: boolean;
}
export function initialRgrOptions(project: Project): RgrOptions {
  let tensionMPa="",compressionMPa="";
  if(project.legacyImport){
    const r=new RecordReader("CN",{name:project.legacyImport.cnFile,text:project.legacyImport.originalFiles.cn});
    const h=r.records[0]?.values;
    if(h){const xc=r.records.slice(1+h[0]!+h[1]!,1+h[0]!+h[1]!+h[2]!),o=project.legacyImport.variant==="R"?1:0;
      const sp=xc.map(x=>x.values[8+o]),sc=xc.map(x=>x.values[9+o]);
      const unit=project.legacyImport.unitSystem==="SI"?1e-6:1;
      if(sp.length&&sp.every(v=>v!==undefined&&v>0&&v===sp[0])) tensionMPa=String(sp[0]!*unit);
      if(sc.length&&sc.every(v=>v!==undefined&&v>0&&v===sc[0])) compressionMPa=String(sc[0]!*unit);
    }
  }
  if(!project.legacyImport){
    const t=project.metadata.description.match(/\[σ\]р=([\d.,]+) МПа/)?.[1],c=project.metadata.description.match(/\[σ\]сж=([\d.,]+) МПа/)?.[1];
    if(t&&positiveValue(t))tensionMPa=t; if(c&&positiveValue(c))compressionMPa=c;
  }
  return {reportKind:"full",includeGraphics:true,institution:"",discipline:"Сопротивление материалов",student:"",group:"",teacher:"",city:"",year:String(new Date().getFullYear()),tensionMPa,compressionMPa,displacementMM:"",modulusConfirmed:false};
}
export const positiveValue=(text:string):number|null=>{const value=Number(text.replace(",","."));return Number.isFinite(value)&&value>0?value:null;};

export function axialReportData(project:Project,analysis:AnalysisSuccess){
  const fail=(reason:string)=>({ok:false as const,reason});
  const loadCase=project.loadCases.find(c=>c.id===project.analysisSettings.activeLoadCaseId);
  if(!loadCase)return fail("Расчётный случай нагрузки не найден.");
  if(project.model.nodes.some(n=>!analysis.displacements.some(d=>d.nodeId===n.id))||project.model.elements.some(e=>!analysis.elements.some(r=>r.elementId===e.id)))return fail("Результаты относятся к другой модели; пересчитайте её.");
  if(loadCase.elementLoads.some(l=>l.qx!==0||l.qy!==0))return fail("Пошаговый осевой отчёт пока поддерживает узловые силы без распределённых нагрузок.");
  const supports=project.model.supports.filter(s=>s.ux||s.uy||s.rz);
  if(!supports.length)return fail("Нужна хотя бы одна опора с закреплённым осевым перемещением.");
  const adjacent=new Map<string,FrameElement2D[]>();
  project.model.elements.forEach(e=>[e.nodeI,e.nodeJ].forEach(id=>adjacent.set(id,[...(adjacent.get(id)??[]),e])));
  const endpoints=project.model.nodes.filter(n=>adjacent.get(n.id)?.length===1).sort((a,b)=>a.x-b.x||a.y-b.y);
  if(endpoints.length!==2)return fail("Нужна одна неразветвлённая цепочка стержней.");
  const origin=(supports.length===1?endpoints.find(n=>n.id===supports[0]!.nodeId):undefined)??endpoints[0]!;
  const chain:{member:FrameElement2D;start:Node2D;end:Node2D}[]=[];
  const visited=new Set<string>();let current=origin;
  while(true){const next=(adjacent.get(current.id)??[]).filter(e=>!visited.has(e.id));if(!next.length)break;
    if(next.length!==1)return fail("Разветвлённые схемы не поддерживаются пошаговым осевым отчётом.");
    const member=next[0]!,end=project.model.nodes.find(n=>n.id===(member.nodeI===current.id?member.nodeJ:member.nodeI))!;
    chain.push({member,start:current,end});visited.add(member.id);current=end;
  }
  if(visited.size!==project.model.elements.length||project.model.nodes.length!==chain.length+1)return fail("Модель должна быть одной связной цепочкой без лишних узлов.");
  const first=chain[0]!;const firstLength=Math.hypot(first.end.x-origin.x,first.end.y-origin.y);
  const tx=(first.end.x-origin.x)/firstLength,ty=(first.end.y-origin.y)/firstLength;
  const total=chain.reduce((s,c)=>s+Math.hypot(c.end.x-c.start.x,c.end.y-c.start.y),0);
  if(chain.some(c=>Math.abs((c.end.x-origin.x)*ty-(c.end.y-origin.y)*tx)>Math.max(total,1)*1e-9||(c.end.x-c.start.x)*tx+(c.end.y-c.start.y)*ty<=0))return fail("Пошаговый осевой отчёт доступен для прямой цепочки без поворотов и возвратов.");
  const forceScale=Math.max(1,...loadCase.nodalLoads.map(l=>Math.hypot(l.fx,l.fy)));
  if(loadCase.nodalLoads.some(l=>Math.abs(l.fx*ty-l.fy*tx)>forceScale*1e-9||Math.abs(l.mz)>forceScale*1e-9))return fail("Поперечные силы и моменты требуют рамного отчёта; осевые формулы к этой модели неприменимы.");
  if((Math.abs(tx)>1e-9&&supports.some(s=>!s.ux))||(Math.abs(ty)>1e-9&&supports.some(s=>!s.uy)))return fail("В опоре не закреплено осевое перемещение.");
  const displacements=new Map(analysis.displacements.map(d=>[d.nodeId,d]));
  const u=(id:string)=>{const d=displacements.get(id)!;return d.ux*tx+d.uy*ty;};
  const loads=loadCase.nodalLoads.map(l=>({nodeId:l.nodeId,force:l.fx*tx+l.fy*ty}));
  const reactions=analysis.reactions.map(r=>({nodeId:r.nodeId,force:r.fx*tx+r.fy*ty}));
  if(Math.abs([...loads,...reactions].reduce((sum,l)=>sum+l.force,0))>forceScale*1e-8)return fail("Результат не удовлетворяет равновесию актуальной модели; пересчитайте её.");
  let x=0;
  const rows=chain.map(({member,start,end},index)=>{
    const response=analysis.elements.find(e=>e.elementId===member.id)!;
    const section=project.model.sections.find(s=>s.id===member.sectionId)!;
    const material=project.model.materials.find(m=>m.id===member.materialId)!;
    const N=response.diagram[0]!.axialForce,length=response.length;
    const x0=x;x+=length;
    const rightNodes=new Set(chain.slice(index).map(c=>c.end.id));
    const rightLoads=loads.filter(l=>rightNodes.has(l.nodeId));
    const rightReactions=reactions.filter(l=>rightNodes.has(l.nodeId));
    return {member,start,end,section,material,N,length,x0,x1:x,stress:N/section.area,
      delta:N*length/(material.elasticModulus*section.area),u0:u(start.id),u1:u(end.id),rightLoads,rightReactions};
  });
  if(rows.some(r=>{
    const response=analysis.elements.find(e=>e.elementId===r.member.id)!;
    return Math.abs(r.length-Math.hypot(r.end.x-r.start.x,r.end.y-r.start.y))>Math.max(total,1)*1e-9||response.diagram.some(p=>Math.abs(p.shearForce)>forceScale*1e-8||Math.abs(p.bendingMoment)>forceScale*Math.max(total,1)*1e-8||Math.abs(p.axialForce-r.N)>forceScale*1e-8)||Math.abs(r.N-[...r.rightLoads,...r.rightReactions].reduce((s,l)=>s+l.force,0))>forceScale*1e-8;
  }))return fail("Результат не соответствует постоянному осевому усилию; осевой вывод не применён.");
  const positions=new Map([[origin.id,0],...rows.map(r=>[r.end.id,r.x1] as [string,number])]);
  const restraints=supports.map(s=>({node:project.model.nodes.find(n=>n.id===s.nodeId)!,x:positions.get(s.nodeId)!,reaction:reactions.filter(r=>r.nodeId===s.nodeId).reduce((sum,r)=>sum+r.force,0)})).sort((a,b)=>a.x-b.x);
  const compatibility=restraints.slice(1).map((end,index)=>{
    const start=restraints[index]!,segments=rows.filter(r=>r.x0>=start.x-1e-10&&r.x1<=end.x+1e-10);
    const coefficients=restraints.map(s=>segments.reduce((sum,r)=>sum+(s.x>=r.x1-1e-10?r.length/(r.material.elasticModulus*r.section.area):0),0));
    const rhs=-segments.reduce((sum,r)=>sum+r.rightLoads.reduce((f,l)=>f+l.force,0)*r.length/(r.material.elasticModulus*r.section.area),0);
    return {start,end,segments,coefficients,rhs,residual:segments.reduce((sum,r)=>sum+r.delta,0)};
  });
  if(restraints.some(s=>Math.abs(u(s.node.id))>1e-9)||rows.some(r=>Math.abs(r.u1-r.u0-r.delta)>1e-9)||compatibility.some(c=>Math.abs(c.residual)>1e-9))return fail("Результат не удовлетворяет закреплениям и совместности перемещений; пересчитайте модель.");
  const baseArea=Math.min(...rows.map(r=>r.section.area));
  const maximumDisplacement=Math.max(...analysis.displacements.map(d=>Math.abs(d.ux*tx+d.uy*ty)));
  return {ok:true as const,rows,origin,total,tx,ty,loads,reactions,restraints,compatibility,baseArea,maximumDisplacement};
}

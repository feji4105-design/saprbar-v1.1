import {sizingModelSnapshot} from "./areaSizing";
import type { Project } from "../model";
import {validateProject} from "../model";
import {analyzeProject} from "../solver";
import {createEmptyProject,finalizeEmptyProject} from "./projectActions";
import {positiveValue} from "./axialReport";

export interface TaskRow {number:number;lengthCM:string;ratio:string;areaLabel:string}
export interface TaskNode {fixed:boolean;fixedSide?:"auto"|"left"|"right";forceKN:string;direction:"none"|"left"|"right"}
export interface AxialTask {areaSizing?:{taskSnapshot:string;minimumBaseArea:number};title:string;rows:TaskRow[];nodes:TaskNode[];baseAreaMM2:string;modulusGPa:string;tensionMPa:string;compressionMPa:string;material:string}
export const emptyTaskNode=():TaskNode=>({fixed:false,fixedSide:'auto',forceKN:'0',direction:'none'});
export const newTaskRow=(number:number):TaskRow=>({number,lengthCM:'',ratio:'1',areaLabel:`A${number}`});
export const emptyAxialTask=():AxialTask=>({title:'Мой ступенчатый стержень',rows:[newTaskRow(1)],nodes:[emptyTaskNode(),emptyTaskNode()],baseAreaMM2:'',modulusGPa:'',tensionMPa:'',compressionMPa:'',material:''});
export function insertTaskRow(task:AxialTask,after:number):AxialTask{
 const at=Math.max(0,Math.min(task.rows.length,after+1)),rows=[...task.rows],nodes=[...task.nodes];
 rows.splice(at,0,newTaskRow(Math.max(0,...rows.map(r=>r.number))+1));nodes.splice(at+1,0,emptyTaskNode());
 return {...task,rows,nodes};
}
export function removeTaskRow(task:AxialTask,index:number):AxialTask{
 if(index<0||index>=task.rows.length)return task;
 const left=task.nodes[index]!,right=task.nodes[index+1]!;
 const force=(n:TaskNode)=>{if(n.direction==='none')return 0;const f=Number(n.forceKN.replace(',','.'));if(!n.forceKN.trim()||!Number.isFinite(f)||f<0)throw Error('Перед объединением узлов задайте величины их сил.');return f*(n.direction==='left'?-1:1);};
 const sum=force(left)+force(right),nodes=[...task.nodes];
 const merged:TaskNode={fixed:left.fixed||right.fixed,fixedSide:(left.fixed?left.fixedSide:right.fixedSide)??'auto',forceKN:String(Math.abs(sum)),direction:Math.abs(sum)<1e-12?'none':sum<0?'left':'right'};
 nodes.splice(index,2,merged);
 return {...task,rows:task.rows.filter((_,i)=>i!==index),nodes};
}
export function splitTaskRow(task:AxialTask,index:number):AxialTask {
 const row=task.rows[index];if(!row)throw Error('Выберите ступень.');
 const length=positiveValue(row.lengthCM);if(length===null)throw Error('Перед делением задайте положительную длину ступени.');
 const half=String(length/2),rows=[...task.rows],nodes=[...task.nodes];
 rows.splice(index,1,{...row,lengthCM:half},{...row,number:Math.max(...rows.map(r=>r.number))+1,lengthCM:half});
 // Preserve the original right-end force/support; the new midpoint is unloaded.
 nodes.splice(index+1,0,emptyTaskNode());return {...task,rows,nodes};
}
export function resizeTask(task:AxialTask,totalCM:string):AxialTask {
 const wanted=positiveValue(totalCM),lengths=task.rows.map(r=>positiveValue(r.lengthCM));
 if(wanted===null||lengths.some(l=>l===null))throw Error('Для изменения общей длины задайте положительные длины всех ступеней.');
 const total=lengths.reduce<number>((sum,l)=>sum+l!,0);
 return {...task,rows:task.rows.map((r,i)=>({...r,lengthCM:String(lengths[i]!*wanted/total)}))};
}
export type TaskSelection={kind:'row'|'node'|'fixed'|'force';index:number};
export function deleteTaskSelection(task:AxialTask,selection:TaskSelection):AxialTask {
 if(selection.kind==='row')return removeTaskRow(task,selection.index);
 return {...task,nodes:task.nodes.map((n,i)=>i!==selection.index?n:selection.kind==='fixed'?{...n,fixed:false}:selection.kind==='force'?{...n,direction:'none',forceKN:'0'}:{...n,fixed:false,direction:'none',forceKN:'0'})};
}
export function fixedHatchSide(node:TaskNode,index:number,count:number):'left'|'right' {
 return node.fixedSide&&node.fixedSide!=='auto'?node.fixedSide:count>1&&index===count-1?'right':'left';
}
export function taskErrors(task:AxialTask,forSizing=false):string[]{
 const errors:string[]=[];
 if(!task.rows.length||task.nodes.length!==task.rows.length+1)errors.push('Каждой ступени нужны два граничных узла.');
 if(!task.nodes.some(n=>n.fixed))errors.push('Укажите хотя бы одну заделку на чертеже или в таблице узлов.');
 task.rows.forEach(r=>{
  if(positiveValue(r.lengthCM)===null)errors.push(`ℓ${r.number}: нужна положительная длина.`);
  if(positiveValue(r.ratio)===null)errors.push(`Участок ${r.number}: нужен положительный коэффициент площади.`);
  if(!r.areaLabel.trim())errors.push(`Участок ${r.number}: подпишите площадь.`);
 });
 task.nodes.forEach((n,i)=>{
  const force=Number(n.forceKN.replace(',','.'));
  if(n.direction!=='none'&&(!n.forceKN.trim()||!Number.isFinite(force)||force<0))errors.push(`Узел ${i+1}: введите неотрицательную величину силы.`);
 });
 if(positiveValue(task.modulusGPa)===null)errors.push('Задайте модуль упругости E по условию задания.');
 if(forSizing){if(positiveValue(task.tensionMPa)===null||positiveValue(task.compressionMPa)===null)errors.push('Для подбора площадей нужны оба допускаемых напряжения.');}
 else if(positiveValue(task.baseAreaMM2)===null)errors.push('Задайте базовую площадь A₀.');
 return errors;
}
export function projectFromTask(task:AxialTask):Project{
 const errors=taskErrors(task);if(errors.length)throw Error(errors.join(' '));
 const p=finalizeEmptyProject(createEmptyProject()),base=positiveValue(task.baseAreaMM2)!*1e-6;
 p.metadata.title=task.title.trim()||'Ступенчатый стержень';
 p.metadata.description=`Свободный ввод. Площади Aᵢ=kᵢA₀; A₀=${task.baseAreaMM2} мм². Слева направо: ${task.rows.map(r=>`${r.areaLabel} (k=${r.ratio})`).join(', ')}. Квадратные сечения приняты для изображения; исходная форма сечений не задана. Направления сил и заделки введены пользователем. Стороны заделок: ${task.nodes.map((n,i)=>`${i+1}=${n.fixedSide??'auto'}`).join(';')}.  [σ]р=${task.tensionMPa} МПа; [σ]сж=${task.compressionMPa} МПа.`;
 p.model.materials=[{id:crypto.randomUUID(),name:task.material||'Материал задан модулем E',elasticModulus:positiveValue(task.modulusGPa)!*1e9}];
 p.model.sections=task.rows.map(r=>{const area=base*positiveValue(r.ratio)!,b=Math.sqrt(area);return {id:crypto.randomUUID(),name:r.areaLabel,area,inertiaZ:area**2/12,yMinus:b/2,yPlus:b/2,source:{kind:'rectangle' as const,width:b,height:b}};});
 let x=0;p.model.nodes=[{id:crypto.randomUUID(),number:1,x:0,y:0}];
 task.rows.forEach((r,i)=>{x+=positiveValue(r.lengthCM)!/100;p.model.nodes.push({id:crypto.randomUUID(),number:i+2,x,y:0});});
 p.model.elements=task.rows.map((r,i)=>({id:crypto.randomUUID(),number:r.number,nodeI:p.model.nodes[i]!.id,nodeJ:p.model.nodes[i+1]!.id,materialId:p.model.materials[0]!.id,sectionId:p.model.sections[i]!.id,releases:{rotationI:false,rotationJ:false}}));
 p.model.supports=task.nodes.flatMap((n,i)=>n.fixed?[{nodeId:p.model.nodes[i]!.id,ux:true,uy:true,rz:true}]:[]);
 p.loadCases[0]!.nodalLoads=task.nodes.flatMap((n,i)=>n.direction==='none'?[]:[{id:crypto.randomUUID(),nodeId:p.model.nodes[i]!.id,fx:Number(n.forceKN.replace(',','.'))*1000*(n.direction==='right'?1:-1),fy:0,mz:0}]);
 if(task.areaSizing?.taskSnapshot===sizingTaskSnapshot(task)){p.metadata.areaSizing={modelSnapshot:sizingModelSnapshot(p),minimumBaseArea:task.areaSizing.minimumBaseArea,tensionMPa:positiveValue(task.tensionMPa)!,compressionMPa:positiveValue(task.compressionMPa)!};}
 const validation=validateProject(p);if(!validation.valid)throw Error(validation.diagnostics.filter(d=>d.severity==='error').map(d=>d.message).join(' '));
 return p;
}
export const sizingTaskSnapshot=(task:AxialTask)=>JSON.stringify({...task,areaSizing:undefined});
export function taskWithSizedArea(task:AxialTask):AxialTask {
 const minimum=sizeTaskArea(task),accepted={...task,baseAreaMM2:String(Math.ceil(minimum))};
 return {...accepted,areaSizing:{taskSnapshot:sizingTaskSnapshot(accepted),minimumBaseArea:minimum*1e-6}};
}
export function sizeTaskArea(task:AxialTask):number{
 const errors=taskErrors(task,true);if(errors.length)throw Error(errors.join(' '));
 // All sections scale by the same A0; for zero prescribed displacements,
 // force distribution is invariant under this common stiffness factor.
 // The actual solver enforces compatibility for multiple supports.
 const p=projectFromTask({...task,baseAreaMM2:'1'}),result=analyzeProject(p);
 if(!result.ok)throw Error(result.diagnostics.map(d=>d.message).join(' '));
 const requested=result.elements.map((e,i)=>Math.max(...e.diagram.map(p=>Math.abs(p.axialForce)/(positiveValue(task.rows[i]!.ratio)!*positiveValue(p.axialForce>=0?task.tensionMPa:task.compressionMPa)!))));
 const area=Math.max(...requested);
 if(area<=1e-12)throw Error('Ступени не нагружены: минимальная ненулевая площадь не определяется. Задайте A₀ вручную.');
 return area;
}
export function taskFromProject(p:Project):AxialTask|null {
 if(!p.model.elements.length||p.model.nodes.length!==p.model.elements.length+1)return null;
 const nodes=[...p.model.nodes].sort((a,b)=>a.x-b.x);
 if(nodes.some(n=>Math.abs(n.y-nodes[0]!.y)>1e-9)||p.model.supports.some(s=>!(s.ux&&s.uy&&s.rz)))return null;
 const lc=p.loadCases.find(c=>c.id===p.analysisSettings.activeLoadCaseId);if(!lc||lc.elementLoads.some(l=>l.qx||l.qy)||lc.nodalLoads.some(l=>l.fy||l.mz))return null;
 const materials=new Set(p.model.elements.map(e=>e.materialId));if(materials.size!==1)return null;
 const mat=p.model.materials.find(m=>m.id===[...materials][0]);if(!mat)return null;
 const rowData=[];
 for(let i=0;i<nodes.length-1;i++){
  const a=nodes[i]!,b=nodes[i+1]!,e=p.model.elements.find(e=>e.nodeI===a.id&&e.nodeJ===b.id);
  if(!e||b.x<=a.x||e.releases.rotationI||e.releases.rotationJ)return null;
  const section=p.model.sections.find(s=>s.id===e.sectionId);if(!section)return null;
  rowData.push({e,section,length:b.x-a.x});
 }
 const baseMatch=p.metadata.description.match(/A₀=([\d.,eE+-]+) мм²/)?.[1],base=baseMatch&&positiveValue(baseMatch)?positiveValue(baseMatch)!*1e-6:Math.min(...rowData.map(r=>r.section.area));
 const rows=rowData.map(({e,section,length})=>({number:e.number,lengthCM:String(length*100),ratio:String(section.area/base),areaLabel:section.name}));
 const taskNodes:TaskNode[]=nodes.map(n=>{const force=lc.nodalLoads.filter(l=>l.nodeId===n.id).reduce((s,l)=>s+l.fx,0);return {fixed:p.model.supports.some(s=>s.nodeId===n.id),fixedSide:(p.metadata.description.match(new RegExp(`(?:Стороны заделок: |;)${nodes.indexOf(n)+1}=(auto|left|right)`))?.[1]??'auto') as NonNullable<TaskNode['fixedSide']>,forceKN:String(Math.abs(force)/1000),direction:Math.abs(force)<1e-12?'none':force<0?'left':'right'};});
 const tension=p.metadata.description.match(/\[σ\]р=([\d.,]+) МПа/)?.[1]??'',compression=p.metadata.description.match(/\[σ\]сж=([\d.,]+) МПа/)?.[1]??'';
 const task:AxialTask={...emptyAxialTask(),title:p.metadata.title,rows,nodes:taskNodes,tensionMPa:tension,compressionMPa:compression,baseAreaMM2:String(base*1e6),modulusGPa:String(mat.elasticModulus/1e9),material:mat.name};
 if(p.metadata.areaSizing?.modelSnapshot===sizingModelSnapshot(p))task.areaSizing={taskSnapshot:sizingTaskSnapshot(task),minimumBaseArea:p.metadata.areaSizing.minimumBaseArea};
 return task;
}

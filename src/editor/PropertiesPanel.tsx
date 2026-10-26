import {useNumberFormat} from "../display/NumberFormat";
import type { Project } from "../model";
import type { Selection } from "./projectActions";

interface Props {
  onEditSection?:()=>void;
  project: Project;
  selection: Selection;
  onCommit: (update: (project: Project) => Project) => void;
}

function NumberField({ label, unit, value, onChange, step = "any" }: { label: string; unit: string; value: number; onChange: (value: number) => void; step?: string }) {
  return <label className="field"><span>{label} <em>{unit}</em></span><input type="number" step={step} value={Number.isFinite(value) ? value : ""} onChange={(event) => onChange(event.target.valueAsNumber)} /></label>;
}

export function PropertiesPanel({ project, selection, onCommit,onEditSection }: Props) {
  const {n}=useNumberFormat();
  const loadCase = project.loadCases[0]!;
  if (!selection) return <aside className="properties panel"><div className="panel-title"><h2>Свойства</h2></div><div className="property-body"><p>Выберите узел или стержень на схеме.</p><p className="hint">Координаты: X вправо, Y вверх. Положительный момент — против часовой стрелки.</p></div></aside>;
  if (selection.kind === "node") {
    const node = project.model.nodes.find((item) => item.id === selection.id);
    if (!node) return null;
    const support = project.model.supports.find((item) => item.nodeId === node.id) ?? { nodeId: node.id, ux: false, uy: false, rz: false };
    const nodalLoad = loadCase.nodalLoads.find((item) => item.nodeId === node.id) ?? { id: "", nodeId: node.id, fx: 0, fy: 0, mz: 0 };
    const changeNode = (key: "x"|"y", value: number) => onCommit((next) => { const target=next.model.nodes.find((item)=>item.id===node.id)!; target[key]=value; return next; });
    const changeSupport = (key: "ux"|"uy"|"rz", value: boolean) => onCommit((next) => { let target=next.model.supports.find((item)=>item.nodeId===node.id); if(!target){target={nodeId:node.id,ux:false,uy:false,rz:false};next.model.supports.push(target);} target[key]=value; if(!target.ux&&!target.uy&&!target.rz) next.model.supports=next.model.supports.filter((item)=>item.nodeId!==node.id); return next; });
    const changeLoad = (key: "fx"|"fy"|"mz", value: number) => onCommit((next) => { const lc=next.loadCases[0]!; let target=lc.nodalLoads.find((item)=>item.nodeId===node.id); if(!target){target={id:crypto.randomUUID(),nodeId:node.id,fx:0,fy:0,mz:0};lc.nodalLoads.push(target);} target[key]=value; if(target.fx===0&&target.fy===0&&target.mz===0) lc.nodalLoads=lc.nodalLoads.filter((item)=>item.id!==target.id); return next; });
    return <aside className="properties panel"><div className="panel-title"><h2>Узел n{node.number}</h2><span>{node.id.slice(0,8)}</span></div><div className="property-body">
      <h3>Координаты</h3><div className="field-grid"><NumberField label="X" unit="м" value={node.x} onChange={(v)=>changeNode("x",v)}/><NumberField label="Y" unit="м" value={node.y} onChange={(v)=>changeNode("y",v)}/></div>
      <h3>Закрепления</h3><div className="checks"><label><input type="checkbox" checked={support.ux} onChange={(e)=>changeSupport("ux",e.target.checked)}/> Ux</label><label><input type="checkbox" checked={support.uy} onChange={(e)=>changeSupport("uy",e.target.checked)}/> Uy</label><label><input type="checkbox" checked={support.rz} onChange={(e)=>changeSupport("rz",e.target.checked)}/> Rz</label></div>
      <h3>Узловая нагрузка</h3><NumberField label="Fx" unit="кН, +X" value={nodalLoad.fx/1000} onChange={(v)=>changeLoad("fx",v*1000)}/><NumberField label="Fy" unit="кН, +Y" value={nodalLoad.fy/1000} onChange={(v)=>changeLoad("fy",v*1000)}/><NumberField label="Mz" unit="кН·м, +↺" value={nodalLoad.mz/1000} onChange={(v)=>changeLoad("mz",v*1000)}/>
    </div></aside>;
  }
  const element = project.model.elements.find((item) => item.id === selection.id);
  if (!element) return null;
  const material = project.model.materials.find((item) => item.id === element.materialId)!;
  const section = project.model.sections.find((item) => item.id === element.sectionId)!;
  const elementLoad = loadCase.elementLoads.find((item) => item.elementId === element.id) ?? { id:"",elementId:element.id,type:"uniform-local" as const,qx:0,qy:0 };
  const changeElement = (key:"materialId"|"sectionId", value:string) => onCommit((next)=>{ next.model.elements.find((item)=>item.id===element.id)![key]=value; return next; });
  const changeRelease = (key:"rotationI"|"rotationJ", value:boolean)=>onCommit((next)=>{next.model.elements.find((item)=>item.id===element.id)!.releases[key]=value;return next;});
  const changeMaterial = (value:number)=>onCommit((next)=>{next.model.materials.find((item)=>item.id===material.id)!.elasticModulus=value*1e9;return next;});
  const changeSection = (key:"area"|"inertiaZ"|"yMinus"|"yPlus",value:number)=>onCommit((next)=>{const target=next.model.sections.find((item)=>item.id===section.id)!;target[key]=value;target.source={kind:"general"};delete target.calculator;return next;});
  const changeLoad=(key:"qx"|"qy",value:number)=>onCommit((next)=>{const lc=next.loadCases[0]!;let target=lc.elementLoads.find((item)=>item.elementId===element.id);if(!target){target={id:crypto.randomUUID(),elementId:element.id,type:"uniform-local",qx:0,qy:0};lc.elementLoads.push(target);}target[key]=value*1000;if(target.qx===0&&target.qy===0)lc.elementLoads=lc.elementLoads.filter((item)=>item.id!==target.id);return next;});
  return <aside className="properties panel"><div className="panel-title"><h2>Стержень e{element.number}</h2><span>i→j</span></div><div className="property-body">
    <label className="field"><span>Материал</span><select value={element.materialId} onChange={(e)=>changeElement("materialId",e.target.value)}>{project.model.materials.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {section.calculator&&onEditSection&&<button onClick={onEditSection}>Редактировать геометрию сечения</button>}
    <NumberField label="E" unit="ГПа" value={material.elasticModulus/1e9} onChange={changeMaterial}/>
    <label className="field"><span>Сечение</span><select value={element.sectionId} onChange={(e)=>changeElement("sectionId",e.target.value)}>{project.model.sections.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div className="field-grid"><NumberField label="A" unit="м²" value={section.area} onChange={(v)=>changeSection("area",v)}/><NumberField label="Iz" unit="м⁴" value={section.inertiaZ} onChange={(v)=>changeSection("inertiaZ",v)}/><NumberField label="y−" unit="м" value={section.yMinus} onChange={(v)=>changeSection("yMinus",v)}/><NumberField label="y+" unit="м" value={section.yPlus} onChange={(v)=>changeSection("yPlus",v)}/></div>
    <p className="hint">Длина: {n(Math.hypot(project.model.nodes.find(n=>n.id===element.nodeJ)!.x-project.model.nodes.find(n=>n.id===element.nodeI)!.x,project.model.nodes.find(n=>n.id===element.nodeJ)!.y-project.model.nodes.find(n=>n.id===element.nodeI)!.y))} м. A = {n(section.area,true)} м²; Iz = {n(section.inertiaZ,true)} м⁴. Поля ввода сохраняют полную точность.</p>
    <h3>Шарниры</h3><div className="checks"><label><input type="checkbox" checked={element.releases.rotationI} onChange={(e)=>changeRelease("rotationI",e.target.checked)}/> в начале i</label><label><input type="checkbox" checked={element.releases.rotationJ} onChange={(e)=>changeRelease("rotationJ",e.target.checked)}/> в конце j</label></div>
    <h3>Равномерная нагрузка</h3><NumberField label="qx" unit="кН/м, +x" value={elementLoad.qx/1000} onChange={(v)=>changeLoad("qx",v)}/><NumberField label="qy" unit="кН/м, +y" value={elementLoad.qy/1000} onChange={(v)=>changeLoad("qy",v)}/>
    <p className="hint">Локальная x направлена i→j, локальная y повернута на +90°.</p>
  </div></aside>;
}

import {useNumberFormat} from "../display/NumberFormat";
import { useState } from "react";
import type { Project } from "../model";
import type { AnalysisSuccess, DiagramPoint, ElementAnalysisResult } from "../solver";

const layers = [
  { key: "axialForce", title: "Nx", unit: "кН", color: "#7b2cbf" },
  { key: "shearForce", title: "Qy", unit: "кН", color: "#087e8b" },
  { key: "bendingMoment", title: "Mz", unit: "кН·м", color: "#b76500" }
] as const;


export function ElementDiagram({ result, field, title, unit, color, scale=1, numbers=true }: {
  result: ElementAnalysisResult; field: keyof Pick<DiagramPoint,"axialForce"|"shearForce"|"bendingMoment">;
  title: string; unit: string; color: string; scale?: number; numbers?: boolean;
}) {
  const {n:format}=useNumberFormat();
  const points = result.diagram;
  const values = points.map(p=>p[field]/1000);
  const max = Math.max(...values.map(Math.abs));
  const amplitude = max > 0 ? 62 * scale / max : 0;
  const x = (p: DiagramPoint) => 42 + 276 * p.x / result.length;
  const y = (p: DiagramPoint) => 115 - p[field]/1000 * amplitude;
  const curve = points.map(p=>`${x(p)},${y(p)}`).join(" ");
  const indices = [...new Set([0,values.indexOf(Math.min(...values)),values.indexOf(Math.max(...values)),points.length-1])];
  return <svg className="result-diagram" viewBox="0 0 360 230" role="img" aria-label={`${title}, ${unit}; длина ${format(result.length)} м`}>
    <title>{`${title}, ${unit}. Положительные значения выше оси. x от узла i к узлу j.`}</title>
    <text x="14" y="22" fontWeight="700">{title}, {unit}</text>
    <line x1="42" y1="115" x2="318" y2="115" stroke="#53645e"/>
    <polygon points={`42,115 ${curve} 318,115`} fill={color} fillOpacity="0.12"/>
    {points.filter((_,i)=>i%2===0||i===points.length-1).map((p,i)=><line key={i} x1={x(p)} y1="115" x2={x(p)} y2={y(p)} stroke={color} strokeOpacity="0.4"/>)}
    <polyline points={`42,115 ${curve} 318,115`} fill="none" stroke={color} strokeWidth="2"/>
    {points.map((p,i)=><circle key={i} cx={x(p)} cy={y(p)} r="4" fill="transparent"><title>{`x=${format(p.x)} м; ${title}=${format(values[i]!)} ${unit}`}</title></circle>)}
    {numbers && indices.map(i=><text key={i} x={x(points[i]!)} y={y(points[i]!)+(values[i]!<0?16:-9)} textAnchor={i===0?"start":i===points.length-1?"end":"middle"} fill={color}>{format(values[i]!)}</text>)}
    <text x="42" y="205">i · 0</text><text x="318" y="205" textAnchor="end">j · {format(result.length)} м</text>
    <text x="180" y="222" textAnchor="middle" fill="#53645e">x →</text>
    {max===0 && <text x="180" y="56" textAnchor="middle" fill="#53645e">{title} = 0 на всём стержне</text>}
  </svg>;
}

export function ResultsDiagrams({ project, analysis, interactive=true }: {project:Project;analysis:AnalysisSuccess;interactive?:boolean}) {
  const {n:format}=useNumberFormat();
  const [selected,setSelected] = useState("all");
  const [scale,setScale] = useState(1);
  const [numbers,setNumbers] = useState(true);
  const elements=analysis.elements.filter(e=>!interactive||selected==="all"||e.elementId===selected);
  const save = (elementId: string, parent: HTMLElement) => {
    const svgs=Array.from(parent.querySelectorAll("svg"));
    const content=svgs.map((svg,i)=>`<g transform="translate(${i*360},0)">${svg.innerHTML}</g>`).join("");
    const blob=new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="230" viewBox="0 0 1080 230" style="font:12px sans-serif" ><rect width="1080" height="230" fill="white"/>${content}</svg>`],{type:"image/svg+xml;charset=utf-8"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;
    link.download=`epures-e${project.model.elements.find(e=>e.id===elementId)?.number??elementId}.svg`;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  };
  return <section className="epures-panel" aria-label="Эпюры по стержням">
    <h3>Эпюры по стержням</h3>
    {interactive && <div className="epures-controls">
      <label>Стержень <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="all">Все стержни</option>{analysis.elements.map(e=><option key={e.elementId} value={e.elementId}>№ {project.model.elements.find(m=>m.id===e.elementId)?.number}</option>)}</select></label>
      <label>Масштаб ординат <input type="range" min="0.25" max="1.25" step="0.05" value={scale} onChange={e=>setScale(Number(e.target.value))}/> ×{format(scale)}</label>
      <label><input type="checkbox" checked={numbers} onChange={e=>setNumbers(e.target.checked)}/> Числовые значения</label>
    </div>}
    <p className="hint">x идёт от узла i к узлу j. Положительные значения выше оси. Масштаб каждого графика независимый; сравнивайте подписанные значения. Наведите на точку для просмотра координаты и усилия.</p>
    {elements.map(e=>{
      const member=project.model.elements.find(m=>m.id===e.elementId)!;
      const ni=project.model.nodes.find(n=>n.id===member.nodeI)!,nj=project.model.nodes.find(n=>n.id===member.nodeJ)!;
      return <div className="epures-member" key={e.elementId}>
        <div className="epures-heading"><strong>Стержень {member.number} · i: узел {ni.number} → j: узел {nj.number} · L={format(e.length)} м</strong>{interactive&&<button onClick={event=>save(e.elementId,event.currentTarget.closest(".epures-member") as HTMLElement)}>Скачать SVG</button>}</div>
        <div className="epures-charts">{layers.map(l=><ElementDiagram key={l.key} result={e} field={l.key} title={l.title} unit={l.unit} color={l.color} scale={interactive?scale:1} numbers={interactive?numbers:true}/>)}</div>
      </div>;
    })}
  </section>;
}

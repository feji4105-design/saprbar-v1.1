import {useNumberFormat} from "../display/NumberFormat";
import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { Project } from "../model";
import type { AnalysisSuccess } from "../solver";
import type { Selection } from "./projectActions";

export type EditorTool = "select" | "node" | "element" | "pan";
export type ResultLayer = "none" | "deformed" | "axial" | "shear" | "moment";

interface Props {
  project: Project;
  selection: Selection;
  tool: EditorTool;
  snap: boolean;
  gridStep: number;
  elementStart: string | null;
  result: AnalysisSuccess | null;
  resultLayer: ResultLayer;
  deformationScale: number;
  onResultLayer?: (layer: ResultLayer) => void;
  onSelect: (selection: Selection) => void;
  onCreateNode: (x: number, y: number) => void;
  onCreateElement: (nodeId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
}

const WIDTH = 900;
const HEIGHT = 560;

export function SchemeCanvas(props: Props) {
  const {n}=useNumberFormat();
  const [diagramScale, setDiagramScale] = useState(1);
  const [diagramNumbers, setDiagramNumbers] = useState(true);
  const [showLoads, setShowLoads] = useState(false);
  const diagramMode = !!props.result && ["axial", "shear", "moment"].includes(props.resultLayer);
  const svgRef = useRef<SVGSVGElement>(null);
  const fitView = () => {
    const nodes = props.project.model.nodes;
    if (!nodes.length) return { x: 2, y: 1.5, scale: 90 };
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY) || 4;
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2,
      scale: Math.min((WIDTH - 240) / Math.max(maxX - minX, span / 4), (HEIGHT - 240) / Math.max(maxY - minY, span / 4)) };
  };
  const [view, setView] = useState(fitView);
  useEffect(() => { setView(fitView()); }, [props.project.metadata.id]);
  const [drag, setDrag] = useState<{ type: "pan"; px: number; py: number; x: number; y: number } | { type: "node"; id: string; x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<{ id: string; x: number; y: number } | null>(null);

  const snapValue = (value: number) => props.snap ? Math.round(value / props.gridStep) * props.gridStep : value;
  const screen = (x: number, y: number) => ({ x: WIDTH / 2 + (x - view.x) * view.scale, y: HEIGHT / 2 - (y - view.y) * view.scale });
  const world = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = (clientX - rect.left) * WIDTH / rect.width;
    const sy = (clientY - rect.top) * HEIGHT / rect.height;
    return { x: view.x + (sx - WIDTH / 2) / view.scale, y: view.y - (sy - HEIGHT / 2) / view.scale };
  };
  const displayNode = (id: string) => {
    const node = props.project.model.nodes.find((item) => item.id === id);
    if (!node) return null;
    return preview?.id === id ? { ...node, x: preview.x, y: preview.y } : node;
  };

  const grid = useMemo(() => {
    const stepPx = props.gridStep * view.scale;
    if (stepPx < 8) return [];
    const left = view.x - WIDTH / 2 / view.scale;
    const right = view.x + WIDTH / 2 / view.scale;
    const bottom = view.y - HEIGHT / 2 / view.scale;
    const top = view.y + HEIGHT / 2 / view.scale;
    const lines: Array<{ a: number; vertical: boolean }> = [];
    for (let x = Math.ceil(left / props.gridStep) * props.gridStep; x <= right; x += props.gridStep) lines.push({ a: x, vertical: true });
    for (let y = Math.ceil(bottom / props.gridStep) * props.gridStep; y <= top; y += props.gridStep) lines.push({ a: y, vertical: false });
    return lines;
  }, [props.gridStep, view]);

  const onBackgroundDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button === 1 || props.tool === "pan") {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ type: "pan", px: event.clientX, py: event.clientY, x: view.x, y: view.y });
      return;
    }
    if (event.target !== event.currentTarget && (event.target as Element).closest("[data-object]")) return;
    if (props.tool === "node") {
      const p = world(event.clientX, event.clientY);
      props.onCreateNode(snapValue(p.x), snapValue(p.y));
    } else props.onSelect(null);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    if (drag.type === "pan") {
      const rect = event.currentTarget.getBoundingClientRect();
      setView((current) => ({ ...current, x: drag.x - (event.clientX - drag.px) * WIDTH / rect.width / current.scale, y: drag.y + (event.clientY - drag.py) * HEIGHT / rect.height / current.scale }));
    } else {
      const p = world(event.clientX, event.clientY);
      setPreview({ id: drag.id, x: snapValue(p.x), y: snapValue(p.y) });
    }
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (drag?.type === "node" && preview) props.onMoveNode(preview.id, preview.x, preview.y);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDrag(null);
    setPreview(null);
  };

  const onWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const before = world(event.clientX, event.clientY);
    const nextScale = Math.max(1e-6, Math.min(1e9, view.scale * Math.exp(-event.deltaY * 0.001)));
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = (event.clientX - rect.left) * WIDTH / rect.width;
    const sy = (event.clientY - rect.top) * HEIGHT / rect.height;
    setView({ x: before.x - (sx - WIDTH / 2) / nextScale, y: before.y + (sy - HEIGHT / 2) / nextScale, scale: nextScale });
  };

  const resultByElement = new Map(props.result?.elements.map((item) => [item.elementId, item]) ?? []);
  const resultValues = props.result?.elements.flatMap((item) => item.diagram.map((point) => props.resultLayer === "axial" ? point.axialForce : props.resultLayer === "shear" ? point.shearForce : point.bendingMoment)) ?? [];
  const diagramMax = Math.max(Number.EPSILON, ...resultValues.map((value) => Math.abs(value)));

  return <div className="canvas-wrap">
    {props.result && props.onResultLayer && <div className="scheme-result-controls">
      <strong>Эпюры вдоль стержней</strong>
      {(["axial", "shear", "moment"] as const).map(layer => <button key={layer} aria-pressed={props.resultLayer === layer} className={props.resultLayer === layer ? "active" : ""} onClick={() => props.onResultLayer?.(layer)}>{{axial:"N, кН",shear:"Q, кН",moment:"M, кН·м"}[layer]}</button>)}
      <button onClick={() => props.onResultLayer?.("none")}>Схема</button>
      {diagramMode && <><label>Высота эпюр <input type="range" min="0.25" max="2" step="0.05" value={diagramScale} onChange={event => setDiagramScale(Number(event.target.value))}/></label>
        <label><input type="checkbox" checked={diagramNumbers} onChange={event => setDiagramNumbers(event.target.checked)}/> Значения</label>
        <label><input type="checkbox" checked={showLoads} onChange={event => setShowLoads(event.target.checked)}/> Нагрузки</label></>}
    </div>}

    <svg ref={svgRef} className={`editor-canvas tool-${props.tool}`} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} onPointerDown={onBackgroundDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onWheel={onWheel}>
      <defs>
        <marker id="load-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" /></marker>
      </defs>
      {grid.map((line, index) => line.vertical ? <line key={index} className={Math.abs(line.a) < 1e-12 ? "grid axis-grid" : "grid"} x1={screen(line.a, 0).x} y1="0" x2={screen(line.a, 0).x} y2={HEIGHT} /> : <line key={index} className={Math.abs(line.a) < 1e-12 ? "grid axis-grid" : "grid"} x1="0" y1={screen(0, line.a).y} x2={WIDTH} y2={screen(0, line.a).y} />)}

      {props.project.model.elements.map((element) => {
        const ni = displayNode(element.nodeI); const nj = displayNode(element.nodeJ);
        if (!ni || !nj) return null;
        const a = screen(ni.x, ni.y); const b = screen(nj.x, nj.y);
        const selected = props.selection?.kind === "element" && props.selection.id === element.id;
        const load = diagramMode && !showLoads ? undefined : props.project.loadCases[0]?.elementLoads.find((item) => item.elementId === element.id);
        const dx = b.x - a.x; const dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1; const nx = dy / len; const ny = -dx / len;
        return <g key={element.id} data-object="element" onPointerDown={(event) => { event.stopPropagation(); props.onSelect({ kind: "element", id: element.id }); }}>
          <line className="hit-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          <line className={selected ? "member selected" : "member"} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          <text className="member-label" x={(a.x + b.x) / 2 + nx * 12} y={(a.y + b.y) / 2 + ny * 12}>e{element.number}</text>
          {element.releases.rotationI && <circle className="release" cx={a.x + dx / len * 10} cy={a.y + dy / len * 10} r="5" />}
          {element.releases.rotationJ && <circle className="release" cx={b.x - dx / len * 10} cy={b.y - dy / len * 10} r="5" />}
          {load && Math.abs(load.qy) > 0 && [0.15,0.325,0.5,0.675,0.85].map((t) => { const x=a.x+dx*t; const y=a.y+dy*t; const sign=Math.sign(load.qy); return <line key={t} className="load" x1={x+nx*sign*32} y1={y+ny*sign*32} x2={x} y2={y} markerEnd="url(#load-arrow)"/>; })}
          {load && (load.qx !== 0 || load.qy !== 0) && <text className="load-label" x={(a.x+b.x)/2+nx*44} y={(a.y+b.y)/2+ny*44}>qx={load.qx/1000}; qy={load.qy/1000} кН/м</text>}
        </g>;
      })}

      {props.project.model.nodes.map((node) => {
        const shown = displayNode(node.id)!; const p = screen(shown.x, shown.y);
        const selected = props.selection?.kind === "node" && props.selection.id === node.id;
        const support = props.project.model.supports.find((item) => item.nodeId === node.id);
        const load = diagramMode && !showLoads ? undefined : props.project.loadCases[0]?.nodalLoads.find((item) => item.nodeId === node.id);
        return <g key={node.id} data-object="node" onPointerDown={(event) => {
          event.stopPropagation();
          if (props.tool === "element") props.onCreateElement(node.id);
          else { props.onSelect({ kind: "node", id: node.id }); if (props.tool === "select") { event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId); setDrag({ type: "node", id: node.id, x: shown.x, y: shown.y }); setPreview({ id: node.id, x: shown.x, y: shown.y }); } }
        }}>
          {support && <path className="support" d={`M${p.x-13},${p.y+18} L${p.x+13},${p.y+18} L${p.x},${p.y+5} Z M${p.x-17},${p.y+22} L${p.x+17},${p.y+22}`} />}
          <circle className={selected || props.elementStart === node.id ? "node selected" : "node"} cx={p.x} cy={p.y} r="7" />
          <text className="node-label" x={p.x+10} y={p.y-10}>n{node.number}</text>
          {support && <text className="support-label" x={p.x+17} y={p.y+34}>{[support.ux&&"X",support.uy&&"Y",support.rz&&"R"].filter(Boolean).join("")}</text>}
          {load && (load.fx !== 0 || load.fy !== 0) && (() => { const m=Math.hypot(load.fx,load.fy); return <line className="load nodal" x1={p.x-load.fx/m*45} y1={p.y+load.fy/m*45} x2={p.x} y2={p.y} markerEnd="url(#load-arrow)"/>; })()}
          {load && (load.fx !== 0 || load.fy !== 0) && <text className="load-label" x={p.x+14} y={p.y+18}>({load.fx/1000}; {load.fy/1000}) кН</text>}
          {load && load.mz !== 0 && <text className="moment-label" x={p.x-24} y={p.y-18}>↺ M</text>}
        </g>;
      })}

      {props.result && props.resultLayer === "deformed" && props.project.model.elements.map((element) => {
        const ni=props.project.model.nodes.find((n)=>n.id===element.nodeI)!; const nj=props.project.model.nodes.find((n)=>n.id===element.nodeJ)!; const er=resultByElement.get(element.id)!;
        const dx=nj.x-ni.x; const dy=nj.y-ni.y; const c=dx/er.length; const s=dy/er.length;
        const points=er.diagram.map((point)=>{const z=point.x/er.length;const du=c*point.axialDisplacement-s*point.transverseDisplacement;const dv=s*point.axialDisplacement+c*point.transverseDisplacement;const p=screen(ni.x+dx*z+du*props.deformationScale,ni.y+dy*z+dv*props.deformationScale);return `${p.x},${p.y}`;}).join(" ");
        return <polyline key={element.id} className="deformed" points={points}/>;
      })}
      {props.result && ["axial","shear","moment"].includes(props.resultLayer) && props.project.model.elements.map((element) => {
        const ni=props.project.model.nodes.find((n)=>n.id===element.nodeI)!; const nj=props.project.model.nodes.find((n)=>n.id===element.nodeJ)!; const a=screen(ni.x,ni.y); const b=screen(nj.x,nj.y); const dx=b.x-a.x; const dy=b.y-a.y; const l=Math.hypot(dx,dy); const nx=dy/l; const ny=-dx/l; const er=resultByElement.get(element.id)!;
        const points=er.diagram.map((point)=>{const t=point.x/er.length; const value=props.resultLayer==="axial"?point.axialForce:props.resultLayer==="shear"?point.shearForce:point.bendingMoment; const off=value/diagramMax*70*diagramScale; return `${a.x+dx*t+nx*off},${a.y+dy*t+ny*off}`;}).join(" ");
        return <g key={element.id} className="member-epure" style={{pointerEvents:"none"}}>
          <polygon className={`diagram-fill ${props.resultLayer}`} points={`${a.x},${a.y} ${points} ${b.x},${b.y}`}/>
          {er.diagram.filter((_,index)=>index%2===0).map((point,index)=>{
            const t=point.x/er.length, value=props.resultLayer==="axial"?point.axialForce:props.resultLayer==="shear"?point.shearForce:point.bendingMoment;
            const off=value/diagramMax*70*diagramScale;
            return <line key={index} className={`diagram-ordinate ${props.resultLayer}`} x1={a.x+dx*t} y1={a.y+dy*t} x2={a.x+dx*t+nx*off} y2={a.y+dy*t+ny*off}/>;
          })}
          <polyline className={`diagram ${props.resultLayer}`} points={`${a.x},${a.y} ${points} ${b.x},${b.y}`}/>
          {diagramNumbers && [er.diagram[0]!, er.diagram[er.diagram.length-1]!].map((point, index) => {
            const value = props.resultLayer === "axial" ? point.axialForce : props.resultLayer === "shear" ? point.shearForce : point.bendingMoment;
            const t = point.x / er.length, off = value / diagramMax * 70 * diagramScale;
            return <text key={index} className="member-label" x={a.x+dx*t+nx*off+(index? -8:8)} y={a.y+dy*t+ny*off-8} textAnchor={index?"end":"start"}>{n(value/1000)}</text>;
          })}
        </g>;
      })}
    </svg>
    <button className="fit-scheme-button" onClick={() => setView(fitView())}>Вписать схему</button>
    <div className="canvas-status">Масштаб вида: {n(view.scale)} px/м · сетка {props.gridStep} м{["axial","shear","moment"].includes(props.resultLayer) && ` · Эпюра вдоль стержней: ${props.resultLayer === "moment" ? "кН·м" : "кН"}`} · X →, Y ↑</div>
  </div>;
}

import {useRef,useState,type PointerEvent} from 'react';
import {edgesOf,extrema,pointOn,rotate,vertices} from './geometry';
import {movedVertex} from './editGeometry';
import {clearExpressions} from './expressions';
import {unitLength,type SectionGeometry,type SectionPart,type Point,type Unit} from './types';
type Tool='select'|'rectangle'|'triangle'|'circle'|'semicircle'|'polygon';
function outline(p:SectionPart){return edgesOf(p).map((e,i)=>{
 const a=pointOn(e,0),b=pointOn(e,1),start=i===0?`M ${a.x} ${-a.y} `:'';
 if(e.kind==='line')return start+`L ${b.x} ${-b.y} `;
 if(e.sweep>6){const m=pointOn(e,.5);return start+`A ${e.r} ${e.r} 0 0 0 ${m.x} ${-m.y} A ${e.r} ${e.r} 0 0 0 ${b.x} ${-b.y} `;}
 return start+`A ${e.r} ${e.r} 0 0 0 ${b.x} ${-b.y} `;
}).join('')+'Z';}
export function SectionSketch({geometry,unit,onChange}:{geometry:SectionGeometry;unit:Unit;onChange:(g:SectionGeometry)=>void}){
 const [tool,setTool]=useState<Tool>('select'),[cut,setCut]=useState(false),[selected,setSelected]=useState<string|null>(null),[points,setPoints]=useState<Point[]>([]),[tip,setTip]=useState('');
 const [grid,setGrid]=useState('1'),[snap,setSnap]=useState(true),[zoom,setZoom]=useState(1);
 const svg=useRef<SVGSVGElement>(null),gesture=useRef<{start:Point;part?:SectionPart;vertex?:number|undefined;end:Point}|null>(null),[draft,setDraft]=useState<SectionPart|null>(null);
 const box=useRef({x:-.1,y:-.7,w:1.8,h:.9});
 const fit=()=>{try{const edges=geometry.parts.flatMap(edgesOf),x=extrema(edges,{x:1,y:0}),y=extrema(edges,{x:0,y:1}),span=Math.max(x.max-x.min,y.max-y.min,.05);box.current={x:x.min-span*.2,y:-y.max-span*.2,w:Math.max(x.max-x.min,span*.5)+span*.4,h:Math.max(y.max-y.min,span*.5)+span*.4};setZoom(z=>z+1);}catch{setTip('Исправьте размеры частей в таблице.');}};
 const coords=(event:PointerEvent<SVGSVGElement>):Point=>{
  const matrix=svg.current?.getScreenCTM?.();let x:number,y:number;
  if(matrix){const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());x=p.x;y=-p.y;}else{const r=svg.current!.getBoundingClientRect(),b=box.current,k=Math.max(b.w/(r.width||800),b.h/(r.height||400));x=b.x+(event.clientX-r.left-((r.width||800)-b.w/k)/2)*k;y=-(b.y+(event.clientY-r.top-((r.height||400)-b.h/k)/2)*k);}
  const step=Number(grid.replace(',','.'))*unitLength[unit];return snap&&step>0?{x:Math.round(x/step)*step,y:Math.round(y/step)*step}:{x,y};
 };
 const make=(a:Point,b:Point):SectionPart=>({id:crypto.randomUUID(),name:cut?'Вырез':'Нарисованная часть',cut,x:tool==='circle'||tool==='semicircle'?a.x:Math.min(a.x,b.x),y:tool==='circle'||tool==='semicircle'?a.y:Math.min(a.y,b.y),angle:0,shape:tool==='circle'||tool==='semicircle'?{kind:tool,radius:Math.hypot(b.x-a.x,b.y-a.y)}:tool==='triangle'?{kind:'triangle',width:Math.abs(b.x-a.x),height:Math.abs(b.y-a.y),apex:Math.abs(b.x-a.x)/2}:{kind:'rectangle',width:Math.abs(b.x-a.x),height:Math.abs(b.y-a.y)}});
 const finishPolygon=()=>{if(points.length<3){setTip('Для контура нужно минимум три вершины.');return;}onChange({...geometry,parts:[...geometry.parts,{id:crypto.randomUUID(),name:cut?'Вырез':'Контур',cut,x:0,y:0,angle:0,shape:{kind:'polygon',vertices:points}}]});setPoints([]);setTool('select');};
 const chosen=geometry.parts.find(p=>p.id===selected),b=box.current,stroke=b.w/500;
 return <section className="section-sketch"><h3>Рисование сечения</h3><div className="section-settings">
  <label>Инструмент<select aria-label="Инструмент рисования" value={tool} onChange={e=>{setTool(e.target.value as Tool);setPoints([]);setDraft(null);}}><option value="select">Выбрать / переместить</option><option value="rectangle">Прямоугольник</option><option value="triangle">Треугольник</option><option value="circle">Круг</option><option value="semicircle">Полукруг</option><option value="polygon">Контур по точкам</option></select></label>
  <label><input type="checkbox" checked={cut} onChange={e=>setCut(e.target.checked)}/> Рисовать вырез</label><label>Шаг сетки, {unit}<input aria-label="Шаг сетки" value={grid} onChange={e=>setGrid(e.target.value)}/></label><label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/> Привязка к сетке</label>
  <button onClick={fit}>Вписать сечение</button><button onClick={()=>{const k=.8;box.current={x:b.x+b.w*(1-k)/2,y:b.y+b.h*(1-k)/2,w:b.w*k,h:b.h*k};setZoom(zoom+1);}}>Приблизить</button><button onClick={()=>{const k=1.25;box.current={x:b.x+b.w*(1-k)/2,y:b.y+b.h*(1-k)/2,w:b.w*k,h:b.h*k};setZoom(zoom+1);}}>Отдалить</button>
  {tool==='polygon'&&<><button onClick={finishPolygon}>Замкнуть контур</button><button onClick={()=>setPoints(ps=>ps.slice(0,-1))}>Убрать последнюю точку</button></>}
  <button disabled={!chosen} onClick={()=>{onChange({...geometry,parts:geometry.parts.filter(p=>p.id!==selected)});setSelected(null);}}>Удалить выбранную часть</button>
 </div><p className="hint">Фигуры рисуются протягиванием мыши; круг — от центра до края. Для контура нажимайте на вершины и «Замкнуть контур». Выбранную часть можно перемещать; круглые маркеры меняют вершины или радиус. Числа, угол и размеры доступны в таблице ниже.</p>
 <svg ref={svg} className="section-sketch-canvas" viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} preserveAspectRatio="xMidYMid meet" role="application" aria-label="Редактор чертежа сечения" tabIndex={0}
 onKeyDown={e=>{if(e.key==='Escape'){gesture.current=null;setDraft(null);setPoints([]);}if((e.key==='Delete'||e.key==='Backspace')&&chosen){e.preventDefault();onChange({...geometry,parts:geometry.parts.filter(p=>p.id!==selected)});setSelected(null);}}}
 onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.focus();const start=coords(e);if(tool==='polygon'){setPoints(ps=>[...ps,start]);return;}const target=e.target as SVGElement,p=geometry.parts.find(p=>p.id===target.dataset.part);if(tool==='select'){setSelected(p?.id??null);if(!p)return;gesture.current={start,end:start,part:p,vertex:target.dataset.vertex!==undefined?Number(target.dataset.vertex):undefined};}else gesture.current={start,end:start};e.currentTarget.setPointerCapture?.(e.pointerId);}}
 onPointerMove={e=>{const g=gesture.current;if(!g)return;g.end=coords(e);if(g.part){const p=g.part;if(g.vertex!==undefined){if(p.shape.kind==='circle'||p.shape.kind==='semicircle')setDraft({...clearExpressions(p,['radius']),shape:{...p.shape,radius:Math.hypot(g.end.x-p.x,g.end.y-p.y)}});else setDraft(movedVertex(p,g.vertex,g.end));}else setDraft({...clearExpressions(p,['x','y']),x:p.x+g.end.x-g.start.x,y:p.y+g.end.y-g.start.y});}else setDraft(make(g.start,g.end));}}
 onPointerUp={()=>{const g=gesture.current;gesture.current=null;if(draft&&g){const edges=edgesOf(draft),x=extrema(edges,{x:1,y:0}),y=extrema(edges,{x:0,y:1});if(x.max>x.min&&y.max>y.min){onChange({...geometry,parts:g.part?geometry.parts.map(p=>p.id===g.part!.id?draft:p):[...geometry.parts,draft]});setSelected(draft.id);}}setDraft(null);}} onPointerCancel={()=>{gesture.current=null;setDraft(null);}}>
  <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#f5f8f6"/>
  {(()=>{const step=Number(grid.replace(',','.'))*unitLength[unit];if(!(step>0)||b.w/step+b.h/step>300)return null;const lines=[];for(let x=Math.ceil(b.x/step)*step;x<b.x+b.w;x+=step)lines.push(<line key={`x${x}`} x1={x} x2={x} y1={b.y} y2={b.y+b.h}/>);for(let y=Math.ceil(b.y/step)*step;y<b.y+b.h;y+=step)lines.push(<line key={`y${y}`} y1={y} y2={y} x1={b.x} x2={b.x+b.w}/>);return <g stroke="#dde5df" strokeWidth={stroke/3} pointerEvents="none">{lines}</g>;})()}
  <g stroke="#96aba0" strokeWidth={stroke/2} pointerEvents="none"><line x1={b.x} x2={b.x+b.w} y1={0} y2={0}/><line y1={b.y} y2={b.y+b.h} x1={0} x2={0}/></g>
  {geometry.parts.map((original,i)=>{const p=draft?.id===original.id?draft:original;try{return <g key={p.id}><path data-part={p.id} d={outline(p)} fill={p.cut?'#fff':'#adcfc0'} fillOpacity={p.cut?.9:.65} stroke={p.id===selected?'#ec8a24':p.cut?'#ab3c32':'#255344'} strokeWidth={stroke} strokeDasharray={p.cut?`${stroke*3} ${stroke*2}`:undefined}/><text x={p.x} y={-p.y} fontSize={stroke*6} pointerEvents="none">{i+1}{p.cut?' −':''}</text></g>;}catch{return null;}})}
  {draft&&!gesture.current?.part&&<path d={outline(draft)} fill="#e6c78f" fillOpacity=".5" stroke="#c87513" strokeWidth={stroke} pointerEvents="none"/>}
  {chosen&&tool==='select'&&(()=>{const p=draft?.id===chosen.id?draft:chosen,vs=p.shape.kind==='circle'||p.shape.kind==='semicircle'?[{x:p.shape.radius,y:0}]:vertices(p.shape);return vs.map((v,i)=>{const q=rotate(v,p.angle);return <circle key={i} data-part={p.id} data-vertex={i} cx={p.x+q.x} cy={-p.y-q.y} r={stroke*3} fill="#fff" stroke="#ec8a24" strokeWidth={stroke}/>;});})()}
  <polyline points={points.map(p=>`${p.x},${-p.y}`).join(' ')} fill="none" stroke="#c87513" strokeWidth={stroke} pointerEvents="none"/>
 </svg><p aria-live="polite">{tip}{chosen?` Выбрана часть ${geometry.parts.indexOf(chosen)+1}: ${chosen.name}`:''}</p></section>;
}

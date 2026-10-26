import {useId,type CSSProperties} from 'react';
import {useNumberFormat} from '../display/NumberFormat';
import type {Edge,SectionResult,Unit} from './types';
import {inUnit} from './types';
import {pointOn,extrema} from './geometry';
export type DrawingScale='fit'|'2'|'5';
export function drawingLayout(result:SectionResult,scale:DrawingScale){
 const x=extrema(result.boundary,{x:1,y:0}),y=extrema(result.boundary,{x:0,y:1}),width=x.max-x.min,height=y.max-y.min;
 const span=Math.max(width,height),drawWidth=width+.44*span,drawHeight=height+.44*span;
 const desired=scale==='fit'?0:Number(scale),fit=Math.max(drawWidth*1000/165,drawHeight*1000/180),ratio=desired||fit;
 return {x,y,width,height,ratio,requested:desired,fits:!desired||(drawWidth*1000/desired<=165&&drawHeight*1000/desired<=180)};
}
function path(edges:Edge[],closed=false){
 let d='';for(const [index,e] of edges.entries()){const a=pointOn(e,0),b=pointOn(e,1);if(!closed||index===0)d+=`M${a.x},${a.y} `;
  if(e.kind==='line')d+=`L${b.x},${b.y} `;
  else if(e.sweep>Math.PI*1.99){const m=pointOn(e,.5);d+=`A${e.r},${e.r} 0 0 1 ${m.x},${m.y} A${e.r},${e.r} 0 0 1 ${b.x},${b.y} `;}
  else d+=`A${e.r},${e.r} 0 ${e.sweep>Math.PI?1:0} 1 ${b.x},${b.y} `;
 }return d;
}
export function SectionDrawing({result,unit,scale='fit'}:{result:SectionResult;unit:Unit;scale?:DrawingScale}){
 const {n}=useNumberFormat(),id=useId().replaceAll(':',''),layout=drawingLayout(result,scale);
 const margin=Math.max(layout.width,layout.height)*.22,pad=Math.max(layout.width,layout.height)*.05;
 const box={x:layout.x.min-margin,y:-layout.y.max-margin,w:layout.width+2*margin,h:layout.height+2*margin};
 const px=(x:number)=>x,py=(y:number)=>-y,font=Math.max(layout.width,layout.height)/35;
 const axes=(cx:number,cy:number,angle:number,color:string,label:string,dashed=false)=>{
  const span=Math.max(layout.width,layout.height),c=Math.cos(angle),s=Math.sin(angle);
  const reach=(dx:number,dy:number)=>dashed?span*.1:Math.min(dx>1e-12?(layout.x.max+margin*.7-cx)/dx:dx< -1e-12?(layout.x.min-margin*.7-cx)/dx:Infinity,dy>1e-12?(layout.y.max+margin*.7-cy)/dy:dy< -1e-12?(layout.y.min-margin*.7-cy)/dy:Infinity);
  const positive=reach(c,s),negative=reach(-c,-s);
  return <g stroke={color} strokeWidth={font/14} strokeDasharray={dashed?`${font/3} ${font/3}`:undefined}><line x1={cx-c*negative} y1={py(cy-s*negative)} x2={cx+c*positive} y2={py(cy+s*positive)}/><text x={cx+c*positive} y={py(cy+s*positive)-font/3} fill={color} stroke="none" fontSize={font}>{label}</text></g>;
 };
 const physicalW=box.w*1000/layout.ratio,physicalH=box.h*1000/layout.ratio;
 return <figure className="section-drawing" style={{'--drawing-width':`${physicalW}mm`,'--drawing-height':`${physicalH}mm`} as CSSProperties}>
  <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Сечение, части, центры тяжести и главные оси">
   <defs><mask id={id} maskUnits="userSpaceOnUse" x={box.x} y={-box.y-box.h} width={box.w} height={box.h}><rect x={box.x} y={-box.y-box.h} width={box.w} height={box.h} fill="black"/>{result.parts.filter(r=>!r.part.cut).map(r=><path key={r.part.id} d={path(r.edges,true)+'Z'} fill="white"/>)}{result.parts.filter(r=>r.part.cut).map(r=><path key={r.part.id} d={path(r.edges,true)+'Z'} fill="black"/>)}</mask></defs>
   <g transform="scale(1,-1)"><rect x={layout.x.min} y={layout.y.min} width={layout.width} height={layout.height} mask={`url(#${id})`} fill="#c9ddd5"/><path d={path(result.boundary)} fill="none" stroke="#173c31" strokeWidth={font/8}/>{result.parts.map(r=><path key={r.part.id} d={path(r.edges)} fill="none" stroke={r.part.cut?'#a43d2e':'#71877e'} strokeWidth={font/18} strokeDasharray={`${font/4} ${font/4}`}/>)}</g>
   {result.parts.map((r,i)=><g key={r.part.id}>{axes(r.cx,r.cy,r.part.angle,'#8b9690',`x${i+1}`,true)}<circle cx={px(r.cx)} cy={py(r.cy)} r={font/7} fill={r.part.cut?'#a43d2e':'#62726b'}/><text x={r.cx+font/3} y={py(r.cy)-font/3} fontSize={font}>C{i+1} ({r.sign>0?'+':'−'})</text></g>)}
   {axes(result.cx,result.cy,0,'#14634f','xC')}{axes(result.cx,result.cy,Math.PI/2,'#14634f','yC')}
   {result.angleMax!==null&&<>{axes(result.cx,result.cy,result.angleMax,'#7048a2','Jmax')}{axes(result.cx,result.cy,result.angleMin!,'#7048a2','Jmin')}</>}
   <circle cx={result.cx} cy={py(result.cy)} r={font/5} fill="#d66a16"/><text x={result.cx+font/2} y={py(result.cy)+font} fontSize={font}>C</text>
   <g stroke="#333" strokeWidth={font/20} fontSize={font} fill="#111"><line x1={layout.x.min} y1={py(layout.y.min)-(-pad)} x2={layout.x.max} y2={py(layout.y.min)-(-pad)}/><text stroke="none" x={(layout.x.min+layout.x.max)/2} y={py(layout.y.min)+pad+font} textAnchor="middle">{n(inUnit(layout.width,unit))} {unit}</text><text stroke="none" x={layout.x.max+pad} y={py((layout.y.min+layout.y.max)/2)} transform={`rotate(-90 ${layout.x.max+pad} ${py((layout.y.min+layout.y.max)/2)})`}>{n(inUnit(layout.height,unit))} {unit}</text></g>
  </svg>
  <figcaption>Масштаб печати 1:{n(layout.ratio)}{scale==='fit'?' (автоматическое вписывание)':''}. {layout.fits?'Чертёж помещается в область A4.':'В этом масштабе чертёж не помещается на A4: выберите вписывание.'} {result.angleMax===null?'Главные направления не единственны.':''} Печатать с масштабом 100%, без дополнительного вписывания браузера.</figcaption>
 </figure>;
}

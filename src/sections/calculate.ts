import polygonClipping from 'polygon-clipping';
import {validateExpressions} from './expressions';
import type {Moments,SectionGeometry,SectionPart,PartResult,SectionResult,Edge,Point} from './types';
import {add,mul,rotate,vertices,edgesOf,pointOn,tangent,intersections,parameter,trimEdge,inside,norm,extrema,cross} from './geometry';
export class SectionError extends Error {}
export function polygonMoments(vertices:Point[]):Moments {
 // Green's theorem, centralised around a local reference to avoid translation cancellation.
 const origin=vertices[0]!,v=vertices.map(p=>({x:p.x-origin.x,y:p.y-origin.y}));let a=0,x=0,y=0,jx=0,jy=0,jxy=0;
 v.forEach((p,i)=>{const q=v[(i+1)%v.length]!,c=cross(p,q);a+=c;x+=(p.x+q.x)*c;y+=(p.y+q.y)*c;jx+=(p.y*p.y+p.y*q.y+q.y*q.y)*c;jy+=(p.x*p.x+p.x*q.x+q.x*q.x)*c;jxy+=(2*p.x*p.y+p.x*q.y+q.x*p.y+2*q.x*q.y)*c;});
 const sign=a<0?-1:1,area=sign*a/2,cx=x/(3*a),cy=y/(3*a);
 return {area,cx:cx+origin.x,cy:cy+origin.y,jx:sign*jx/12-area*cy*cy,jy:sign*jy/12-area*cx*cx,jxy:sign*jxy/24-area*cx*cy};
}
export function partMoments(part:SectionPart):PartResult {
 const s=part.shape;let local:Moments;
 if(s.kind==='circle')local={area:Math.PI*s.radius**2,cx:0,cy:0,jx:Math.PI*s.radius**4/4,jy:Math.PI*s.radius**4/4,jxy:0};
 else if(s.kind==='semicircle'){const area=Math.PI*s.radius**2/2,cy=4*s.radius/(3*Math.PI);local={area,cx:0,cy,jx:Math.PI*s.radius**4/8-area*cy**2,jy:Math.PI*s.radius**4/8,jxy:0};}
 else local=polygonMoments(vertices(s));
 const c=Math.cos(part.angle),t=Math.sin(part.angle),center=add(rotate({x:local.cx,y:local.cy},part.angle),{x:part.x,y:part.y});
 return {part,sign:part.cut?-1:1,area:local.area,cx:center.x,cy:center.y,jx:c*c*local.jx+t*t*local.jy+2*c*t*local.jxy,jy:t*t*local.jx+c*c*local.jy-2*c*t*local.jxy,jxy:c*t*(local.jy-local.jx)+(c*c-t*t)*local.jxy,edges:edgesOf(part)};
}
export function assertSectionGeometry(value:unknown):asserts value is SectionGeometry {
 if(!value||typeof value!=='object')throw new SectionError('Нужна геометрия сечения.');
 const g=value as SectionGeometry;
 if(g.version!==1||typeof g.name!=='string'||!Array.isArray(g.parts)||!g.parts.length||g.parts.length>100)throw new SectionError('Геометрия версии 1 должна содержать от 1 до 100 частей.');
 for(const key of ["a","b"] as const)if(g[key]!==undefined&&(!Number.isFinite(g[key])||g[key]!<=0))throw new SectionError("Размерные параметры должны быть положительными.");
 if(g.scheme!==undefined&&(!Number.isInteger(g.scheme)||g.scheme<1||g.scheme>30))throw new SectionError("Номер схемы вне 1–30.");
 if(g.dimensionRow!==undefined&&(!Number.isInteger(g.dimensionRow)||g.dimensionRow<1||g.dimensionRow>20))throw new SectionError("Строка размеров вне 1–20.");
 const ids=new Set<string>();
 for(const p of g.parts){
  if(!p||typeof p.id!=='string'||ids.has(p.id)||typeof p.name!=='string'||typeof p.cut!=='boolean'||![p.x,p.y,p.angle].every(Number.isFinite)||!p.shape)throw new SectionError('Некорректная часть: проверьте ID, положение и поворот.');ids.add(p.id);
  const s=p.shape;
  const positive=(...v:number[])=>v.every(x=>Number.isFinite(x)&&x>0);
  let valid=false;
  if(s.kind==='rectangle')valid=positive(s.width,s.height);
  if(s.kind==='triangle')valid=positive(s.width,s.height)&&Number.isFinite(s.apex);
  if(s.kind==='trapezoid')valid=positive(s.width,s.height,s.top)&&Number.isFinite(s.shift);
  if(s.kind==='circle'||s.kind==='semicircle')valid=positive(s.radius);
  if(s.kind==='polygon')valid=Array.isArray(s.vertices)&&s.vertices.length>=3&&s.vertices.length<=200&&s.vertices.every(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y));
  if(!valid)throw new SectionError(`Часть «${p.name}»: размеры должны быть конечными и положительными.`);
  const v=vertices(s);
  if(v.length){
   const scale=Math.max(...v.map(norm),1e-12),edges=edgesOf({...p,x:0,y:0,angle:0});
   if(polygonMoments(v).area<=scale**2*1e-12)throw new SectionError(`Часть «${p.name}»: вырожденный контур.`);
   edges.forEach((e,i)=>{if(e.kind==='line'&&norm({x:e.b.x-e.a.x,y:e.b.y-e.a.y})<scale*1e-12)throw new SectionError('Совпадающие соседние вершины.');edges.forEach((f,j)=>{if(j>i+1&&!(i===0&&j===edges.length-1)&&intersections(e,f,scale*1e-12).length)throw new SectionError('Многоугольник самопересекается.');});});
  }
 }
 if(!g.parts.some(p=>!p.cut))throw new SectionError('Добавьте хотя бы одну часть материала.');
 validateExpressions(g);
}
function boundaries(parts:PartResult[]):Edge[]{
 const all=parts.flatMap((r,index)=>r.edges.map(edge=>({edge,index}))),scale=Math.max(...all.flatMap(({edge:e})=>e.kind==='arc'?[e.r]:[norm({x:e.b.x-e.a.x,y:e.b.y-e.a.y})])),eps=scale*1e-9;
 const pieces=all.flatMap(({edge,index})=>{
  const cuts=[0,1,...all.flatMap(({edge:other})=>intersections(edge,other,eps*1e-2).map(p=>parameter(edge,p))).filter(t=>t>1e-10&&t<1-1e-10)].sort((a,b)=>a-b);
  return cuts.slice(1).flatMap((to,i)=>to-cuts[i]!>1e-10?[{edge:trimEdge(edge,cuts[i]!,to),index}]:[]);
 });
 const material=(p:Point)=>parts.some(r=>!r.part.cut&&inside(r.part,p))&&!parts.some(r=>r.part.cut&&inside(r.part,p));
 const covered=(p:Point)=>parts.some(r=>!r.part.cut&&inside(r.part,p,-eps*.01));
 // Exact straight-polygon overlap check; arcs are verified by partitioned analytical boundaries.
 for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
  const a=parts[i]!,b=parts[j]!;if(a.part.cut!==b.part.cut)continue;
  if(vertices(a.part.shape).length&&vertices(b.part.shape).length){
   const ring=(r:PartResult)=>r.edges.map(e=>{const p=pointOn(e,0);return [p.x,p.y] as [number,number];});
   const result=polygonClipping.intersection([ring(a)],[ring(b)]);
   const area=result.reduce((sum,poly)=>sum+poly.reduce((v,ring,i)=>v+(i?-1:1)*polygonMoments(ring.slice(0,-1).map(([x,y])=>({x,y}))).area,0),0);
   if(area>scale**2*1e-12)throw new SectionError(a.part.cut?'Вырезы пересекаются: нельзя вычитать одну область дважды.':'Части материала перекрываются. Разбейте их на неперекрывающиеся области.');
  }
 }
 const result:Edge[]=[];
 for(const {edge,index} of pieces){
  const mid=pointOn(edge,.5),t=tangent(edge,.5),normal=mul({x:-t.y,y:t.x},eps/norm(t)),left=add(mid,normal),right=add(mid,mul(normal,-1));
  for(const p of [left,right]){
   const positive=parts.filter(r=>!r.part.cut&&inside(r.part,p)),negative=parts.filter(r=>r.part.cut&&inside(r.part,p));
   if(positive.length>1)throw new SectionError('Части материала перекрываются. Разбейте их на неперекрывающиеся области.');
   if(negative.length>1)throw new SectionError('Вырезы пересекаются: двойное вычитание запрещено.');
   if(negative.length&&!covered(p))throw new SectionError('Вырез выходит за границу материала.');
  }
  if(parts[index]!.part.cut&&!covered(left))throw new SectionError('Вырез выходит за границу материала.');
  if(material(left)!==material(right))result.push(edge);
 }
 if(!result.length)throw new SectionError('После вырезов материал отсутствует или геометрия численно неразличима.');
 return result;
}
export function calculateSection(geometry:SectionGeometry):SectionResult {
 assertSectionGeometry(geometry);const parts=geometry.parts.map(partMoments),boundary=boundaries(parts),area=parts.reduce((s,r)=>s+r.sign*r.area,0);
 if(area<=0)throw new SectionError('Оставшаяся площадь должна быть положительной.');
 const ref=parts[0]!,sx=parts.reduce((s,r)=>s+r.sign*r.area*r.cy,0),sy=parts.reduce((s,r)=>s+r.sign*r.area*r.cx,0);
 const cx=ref.cx+parts.reduce((s,r)=>s+r.sign*r.area*(r.cx-ref.cx),0)/area,cy=ref.cy+parts.reduce((s,r)=>s+r.sign*r.area*(r.cy-ref.cy),0)/area;
 const jx=parts.reduce((s,r)=>s+r.sign*(r.jx+r.area*(r.cy-cy)**2),0),jy=parts.reduce((s,r)=>s+r.sign*(r.jy+r.area*(r.cx-cx)**2),0),jxy=parts.reduce((s,r)=>s+r.sign*(r.jxy+r.area*(r.cx-cx)*(r.cy-cy)),0);
 const trace=jx+jy,gap=Math.hypot(jx-jy,2*jxy),jmax=(trace+gap)/2,jmin=(trace-gap)/2;
 if(![area,cx,cy,jx,jy,jxy,jmax,jmin].every(Number.isFinite)||jmin<=0)throw new SectionError('Моменты инерции неположительны либо геометрия численно неустойчива.');
 const angleMax=gap<=trace*1e-12?null:.5*Math.atan2(-2*jxy,jx-jy),angleMin=angleMax===null?null:angleMax+Math.PI/2;
 const centralSx=parts.reduce((s,r)=>s+r.sign*r.area*(r.cy-cy),0),centralSy=parts.reduce((s,r)=>s+r.sign*r.area*(r.cx-cx),0);
 const span=Math.max(extrema(boundary,{x:1,y:0}).max-extrema(boundary,{x:1,y:0}).min,extrema(boundary,{x:0,y:1}).max-extrema(boundary,{x:0,y:1}).min);
 const principalProduct=angleMax===null?jxy:.5*Math.sin(2*angleMax)*(jx-jy)+Math.cos(2*angleMax)*jxy;
 const checks={static:Math.max(Math.abs(centralSx),Math.abs(centralSy))<=area*span*1e-9,principal:Math.abs(principalProduct)<=trace*1e-9,positive:jmin>0&&jmax>0,trace:Math.abs(jmax+jmin-trace)<=trace*1e-12};
 if(Object.values(checks).some(v=>!v))throw new SectionError('Проверки геометрических характеристик не выполнены.');
 return {parts,boundary,area,cx,cy,jx,jy,jxy,sx,sy,centralSx,centralSy,jmax,jmin,angleMax,angleMin,iMax2:jmax/area,iMin2:jmin/area,iMax:Math.sqrt(jmax/area),iMin:Math.sqrt(jmin/area),checks};
}
export function propertiesAtAxis(result:SectionResult,angle:number){
 const c=Math.cos(angle),s=Math.sin(angle),j=result.jx*c*c+result.jy*s*s-2*result.jxy*s*c,jOther=result.jy*c*c+result.jx*s*s+2*result.jxy*s*c,product=.5*Math.sin(2*angle)*(result.jx-result.jy)+Math.cos(2*angle)*result.jxy;
 const vertical=extrema(result.boundary,{x:-s,y:c}),horizontal=extrema(result.boundary,{x:c,y:s}),centerY=-s*result.cx+c*result.cy,centerX=c*result.cx+s*result.cy;
 const upper=vertical.max-centerY,lower=centerY-vertical.min,right=horizontal.max-centerX,left=centerX-horizontal.min;
 return {angle,j,jOther,product,upper,lower,right,left,wUpper:j/upper,wLower:j/lower,wRight:jOther/right,wLeft:jOther/left};
}

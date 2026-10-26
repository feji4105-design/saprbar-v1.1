import {useNumberFormat} from '../display/NumberFormat';
import {partMoments} from './calculate';
import {inUnit,type PartResult,type Unit} from './types';
import {vertices,cross} from './geometry';
export function PartCalculations({part,unit}:{part:PartResult;unit:Unit}){
 const {n}=useNumberFormat(),p=part.part,s=p.shape,local=partMoments({...p,x:0,y:0,angle:0}),u=(v:number,power=1)=>n(inUnit(v,unit,power));
 let A='',Jx='',Jy='',Jxy='';
 if(s.kind==='circle'||s.kind==='semicircle'){
  const semi=s.kind==='semicircle',d=semi?'2':'1';
  A=`πr²/${d} → π × (${u(s.radius)})²/${d}`;
  Jx=semi?`πr⁴/8 − A(4r/(3π))² → π × (${u(s.radius)})⁴/8 − ${u(local.area,2)} × (4 × ${u(s.radius)}/(3π))²`:`πr⁴/4 → π × (${u(s.radius)})⁴/4`;
  Jy=`πr⁴/${semi?8:4} → π × (${u(s.radius)})⁴/${semi?8:4}`;Jxy='0 → 0';
 }else if(s.kind==='rectangle'){
  A=`wh → ${u(s.width)} × ${u(s.height)}`;Jx=`wh³/12 → ${u(s.width)} × (${u(s.height)})³/12`;Jy=`hw³/12 → ${u(s.height)} × (${u(s.width)})³/12`;Jxy='0 → 0';
 }else if(s.kind==='triangle'){
  A=`wh/2 → ${u(s.width)} × ${u(s.height)}/2`;Jx=`wh³/36 → ${u(s.width)} × (${u(s.height)})³/36`;
  Jy=`wh(w²−wt+t²)/36 → ${u(s.width)} × ${u(s.height)} × ((${u(s.width)})²−${u(s.width)} × ${u(s.apex)}+(${u(s.apex)})²)/36`;
  Jxy=`wh²(2t−w)/72 → ${u(s.width)} × (${u(s.height)})² × (2 × ${u(s.apex)}−${u(s.width)})/72`;
 }else {
  let v=vertices(s);if(v.reduce((sum,p,i)=>sum+cross(p,v[(i+1)%v.length]!),0)<0)v=[...v].reverse();const terms=v.map((p,i)=>{const q=v[(i+1)%v.length]!,c=cross(p,q);return {p,q,c};});
  A=`½Σcᵢ, cᵢ=xᵢyᵢ₊₁−xᵢ₊₁yᵢ → ½ × (${terms.map(t=>u(t.c,2)).join(' + ')})`;
  Jx=`Σ(yᵢ²+yᵢyᵢ₊₁+yᵢ₊₁²)cᵢ/12 − Ayc² → (${terms.map(t=>u((t.p.y*t.p.y+t.p.y*t.q.y+t.q.y*t.q.y)*t.c,4)).join(' + ')})/12 − ${u(local.area,2)} × (${u(local.cy)})²`;
  Jy=`Σ(xᵢ²+xᵢxᵢ₊₁+xᵢ₊₁²)cᵢ/12 − Axc² → (${terms.map(t=>u((t.p.x*t.p.x+t.p.x*t.q.x+t.q.x*t.q.x)*t.c,4)).join(' + ')})/12 − ${u(local.area,2)} × (${u(local.cx)})²`;
  Jxy=`Σ(2xᵢyᵢ+xᵢyᵢ₊₁+xᵢ₊₁yᵢ+2xᵢ₊₁yᵢ₊₁)cᵢ/24 − Axc yc → (${terms.map(t=>u((2*t.p.x*t.p.y+t.p.x*t.q.y+t.q.x*t.p.y+2*t.q.x*t.q.y)*t.c,4)).join(' + ')})/24 − ${u(local.area,2)} × (${u(local.cx)}) × (${u(local.cy)})`;
 }
 const c=Math.cos(p.angle),t=Math.sin(p.angle);
 return <div>
  {s.kind==='polygon'&&<p>Локальные вершины ({unit}): {s.vertices.map(v=>`(${u(v.x)}; ${u(v.y)})`).join(', ')}. Интегралы по обходу против часовой стрелки.</p>}
  {s.kind==='trapezoid'&&<p>Нижнее основание w={u(s.width)}, верхнее t={u(s.top)}, высота h={u(s.height)}, смещение верхнего основания={u(s.shift)} {unit}; контур интегрируется как многоугольник.</p>}
  <p className="rgr-formula">A = {A} = {u(local.area,2)} {unit}².</p>
  <p className="rgr-formula">Jx,лок = {Jx} = {u(local.jx,4)} {unit}⁴.</p><p className="rgr-formula">Jy,лок = {Jy} = {u(local.jy,4)} {unit}⁴.</p><p className="rgr-formula">Jxy,лок = {Jxy} = {u(local.jxy,4)} {unit}⁴.</p>
  <p className="rgr-formula">C=O+RαCлок → ({u(p.x)} + {n(c)} × ({u(local.cx)}) − {n(t)} × ({u(local.cy)}); {u(p.y)} + {n(t)} × ({u(local.cx)}) + {n(c)} × ({u(local.cy)})) = ({u(part.cx)}; {u(part.cy)}) {unit}.</p>
  {p.angle!==0&&<><p className="rgr-formula">Jx′=c²Jx+s²Jy+2csJxy → ({n(c)})² × {u(local.jx,4)} + ({n(t)})² × {u(local.jy,4)} + 2 × {n(c)} × {n(t)} × ({u(local.jxy,4)}) = {u(part.jx,4)} {unit}⁴.</p><p className="rgr-formula">Jy′=s²Jx+c²Jy−2csJxy → ({n(t)})² × {u(local.jx,4)} + ({n(c)})² × {u(local.jy,4)} − 2 × {n(c)} × {n(t)} × ({u(local.jxy,4)}) = {u(part.jy,4)} {unit}⁴.</p><p className="rgr-formula">Jxy′=cs(Jy−Jx)+(c²−s²)Jxy → {n(c)} × {n(t)} × ({u(local.jy,4)}−{u(local.jx,4)}) + (({n(c)})²−({n(t)})²) × ({u(local.jxy,4)}) = {u(part.jxy,4)} {unit}⁴.</p></>}
 </div>;
}

import type {Point,Edge,SectionPart,Primitive} from './types';
export const TAU=2*Math.PI;
export const add=(a:Point,b:Point):Point=>({x:a.x+b.x,y:a.y+b.y});
export const sub=(a:Point,b:Point):Point=>({x:a.x-b.x,y:a.y-b.y});
export const mul=(a:Point,s:number):Point=>({x:a.x*s,y:a.y*s});
export const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y;
export const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
export const norm=(a:Point)=>Math.hypot(a.x,a.y);
export const rotate=(p:Point,a:number):Point=>({x:Math.cos(a)*p.x-Math.sin(a)*p.y,y:Math.sin(a)*p.x+Math.cos(a)*p.y});
export function vertices(shape:Primitive):Point[] {
 if(shape.kind==='polygon')return shape.vertices;
 if(shape.kind==='rectangle')return [{x:0,y:0},{x:shape.width,y:0},{x:shape.width,y:shape.height},{x:0,y:shape.height}];
 if(shape.kind==='triangle')return [{x:0,y:0},{x:shape.width,y:0},{x:shape.apex,y:shape.height}];
 if(shape.kind==='trapezoid'){const l=(shape.width-shape.top)/2+shape.shift;return [{x:0,y:0},{x:shape.width,y:0},{x:l+shape.top,y:shape.height},{x:l,y:shape.height}];}
 return [];
}
export const pointOn=(e:Edge,t:number):Point=>e.kind==='line'?add(e.a,mul(sub(e.b,e.a),t)):add(e.c,{x:e.r*Math.cos(e.start+e.sweep*t),y:e.r*Math.sin(e.start+e.sweep*t)});
export const tangent=(e:Edge,t:number):Point=>e.kind==='line'?sub(e.b,e.a):{x:-Math.sin(e.start+e.sweep*t),y:Math.cos(e.start+e.sweep*t)};
export const parameter=(e:Edge,p:Point):number=>e.kind==='line'?dot(sub(p,e.a),sub(e.b,e.a))/dot(sub(e.b,e.a),sub(e.b,e.a)):(((Math.atan2(p.y-e.c.y,p.x-e.c.x)-e.start)%TAU+TAU)%TAU)/e.sweep;
export function edgesOf(part:SectionPart):Edge[]{
 const world=(p:Point)=>add(rotate(p,part.angle),{x:part.x,y:part.y});
 if(part.shape.kind==='circle'||part.shape.kind==='semicircle'){
  const arc:Edge={kind:'arc',c:{x:part.x,y:part.y},r:part.shape.radius,start:part.angle,sweep:part.shape.kind==='circle'?TAU:Math.PI};
  return part.shape.kind==='circle'?[arc]:[arc,{kind:'line',a:world({x:-arc.r,y:0}),b:world({x:arc.r,y:0})}];
 }
 let v=vertices(part.shape);if(v.reduce((s,p,i)=>s+cross(p,v[(i+1)%v.length]!),0)<0)v=[...v].reverse();
 const w=v.map(world);return w.map((a,i)=>({kind:'line' as const,a,b:w[(i+1)%w.length]!}));
}
export function inside(part:SectionPart,p:Point,eps=0):boolean {
 const q=rotate(sub(p,{x:part.x,y:part.y}),-part.angle),s=part.shape;
 if(s.kind==='circle'||s.kind==='semicircle')return norm(q)<s.radius-eps&&(s.kind==='circle'||q.y>eps);
 const v=vertices(s);let on=false,result=false;
 for(let i=0,j=v.length-1;i<v.length;j=i++){
  const a=v[j]!,b=v[i]!,d=sub(b,a),t=dot(sub(q,a),d)/dot(d,d);
  if(t>=0&&t<=1&&norm(sub(q,add(a,mul(d,t))))<=Math.abs(eps)+1e-14)on=true;
  if((a.y>q.y)!==(b.y>q.y)&&q.x<(b.x-a.x)*(q.y-a.y)/(b.y-a.y)+a.x)result=!result;
 }
 return eps<0?result||on:result&&!on;
}
export function intersections(a:Edge,b:Edge,eps:number):Point[]{
 if(a.kind==='line'&&b.kind==='line'){
  const da=sub(a.b,a.a),db=sub(b.b,b.a),den=cross(da,db),off=sub(b.a,a.a);
  if(Math.abs(den)<=eps*Math.max(norm(da),norm(db))){
   if(Math.abs(cross(off,da))>eps*norm(da))return [];
   return [a.a,a.b,b.a,b.b].filter(p=>parameter(a,p)>=-1e-10&&parameter(a,p)<=1+1e-10&&parameter(b,p)>=-1e-10&&parameter(b,p)<=1+1e-10);
  }
  const t=cross(off,db)/den,u=cross(off,da)/den;return t>=-1e-10&&t<=1+1e-10&&u>=-1e-10&&u<=1+1e-10?[pointOn(a,t)]:[];
 }
 if(a.kind==='arc'&&b.kind==='line')return intersections(b,a,eps);
 if(a.kind==='line'&&b.kind==='arc'){
  const d=sub(a.b,a.a),f=sub(a.a,b.c),A=dot(d,d),B=2*dot(f,d),C=dot(f,f)-b.r*b.r,D=B*B-4*A*C;
  if(D< -eps*eps*A)return [];
  return [...new Set([(-B-Math.sqrt(Math.max(D,0)))/(2*A),(-B+Math.sqrt(Math.max(D,0)))/(2*A)])].filter(t=>t>=-1e-10&&t<=1+1e-10).map(t=>pointOn(a,t)).filter(p=>parameter(b,p)<=1+1e-10);
 }
 if(a.kind==='arc'&&b.kind==='arc'){
  const d=norm(sub(b.c,a.c));if(d<eps&&Math.abs(a.r-b.r)<eps)return [pointOn(a,0),pointOn(a,1),pointOn(b,0),pointOn(b,1)].filter(p=>parameter(a,p)<=1+1e-10&&parameter(b,p)<=1+1e-10);
  if(d>a.r+b.r+eps||d<Math.abs(a.r-b.r)-eps||d===0)return [];
  const x=(a.r*a.r-b.r*b.r+d*d)/(2*d),h=Math.sqrt(Math.max(0,a.r*a.r-x*x)),dir=mul(sub(b.c,a.c),1/d),base=add(a.c,mul(dir,x)),normal={x:-dir.y,y:dir.x};
  return [add(base,mul(normal,h)),add(base,mul(normal,-h))].filter(p=>parameter(a,p)<=1+1e-10&&parameter(b,p)<=1+1e-10);
 }
 return [];
}
export const trimEdge=(e:Edge,from:number,to:number):Edge=>e.kind==='line'?{kind:'line',a:pointOn(e,from),b:pointOn(e,to)}:{...e,start:e.start+e.sweep*from,sweep:e.sweep*(to-from)};
export function extrema(edges:Edge[],direction:Point):{min:number;max:number} {
 const values:number[]=[];
 for(const e of edges){values.push(dot(pointOn(e,0),direction),dot(pointOn(e,1),direction));if(e.kind==='arc')for(const angle of [Math.atan2(direction.y,direction.x),Math.atan2(direction.y,direction.x)+Math.PI]){
   const p=add(e.c,{x:e.r*Math.cos(angle),y:e.r*Math.sin(angle)});if(parameter(e,p)<=1+1e-10)values.push(dot(p,direction));
 }}
 return {min:Math.min(...values),max:Math.max(...values)};
}

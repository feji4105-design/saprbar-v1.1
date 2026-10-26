import {rotate,vertices} from './geometry';
import type {SectionGeometry,SectionPart,Point} from './types';
import {clearExpressions} from './expressions';

// Stretch polygonal geometry in world coordinates; preserve analytic circles.
export function resizeReferences(g:SectionGeometry,a:number,b:number):SectionGeometry{
 if(g.parts.some(p=>Object.keys(p.expressions??{}).length))throw Error('Для сечения с выражениями используйте режим переменных a/b.');
 if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0)throw Error('Размеры a и b должны быть положительными числами.');
 const sx=a/(g.a??a),sy=b/(g.b??b);
 const parts=g.parts.map(p=>{
  if(p.shape.kind==='circle'||p.shape.kind==='semicircle'){
   if(Math.abs(sx-sy)>1e-12)throw Error('Круговые части нельзя растянуть в эллипс. Измените их радиус в таблице или масштабируйте a и b одинаково.');
   return {...p,x:p.x*sx,y:p.y*sy,shape:{...p.shape,radius:p.shape.radius*sx}};
  }
  if(p.angle===0&&(p.shape.kind==='rectangle'||p.shape.kind==='triangle'||p.shape.kind==='trapezoid')){
   const s=p.shape;
   return {...p,x:p.x*sx,y:p.y*sy,shape:s.kind==='rectangle'?{...s,width:s.width*sx,height:s.height*sy}:s.kind==='triangle'?{...s,width:s.width*sx,height:s.height*sy,apex:s.apex*sx}:{...s,width:s.width*sx,height:s.height*sy,top:s.top*sx,shift:s.shift*sx}};
  }
  const points=vertices(p.shape).map(v=>rotate(v,p.angle)).map(v=>({x:v.x*sx,y:v.y*sy}));
  return {...p,x:p.x*sx,y:p.y*sy,angle:0,shape:{kind:'polygon' as const,vertices:points}};
 });
 return {...g,a,b,parts};
}
export function movedVertex(p:SectionPart,index:number,world:Point):SectionPart{
 const v=vertices(p.shape).map(q=>({...q}));
 v[index]=rotate({x:world.x-p.x,y:world.y-p.y},-p.angle);
 const keys=p.shape.kind==='polygon'?[`vertices.${index}.x`,`vertices.${index}.y`]:Object.keys(p.expressions??{}).filter(key=>key!=='x'&&key!=='y');
 return {...clearExpressions(p,keys),shape:{kind:'polygon',vertices:v}};
}

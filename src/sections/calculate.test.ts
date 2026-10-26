import {expect,it} from 'vitest';
import earcut from 'earcut';
import {calculateSection,propertiesAtAxis,polygonMoments} from './calculate';
import {catalogSection,dimensionRows,sectionCatalog,textbookExample} from './catalog';
import type {SectionGeometry,SectionPart,Point} from './types';
const part=(shape:SectionPart['shape'],x=0,y=0,cut=false,angle=0,id='p'):SectionPart=>({id,name:id,shape,x,y,cut,angle});
const g=(parts:SectionPart[]):SectionGeometry=>({version:1,name:'test',parts});
const rect=(w:number,h:number,x=0,y=0,cut=false,id='p')=>part({kind:'rectangle',width:w,height:h},x,y,cut,0,id);
it('rectangle analytic properties and exact fibres after rotation',()=>{
 const r=calculateSection(g([rect(2,4)]));expect(r.area).toBe(8);expect(r.cx).toBe(1);expect(r.cy).toBe(2);
 expect(r.jx).toBeCloseTo(2*4**3/12,12);expect(r.jy).toBeCloseTo(4*2**3/12,12);expect(r.jxy).toBeCloseTo(0,12);
 const a=propertiesAtAxis(r,0);expect(a.wUpper).toBeCloseTo(2*4**2/6,12);expect(a.wLeft).toBeCloseTo(4*2**2/6,12);
 const rotated=calculateSection(g([{...rect(2,4),angle:Math.PI/4}]));expect(propertiesAtAxis(rotated,0).upper).toBeCloseTo(3/Math.sqrt(2),12);
 expect(rotated.jmax).toBeCloseTo(r.jmax,12);expect(rotated.angleMax).not.toBeNull();
});
it('central rectangular hole subtracts all characteristics',()=>{
 const r=calculateSection(g([rect(4,6),rect(2,2,1,2,true,'hole')]));expect(r.area).toBe(20);expect(r.cx).toBe(2);expect(r.cy).toBe(3);
 expect(r.jx).toBeCloseTo((4*6**3-2*2**3)/12,12);expect(r.jy).toBeCloseTo((6*4**3-2*2**3)/12,12);
});
it('triangle, nonzero product and principal axes convention',()=>{
 const r=calculateSection(g([part({kind:'triangle',width:2,height:3,apex:0})]));
 expect(r.area).toBe(3);expect(r.cx).toBeCloseTo(2/3,12);expect(r.cy).toBe(1);
 expect(r.jx).toBeCloseTo(2*3**3/36,12);expect(r.jy).toBeCloseTo(3*2**3/36,12);expect(r.jxy).toBeCloseTo(-(2**2*3**2)/72,12);
 expect(propertiesAtAxis(r,r.angleMax!).product).toBeCloseTo(0,12);
 expect(propertiesAtAxis(r,r.angleMax!).j).toBeCloseTo(r.jmax,12);
});
it('semicircle uses exact PI and analytic curved extrema',()=>{
 const r=calculateSection(g([part({kind:'semicircle',radius:2})]));
 expect(r.area).toBeCloseTo(2*Math.PI,12);expect(r.cy).toBeCloseTo(8/(3*Math.PI),12);
 expect(r.jx).toBeCloseTo(2*Math.PI-2*Math.PI*(8/(3*Math.PI))**2,12);expect(r.jy).toBeCloseTo(2*Math.PI,12);
 const rotated=calculateSection(g([part({kind:'semicircle',radius:2},0,0,false,Math.PI/3)]));
 expect(propertiesAtAxis(rotated,Math.PI/3).upper).toBeCloseTo(2-r.cy,12);
});
it('ring, equal eigenvalues and non-unique direction',()=>{
 const r=calculateSection(g([part({kind:'circle',radius:2}),part({kind:'circle',radius:1},0,0,true,0,'cut')]));
 expect(r.area).toBeCloseTo(3*Math.PI,12);expect(r.jx).toBeCloseTo(15*Math.PI/4,12);expect(r.angleMax).toBeNull();expect(r.angleMin).toBeNull();
});
it('symmetric composite, scheme19 / independently chosen row19',()=>{
 expect(dimensionRows[18]).toMatchObject({a:50,b:14});const r=calculateSection(catalogSection(19,.5,.14,19));
 expect(r.area).toBeCloseTo(9*.5*.14,12);expect(r.cx).toBeCloseTo(.75,12);expect(r.cy).toBeCloseTo(13*.14/6,12);expect(r.jxy).toBeCloseTo(0,12);
 expect(catalogSection(19,.3,.18,1).scheme).toBe(19);expect(catalogSection(1,.5,.14,19).dimensionRow).toBe(19);
});
it('exact textbook example, errors from approximated textbook constants explained',()=>{
 const r=calculateSection(textbookExample());
 const A=.9*.48-.9*.24/2-Math.PI*.15**2/2;
 const yc=(.9*.48*.24-(.9*.24/2)*.4-(Math.PI*.15**2/2)*(4*.15/(3*Math.PI)))/A;
 const Jx=.9*.48**3/12+.9*.48*(.24-yc)**2-(.9*.24**3/36+(.9*.24/2)*(.4-yc)**2)-(Math.PI*.15**4/8-(Math.PI*.15**2/2)*(4*.15/(3*Math.PI))**2+(Math.PI*.15**2/2)*(4*.15/(3*Math.PI)-yc)**2);
 expect(r.area).toBeCloseTo(A,12);expect(r.cy).toBeCloseTo(yc,12);expect(r.jx).toBeCloseTo(Jx,12);expect(r.jy).toBeCloseTo(.48*.9**3/12-.24*.9**3/48-Math.PI*.15**4/8,12);
 expect(r.area*1e4).not.toBeCloseTo(2886.75,2);expect(r.centralSx).toBeCloseTo(0,12);
});
it('translation, rotation and dimensional scaling',()=>{
 const original=calculateSection(g([part({kind:'triangle',width:2,height:3,apex:.4})]));
 const shifted=calculateSection(g([part({kind:'triangle',width:2,height:3,apex:.4},100,-30,false,.7)]));
 expect(shifted.jmax).toBeCloseTo(original.jmax,10);expect(shifted.jmin).toBeCloseTo(original.jmin,10);
 for(const lambda of [.01,2,100]){
  const r=calculateSection(g([part({kind:'triangle',width:2*lambda,height:3*lambda,apex:.4*lambda})]));
  expect(r.area/original.area).toBeCloseTo(lambda**2,8);expect(r.jmax/original.jmax).toBeCloseTo(lambda**4,6);
  expect(propertiesAtAxis(r,0).wUpper/propertiesAtAxis(original,0).wUpper).toBeCloseTo(lambda**3,7);
 }
});
it('polygon independent oracle: exact triangle quadrature after earcut',()=>{
 const v:Point[]=[{x:0,y:0},{x:4,y:0},{x:4,y:1},{x:1,y:1},{x:1,y:3},{x:0,y:3}],indices=earcut(v.flatMap(p=>[p.x,p.y]));
 let A=0,Sx=0,Sy=0,Ix=0,Iy=0,Ixy=0;
 for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3).map(j=>v[j]!) as [Point,Point,Point];const area=Math.abs((b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y))/2;
  // Degree-2 exact quadrature with three barycentric points, independent of boundary sums.
  for(const weights of [[2/3,1/6,1/6],[1/6,2/3,1/6],[1/6,1/6,2/3]]){
   const p={x:a.x*weights[0]!+b.x*weights[1]!+c.x*weights[2]!,y:a.y*weights[0]!+b.y*weights[1]!+c.y*weights[2]!};
   A+=area/3;Sx+=area/3*p.y;Sy+=area/3*p.x;Ix+=area/3*p.y*p.y;Iy+=area/3*p.x*p.x;Ixy+=area/3*p.x*p.y;
  }
 }
 const r=polygonMoments(v);expect(r.area).toBeCloseTo(A,12);expect(r.cx).toBeCloseTo(Sy/A,12);expect(r.cy).toBeCloseTo(Sx/A,12);
 expect(r.jx).toBeCloseTo(Ix-Sx*Sx/A,12);expect(r.jy).toBeCloseTo(Iy-Sy*Sy/A,12);expect(r.jxy).toBeCloseTo(Ixy-Sx*Sy/A,12);
});
it('overlap/invalid cut detection, including round geometry and boundary-touching slots',()=>{
 for(const p of [g([rect(2,2),rect(2,2,1,1,false,'overlap')]),g([rect(2,2),rect(2,2,1,1,true,'outside')]),g([rect(3,3),rect(2,2,0,0,true,'a'),rect(2,2,1,1,true,'b')]),g([part({kind:'circle',radius:2}),part({kind:'circle',radius:2},1,0,false,0,'second')]),g([rect(2,2),part({kind:'circle',radius:1},0,0,true,0,'outside')])])expect(()=>calculateSection(p)).toThrow();
 const notch=calculateSection(g([rect(2,4),rect(2,1,0,3,true,'strip')]));expect(propertiesAtAxis(notch,0).upper).toBeCloseTo(1.5,12);
 expect(()=>calculateSection(g([part({kind:'polygon',vertices:[{x:0,y:0},{x:2,y:2},{x:0,y:2},{x:2,y:0}]})]))).toThrow();
});
it.each(sectionCatalog.filter(s=>s.confirmed).map(s=>s.number))('confirmed template %i passes for every dimension row',number=>{
 for(const row of dimensionRows){const r=calculateSection(catalogSection(number,row.a*.01,row.b*.01,row.number));expect(Object.values(r.checks).every(Boolean)).toBe(true);expect(r.jxy).toBeCloseTo(0,10);}
});
it('unconfirmed templates cannot silently calculate',()=>{for(const s of sectionCatalog.filter(s=>!s.confirmed))expect(()=>catalogSection(s.number,.5,.14)).toThrow(s.reason);});
it('trapezoid with shifted upper base: independent strip-integration expressions',()=>{
 const w=4,top=2,h=3,shift=.7,A=(w+top)*h/2,yc=h*(w+2*top)/(3*(w+top));
 const Ix=h**3*(w*w+4*w*top+top*top)/(36*(w+top)),Iy=h*(w**3+w*w*top+w*top*top+top**3)/48+shift**2/h**2*Ix;
 const r=calculateSection(g([part({kind:'trapezoid',width:w,top,height:h,shift})]));
 expect(r.area).toBeCloseTo(A,12);expect(r.cy).toBeCloseTo(yc,12);expect(r.cx).toBeCloseTo(w/2+shift*yc/h,12);
 expect(r.jx).toBeCloseTo(Ix,12);expect(r.jy).toBeCloseTo(Iy,12);expect(r.jxy).toBeCloseTo(shift/h*Ix,12);
});
it('unit powers and radius scaling remain consistent',async()=>{
 const {inUnit}=await import('./types');
 for(const [unit,factor] of [['mm',1e3],['cm',1e2],['m',1]] as const)for(const power of [1,2,3,4])expect(inUnit(1,unit,power)).toBeCloseTo(factor**power,1);
 const r=calculateSection(g([part({kind:'circle',radius:.2})]));expect(r.area).toBeCloseTo(Math.PI*.04,12);expect(r.jx).toBeCloseTo(Math.PI*.2**4/4,12);expect(r.iMax).toBeCloseTo(.1,12);
});

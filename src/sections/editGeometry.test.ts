import {expect,it} from 'vitest';
import {resizeReferences,movedVertex} from './editGeometry';
import {calculateSection} from './calculate';
import type {SectionGeometry} from './types';
const g:SectionGeometry={version:1,name:'rectangle',a:2,b:3,parts:[{id:'r',name:'r',cut:false,x:1,y:1,angle:0,shape:{kind:'rectangle',width:2,height:3}}]};
it('reference edits stretch full geometry and preserve independent analytic moments',()=>{
 const next=resizeReferences(g,4,9),r=calculateSection(next);
 expect(r.area).toBeCloseTo(36);expect(r.cx).toBeCloseTo(4);expect(r.cy).toBeCloseTo(7.5);
 expect(r.jx).toBeCloseTo(4*9**3/12);expect(r.jy).toBeCloseTo(9*4**3/12);expect(g.parts[0]!.shape).toEqual({kind:'rectangle',width:2,height:3});
});
it('world vertex editing respects local rotation and creates editable polygon',()=>{
 const p={...g.parts[0]!,angle:Math.PI/2};const next=movedVertex(p,2,{x:-3,y:4});
 expect(next.shape.kind).toBe('polygon');if(next.shape.kind==='polygon'){expect(next.shape.vertices[2]!.x).toBeCloseTo(3);expect(next.shape.vertices[2]!.y).toBeCloseTo(4);}
});
it('circles remain analytic: uniform rescale allowed, anisotropic deformation rejected',()=>{
 const circle:SectionGeometry={...g,parts:[{...g.parts[0]!,shape:{kind:'circle',radius:1}}]};
 expect(calculateSection(resizeReferences(circle,4,6)).area).toBeCloseTo(4*Math.PI);
 expect(()=>resizeReferences(circle,4,3)).toThrow('эллипс');expect(()=>resizeReferences(g,0,3)).toThrow();
});

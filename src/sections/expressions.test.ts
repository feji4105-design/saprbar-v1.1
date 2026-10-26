import {expect,it} from 'vitest';
import {evaluateLength,bindLength,resolveExpressions,validateExpressions,clearExpressions} from './expressions';
import {calculateSection} from './calculate';
import {movedVertex} from './editGeometry';
import {sectionForFrame} from './projectSection';
import {parseProjectJson,serializeProject} from '../model';
import {exampleProject} from '../examples/exampleProject';
import type {SectionGeometry,SectionPart} from './types';
const p:SectionPart={id:'r',name:'Rectangle',cut:false,x:0,y:0,angle:0,shape:{kind:'rectangle',width:.1,height:.1}};
it.each([['3a',1.14],['3а',1.14],['2*b',.28],['1,5б',.21],['a/2',.19],['(a+b)/2',.26],['2(a+b)',1.04],['-a + 2b',-.1],['3 * (a-b)',.72],['1e-3',.00001]])('arithmetic %s in cm gives SI %s',(text,expected)=>expect(evaluateLength(text,.38,.14,'cm')).toBeCloseTo(expected,13));
it.each(['','a/0','3aa+','Math.PI','window.alert(1)','a.constructor','3c','1 2','()','1e999','('.repeat(33)+'a'+')'.repeat(33)])('invalid expression rejected: %s',text=>expect(()=>evaluateLength(text,.38,.14,'cm')).toThrow());
it('length dimensions distinguish numeric coefficients, lengths and areas',()=>{
 expect(()=>evaluateLength('a*b',.38,.14,'cm')).toThrow('площадь');expect(()=>evaluateLength('a/b',.38,.14,'cm')).toThrow('длиной');
 expect(evaluateLength('3*4',.38,.14,'cm')).toBeCloseTo(.12);expect(evaluateLength('a*b/b',.38,.14,'cm')).toBeCloseTo(.38);
});
it('binding survives updates and units without rounding or changing literal dimensions',()=>{
 const base:SectionGeometry={version:1,name:'test',a:.38,b:.14,referenceMode:'variables',parts:[bindLength(p,'width','3a','cm',{a:.38,b:.14})]};
 expect(base.parts[0]!.shape.kind).toBe('rectangle');expect(base.parts[0]!.shape).toHaveProperty('height',.1);expect((base.parts[0]!.shape as {width:number}).width).toBeCloseTo(1.14,13);
 const next=resolveExpressions({...base,a:.4});expect(next.parts[0]!.shape).toEqual({kind:'rectangle',width:1.2,height:.1});expect(next.parts[0]!.expressions!.width!.text).toBe('3a');
 expect(calculateSection(next).area).toBeCloseTo(.12);expect(base.a).toBe(.38);
 const literals=bindLength(next.parts[0]!,'width','1200','mm',next);expect(literals.expressions).toBeUndefined();expect(literals.shape).toEqual({kind:'rectangle',width:1.2,height:.1});
 const shifted=bindLength(p,'x','a+2','cm',base);expect(resolveExpressions({...base,parts:[shifted]}).parts[0]!.x).toBeCloseTo(.4);
});
it('saved project preserves source; corrupt binding or computed number is rejected',()=>{
 const geometry:SectionGeometry={version:1,name:'expr',a:.38,b:.14,parts:[bindLength(p,'width','3a','cm',{a:.38,b:.14})]};
 const s=sectionForFrame(geometry,0,true,'expr'),project=structuredClone(exampleProject);project.model.sections.push(s);
 const loaded=parseProjectJson(serializeProject(project));expect(loaded.model.sections.at(-1)!.calculator!.geometry).toEqual(geometry);
 const bad=structuredClone(geometry);bad.a=.5;expect(()=>calculateSection(bad)).toThrow('расходятся');
 const unknown=structuredClone(geometry);unknown.parts[0]!.expressions!.foo={text:'a',unit:'cm'};expect(()=>validateExpressions(unknown)).toThrow('Недопустимое поле');
});
it('moving polygon vertex breaks only affected bindings, keeping other variables',()=>{
 const poly:SectionPart={...p,shape:{kind:'polygon',vertices:[{x:0,y:0},{x:.38,y:0},{x:0,y:.14}]},expressions:{'vertices.1.x':{text:'a',unit:'cm'},'vertices.2.y':{text:'b',unit:'cm'},x:{text:'0*a',unit:'cm'}}};
 const moved=movedVertex(poly,1,{x:.2,y:0});expect(moved.expressions!['vertices.1.x']).toBeUndefined();expect(moved.expressions!['vertices.2.y']!.text).toBe('b');
 expect(clearExpressions(moved,['x']).expressions!['vertices.2.y']).toBeDefined();
});

import {it,expect} from 'vitest';
import {sectionForFrame} from './projectSection';
import {calculateSection} from './calculate';
import {catalogSection} from './catalog';
import {parseProjectJson,serializeProject,validateProject} from '../model';
import {exampleProject} from '../examples/exampleProject';
import {analyzeProject} from '../solver';
const g=catalogSection(19,.5,.14,19);
it('explicit plane mapping, no automatic Jmax, and compatible JSON geometry',()=>{
 expect(()=>sectionForFrame(g,0,false,'section')).toThrow('Подтвердите');
 const result=calculateSection(g),s=sectionForFrame(g,0,true,'section');
 expect(s.area).toBeCloseTo(result.area,12);expect(s.inertiaZ).toBeCloseTo(result.jx,12);
 const p=structuredClone(exampleProject);p.model.sections.push(s);p.model.elements[0]!.sectionId=s.id;
 const loaded=parseProjectJson(serializeProject(p));expect(loaded.model.sections.at(-1)!.calculator!.geometry).toEqual(g);expect(analyzeProject(loaded).ok).toBe(true);
 const old=structuredClone(exampleProject);expect(parseProjectJson(serializeProject(old))).toEqual(old);
 loaded.model.sections.at(-1)!.inertiaZ*=2;expect(()=>parseProjectJson(JSON.stringify(loaded))).toThrow();expect(validateProject(loaded).diagnostics.some(d=>d.message.includes('расходятся'))).toBe(true);
});
it('non-principal plane blocked and principal selected plane allowed',()=>{
 const triangle={version:1 as const,name:'triangle',parts:[{id:'t',name:'t',cut:false,x:0,y:0,angle:0,shape:{kind:'triangle' as const,width:2,height:3,apex:0}}]},r=calculateSection(triangle);
 expect(()=>sectionForFrame(triangle,0,true,'s')).toThrow('связанный изгиб');
 expect(sectionForFrame(triangle,r.angleMin!,true,'s').inertiaZ).toBeCloseTo(r.jmin,12);
});

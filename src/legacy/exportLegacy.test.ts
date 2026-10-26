import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parseProjectJson} from '../model/projectFormat';
import {analyzeProject} from '../solver';
import {exportLegacySI} from './exportLegacy';
import {importLegacyFiles} from './importLegacy';
const source=()=>parseProjectJson(readFileSync(new URL('../../tests/fixtures/rgr1-scheme19/project.saprbar.json',import.meta.url),'utf8'));
const properties={thermalExpansion:1.2e-5,tensionMPa:70,compressionMPa:120};
describe('B/SI export',()=>{
 it('preserves numbered element references and independent axial solution',()=>{
  const p=source(), f=exportLegacySI(p,'RGRV4',2700,properties);
  const r=importLegacyFiles(f.CN,f.LD,f.MD,{variant:'B',unitSystem:'SI'});
  expect(r.ok).toBe(true);if(!r.ok)throw Error(JSON.stringify(r.issues));
  expect(r.report.blockers).toEqual([]);
  const a=analyzeProject(r.project);expect(a.ok).toBe(true);if(!a.ok)throw Error(JSON.stringify(a.diagnostics));
  // Right-hand section equilibrium: N = sum of external forces to the right.
  const forces=[-60000,-10000,70000,160000];
  for(const e of a.elements){const index=r.project.model.elements.findIndex(x=>x.id===e.elementId);for(const point of e.diagram)expect(point.axialForce).toBeCloseTo(forces[index]!,6);}
  const expected=p.model.elements.reduce((sum,e,i)=>sum+[160000,70000,-10000,-60000][i]! * [.75,.65,.5,.35][i]!/(80e9*p.model.sections.find(s=>s.id===e.sectionId)!.area),0);
  expect(a.displacements[4]!.ux).toBeCloseTo(expected,12);
  expect(a.reactions[0]!.fx).toBeCloseTo(-160000,6);
  expect(a.equilibrium.relativeResidual).toBeLessThan(1e-9);
 });
 it('round trips moments, uniform loads, releases, and arbitrary IDs',()=>{
  const p=source();p.model.elements[0]!.releases.rotationJ=true;
  p.loadCases[0]!.nodalLoads[0]!.fy=-123.45;p.loadCases[0]!.nodalLoads[0]!.mz=17.89;
  p.loadCases[0]!.elementLoads.push({id:'q',elementId:p.model.elements[0]!.id,type:'uniform-local',qx:12.34,qy:-56.78});
  const f=exportLegacySI(p,"MODEL",2700,properties),r=importLegacyFiles(f.CN,f.LD,f.MD,{variant:'B',unitSystem:'SI'});
  expect(r.ok).toBe(true);if(!r.ok)throw Error('import');
  expect(r.project.model.elements[3]!.releases.rotationJ).toBe(true);
  expect(r.project.loadCases[0]!.elementLoads[0]).toMatchObject({elementId:r.project.model.elements[3]!.id,qx:12.34,qy:-56.78});
  expect(r.project.loadCases[0]!.nodalLoads[0]).toMatchObject({fy:-123.45,mz:17.89});
 });
 it('requires an explicitly supplied positive density',()=>{
  for(const density of [undefined,0,-1,NaN,Infinity]) expect(()=>exportLegacySI(source(),'MODEL',density)).toThrow(/плотност/);
  const f=exportLegacySI(source(),'MODEL',2700,properties);expect(f.CN.text).toContain('80000000000 2700 1.2e-5');
 });
 it('requires explicit thermal and allowable properties and writes SI values',()=>{
  for(const thermalExpansion of [undefined,0,-1,NaN,Infinity]) expect(()=>exportLegacySI(source(),'MODEL',8000,{...properties,thermalExpansion:thermalExpansion as number})).toThrow(/aT/);
  for(const key of ['tensionMPa','compressionMPa'] as const) for(const value of [0,-1,NaN,Infinity,1e308]) expect(()=>exportLegacySI(source(),'MODEL',8000,{...properties,[key]:value})).toThrow(/Sp/);
  const f=exportLegacySI(source(),'MODEL',8000,properties);
  const rows=f.CN.text.trim().split(/\r?\n/).slice(10,14).map(row=>row.split(' ').map(Number));
  rows.forEach(row=>expect([row[2],row[3],row[8],row[9]]).toEqual([8000,1.2e-5,70e6,120e6]));
 });
 it('exports negative lower-fibre coordinates and round trips positive internal distances',()=>{
  const p=source(),f=exportLegacySI(p,'SIGN',8000,properties);
  const rows=f.CN.text.trim().split(/\r?\n/).slice(10,14).map(row=>row.split(' ').map(Number));
  const es=[...p.model.elements].sort((a,b)=>a.number-b.number);
  rows.forEach((row,i)=>{const section=p.model.sections.find(s=>s.id===es[i]!.sectionId)!;expect(row[6]).toBe(-section.yMinus);expect(row[7]).toBe(section.yPlus);expect(row[6]).toBeLessThan(0);});
  const imported=importLegacyFiles(f.CN,f.LD,f.MD,{variant:'B',unitSystem:'SI'});
  expect(imported.ok).toBe(true);if(!imported.ok)throw Error('import');
  imported.project.model.sections.forEach((s,i)=>{const original=p.model.sections.find(s=>s.id===es[i]!.sectionId)!;expect(s.yMinus).toBe(original.yMinus);expect(s.yPlus).toBe(original.yPlus);expect(s.area).toBe(original.area);expect(s.inertiaZ).toBe(original.inertiaZ);});
 });
 it('refuses invalid models and multiple load cases',()=>{
  const p=source();p.loadCases.push({...p.loadCases[0]!,id:'extra'});expect(()=>exportLegacySI(p,"MODEL",2700,properties)).toThrow();
  const q=source();q.model.elements[0]!.nodeI='missing';expect(()=>exportLegacySI(q,"MODEL",2700,properties)).toThrow();
 });
});

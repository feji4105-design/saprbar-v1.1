import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {expect,it} from "vitest";
import {unzipSync,strFromU8} from "fflate";
import {parseProjectJson,serializeProject,type LegacyExportSettings} from "../model";
import {exportLegacySI} from "./exportLegacy";
import {exportLegacyZip} from "./exportLegacyZip";
import {importLegacyFiles} from "./importLegacy";
import {analyzeProject} from "../solver";
const settings:LegacyExportSettings={profile:"B-SI-linear-static-v1",basename:"V4SIGN",density:8000,thermalExpansion:1.2e-5,tensionMPa:70,compressionMPa:120};
const source=()=>parseProjectJson(readFileSync(new URL('../../tests/fixtures/rgr1-scheme19/project.saprbar.json',import.meta.url),'utf8'));
const authentic=(ext:string)=>readFileSync(new URL(`../../tests/fixtures/saprbar-v4sign-authentic/V4SIGN.${ext}`,import.meta.url));

it('exported CN/LD/MD exactly match the three files accepted and solved by original SAPR-BAR 3.0',()=>{
 const p=source();p.legacyExport=settings;
 const files=exportLegacySI(p);
 for(const ext of ['CN','LD','MD'] as const){
  expect(Buffer.from(files[ext].text,'ascii')).toEqual(authentic(ext));
  expect(files[ext].name).toBe(`V4SIGN.${ext}`);
  expect(files[ext].text.replaceAll('\r\n','')).not.toMatch(/[\r\n]/);
 }
 expect(new TextDecoder('ibm866').decode(authentic('RES'))).toContain('Файл  FW  сформирован');
});
it('JSON persists export-only fields; old files open unchanged; absent data are never replaced by sample values',()=>{
 const p=source();expect(p.legacyExport).toBeUndefined();expect(parseProjectJson(serializeProject(p))).toEqual(p);
 expect(()=>exportLegacySI(p)).toThrow(/плотност/);
 p.legacyExport=settings;const loaded=parseProjectJson(serializeProject(p));expect(loaded.legacyExport).toEqual(settings);expect(exportLegacySI(loaded)).toEqual(exportLegacySI(p));
 for(const key of ['density','thermalExpansion','tensionMPa','compressionMPa'] as const){
  for(const value of [0,-1,NaN,Infinity]){const q=structuredClone(p);q.legacyExport![key]=value;expect(()=>serializeProject(q)).toThrow();expect(()=>parseProjectJson(JSON.stringify(q))).toThrow();}
  const data=JSON.parse(JSON.stringify(p));delete data.legacyExport[key];expect(()=>parseProjectJson(JSON.stringify(data))).toThrow();
 }
 for(const basename of ['../X','CON','nul','LPT1','123456789','кириллица','']){
  const q=structuredClone(p);q.legacyExport!.basename=basename;expect(()=>exportLegacySI(q)).toThrow();expect(()=>parseProjectJson(JSON.stringify(q))).toThrow();
 }
});
it('ZIP contains exactly three freshly generated ASCII/CRLF files with one shared name',()=>{
 const p=source();p.legacyExport=settings;const archive=exportLegacyZip(p);
 expect(archive.name).toBe('V4SIGN.zip');const entries=unzipSync(archive.bytes);
 expect(Object.keys(entries).sort()).toEqual(['V4SIGN.CN','V4SIGN.LD','V4SIGN.MD']);
 for(const ext of ['CN','LD','MD'] as const)expect(strFromU8(entries[`V4SIGN.${ext}`]!)).toBe(authentic(ext).toString('ascii'));
 p.loadCases[0]!.nodalLoads[0]!.fx=91000;
 expect(strFromU8(unzipSync(exportLegacyZip(p).bytes)['V4SIGN.LD']!)).toContain('2 91000 0 0');
});
it('new export/import agrees with original FW specimen and independent axial analytics',()=>{
 const p=source();p.legacyExport=settings;const f=exportLegacySI(p);
 const imported=importLegacyFiles(f.CN,f.LD,f.MD,{variant:'B',unitSystem:'SI'});expect(imported.ok).toBe(true);if(!imported.ok)throw Error('import');
 const a=analyzeProject(imported.project);expect(a.ok).toBe(true);if(!a.ok)throw Error('solve');
 const fw=authentic('FW');expect(createHash('sha256').update(fw).digest('hex')).toBe('568f12b2d413244b7f2e0151e96dc51bae0ca34e32122640af7cc4f2bc0d4ce4');
 // Offsets are researched ONLY for this pinned specimen; no production FW parser is implied.
 for(let i=0;i<5;i++){
  const node=imported.project.model.nodes[4-i]!,d=a.displacements.find(d=>d.nodeId===node.id)!;
  expect(d.ux).toBeCloseTo(fw.readDoubleLE(261+24*i),12);expect(d.uy).toBe(0);expect(d.rz).toBe(0);
 }
 const N=[-60000,-10000,70000,160000],sigma=[-40e6,-5e6,70e6,160000/.0024];
 for(let i=0;i<4;i++)for(let j=0;j<9;j++){
  expect(fw.readDoubleLE(1245+216*i+24*j)).toBeCloseTo(N[i]!,6);
  for(const point of a.elements[i]!.diagram){
   expect(point.axialForce).toBeCloseTo(fw.readDoubleLE(1245+216*i+24*j),6);
   expect(point.stressLower).toBeCloseTo(fw.readDoubleLE(2973+216*i+24*j),4);
   expect(point.stressUpper).toBeCloseTo(sigma[i]!,4);
  }
 }
 expect(a.reactions[0]!.fx).toBeCloseTo(-160000,6);expect(a.equilibrium.relativeResidual).toBeLessThan(1e-9);
});

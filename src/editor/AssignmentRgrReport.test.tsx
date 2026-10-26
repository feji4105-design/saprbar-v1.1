import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {parseProjectJson,type Project} from '../model';
import {analyzeProject} from '../solver';
import {NumberFormatProvider} from '../display/NumberFormat';
import {initialRgrOptions,axialReportData} from './axialReport';
import {hasCurrentAreaSizing} from './areaSizing';
import {RgrReport} from './RgrReport';
import {RgrReportDialog} from './RgrReportDialog';
const source=()=>parseProjectJson(readFileSync(new URL('../../tests/fixtures/rgr1-scheme19/project.saprbar.json',import.meta.url),'utf8'));
function report(p:Project,graphics=true,stale=false,criteria={}){
 const a=analyzeProject(p);if(!a.ok)throw Error(JSON.stringify(a.diagnostics));
 const o={...initialRgrOptions(p),reportKind:'assignment' as const,modulusConfirmed:true,includeGraphics:graphics,...criteria};
 return {a,o,html:renderToStaticMarkup(<NumberFormatProvider places={5}><RgrReport project={p} analysis={a} options={o} stale={stale}/></NumberFormatProvider>)};
}
it('scheme 19 variant 4: photographic mapping, strength minimum, axial oracle and balance',()=>{
 const p=source(),{a}=report(p);
 expect(p.model.elements.map(e=>e.number)).toEqual([4,3,2,1]);
 expect(p.model.elements.map(e=>p.model.sections.find(s=>s.id===e.sectionId)!.name)).toEqual(['A4','A1','A3','A2']);
 expect(p.loadCases[0]!.nodalLoads.map(l=>l.fx)).toEqual([90000,80000,50000,-60000]);
 const lengths=[.75,.65,.5,.35],ratios=[2.4,1,2,1.5],forces=[160000,70000,-10000,-60000];
 const min=Math.max(...forces.map((f,i)=>Math.abs(f)/(ratios[i]!*(f>=0?70e6:120e6))));
 expect(min).toBeCloseTo(.001,15);expect(hasCurrentAreaSizing(p,70,120)).toBe(true);
 let u=0;
 p.model.elements.forEach((e,i)=>{
  const s=p.model.sections.find(s=>s.id===e.sectionId)!;
  expect(s.area).toBeCloseTo(ratios[i]!*min,15);
  expect(a.elements[i]!.length).toBeCloseTo(lengths[i]!,12);
  a.elements[i]!.diagram.forEach(point=>{expect(point.axialForce).toBeCloseTo(forces[i]!,6);expect(point.shearForce).toBeCloseTo(0,8);expect(point.bendingMoment).toBeCloseTo(0,8);});
  u+=forces[i]!*lengths[i]!/(80e9*s.area);expect(a.displacements[i+1]!.ux).toBeCloseTo(u,12);
 });
 expect(a.displacements.map(d=>d.ux*1000)).toEqual(expect.arrayContaining([expect.closeTo(0),expect.closeTo(.625),expect.closeTo(1.19375),expect.closeTo(1.1625),expect.closeTo(.9875)]));
 expect(a.reactions[0]!.fx).toBeCloseTo(-160000,6);expect(a.equilibrium.relativeResidual).toBeLessThan(1e-9);
});
it('reference report follows seven steps, uses section names in denominators, preserves precision',()=>{
 const {html}=report(source());
 const headings=['ДАНО','1. Продольные силы','2. Соотношение площадей','3. Определение A₀','4. Принятые площади','5. Нормальные напряжения','6. Деформации участков','7. Перемещения сечений','Расчётная схема и эпюры'];
 headings.forEach((s,i)=>{expect(html).toContain(s);if(i)expect(html.indexOf(s)).toBeGreaterThan(html.indexOf(headings[i-1]!));});
 for(const s of ['σ1 = N1/A2','σ2 = N2/A3','σ3 = N3/A1','σ4 = N4/A4','1,19375','0,9875','66,66667','Площади подобраны','Прочность: обеспечена'])expect(html).toContain(s);
 expect(html.match(/class="rgr-chain-diagram"/g)).toHaveLength(3);
 expect(html).not.toMatch(/rgr-title-page|NaN|Infinity|solverVersion|schemaVersion/);
});
it('report recomputes after changed forces, handles missing criteria, stale results and graphics',()=>{
 const p=source();p.loadCases[0]!.nodalLoads[3]!.fx=-30000;
 const {html}=report(p,false);
 expect(html).toContain('−30 кН');expect(html).not.toContain('Площади подобраны');expect(html).not.toContain('<svg');
 expect(report(source(),true,true).html).not.toContain('rgr-chain-diagram');
 const missing=report(source(),false,false,{tensionMPa:'',modulusConfirmed:false}).html;
 expect(missing).toContain('не определяется');expect(missing).toContain('Прочность: не проверена полностью');expect(missing).toContain('Численные перемещения условные');
});
it('offers reference mode in dialog and refuses multiple restraints in this mode',()=>{
 const p=source(),{a,o}=report(p);
 const dialog=renderToStaticMarkup(<RgrReportDialog project={p} analysis={a} stale={false} options={o} onOptions={()=>{}} onClose={()=>{}} onPrint={()=>{}}/>);
 expect(dialog).toContain('По образцу РГР1 (7 шагов)');
 p.model.supports.push({nodeId:p.model.nodes[4]!.id,ux:true,uy:true,rz:true});
 const {a:multi,html}=report(p);expect(axialReportData(p,multi).ok).toBe(true);expect(html).toContain('Выберите полный или краткий отчёт');expect(html).not.toContain('N1 =');
});

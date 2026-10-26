import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {parseProjectJson,serializeProject,type Project} from '../model';
import {analyzeProject} from '../solver';
import {NumberFormatProvider} from '../display/NumberFormat';
import {initialRgrOptions,axialReportData} from './axialReport';
import {RgrReport} from './RgrReport';
import {RgrReportDialog} from './RgrReportDialog';
import {PrintReport} from './PrintReport';
import {PropertiesPanel} from './PropertiesPanel';
import {projectFromTask,taskFromProject,taskWithSizedArea,emptyAxialTask} from './axialTask';
import {hasCurrentAreaSizing} from './areaSizing';
const fixture=parseProjectJson(readFileSync(new URL('../../tests/fixtures/rgr-variant-4/VARIANT4.saprbar.json',import.meta.url),'utf8'));
function report(project:Project,places=3,graphics=false){
 const analysis=analyzeProject(project);if(!analysis.ok)throw Error('analysis');
 const options={...initialRgrOptions(project),reportKind:'short' as const,includeGraphics:graphics,tensionMPa:'70',compressionMPa:'120',displacementMM:'2.5',modulusConfirmed:true};
 const html=renderToStaticMarkup(<NumberFormatProvider places={places}><RgrReport project={project} analysis={analysis} options={options}/></NumberFormatProvider>);
 return {html,analysis,options};
}
it('short single-support RGR follows given→forces→areas→stress→deformation→displacement',()=>{
 const {html}=report(fixture);
 const labels=['Дано','1. Реакции','2. Проверка','3. Нормальные','4. Деформации','5. Перемещения','6. Проверка','Итог'];
 labels.forEach((s,i)=>{expect(html).toContain(s);if(i)expect(html.indexOf(s)).toBeGreaterThan(html.indexOf(labels[i-1]!));});
 expect(html).toContain('Площади заданы вручную');expect(html).toContain('A₀,треб');expect(html).toContain('A₀,прин');
 for(const value of ['Участок 4, узлы 1 → 2','6,200 · 10⁻⁴ м²','−110 кН','Жёсткость обеспечена'])expect(html).toContain(value);
 expect(html).not.toMatch(/rgr-title-page|Версия ядра|solver|schemaVersion|Nx|Qy|Mz|<svg|NaN|Infinity/);
 expect(report(fixture,3,true).html.match(/class="rgr-chain-diagram"/g)).toHaveLength(3);
});
it('two restraints: equilibrium and compatibility before reactions, correct analytic N',()=>{
 const p=structuredClone(fixture);
 p.model.nodes.forEach((v,i)=>v.x=i);
 p.model.elements.forEach(e=>e.sectionId=p.model.sections[0]!.id);
 p.model.supports=[0,4].map(i=>({nodeId:p.model.nodes[i]!.id,ux:true,uy:true,rz:true}));
 p.loadCases[0]!.nodalLoads=[{id:'P',nodeId:p.model.nodes[1]!.id,fx:40000,fy:0,mz:0}];
 const {html,analysis}=report(p);
 const data=axialReportData(p,analysis);if(!data.ok)throw Error(data.reason);
 expect(data.restraints[0]!.reaction).toBeCloseTo(-30000,7);expect(data.restraints[1]!.reaction).toBeCloseTo(-10000,7);
 data.rows.forEach((r,i)=>expect(r.N).toBeCloseTo(i===0?30000:-10000,7));
 expect(html).toContain('Степень статической неопределимости: 1');
 expect(html.indexOf('Условия совместности')).toBeLessThan(html.indexOf('Решение системы'));
 expect(html).toContain('ΣFсправа + ΣRсправа');expect(html).not.toContain('статически определима');
});
it('precision only affects text; solver, input fields, serialization and checks are untouched',()=>{
 const snapshot=serializeProject(fixture),result=analyzeProject(fixture);
 const low=report(fixture,0),high=report(fixture,8);
 expect(low.html).not.toBe(high.html);expect(low.analysis).toEqual(result);expect(high.analysis).toEqual(result);expect(serializeProject(fixture)).toBe(snapshot);
 expect(low.html).toContain('Прочность: обеспечена');expect(high.html).toContain('Прочность: обеспечена');
 const panels=[0,8].map(places=>renderToStaticMarkup(<NumberFormatProvider places={places}><PropertiesPanel project={fixture} selection={{kind:'element',id:fixture.model.elements[0]!.id}} onCommit={()=>{}}/></NumberFormatProvider>));
 panels.forEach(html=>expect(html).toContain('value="0.001488"'));
 // A rounded comparison must not turn a real failure into a pass.
 const options={...low.options,displacementMM:String(low.analysis.ok?Math.abs(low.analysis.displacements.at(-1)!.ux)*1000-1e-6:0)};
 const html=renderToStaticMarkup(<NumberFormatProvider places={0}><RgrReport project={fixture} analysis={low.analysis} options={options}/></NumberFormatProvider>);
 expect(html).toContain('Жёсткость не обеспечена');
});
it('sizing provenance survives JSON; manual edits and changed criteria invalidate it',()=>{
 const task={...emptyAxialTask(),rows:[{number:7,lengthCM:'100',ratio:'1',areaLabel:'A7'}],nodes:[{fixed:true,forceKN:'0',direction:'none' as const},{fixed:false,forceKN:'10',direction:'right' as const}],baseAreaMM2:'200',modulusGPa:'200',tensionMPa:'70',compressionMPa:'120'};
 expect(projectFromTask(task).metadata.areaSizing).toBeUndefined();
 const sized=taskWithSizedArea(task),p=parseProjectJson(serializeProject(projectFromTask(sized)));
 expect(hasCurrentAreaSizing(p,70,120)).toBe(true);expect(report(p).html).toContain('2. Подбор площадей по прочности');
 const restored=taskFromProject(p)!;expect(projectFromTask(restored).metadata.areaSizing).toBeDefined();
 expect(projectFromTask({...sized,baseAreaMM2:'999'}).metadata.areaSizing).toBeUndefined();
 expect(hasCurrentAreaSizing(p,71,120)).toBe(false);
 p.model.sections[0]!.area*=2;expect(report(p).html).toContain('2. Проверка прочности');
 expect(fixture.metadata.areaSizing).toBeUndefined();expect(parseProjectJson(serializeProject(fixture))).toEqual(fixture);
 const bad=structuredClone(p) as Project;bad.metadata.areaSizing!.minimumBaseArea=-1;
 expect(()=>parseProjectJson(JSON.stringify(bad))).toThrow();
});
it('stale output is blocked in preview, direct report and print; unsupported loads explained',()=>{
 const {analysis,options}=report(fixture);
 const dialog=renderToStaticMarkup(<RgrReportDialog project={fixture} analysis={analysis} options={options} stale onOptions={()=>{}} onClose={()=>{}} onPrint={()=>{}}/>);
 expect(dialog.match(/disabled=""/g)).toHaveLength(3);expect(dialog).not.toContain('rgr-preview');
 for(const html of [renderToStaticMarkup(<RgrReport project={fixture} analysis={analysis} options={options} stale/>),renderToStaticMarkup(<PrintReport project={fixture} analysis={analysis} rgrOptions={options} stale/>)] )expect(html).not.toContain('rgr-short');
 const p=structuredClone(fixture);p.loadCases[0]!.nodalLoads[0]!.fy=100;
 expect(report(p).html).toContain('Поперечные силы');
 const printed=renderToStaticMarkup(<PrintReport project={fixture} analysis={analysis} rgrOptions={options} stale={false}/>);
 expect(printed).toContain('rgr-short');expect(printed).not.toContain('rgr-title-page');
});

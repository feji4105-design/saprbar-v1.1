import {readFileSync} from "node:fs";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {parseProjectJson} from "../model";
import {analyzeProject} from "../solver";
import {importLegacyFiles} from "../legacy/importLegacy";
import {axialReportData,initialRgrOptions,positiveValue} from "./axialReport";
import {RgrReport} from "./RgrReport";
import {ResultsPanel} from "./ResultsPanel";
import {PrintReport} from "./PrintReport";

const project=parseProjectJson(readFileSync(new URL('../../tests/fixtures/rgr-variant-4/VARIANT4.saprbar.json',import.meta.url),'utf8'));
const analysis=analyzeProject(project);
if(!analysis.ok)throw Error(JSON.stringify(analysis.diagnostics));

it('вариант 4 с фото: усилия, реакция, напряжения, интеграл перемещений',()=>{
  expect(project.model.elements.map(e=>e.number)).toEqual([4,3,2,1]);
  const forces=[60000,-30000,-110000,-60000],areas=[1488,1240,930,620],lengths=[750,650,500,350];
  expect(analysis.reactions[0]!.fx).toBeCloseTo(-60000,7);
  let u=0;
  analysis.elements.forEach((e,i)=>{
    e.diagram.forEach(p=>{
      expect(p.axialForce).toBeCloseTo(forces[i]!,7);
      expect(p.shearForce).toBeCloseTo(0,8);expect(p.bendingMoment).toBeCloseTo(0,8);
      expect(p.stressUpper/1e6).toBeCloseTo(forces[i]!/areas[i]!,8);
    });
    u+=forces[i]!*lengths[i]!/(80000*areas[i]!);
    expect(analysis.displacements[i+1]!.ux*1000).toBeCloseTo(u,10);
  });
  expect(u).toBeCloseTo(-0.9811827956989247,9);
  expect(analysis.equilibrium.relativeResidual).toBeLessThan(1e-9);
});

it('CN/LD/MD и JSON дают одинаковые расчётные значения',()=>{
 const file=(ext:string)=>({name:`VARIANT4.${ext}`,text:readFileSync(new URL(`../../tests/fixtures/rgr-variant-4/VARIANT4.${ext}`,import.meta.url),'utf8')});
 const imported=importLegacyFiles(file('CN'),file('LD'),file('MD'),{variant:'B',unitSystem:'SI'});
 expect(imported.ok).toBe(true);if(!imported.ok)throw Error(JSON.stringify(imported.issues));
 expect(imported.report.blockers).toEqual([]);
 const result=analyzeProject(imported.project);expect(result.ok).toBe(true);if(!result.ok)throw Error('failure');
 result.displacements.forEach((d,i)=>expect(d.ux).toBeCloseTo(analysis.displacements[i]!.ux,12));
 expect(initialRgrOptions(imported.project)).toMatchObject({tensionMPa:'70',compressionMPa:'120',modulusConfirmed:false});
});

it('отчёт содержит все разделы, три вертикальные эпюры и условную проверку жёсткости',()=>{
 const options=initialRgrOptions(project);
 const markup=renderToStaticMarkup(<RgrReport project={project} analysis={analysis} options={options}/>);
 expect(markup).toContain('Расчётно-графическая работа');
 for(const title of ['Исходные данные и расчётная схема','1. Определение реакций','2. Расчёт по участкам','3. Проверки прочности и жёсткости','4. Эпюры','5. Итоговые результаты'])expect(markup).toContain(title);
 expect(markup.match(/class="rgr-chain-diagram"/g)).toHaveLength(3);
 expect(markup).toContain('611,111 мм²');expect(markup).toContain('Прочность: обеспечена');
 expect(markup).toContain('требуется подтвердить E');expect(markup).not.toContain('Жёсткость обеспечена');
 expect(markup).not.toMatch(/NaN|Infinity/);
 const missing=renderToStaticMarkup(<RgrReport project={project} analysis={analysis} options={{...options,modulusConfirmed:true}}/>);
 expect(missing).toContain('допускаемое перемещение [u] не задано');
 const confirmed=renderToStaticMarkup(<RgrReport project={project} analysis={analysis} options={{...options,modulusConfirmed:true,displacementMM:'1'}}/>);
 expect(confirmed).toContain('Жёсткость обеспечена');
 const failed=renderToStaticMarkup(<RgrReport project={project} analysis={analysis} options={{...options,modulusConfirmed:true,displacementMM:'.1',tensionMPa:'10'}}/>);
 expect(failed).toContain('Жёсткость не обеспечена');expect(failed).toContain('Прочность: не обеспечена');
 expect(renderToStaticMarkup(<PrintReport project={project} analysis={analysis} stale rgrOptions={options}/>)).not.toContain('rgr-chain-diagram');
});

it('осевые формулы не применяются к поперечной нагрузке, устаревшему результату и раме',()=>{
 const changed=structuredClone(project);changed.loadCases[0]!.nodalLoads[0]!.fy=100;
 expect(axialReportData(changed,analysis).ok).toBe(false);
 const twice=structuredClone(project);twice.model.supports.push({nodeId:twice.model.nodes[4]!.id,ux:true,uy:true,rz:true});
 expect(axialReportData(twice,analysis).ok).toBe(false);
 const bent=structuredClone(project);bent.model.nodes[2]!.y=.1;
 expect(axialReportData(bent,analysis).ok).toBe(false);
});

it('E влияет на перемещения, но не на статически определимые N и реакцию',()=>{
 const changed=structuredClone(project);changed.model.materials.forEach(m=>m.elasticModulus*=2);
 const doubled=analyzeProject(changed);if(!doubled.ok)throw Error('failure');
 doubled.displacements.forEach((d,i)=>expect(d.ux).toBeCloseTo(analysis.displacements[i]!.ux/2,12));
 doubled.elements.forEach((e,i)=>expect(e.diagram[0]!.axialForce).toBeCloseTo(analysis.elements[i]!.diagram[0]!.axialForce,7));
 expect(positiveValue('0,5')).toBe(.5);expect(positiveValue('')).toBe(null);expect(positiveValue('-1')).toBe(null);
});


it('три заделки: независимый эталон двух пролётов, реакции и совместность в РГР',()=>{
 const model=structuredClone(project);
 model.model.nodes.forEach((node,i)=>{node.x=i;node.y=0;});
 model.model.elements.forEach(e=>e.sectionId=model.model.sections[0]!.id);
 model.model.supports=[0,2,4].map(i=>({nodeId:model.model.nodes[i]!.id,ux:true,uy:true,rz:true}));
 model.loadCases[0]!.nodalLoads=model.loadCases[0]!.nodalLoads.slice(0,2).map((l,i)=>({...l,nodeId:model.model.nodes[i===0?1:3]!.id,fx:i===0?10000:20000,fy:0,mz:0}));
 const result=analyzeProject(model);if(!result.ok)throw Error('failure');
 const data=axialReportData(model,result);if(!data.ok)throw Error(data.reason);
 expect(data.restraints.map(s=>s.reaction)).toEqual(expect.arrayContaining([expect.closeTo(-5000,6),expect.closeTo(-15000,6),expect.closeTo(-10000,6)]));
 data.rows.forEach((r,i)=>expect(r.N).toBeCloseTo([5000,-5000,10000,-10000][i]!,6));
 expect(data.compatibility).toHaveLength(2);
 data.compatibility.forEach(c=>{
  expect(c.residual).toBeCloseTo(0,12);
  expect(c.coefficients.reduce((sum,a,j)=>sum+a*data.restraints[j]!.reaction,0)).toBeCloseTo(c.rhs,12);
 });
 const html=renderToStaticMarkup(<RgrReport project={model} analysis={result} options={initialRgrOptions(model)}/>);
 expect(html).toContain('Степень статической неопределимости: 2');
 expect(html.match(/Условие совместности между заделками/g)).toHaveLength(2);
 expect(html.match(/aria-label="Заделка в узле/g)).toHaveLength(3);
 expect(html.match(/class="rgr-chain-diagram"/g)).toHaveLength(3);
 expect(html).not.toMatch(/NaN|Infinity|свободного конца/);
});

it.each([2,4,5])('РГР поддерживает %i заделок с переменными площадями',count=>{
 const model=structuredClone(project);
 model.model.supports=[0,...[1,2,3,4].slice(5-count)].map(i=>({nodeId:model.model.nodes[i]!.id,ux:true,uy:true,rz:true}));
 const result=analyzeProject(model);if(!result.ok)throw Error('failure');
 const data=axialReportData(model,result);if(!data.ok)throw Error(data.reason);
 expect(data.restraints).toHaveLength(count);
 expect(data.compatibility).toHaveLength(count-1);
 data.compatibility.forEach(c=>expect(c.residual).toBeCloseTo(0,10));
});

it('таблицы результатов раскрываются, прокручиваются и показывают номера вместо ID',()=>{
 const html=renderToStaticMarkup(<ResultsPanel project={project} analysis={analysis} stale={false} layer="none" deformationScale={1} onLayer={()=>{}} onDeformationScale={()=>{}}/>);
 expect(html.match(/<details open="">/g)).toHaveLength(3);
 expect(html.match(/class="result-table-scroll"/g)).toHaveLength(3);
 project.model.nodes.forEach(n=>expect(html).not.toContain(n.id));
 project.model.elements.forEach(e=>expect(html).not.toContain(`<td>${e.id}</td>`));
});

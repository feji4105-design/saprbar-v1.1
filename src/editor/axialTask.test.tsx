import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {emptyAxialTask,emptyTaskNode,newTaskRow,insertTaskRow,removeTaskRow,splitTaskRow,resizeTask,deleteTaskSelection,projectFromTask,sizeTaskArea,taskErrors,taskFromProject,type AxialTask} from './axialTask';
import {initialRgrOptions} from './axialReport';
import {TaskSketch,AxialTaskDialog} from './AxialTaskDialog';
import {analyzeProject} from '../solver';
import {validateProject,parseProjectJson,serializeProject} from '../model';
const fixture=():AxialTask=>({...emptyAxialTask(),title:'РГР1',baseAreaMM2:'1000',modulusGPa:'80',tensionMPa:'70',compressionMPa:'120',rows:[4,3,2,1].map((number,i)=>({number,lengthCM:['75','65','50','35'][i]!,ratio:['2.4','1','2','1.5'][i]!,areaLabel:['A4','A1','A3','A2'][i]!})),nodes:[{...emptyTaskNode(),fixed:true},...[90,80,50,60].map((f,i)=>({fixed:false,forceKN:String(f),direction:i===3?'left' as const:'right' as const}))]});
describe('свободный ввод ступенчатого стержня',()=>{
 it('не навязывает схемы, числа, стрелки и заделку; требует явные данные',()=>{
  expect(taskErrors(emptyAxialTask()).length).toBeGreaterThan(0);expect(()=>projectFromTask(emptyAxialTask())).toThrow();
  const t=fixture();t.modulusGPa='';expect(taskErrors(t).join(' ')).toContain('E');t.modulusGPa='80';t.nodes.forEach(n=>n.fixed=false);expect(taskErrors(t).join(' ')).toContain('заделку');
  const markup=renderToStaticMarkup(<AxialTaskDialog onApply={()=>{}} onClose={()=>{}}/>);
  expect(markup).not.toContain('Числа варианта');expect(markup).not.toContain('Выберите схему');expect(markup).toContain('После выбранной');
 });
 it('сохраняет независимый порядок площадей и сверяется с RGR1',()=>{
  const p=projectFromTask(fixture());expect(validateProject(p).valid).toBe(true);
  expect(p.model.elements.map(e=>p.model.sections.find(s=>s.id===e.sectionId)!.name)).toEqual(['A4','A1','A3','A2']);
  const a=analyzeProject(p);if(!a.ok)throw Error('Расчёт не выполнен');
  expect(a.reactions[0]!.fx).toBeCloseTo(-160000,7);
  const N=[160000,70000,-10000,-60000];a.elements.forEach((e,i)=>expect(e.diagram[0]!.axialForce).toBeCloseTo(N[i]!,7));
  expect(a.displacements[4]!.ux*1000).toBeCloseTo(.9875,10);expect(sizeTaskArea(fixture())).toBeCloseTo(1000,8);
  const restored=taskFromProject(parseProjectJson(serializeProject(p)))!;
  expect(restored.rows.map(r=>r.areaLabel)).toEqual(['A4','A1','A3','A2']);expect(restored.nodes.map(r=>r.direction)).toEqual(['none','right','right','right','left']);
  restored.rows.forEach((r,i)=>expect(Number(r.lengthCM)).toBeCloseTo([75,65,50,35][i]!,12));
  expect(restored.baseAreaMM2).toBe('1000');expect(restored.tensionMPa).toBe('70');expect(restored.compressionMPa).toBe('120');
  expect(initialRgrOptions(parseProjectJson(serializeProject(p)))).toMatchObject({tensionMPa:'70',compressionMPa:'120'});
 });
 it('поддерживает более четырёх ступеней, сохранение и изменение топологии без потери нагрузок',()=>{
  let t=fixture();for(let i=0;i<8;i++){t=insertTaskRow(t,t.rows.length-1);t.rows.at(-1)!.lengthCM='10';}
  expect(t.rows).toHaveLength(12);expect(t.nodes).toHaveLength(13);
  const p=projectFromTask(t),r=taskFromProject(parseProjectJson(serializeProject(p)))!;
  expect(r.rows).toHaveLength(12);expect(r.nodes[4]!.forceKN).toBe('60');expect(analyzeProject(p).ok).toBe(true);
  const inserted=insertTaskRow(fixture(),0);expect(inserted.nodes[1]!.forceKN).toBe('90');expect(inserted.nodes[2]!.direction).toBe('none');expect(inserted.nodes[3]!.forceKN).toBe('80');
  const merged=removeTaskRow(fixture(),0);expect(merged.nodes[0]!.fixed).toBe(true);expect(merged.nodes[0]!.forceKN).toBe('90');
  const removed=removeTaskRow(t,11);expect(removed.rows).toHaveLength(11);expect(removed.nodes).toHaveLength(12);
 });
 it('две концевые заделки: совместность, реакции и подбор площади через фактическое решение',()=>{
  const t=fixture();t.rows=[{...newTaskRow(1),lengthCM:'100'},{...newTaskRow(2),lengthCM:'100'}];t.nodes=[{...emptyTaskNode(),fixed:true},{fixed:false,forceKN:'10',direction:'right'},{...emptyTaskNode(),fixed:true}];
  const p=projectFromTask(t),a=analyzeProject(p);if(!a.ok)throw Error('Расчёт не выполнен');
  expect(a.reactions.map(r=>r.fx)).toEqual([-5000,-5000]);expect(a.displacements[1]!.ux).toBeCloseTo(10000/(2*80e9*.001),12);
  expect(a.displacements[0]!.ux).toBe(0);expect(a.displacements[2]!.ux).toBe(0);
  expect(a.elements[0]!.diagram[0]!.axialForce).toBeCloseTo(5000,8);expect(a.elements[1]!.diagram[0]!.axialForce).toBeCloseTo(-5000,8);
  expect(sizeTaskArea(t)).toBeCloseTo(5000/70,8);
  expect(taskFromProject(p)!.nodes.map(n=>n.fixed)).toEqual([true,false,true]);
 });
 it('заделка справа или внутри, сила на левом конце и запятая во вводе',()=>{
  const t=fixture();t.rows=[{...newTaskRow(1),lengthCM:'50'},{...newTaskRow(2),lengthCM:'50'}];t.nodes=[{fixed:false,forceKN:'10,5',direction:'left'},emptyTaskNode(),{...emptyTaskNode(),fixed:true}];
  const p=projectFromTask(t),a=analyzeProject(p);if(!a.ok)throw Error('Расчёт не выполнен');expect(a.reactions[0]!.fx).toBeCloseTo(10500,8);
  a.elements.forEach(e=>expect(e.diagram[0]!.axialForce).toBeCloseTo(10500,8));
  t.nodes[1]!.fixed=true;t.nodes[2]!.fixed=false;t.nodes[2]!.direction='right';t.nodes[2]!.forceKN='3';
  const b=analyzeProject(projectFromTask(t));if(!b.ok)throw Error('Расчёт не выполнен');expect(b.displacements[1]!.ux).toBe(0);expect(b.elements[0]!.diagram[0]!.axialForce).toBeCloseTo(10500,8);expect(b.elements[1]!.diagram[0]!.axialForce).toBeCloseTo(3000,8);
 });
 it('предпросмотр отражает произвольные подписи, нулевые силы и заделки',()=>{
  const t=fixture();t.rows[0]!.areaLabel='Большое сечение';t.nodes[4]!.fixed=true;
  const markup=renderToStaticMarkup(<TaskSketch task={t} onRow={()=>{}} onNode={()=>{}}/>);
  expect(markup).toContain('Большое сечение');expect(markup).toContain('Узел 5, заделка');expect(markup).toContain('F2 = 90 кН');expect(markup).toContain('ℓ3 = 65 см');expect(markup).not.toMatch(/NaN|Infinity/);
 });
});

it('штриховка наружу на обоих концах; выбранная сторона сохраняется через JSON',()=>{
 const t=fixture();t.nodes[4]!.fixed=true;
 const markup=renderToStaticMarkup(<TaskSketch task={t}/>);
 expect(markup).toContain('data-side="left"');expect(markup).toContain('data-side="right"');
 t.nodes[1]!.fixed=true;t.nodes[1]!.fixedSide='right';
 expect(taskFromProject(parseProjectJson(serializeProject(projectFromTask(t))))!.nodes[1]!.fixedSide).toBe('right');
});

it('разделение длины на два равных участка сохраняет силу, реакцию, перемещения и общую длину',()=>{
 const t=fixture(),split=splitTaskRow(t,0);
 expect(split.rows[0]!.lengthCM).toBe('37.5');expect(split.rows[1]!.lengthCM).toBe('37.5');
 expect(split.nodes[1]!.direction).toBe('none');expect(split.nodes[2]!.forceKN).toBe('90');
 const original=analyzeProject(projectFromTask(t)),result=analyzeProject(projectFromTask(split));
 if(!original.ok||!result.ok)throw Error('Расчёт не выполнен');
 expect(result.reactions[0]!.fx).toBeCloseTo(original.reactions[0]!.fx,7);
 expect(result.displacements.at(-1)!.ux).toBeCloseTo(original.displacements.at(-1)!.ux,12);
 expect(result.elements[0]!.diagram[0]!.axialForce).toBeCloseTo(160000,7);expect(result.elements[1]!.diagram[0]!.axialForce).toBeCloseTo(160000,7);
});

it('изменение общей длины масштабирует перемещения и координаты, но сохраняет усилия',()=>{
 const t=fixture(),long=resizeTask(t,'450');expect(long.rows.map(r=>Number(r.lengthCM))).toEqual([150,130,100,70]);
 const a=analyzeProject(projectFromTask(t)),b=analyzeProject(projectFromTask(long));if(!a.ok||!b.ok)throw Error('Расчёт не выполнен');
 expect(b.displacements.at(-1)!.ux).toBeCloseTo(2*a.displacements.at(-1)!.ux,12);
 b.elements.forEach((e,i)=>expect(e.diagram[0]!.axialForce).toBeCloseTo(a.elements[i]!.diagram[0]!.axialForce,7));
 expect(()=>resizeTask(t,'0')).toThrow();
});

it('удаление отдельно выбранной силы или заделки и последней ступени',()=>{
 const t=fixture();
 const withoutForce=deleteTaskSelection(t,{kind:'force',index:0});expect(withoutForce.nodes[0]!.fixed).toBe(true);
 const withoutFixed=deleteTaskSelection(t,{kind:'fixed',index:1});expect(withoutFixed.nodes[1]!.forceKN).toBe('90');
 const only=emptyAxialTask(),cleared=removeTaskRow(only,0);expect(cleared.rows).toHaveLength(0);expect(cleared.nodes).toHaveLength(1);
 expect(renderToStaticMarkup(<TaskSketch task={cleared}/>)).not.toMatch(/NaN|Infinity/);
 expect(insertTaskRow(cleared,-1).rows).toHaveLength(1);
});

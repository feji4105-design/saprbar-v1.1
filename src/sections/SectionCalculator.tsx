import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {Section} from '../model';
import {useNumberFormat} from '../display/NumberFormat';
import {calculateSection,assertSectionGeometry,propertiesAtAxis} from './calculate';
import {catalogSection,dimensionRows,sectionCatalog,textbookExample} from './catalog';
import {unitLength,type SectionGeometry,type SectionPart,type Primitive,type Unit,type SectionResult} from './types';
import {sectionForFrame} from './projectSection';
import {SectionReport} from './SectionReport';
import {SectionDrawing,drawingLayout,type DrawingScale} from './SectionDrawing';
import reportCss from '../editor/rgrReport.css?raw';
import sectionCss from './sectionCalculator.css?raw';
import './sectionCalculator.css';
import {SectionSketch} from './SectionSketch';
import {resizeReferences} from './editGeometry';
import {bindLength,expressionUnit,resolveExpressions,getLength,isLiteralLength} from './expressions';
import type {LengthExpression} from './types';
function Numeric({label,value,onChange}:{label:string;value:number;onChange:(v:number)=>void}){
 const [text,setText]=useState(String(value)),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(document.activeElement!==input.current)setText(Number.isFinite(value)?String(value):'');},[value]);
 return <label>{label}<input ref={input} inputMode="decimal" value={text} onChange={e=>{setText(e.target.value);onChange(e.target.value.trim()?Number(e.target.value.replace(',','.')):NaN);}}/></label>;
}
const parameterLabels:Record<string,string>={width:"Ширина",height:"Высота",apex:"Вершина x",top:"Верхнее основание",shift:"Смещение верхнего основания",radius:"Радиус"};
const labels:Record<Primitive['kind'],string>={rectangle:'Прямоугольник / квадрат',triangle:'Треугольник',trapezoid:'Трапеция',circle:'Круг',semicircle:'Полукруг',polygon:'Многоугольник'};
function LengthField({label,value,binding,unit,onChange,error}:{label:string;value:number;binding:LengthExpression|undefined;unit:Unit;onChange:(text:string)=>void;error:string|undefined}){
 const {n}=useNumberFormat(),[text,setText]=useState(binding?.text??String(value/unitLength[unit])),ref=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(document.activeElement!==ref.current&&!error)setText(binding?.text??String(value/unitLength[unit]));},[value,binding?.text,unit,error]);
 return <label>{label}<input ref={ref} aria-label={label} aria-invalid={!!error} value={text} placeholder="3a, 2b, a/2" onChange={e=>{setText(e.target.value);onChange(e.target.value);}}/>{binding&&!error&&<small>= {n(value/unitLength[unit])} {unit}{binding.unit!==unit?` (выражение в ${binding.unit})`:''}</small>}{error&&<small role="alert">{error}</small>}</label>;
}
export function SectionCalculator({initial,initialAxisAngle=0,sectionId,onClose,onDraft,onUse,onPrint,onReportChange}:{initial?:SectionGeometry|null;initialAxisAngle?:number;onReportChange?:()=>void;sectionId?:string|null;onClose:()=>void;onDraft:(g:SectionGeometry)=>void;onUse:(s:Section)=>void;onPrint:(report:ReactNode)=>void}){
 const {n}=useNumberFormat(),[geometry,setGeometry]=useState(()=>initial??{...catalogSection(19,.5,.14,19),referenceMode:'variables' as const});
 const [scheme,setScheme]=useState(initial?.scheme??(initial?0:19)),[row,setRow]=useState(initial?.dimensionRow??19),[unit,setUnit]=useState<Unit>('cm');
 const [a,setA]=useState(String((initial?.a??.5)*100)),[b,setB]=useState(String((initial?.b??.14)*100));
 const [reason,setReason]=useState(''),[message,setMessage]=useState('');
 const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
 const [computed,setComputed]=useState<{signature:string;result:SectionResult}|null>(null),[short,setShort]=useState(true),[scale,setScale]=useState<DrawingScale>('fit');
 const [axis,setAxis]=useState(initialAxisAngle===0?'0':'manual'),[manualAngle,setManualAngle]=useState(initialAxisAngle*180/Math.PI),[confirmed,setConfirmed]=useState(false);
 const [addKind,setAddKind]=useState<Primitive['kind']|'ring'|'hollow'>('rectangle'),[addCut,setAddCut]=useState(false);
 const file=useRef<HTMLInputElement>(null),preview=useRef<HTMLDivElement>(null),id=useRef(sectionId??crypto.randomUUID());
 useEffect(()=>{onReportChange?.();},[axis,manualAngle,unit,short,scale]);
 const hasErrors=Object.keys(fieldErrors).length>0;
 const signature=JSON.stringify(geometry),fresh=!!computed&&computed.signature===signature&&!reason&&!hasErrors;
 const result=fresh?computed!.result:null;
 const selectedAngle=axis==='max'?result?.angleMax??0:axis==='min'?result?.angleMin??0:axis==='manual'?manualAngle*Math.PI/180:0;
 const plane=result?propertiesAtAxis(result,selectedAngle):null;
 const principal=!!plane&&!!result&&Math.abs(plane.product)<=result.jmax*1e-9;
 const fits=result?drawingLayout(result,scale).fits:false;
 const change=(next:SectionGeometry)=>{setGeometry(next);setComputed(null);setConfirmed(false);setMessage('');onDraft(next);};
 const custom=(parts:SectionPart[],variables=false,refs?:{a:number;b:number})=>{
  try{const values=refs??{a:Number(a.replace(',','.'))*unitLength[unit],b:Number(b.replace(',','.'))*unitLength[unit]};if(![values.a,values.b].every(v=>Number.isFinite(v)&&v>0))throw Error('Задайте положительные a и b.');let next:SectionGeometry={version:1,name:geometry.name,parts,...values,referenceMode:variables?'variables':geometry.referenceMode??'scale'};
   if(next.referenceMode==='variables')next=resolveExpressions(next);else if(geometry.a!==undefined&&geometry.b!==undefined&&(values.a!==geometry.a||values.b!==geometry.b))next=resizeReferences({...next,a:geometry.a,b:geometry.b},values.a,values.b);
   setScheme(0);setReason('');setFieldErrors(errors=>Object.fromEntries(Object.entries(errors).filter(([key])=>next.parts.some(p=>{if(!key.startsWith(`${p.id}:`))return false;try{getLength(p,key.slice(p.id.length+1));return true;}catch{return false;}}))));change(next);
  }catch(e){setReason(e instanceof Error?e.message:'Проверьте размеры.');setComputed(null);setConfirmed(false);onReportChange?.();}
 };
 const editReference=(aa:string,bb:string)=>{
  if(scheme){selectCatalog(scheme,aa,bb,row);return;}
  setA(aa);setB(bb);setComputed(null);setConfirmed(false);
  try{const av=Number(aa.replace(',','.'))*unitLength[unit],bv=Number(bb.replace(',','.'))*unitLength[unit];if(!Number.isFinite(av)||!Number.isFinite(bv)||av<=0||bv<=0)throw Error('Размеры a и b должны быть положительными числами.');const next=geometry.referenceMode==='variables'||geometry.parts.some(p=>Object.keys(p.expressions??{}).length)?resolveExpressions({...geometry,a:av,b:bv,referenceMode:'variables'}):resizeReferences({...geometry,a:geometry.a??Number(a.replace(',','.'))*unitLength[unit],b:geometry.b??Number(b.replace(',','.'))*unitLength[unit]},av,bv);setReason('');change(next);}catch(e){setReason(e instanceof Error?e.message:'Проверьте размеры.');onReportChange?.();}
 };
 const selectCatalog=(nextScheme:number,aa:string,bb:string,nextRow:number)=>{
  setScheme(nextScheme);setA(aa);setB(bb);setRow(nextRow);setComputed(null);setConfirmed(false);setFieldErrors({});
  try{const parsed=(s:string)=>Number(s.replace(',','.'))*unitLength[unit];const g=catalogSection(nextScheme,parsed(aa),parsed(bb),nextRow);setReason('');change({...g,referenceMode:'variables'});}catch(e){setReason(e instanceof Error?e.message:'Проверьте размеры.');}
 };
 const calculate=()=>{try{if(reason)throw Error(reason);const r=calculateSection(geometry);setComputed({signature,result:r});setMessage('Расчёт выполнен; все проверки пройдены.');}catch(e){setComputed(null);setMessage(e instanceof Error?e.message:'Расчёт не выполнен.');}};
 const save=()=>{try{assertSectionGeometry(geometry);const blob=new Blob([JSON.stringify({format:'saprbar-section',version:1,unit,geometry},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='section.saprsection.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);}catch(e){setMessage(e instanceof Error?e.message:'Не удалось сохранить.');}};
 const add=()=>{
  const r=result,position=r?Math.max(...r.parts.flatMap(p=>p.edges.flatMap(e=>e.kind==='arc'?[e.c.x+e.r]:[e.a.x,e.b.x])))+.05:0;
  const pose={x:addCut?(r?.cx??0):position,y:addCut?(r?.cy??0):0};
  const shape:Primitive=addKind==='circle'||addKind==='semicircle'||addKind==='ring'?{kind:addKind==='ring'?'circle':addKind,radius:.05}:addKind==='triangle'?{kind:'triangle',width:.1,height:.1,apex:.05}:addKind==='trapezoid'?{kind:'trapezoid',width:.1,height:.1,top:.05,shift:0}:addKind==='polygon'?{kind:'polygon',vertices:[{x:0,y:0},{x:.1,y:0},{x:0,y:.1}]}:{kind:'rectangle',width:.1,height:.1};
  const positive:SectionPart={id:crypto.randomUUID(),name:labels[shape.kind],cut:addCut,angle:0,...pose,shape},parts=[...geometry.parts,positive];
  if(addKind==='ring'||addKind==='hollow'){
   if(addCut){setMessage('Кольцо и полый прямоугольник добавляются как материал с внутренним вырезом.');return;}
   parts.push({...positive,id:crypto.randomUUID(),name:'Внутренний вырез',cut:true,shape:addKind==='ring'?{kind:'circle',radius:.025}:{kind:'rectangle',width:.05,height:.05},x:pose.x+(addKind==='hollow'?.025:0),y:pose.y+(addKind==='hollow'?.025:0)});
  }custom(parts);
 };
 const editPart=(index:number,patch:Partial<SectionPart>)=>custom(geometry.parts.map((p,i)=>i===index?{...p,...patch}:p));
 const editLength=(index:number,key:string,text:string)=>{
  const part=geometry.parts[index]!,errorKey=`${part.id}:${key}`;
  try{const refs={a:Number(a.replace(',','.'))*unitLength[unit],b:Number(b.replace(',','.'))*unitLength[unit]};if(![refs.a,refs.b].every(v=>Number.isFinite(v)&&v>0))throw Error('Задайте положительные a и b.');const next=bindLength(part,key,text,isLiteralLength(text)?unit:expressionUnit(part.expressions?.[key],unit),refs),resolved=resolveExpressions({...geometry,...refs,parts:geometry.parts.map((p,i)=>i===index?next:p)});setFieldErrors(errors=>{const clean={...errors};delete clean[errorKey];return clean;});custom(resolved.parts,!!next.expressions||geometry.referenceMode==='variables',refs);}
  catch(e){setFieldErrors(errors=>({...errors,[errorKey]:e instanceof Error?e.message:'Проверьте выражение.'}));setComputed(null);setConfirmed(false);onReportChange?.();}
 };
 const lengthField=(p:SectionPart,i:number,key:string,label:string)=><LengthField key={key} label={label} value={getLength(p,key)} binding={p.expressions?.[key]} unit={unit} error={fieldErrors[`${p.id}:${key}`]} onChange={text=>editLength(i,key,text)}/>;
 return <div className="modal-backdrop section-modal"><section className="section-calculator panel" role="dialog" aria-modal="true" aria-labelledby="section-title">
  <header className="panel-title"><h2 id="section-title">Сечения — калькулятор</h2><button onClick={onClose}>Назад к стержням</button></header>
  <div className="section-body">
   <div className="section-settings"><label>Схема сечения<select aria-label="Схема сечения" value={scheme} onChange={e=>{const value=Number(e.target.value);if(value)selectCatalog(value,a,b,row);else{custom(geometry.parts);}}}><option value={0}>Пользовательское</option>{sectionCatalog.map(s=><option key={s.number} value={s.number}>{s.number}{s.confirmed?'':' — требует уточнения'}</option>)}</select></label>
    <label>Строка размеров<select aria-label="Строка размеров" value={row} disabled={!scheme} onChange={e=>{const value=Number(e.target.value),d=dimensionRows[value-1]!;selectCatalog(scheme,String(d.a*.01/unitLength[unit]),String(d.b*.01/unitLength[unit]),value);}}>{dimensionRows.map(r=><option key={r.number} value={r.number}>{r.number}: a={r.a} см; b={r.b} см</option>)}</select></label>
    <label>Единицы<select aria-label="Единицы сечения" value={unit} onChange={e=>{const u=e.target.value as Unit;setA(String(Number(a.replace(',','.'))*unitLength[unit]/unitLength[u]));setB(String(Number(b.replace(',','.'))*unitLength[unit]/unitLength[u]));setUnit(u);}}><option value="mm">мм</option><option value="cm">см</option><option value="m">м</option></select></label>
    <label>a, {unit}<input aria-label="Размер a" inputMode="decimal" value={a} onChange={e=>editReference(e.target.value,b)}/></label><label>b, {unit}<input aria-label="Размер b" inputMode="decimal" value={b} onChange={e=>editReference(a,e.target.value)}/></label>
    <button onClick={()=>{setScheme(0);setReason('');setFieldErrors({});change({referenceMode:'variables',version:1,name:'Моё сечение',parts:[{id:crypto.randomUUID(),name:'Прямоугольник',cut:false,x:0,y:0,angle:0,shape:{kind:'rectangle',width:.1,height:.1}}]});}}>Создать пользовательское сечение</button>
    <button onClick={()=>{setScheme(0);setReason('');setFieldErrors({});change({...textbookExample(),referenceMode:'variables'});}}>Пример из методички</button>
    <button onClick={()=>{setScheme(0);setReason('');setFieldErrors({});setA('10');setB('10');if(unit!=='cm')setUnit('cm');change({referenceMode:'variables',version:1,name:'Мой чертёж',a:.1,b:.1,parts:[]});}}>Нарисовать с нуля</button>
   </div>
   <p className="hint">Схема и строка размеров независимы. Поворот части идёт вокруг заданного начала: у прямоугольника/многоугольника — локальное (0;0); у круга — центр; у полукруга — середина диаметра. Положительные части не должны перекрываться.</p>
   {reason&&<p role="alert" className="rgr-note">{reason}</p>}
   <p className="hint">Введите размеры и координаты числами или выражениями: 3a, 2*b, a/2, (a+b)/2. Например, a=38 см → 3a=114 см. При изменении a/b пересчитываются связанные поля; обычные числа остаются постоянными. Допустимы латинские a/b и русские а/б.</p>
   {!scheme&&<label>Режим a и b<select aria-label="Режим a и b" value={geometry.referenceMode??'scale'} onChange={e=>{if(e.target.value==='scale'&&geometry.parts.some(p=>Object.keys(p.expressions??{}).length)){setMessage('Сначала замените выражения обычными числами, чтобы растягивать всю геометрию.');return;}change({...geometry,referenceMode:e.target.value as 'variables'|'scale'});}}><option value="variables">Переменные для выражений</option><option value="scale">Растягивать всю геометрию (прежний режим)</option></select></label>}
   {hasErrors&&<p role="alert">Исправьте выражения в полях перед расчётом и сохранением.</p>}
   <label>Название сечения<input value={geometry.name} onChange={e=>change({...geometry,name:e.target.value})}/></label>
   {(!reason||!scheme)&&<SectionSketch geometry={geometry} unit={unit} onChange={g=>custom(g.parts)}/>}
   {(!reason||!scheme)&&<div className="section-parts">{geometry.parts.map((p,i)=><fieldset key={p.id}><legend>Часть {i+1}: {labels[p.shape.kind]}</legend><div className="section-settings">
    <label>Имя<input value={p.name} onChange={e=>editPart(i,{name:e.target.value})}/></label><label><input type="checkbox" checked={p.cut} onChange={e=>editPart(i,{cut:e.target.checked})}/> Вырез</label>
    {lengthField(p,i,'x',`x${i+1}, ${unit}`)}{lengthField(p,i,'y',`y${i+1}, ${unit}`)}<Numeric label={`Угол ${i+1}, °`} value={p.angle*180/Math.PI} onChange={v=>editPart(i,{angle:v*Math.PI/180})}/>
    {p.shape.kind==='polygon'?p.shape.vertices.map((_,j)=><div key={j} className="section-settings">{lengthField(p,i,`vertices.${j}.x`,`Вершина ${j+1} x части ${i+1}, ${unit}`)}{lengthField(p,i,`vertices.${j}.y`,`Вершина ${j+1} y части ${i+1}, ${unit}`)}</div>):Object.keys(p.shape).filter(key=>key!=='kind').map(key=>lengthField(p,i,key,`${parameterLabels[key]??key} ${i+1}, ${unit}`))}
    <button onClick={()=>custom(geometry.parts.filter((_,j)=>j!==i))}>Удалить часть {i+1}</button>
   </div></fieldset>)}</div>}
   <div className="section-settings"><label>Примитив<select value={addKind} onChange={e=>setAddKind(e.target.value as typeof addKind)}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}<option value="ring">Кольцо</option><option value="hollow">Полый прямоугольник</option></select></label><label><input type="checkbox" checked={addCut} onChange={e=>setAddCut(e.target.checked)}/> Добавить как вырез</label><button onClick={add}>Добавить часть</button><button className="primary" disabled={!!reason||hasErrors} onClick={calculate}>Рассчитать сечение</button><button disabled={!!reason||hasErrors} onClick={save}>Сохранить сечение</button><button onClick={()=>file.current?.click()}>Открыть сечение</button><input ref={file} hidden type="file" accept=".json,.saprsection.json" onChange={async e=>{const source=e.target.files?.[0];e.target.value='';if(!source)return;try{const data=JSON.parse(await source.text());if(data.format!=='saprbar-section'||data.version!==1)throw Error('Неподдерживаемый файл сечения.');assertSectionGeometry(data.geometry);const openedUnit:Unit=["mm","cm","m"].includes(data.unit)?data.unit:"cm";setUnit(openedUnit);setFieldErrors({});change(data.geometry);setScheme(data.geometry.scheme??0);setRow(data.geometry.dimensionRow??19);setReason('');if(data.geometry.a!==undefined)setA(String(data.geometry.a/unitLength[openedUnit]));if(data.geometry.b!==undefined)setB(String(data.geometry.b/unitLength[openedUnit]));}catch(error){setMessage(error instanceof Error?error.message:'Файл не открыт.');}}}/></div>
   <p aria-live="polite">{message}</p>{computed&&!fresh&&<p>Геометрия изменена: пересчитайте сечение.</p>}
   {result&&<><SectionDrawing result={result} unit={unit}/><div className="section-settings"><label>Плоскость изгиба<select aria-label="Плоскость изгиба" value={axis} onChange={e=>{setAxis(e.target.value);setConfirmed(false);}}><option value="0">Ось x калькулятора (0°)</option>{result.angleMax!==null&&<><option value="max">Главная ось Jmax</option><option value="min">Главная ось Jmin</option></>}<option value="manual">Угол вручную</option></select></label>{axis==='manual'&&<Numeric label="Угол оси, °" value={manualAngle} onChange={v=>{setManualAngle(v);setConfirmed(false);}}/>}
    <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Подтверждаю: выбранная ось соответствует локальной z стержня, перпендикулярная — локальной y</label><button disabled={!confirmed||!principal} onClick={()=>{try{onUse(sectionForFrame(geometry,selectedAngle,confirmed,id.current));setMessage('Сечение передано в проект. Расчёт стержней требуется выполнить заново.');}catch(e){setMessage(e instanceof Error?e.message:'Сечение не передано.');}}}>Использовать сечение в проекте</button></div>
    <p className="hint">Iz=Jxθ={n(plane!.j)} м⁴; y−={n(plane!.lower)} м; y+={n(plane!.upper)} м. {principal?'Выбранные оси главные; передача разрешается после подтверждения.':'Jxy ≠ 0: связанный изгиб не поддерживается плоским ядром; выберите главную ось.'} Полярный момент для кручения не используется.</p>
    <div className="section-settings"><label>Отчёт<select value={short?'short':'full'} onChange={e=>setShort(e.target.value==='short')}><option value="full">Полный отчёт</option><option value="short">Краткая РГР</option></select></label><label>Масштаб чертежа<select value={scale} onChange={e=>setScale(e.target.value as DrawingScale)}><option value="fit">Автоматическое вписывание</option><option value="2">1:2</option><option value="5">1:5</option></select></label><button disabled={!fits} onClick={()=>onPrint(<SectionReport geometry={geometry} result={result} unit={unit} angle={selectedAngle} short={short} scale={scale}/>)}>Печать сечения / A4</button><button disabled={!fits} onClick={()=>{const article=preview.current?.querySelector('.section-report');if(!article)return;const html=`<!doctype html><html lang="ru"><meta charset="utf-8"><title>Расчёт сечения</title><style>${reportCss}\n${sectionCss}</style><body>${article.outerHTML}</body></html>`,url=URL.createObjectURL(new Blob([html],{type:'text/html'})),link=document.createElement('a');link.href=url;link.download='section-report.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);}}>Скачать отчёт сечения</button></div>
    {!fits&&<p className="rgr-note">Чертёж не помещается на A4 в выбранном физическом масштабе. Выберите автоматическое вписывание.</p>}
    <div className="section-preview" ref={preview}><SectionReport geometry={geometry} result={result} unit={unit} angle={selectedAngle} short={short} scale={scale}/></div>
   </>}
  </div>
 </section></div>;
}

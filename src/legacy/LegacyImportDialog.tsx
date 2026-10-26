import { useState, type ChangeEvent } from "react";
import type { LegacyExportSettings, Project } from "../model";
import { importLegacyFiles } from "./importLegacy";
import type { LegacyImportResult, LegacyUnitSystem, LegacyVariant } from "./types";
import { createBlankLegacySet, createLegacyTemplate, type LegacyEditableSet } from "./templates";
import { convertCNVariant, StructuredLegacyEditor } from "./StructuredLegacyEditor";
import { exportLegacyZip } from "./exportLegacyZip";
import { exportLegacySI } from "./exportLegacy";
import { RecordReader } from "./parser";

interface Props { onSaveExportSettings?:((settings:LegacyExportSettings)=>void)|undefined; project?:Project|undefined; initialFiles?:LegacyEditableSet|undefined; initialVariant?:LegacyVariant|undefined; initialUnitSystem?:LegacyUnitSystem|undefined; onApply:(project:Project)=>void; onClose:()=>void }
const kinds=["CN","LD","MD"] as const;

function downloadLegacyFile(name:string,text:string):void {
  const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=name;anchor.click();URL.revokeObjectURL(url);
}

export function LegacyImportDialog({project,initialFiles,initialVariant="B",initialUnitSystem,onApply,onClose,onSaveExportSettings}:Props) {
  const [files,setFiles]=useState<LegacyEditableSet>(()=>initialFiles??createBlankLegacySet());const [variant,setVariant]=useState<LegacyVariant>(initialVariant);const [unitSystem,setUnitSystem]=useState<LegacyUnitSystem | "">(initialUnitSystem??"");const [result,setResult]=useState<LegacyImportResult|null>(null);const [editMode,setEditMode]=useState<"table"|"text">("table");
  const [basename,setBasename]=useState(project?.legacyExport?.basename??"MODEL");
  const [thermalExpansion,setThermalExpansion]=useState(project?.legacyExport?String(project.legacyExport.thermalExpansion):"");
  const [tensionMPa,setTensionMPa]=useState(project?.legacyExport?String(project.legacyExport.tensionMPa):"");
  const [compressionMPa,setCompressionMPa]=useState(project?.legacyExport?String(project.legacyExport.compressionMPa):"");
  const [density,setDensity]=useState(project?.legacyExport?String(project.legacyExport.density):"");
  const [exportError,setExportError]=useState("");
  const generate=(zip=false)=>{try{
    const settings:LegacyExportSettings={profile:"B-SI-linear-static-v1",basename,density:Number(density),thermalExpansion:Number(thermalExpansion),tensionMPa:Number(tensionMPa),compressionMPa:Number(compressionMPa)};
    const archive=zip?exportLegacyZip(project!,basename,settings.density,settings):null;
    const next=archive?.files??exportLegacySI(project!,basename,settings.density,settings);
    setFiles(next);setVariant("B");setUnitSystem("SI");
    setResult(importLegacyFiles(next.CN,next.LD,next.MD,{variant:"B",unitSystem:"SI"}));setExportError("");
    onSaveExportSettings?.(settings);
    if(archive){const url=URL.createObjectURL(new Blob([archive.bytes],{type:"application/zip"}));const link=document.createElement("a");link.href=url;link.download=archive.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
  }catch(error){setExportError(error instanceof Error?error.message:String(error));}};
  const pick=(kind:"CN"|"LD"|"MD")=>async(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];e.target.value="";if(file){const bytes=await file.arrayBuffer();let text:string;try{text=new TextDecoder("ibm866",{fatal:true}).decode(bytes);}catch{text=new TextDecoder().decode(bytes);}setFiles(x=>({...x,[kind]:{name:file.name,text}}));setResult(null);}};
  const update=(kind:"CN"|"LD"|"MD",patch:Partial<LegacyEditableSet[typeof kind]>)=>{setFiles(current=>({...current,[kind]:{...current[kind],...patch}}));setResult(null);};
  const inspect=()=>{if(!unitSystem)return;setResult(importLegacyFiles(files.CN,files.LD,files.MD,{variant,unitSystem}));};
  const elementCount=new RecordReader("CN",files.CN).records[0]?.values[1]??0;
  const loadTemplate=()=>{setFiles(createLegacyTemplate(variant));setUnitSystem("mm-kN-MPa");setResult(null);};
  const clear=()=>{if(window.confirm("Очистить тексты CN, LD и MD?")){setFiles(createBlankLegacySet());setResult(null);}};
  return <div className="modal-backdrop"><section className="legacy-dialog panel" role="dialog" aria-modal="true" aria-labelledby="legacy-title"><div className="panel-title"><h2 id="legacy-title">Редактор CN / LD / MD</h2><button onClick={onClose}>Закрыть</button></div><div className="legacy-body">
    <p className="legacy-caution"><strong>Ограничение проверки.</strong> Структура сверяется со справкой HELP_30B/R и документированным профилем. Числовой профиль B/SI проверен в оригинальном SAPR-BAR 3.0 на комплекте V4SIGN (осевая линейная статика). Это не подтверждает все модели и режимы.</p>
    <div className="legacy-options"><label>Вариант XC <select value={variant} onChange={e=>{const next=e.target.value as LegacyVariant;setFiles(current=>({...current,CN:{...current.CN,text:convertCNVariant(current.CN,variant,next)}}));setVariant(next);setResult(null);}}><option value="B">B — 10 полей</option><option value="R">R — 11 полей + SC</option></select></label><label>Единицы исходных чисел <select value={unitSystem} onChange={e=>{setUnitSystem(e.target.value as LegacyUnitSystem);setResult(null);}}><option value="" disabled>Выберите единицы</option><option value="mm-kN-MPa">мм, кН, МПа</option><option value="SI">м, Н, Па</option></select></label></div>
    <p className="hint">Единицы справкой не заданы. Выбор обязателен для переноса в современную SI-модель. Тексты сохраняются без автоматического пересчёта единиц.</p>
    {project&&<><div className="legacy-export-options"><label>Имя комплекта (1–8 латинских символов) <input aria-label="Имя комплекта" value={basename} maxLength={8} onChange={e=>setBasename(e.target.value)}/></label><label>Плотность Ro для всех материалов, кг/м³ <input aria-label="Плотность Ro" type="number" min="0" value={density} onChange={e=>setDensity(e.target.value)}/></label><label>Коэффициент aT для всех материалов, 1/К <input aria-label="Коэффициент aT" type="number" step="any" value={thermalExpansion} onChange={e=>setThermalExpansion(e.target.value)}/></label><label>Sp — допускаемое растяжение, МПа <input aria-label="Допускаемое растяжение Sp" type="number" step="any" value={tensionMPa} onChange={e=>setTensionMPa(e.target.value)}/></label><label>Sc — допускаемое сжатие, МПа <input aria-label="Допускаемое сжатие Sc" type="number" step="any" value={compressionMPa} onChange={e=>setCompressionMPa(e.target.value)}/></label></div><div className="legacy-editor-actions"><button onClick={()=>generate()}>Создать из текущей модели (B, SI)</button><button className="primary" onClick={()=>generate(true)}>Скачать комплект CN/LD/MD в ZIP</button></div><p className="hint">Заменяет тексты редактора. Экспортируется одно загружение: м, Н, Па; K=1, без собственного веса и сдвига. Ro, aT, Sp и Sc задаются отдельно для экспорта и одинаковы для всех материалов. Нули вместо отсутствующих свойств не подставляются. Параметры сохраняются в JSON проекта после создания комплекта. ZIP всегда создаётся заново из текущей модели. В оригинале проверен осевой эталон V4SIGN; другие модели требуют отдельной сверки.</p></>}{exportError&&<p role="alert">{exportError}</p>}
    <div className="legacy-editor-actions"><button onClick={loadTemplate}>Создать синтетический пример {variant}</button><button onClick={clear}>Новый пустой комплект</button><button className="primary" disabled={!unitSystem} onClick={inspect}>Проверить комплект</button></div>
    <div className="legacy-view-switch" role="tablist" aria-label="Режим редактора"><button role="tab" aria-selected={editMode==="table"} className={editMode==="table"?"active":""} onClick={()=>setEditMode("table")}>Таблицы</button><button role="tab" aria-selected={editMode==="text"} className={editMode==="text"?"active":""} onClick={()=>setEditMode("text")}>Текст</button></div>
    <div className="legacy-editors">{kinds.map(kind=><section key={kind} className="legacy-file-editor"><div className="legacy-file-head"><strong>{kind}</strong><label>Имя файла <input value={files[kind].name} onChange={e=>update(kind,{name:e.target.value})}/></label><label className="legacy-file-picker">Открыть<input type="file" accept={`.${kind.toLowerCase()},.${kind},text/plain`} onChange={pick(kind)}/></label><button onClick={()=>downloadLegacyFile(files[kind].name||`model.${kind}`,files[kind].text)}>Скачать {kind}</button></div>{editMode==="table"?<StructuredLegacyEditor kind={kind} file={files[kind]} variant={variant} elementCount={elementCount} onChange={text=>update(kind,{text})}/>:<textarea aria-label={`Текст ${kind}`} spellCheck={false} value={files[kind].text} onChange={e=>update(kind,{text:e.target.value})} placeholder={`Введите записи ${kind} по одной на строку`}/>}<small>{files[kind].text.split(/\r?\n/).filter(line=>line.trim()).length} непустых строк</small></section>)}</div>
    {result&&!result.ok&&<div className="import-errors"><h3>Импорт невозможен</h3><ul>{result.issues.map((x,i)=><li key={i}><strong>{x.file}, строка {x.line||"?"}, {x.field}:</strong> {x.message}</li>)}</ul></div>}
    {result?.ok&&<div className="import-preview"><h3>Предварительный отчёт</h3><p>{result.report.compatibilityStatement}</p><dl><dt>Узлы</dt><dd>{result.report.counts.nodes}</dd><dt>Стержни</dt><dd>{result.report.counts.elements}</dd><dt>Типы свойств</dt><dd>{result.report.counts.propertyTypes}</dd><dt>Опоры</dt><dd>{result.report.counts.supports}</dd><dt>Узловые нагрузки</dt><dd>{result.report.counts.nodalLoads}</dd><dt>Стержневые нагрузки</dt><dd>{result.report.counts.elementLoads}</dd></dl><h4>Принятые допущения</h4><ul>{result.report.assumptions.map(x=><li key={x}>{x}</li>)}</ul>{result.report.warnings.length>0&&<><h4>Предупреждения</h4><ul>{result.report.warnings.map((x,i)=><li key={i}>{x.file}:{x.line} {x.field} — {x.message}</li>)}</ul></>}{result.report.blockers.length>0&&<div className="blocked"><strong>Расчёт будет заблокирован</strong><ul>{result.report.blockers.map((x,i)=><li key={i}>{x.file}:{x.line} {x.field} — {x.message}</li>)}</ul></div>}<button className="primary" onClick={()=>onApply(result.project)}>Применить импортированную модель</button></div>}
  </div></section></div>;
}

import {SectionCalculator} from "./sections/SectionCalculator";
import type {SectionGeometry} from "./sections/types";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { exampleProject } from "./examples/exampleProject";
import { parseProjectJson, ProjectFormatError, serializeProject, validateProject, type Project } from "./model";
import { analyzeProject, type AnalysisResult } from "./solver";
import { PropertiesPanel } from "./editor/PropertiesPanel";
import { ResultsPanel } from "./editor/ResultsPanel";
import { SchemeCanvas, type EditorTool, type ResultLayer } from "./editor/SchemeCanvas";
import { createEmptyProject, finalizeEmptyProject, nextNumber, removeSelection, type Selection } from "./editor/projectActions";
import { useProjectHistory } from "./editor/useProjectHistory";
import { LegacyImportDialog } from "./legacy/LegacyImportDialog";
import { taskFromProject } from "./editor/axialTask";
import { AxialTaskDialog, TaskSketch } from "./editor/AxialTaskDialog";
import { RgrReportDialog } from "./editor/RgrReportDialog";
import { initialRgrOptions } from "./editor/axialReport";
import { PrintReport } from "./editor/PrintReport";
import "./styles.css";
import {NumberFormatProvider, PrecisionSelect} from "./display/NumberFormat";

function cloneExample(): Project { return structuredClone(exampleProject); }
function downloadProject(project: Project): void { const blob=new Blob([serializeProject(project)],{type:"application/json;charset=utf-8"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=`${project.metadata.title.trim().replaceAll(/[^\p{L}\p{N}-]+/gu,"-")||"project"}.saprbar.json`;anchor.click();URL.revokeObjectURL(url); }

export default function App() {
  const history=useProjectHistory(cloneExample()); const {project}=history;
  const [selection,setSelection]=useState<Selection>(null); const [tool,setTool]=useState<EditorTool>("select"); const [snap,setSnap]=useState(true); const [gridStep,setGridStep]=useState(0.5); const [elementStart,setElementStart]=useState<string|null>(null);
  const [analysis,setAnalysis]=useState<AnalysisResult|null>(null); const [stale,setStale]=useState(false); const [resultLayer,setResultLayer]=useState<ResultLayer>("none"); const [deformationScale,setDeformationScale]=useState(100); const [message,setMessage]=useState("Пример загружен. Выберите инструмент и редактируйте схему.");
  const [decimalPlaces,setDecimalPlaces]=useState(3);
  const [sectionsOpen,setSectionsOpen]=useState(false);
  const [sectionDraft,setSectionDraft]=useState<SectionGeometry|null>(null);
  const [sectionEditAngle,setSectionEditAngle]=useState(0);
  const [sectionEditId,setSectionEditId]=useState<string|null>(null);
  const [sectionPrint,setSectionPrint]=useState<ReactNode|null>(null);
  const [taskDialog,setTaskDialog]=useState(false);
  const [taskCriteria,setTaskCriteria]=useState<{id:string;tensionMPa:string;compressionMPa:string}|null>(null);
  const [legacyDialog,setLegacyDialog]=useState(false);
  const [rgrDialog,setRgrDialog]=useState(false);
  const [rgrMode,setRgrMode]=useState(false);
  const [rgrOptions,setRgrOptions]=useState(()=>initialRgrOptions(project));
  useEffect(()=>{setRgrOptions({...initialRgrOptions(project),...(taskCriteria?.id===project.metadata.id?{tensionMPa:taskCriteria.tensionMPa,compressionMPa:taskCriteria.compressionMPa}:{})});setRgrDialog(false);setRgrMode(false);},[project.metadata.id,taskCriteria]);
  const fileInput=useRef<HTMLInputElement>(null); const validation=useMemo(()=>validateProject(project),[project]); const freshResult=analysis?.ok&&!stale?analysis:null;
  const currentTask=useMemo(()=>taskFromProject(project),[project]);
  const legacyBlockers=project.legacyImport?.calculationBlockedReasons??[];
  const commit=(update:(project:Project)=>Project)=>{setSectionPrint(null);history.commit(update);if(analysis)setStale(true);};
  const historyChange=(action:()=>void)=>{setSectionPrint(null);action();if(analysis)setStale(true);};

  useEffect(()=>{const keyboard=(event:KeyboardEvent)=>{const target=event.target as HTMLElement;if(taskDialog||legacyDialog||rgrDialog||sectionsOpen)return;if(["INPUT","SELECT","TEXTAREA"].includes(target.tagName))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();historyChange(event.shiftKey?history.redo:history.undo);}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="y"){event.preventDefault();historyChange(history.redo);}else if((event.key==="Delete"||event.key==="Backspace")&&selection){event.preventDefault();commit((next)=>removeSelection(next,selection));setSelection(null);}else if(event.key==="Escape"){setElementStart(null);setTool("select");}};window.addEventListener("keydown",keyboard);return()=>window.removeEventListener("keydown",keyboard);});
  const openSections=()=>{
    const member=selection?.kind==='element'?project.model.elements.find(e=>e.id===selection.id):null;
    const section=member?project.model.sections.find(s=>s.id===member.sectionId):null;
    if(section?.calculator){setSectionDraft(section.calculator.geometry);setSectionEditId(section.id);setSectionEditAngle(section.calculator.axisAngle);}else {setSectionEditId(null);setSectionEditAngle(0);}
    setSectionPrint(null);setSectionsOpen(true);
  };
  const newProject=()=>{if(!window.confirm("Создать новый проект? Несохранённые изменения будут потеряны."))return;history.replace(finalizeEmptyProject(createEmptyProject()));setSelection(null);setAnalysis(null);setStale(false);setMessage("Создан новый проект. Добавьте узлы и стержни.");};
  const loadFile=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value="";if(!file)return;try{const loaded=parseProjectJson(await file.text());history.replace(loaded);setSelection(null);setAnalysis(null);setStale(false);setMessage(`Открыт проект «${loaded.metadata.title}».`);}catch(cause){const detail=cause instanceof ProjectFormatError?[cause.message,...cause.diagnostics.map((d)=>d.message)].join(" "):"Неизвестная ошибка.";setMessage(`Файл не открыт: ${detail}`);}};
  const save=()=>{try{downloadProject(project);setMessage("Проект сохранён в JSON.");}catch(cause){setMessage(cause instanceof ProjectFormatError?`${cause.message} ${cause.diagnostics.map((d)=>d.message).join(" ")}`:"Сохранение не выполнено.");}};
  const calculate=()=>{if(legacyBlockers.length){setMessage(`Расчёт заблокирован импортом: ${legacyBlockers.join(" ")}`);return;}const result=analyzeProject(project);setAnalysis(result);setStale(false);setResultLayer(result.ok?"axial":"none");setMessage(result.ok?`Расчёт выполнен: ${result.solverVersion}.`:`Расчёт остановлен: ${result.diagnostics.map((d)=>d.message).join(" ")}`);};
  const chooseTool=(next:EditorTool)=>{setTool(next);if(next!=="element")setElementStart(null);};
  const createNode=(x:number,y:number)=>{const id=crypto.randomUUID();commit((next)=>{next.model.nodes.push({id,number:nextNumber(next.model.nodes),x,y});return next;});setSelection({kind:"node",id});setTool("select");setMessage(`Создан узел (${x}; ${y}) м.`);};
  const createElement=(nodeId:string)=>{if(!elementStart){setElementStart(nodeId);setMessage("Выберите конечный узел стержня.");return;}if(elementStart===nodeId){setMessage("Начало и конец стержня должны различаться.");return;}const id=crypto.randomUUID();commit((next)=>{next.model.elements.push({id,number:nextNumber(next.model.elements),nodeI:elementStart,nodeJ:nodeId,materialId:next.model.materials[0]!.id,sectionId:next.model.sections[0]!.id,releases:{rotationI:false,rotationJ:false}});return next;});setElementStart(null);setSelection({kind:"element",id});setMessage("Стержень создан. Можно выбрать начало следующего.");};
  const deleteSelected=()=>{if(!selection)return;commit((next)=>removeSelection(next,selection));setSelection(null);setMessage("Объект удалён вместе с зависимыми нагрузками.");};

  return <NumberFormatProvider places={decimalPlaces}><main className="app-shell">
    <header className="app-header"><div><span className="eyebrow">SAPR-BAR Web · линейная статика</span><input className="project-title" value={project.metadata.title} aria-label="Название проекта" onChange={(e)=>commit((next)=>{next.metadata.title=e.target.value;return next;})}/></div><div className="file-actions"><button onClick={newProject}>Новый</button><button onClick={()=>{history.replace(cloneExample());setAnalysis(null);setStale(false);setSelection(null);}}>Пример</button><button onClick={()=>fileInput.current?.click()}>Открыть JSON</button><button onClick={()=>setTaskDialog(true)}>Ступенчатый стержень</button><button onClick={openSections}>Сечения</button><button onClick={()=>setLegacyDialog(true)}>Редактор CN/LD/MD</button><button onClick={save} disabled={!validation.valid}>Сохранить JSON</button><button onClick={()=>{setSectionPrint(null);setRgrMode(false);requestAnimationFrame(()=>window.print());}}>Печать</button><button disabled={!freshResult} onClick={()=>setRgrDialog(true)}>Отчёт РГР</button><button className="primary" onClick={calculate} disabled={!validation.valid||legacyBlockers.length>0} title={legacyBlockers.join("\n")}>Рассчитать</button><input ref={fileInput} hidden type="file" accept=".json,.saprbar.json,application/json" onChange={loadFile}/></div></header>
    <div className="message" aria-live="polite">{message}{stale&&<strong> Предыдущие результаты неактуальны.</strong>}</div>
    <nav className="toolbar" aria-label="Инструменты редактора"><PrecisionSelect value={decimalPlaces} onChange={setDecimalPlaces}/>{(["select","node","element","pan"] as EditorTool[]).map((item)=><button key={item} className={tool===item?"active":""} onClick={()=>chooseTool(item)}>{{select:"Выбор",node:"Узел",element:"Стержень",pan:"Панорама"}[item]}</button>)}<span className="separator"/><button onClick={()=>historyChange(history.undo)} disabled={!history.canUndo}>↶ Отменить</button><button onClick={()=>historyChange(history.redo)} disabled={!history.canRedo}>↷ Повторить</button><button onClick={deleteSelected} disabled={!selection}>Удалить</button><span className="separator"/><label className="inline-check"><input type="checkbox" checked={snap} onChange={(e)=>setSnap(e.target.checked)}/> Привязка</label><label className="grid-input">Сетка, м <input type="number" min="0.01" step="0.1" value={gridStep} onChange={(e)=>setGridStep(Math.max(0.01,e.target.valueAsNumber||0.5))}/></label>{elementStart&&<span className="tool-hint">Начало выбрано — укажите конец</span>}</nav>
    {currentTask&&<section className="panel" style={{marginTop:12,padding:12}}><div className="panel-title"><h2>Учебная схема ступенчатого стержня</h2><button onClick={()=>setTaskDialog(true)}>Изменить таблицу</button></div><TaskSketch task={currentTask}/></section>}
    <div className="workspace"><section className="canvas-panel panel"><SchemeCanvas project={project} selection={selection} tool={tool} snap={snap} gridStep={gridStep} elementStart={elementStart} result={freshResult} resultLayer={resultLayer} deformationScale={deformationScale} onResultLayer={setResultLayer} onSelect={setSelection} onCreateNode={createNode} onCreateElement={createElement} onMoveNode={(id,x,y)=>commit((next)=>{const node=next.model.nodes.find((item)=>item.id===id)!;node.x=x;node.y=y;return next;})}/></section><PropertiesPanel project={project} selection={selection} onCommit={commit} onEditSection={openSections}/></div>
    {!validation.valid&&<section className="validation panel"><div className="panel-title"><h2>Ошибки модели</h2><span>{validation.diagnostics.filter((d)=>d.severity==="error").length}</span></div><ul>{validation.diagnostics.map((item,index)=><li key={index} className={item.severity}><code>{item.path}</code> — {item.message}</li>)}</ul></section>}
    {legacyBlockers.length>0&&<section className="validation panel blocked"><div className="panel-title"><h2>Расчёт импортированной задачи заблокирован</h2><span>{legacyBlockers.length}</span></div><ul>{legacyBlockers.map((item,index)=><li key={index}>{item}</li>)}</ul></section>}
    <ResultsPanel project={project} analysis={analysis} stale={stale} layer={resultLayer} deformationScale={deformationScale} onLayer={setResultLayer} onDeformationScale={(value)=>setDeformationScale(Number.isFinite(value)?Math.max(0,value):100)}/>
    {sectionPrint?<div className="print-report">{sectionPrint}</div>:<PrintReport project={project} analysis={analysis} stale={stale} rgrOptions={rgrMode?rgrOptions:undefined}/>}
    {rgrDialog&&analysis?.ok&&<RgrReportDialog project={project} analysis={analysis} stale={stale} options={rgrOptions} precision={decimalPlaces} onPrecision={setDecimalPlaces} onOptions={setRgrOptions} onClose={()=>setRgrDialog(false)} onPrint={()=>{setSectionPrint(null);setRgrMode(true);requestAnimationFrame(()=>window.print());}}/>}
    {sectionsOpen&&<SectionCalculator initial={sectionDraft} initialAxisAngle={sectionEditAngle} sectionId={sectionEditId} onReportChange={()=>setSectionPrint(null)} onClose={()=>{setSectionsOpen(false);setSectionPrint(null);}} onDraft={g=>{setSectionDraft(g);setSectionPrint(null);}} onUse={section=>{commit(next=>{const index=next.model.sections.findIndex(s=>s.id===section.id);if(index>=0)next.model.sections[index]=section;else next.model.sections.push(section);if(selection?.kind==='element'){const member=next.model.elements.find(e=>e.id===selection.id);if(member)member.sectionId=section.id;}return next;});setMessage("Геометрия сечения сохранена в проекте. Пересчитайте стержни.");}} onPrint={report=>{setSectionPrint(report);requestAnimationFrame(()=>window.print());}}/>}
    {taskDialog&&<AxialTaskDialog initialTask={currentTask} onClose={()=>setTaskDialog(false)} onApply={(loaded,criteria)=>{history.replace(loaded);setTaskCriteria({id:loaded.metadata.id,...criteria});setSelection(null);setAnalysis(null);setStale(false);setTaskDialog(false);setMessage("Задание перенесено из таблицы. Проверьте схему и нажмите «Рассчитать».");}}/>}
    {legacyDialog&&<LegacyImportDialog onSaveExportSettings={settings=>history.commit(next=>{next.legacyExport=settings;return next;})} project={project} initialFiles={project.legacyImport?{CN:{name:project.legacyImport.cnFile,text:project.legacyImport.originalFiles.cn},LD:{name:project.legacyImport.ldFile,text:project.legacyImport.originalFiles.ld},MD:{name:project.legacyImport.mdFile,text:project.legacyImport.originalFiles.md}}:undefined} initialVariant={project.legacyImport?.variant} initialUnitSystem={project.legacyImport?.unitSystem} onClose={()=>setLegacyDialog(false)} onApply={(loaded)=>{history.replace(loaded);setSelection(null);setAnalysis(null);setStale(false);setLegacyDialog(false);setMessage(loaded.legacyImport?.calculationBlockedReasons.length?"Модель импортирована. Расчёт заблокирован из-за неподдерживаемых данных — см. список ниже.":"Модель импортирована по документированной структуре. Совместимость с оригинальным SAPR-BAR не проверена.");}}/>}
  </main></NumberFormatProvider>;
}

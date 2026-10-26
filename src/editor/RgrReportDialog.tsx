import {exportReportPdf} from "./exportReportPdf";
import {PrecisionSelect,useNumberFormat} from "../display/NumberFormat";
import { useRef,useState,useEffect } from "react";
import type { Project } from "../model";
import type { AnalysisSuccess } from "../solver";
import { RgrReport } from "./RgrReport";
import { axialReportData, type RgrOptions } from "./axialReport";
import exportCss from "./rgrReport.css?raw";
import "./rgrReport.css";

export function RgrReportDialog({project,analysis,stale,options,precision,onPrecision,onOptions,onClose,onPrint}:{
  project:Project;analysis:AnalysisSuccess;stale:boolean;options:RgrOptions;precision?:number;onPrecision?:(value:number)=>void;
  onOptions:(options:RgrOptions)=>void;onClose:()=>void;onPrint:()=>void;
}){
  const {places}=useNumberFormat();
  const [pdfBusy,setPdfBusy]=useState(false),[pdfError,setPdfError]=useState("");
  const generation=useRef(0);
  useEffect(()=>{setPdfBusy(false);setPdfError("");return()=>{generation.current++;};},[project,analysis,stale,options,places]);
  const preview=useRef<HTMLDivElement>(null);
  const data=stale?{ok:false as const,reason:"Модель изменена: пересчитайте её перед выводом отчёта."}:axialReportData(project,analysis);
  const fields=[['institution','Учебное заведение'],['discipline','Дисциплина'],['student','ФИО студента'],['group','Группа'],['teacher','Преподаватель'],['city','Город'],['year','Год'],['tensionMPa','[σ] растяжение, МПа'],['compressionMPa','[σ] сжатие, МПа'],['displacementMM','[u] допустимое, мм (если задано)']] as const;
  const cleanPdf=async()=>{
    const report=preview.current?.querySelector<HTMLElement>('.rgr-document');
    if(stale||!data.ok||!report||pdfBusy)return;
    const version=generation.current;
    setPdfBusy(true);setPdfError('');
    try {await exportReportPdf(report,'RGR-report.pdf',()=>generation.current===version);}
    catch {if(generation.current===version)setPdfError('Не удалось создать PDF. Повторите попытку или используйте печать с отключёнными колонтитулами.');}
    finally {if(generation.current===version)setPdfBusy(false);}
  };
  const download=()=>{
    if(stale||!data.ok||!preview.current)return;
    const title=project.metadata.title.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${exportCss}</style></head><body>${preview.current.innerHTML}</body></html>`;
    const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"})),link=document.createElement('a');link.href=url;link.download='RGR-report.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  };
  return <div className="modal-backdrop"><section className="legacy-dialog rgr-dialog panel" role="dialog" aria-modal="true" aria-labelledby="rgr-title">
    <div className="panel-title"><h2 id="rgr-title">Отчёт РГР</h2><button onClick={onClose}>Закрыть</button></div>
    <div className="legacy-body"><p>Пошаговый расчёт прямого ступенчатого стержня с одной или несколькими заделками и узловыми осевыми силами. Титульные поля и критерии проверки можно заполнить ниже. Они действуют в текущем сеансе; скачанный HTML сохраняет заполненный отчёт.</p>
      <div className="rgr-actions rgr-settings"><label>Вид отчёта <select value={options.reportKind??"full"} onChange={e=>onOptions({...options,reportKind:e.target.value as NonNullable<RgrOptions["reportKind"]>})}><option value="full">Полный отчёт</option><option value="short">Краткая РГР</option><option value="assignment">По образцу РГР1 (7 шагов)</option></select></label><label><input type="checkbox" checked={options.includeGraphics!==false} onChange={e=>onOptions({...options,includeGraphics:e.target.checked})}/> Включить схему и эпюры</label>{onPrecision&&<PrecisionSelect value={precision??places} onChange={onPrecision}/>}</div>
      <div className="rgr-fields">{fields.filter(([key])=>(!options.reportKind||options.reportKind==="full")||["tensionMPa","compressionMPa","displacementMM"].includes(key)).map(([key,label])=><label key={key}>{label}<input value={options[key]} onChange={e=>onOptions({...options,[key]:e.target.value})}/></label>)}</div>
      <label><input type="checkbox" checked={options.modulusConfirmed} onChange={e=>onOptions({...options,modulusConfirmed:e.target.checked})}/> Материал и E в модели проверены по условию задания</label>
      <p className="hint">Изменение критериев отчёта не меняет геометрию и материал модели. Чтобы изменить E или площади, закройте отчёт, отредактируйте модель и пересчитайте.</p>
      {stale&&<p className="rgr-note">Модель изменена: пересчитайте её перед выводом отчёта.</p>}
      {!stale&&!data.ok&&<p className="rgr-note">{data.reason}</p>}
      <div className="rgr-actions"><button className="primary" disabled={stale||!data.ok} onClick={()=>{if(!stale&&data.ok)onPrint();}}>Печать / PDF</button><button disabled={stale||!data.ok||pdfBusy} onClick={cleanPdf}>{pdfBusy?"Создание PDF…":"PDF без подписи и адреса"}</button><button disabled={stale||!data.ok} onClick={download}>Скачать HTML</button></div>
      <p className="hint">Кнопка «PDF без подписи и адреса» сохраняет отчёт без колонтитулов браузера. При обычной печати их можно убрать в окне печати, отключив «Колонтитулы».</p>
      {pdfError&&<p className="rgr-note" role="alert">{pdfError}</p>}
      {!stale&&data.ok&&<div className="rgr-preview" ref={preview}><RgrReport project={project} analysis={analysis} options={options}/></div>}
    </div>
  </section></div>;
}

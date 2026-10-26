import type {Project} from '../model';
import {useNumberFormat} from '../display/NumberFormat';
import {positiveValue,type axialReportData,type RgrOptions} from './axialReport';
import {Scheme,ChainDiagram} from './AxialReportFigures';
import {hasCurrentAreaSizing} from './areaSizing';
type Data=Extract<ReturnType<typeof axialReportData>,{ok:true}>;

/** Seven calculation steps follow the supplied RGR1.docx; values come from the current model. */
export function AssignmentRgrReport({project,data,options}:{project:Project;data:Data;options:RgrOptions}) {
 const {n,signed}=useNumberFormat();
 if(data.restraints.length!==1||data.restraints[0]!.x!==0)return <article className="rgr-document"><p className="rgr-note">Отчёт по образцу РГР1 предназначен для статически определимого бруса с одной заделкой. Выберите полный или краткий отчёт для нескольких заделок.</p></article>;
 const rows=[...data.rows].sort((a,b)=>a.member.number-b.member.number);
 const sections=[...new Map(data.rows.map(r=>[r.section.id,r.section])).values()].sort((a,b)=>a.name.localeCompare(b.name,'ru',{numeric:true}));
 const tension=positiveValue(options.tensionMPa),compression=positiveValue(options.compressionMPa);
 const required=rows.map(r=>({r,k:r.section.area/data.baseArea,allow:r.N<0?compression:tension}));
 const minimum=required.every(v=>v.allow!==null)?Math.max(...required.map(v=>Math.abs(v.r.N)/(v.k*v.allow!*1e6))):null;
 const sized=hasCurrentAreaSizing(project,tension,compression);
 const strength=required.every(v=>v.allow!==null&&Math.abs(v.r.stress)<=v.allow!*1e6*(1+1e-9));
 const numericActions=(r:Data['rows'][number])=>[...r.rightLoads,...r.rightReactions].map(l=>`(${signed(l.force/1000)})`).join(' + ')||'0';
 const forceRows=rows.map(r=>({r,force:data.loads.filter(l=>l.nodeId===r.end.id).reduce((sum,l)=>sum+l.force,0)}));
 return <article className="rgr-document rgr-assignment">
  <h1>Растяжение и сжатие ступенчатого бруса</h1><p className="rgr-assignment-subtitle">{project.metadata.title}</p>
  <section><h2>ДАНО</h2>
   <p>{forceRows.map(({r,force})=>`F${r.member.number} = ${n(Math.abs(force)/1000)} кН`).join('; ')}.</p>
   <p>{rows.map(r=>`ℓ${r.member.number} = ${n(r.length*100)} см = ${n(r.length)} м`).join('; ')}.</p>
   <p>{sections.map(s=>s.name).join(' : ')} = {sections.map(s=>n(s.area/data.baseArea)).join(' : ')}.</p>
   <p>[σ]р = {tension===null?'не задано':`${n(tension)} МПа`}; [σ]сж = {compression===null?'не задано':`${n(compression)} МПа`}.</p>
   <p>E = {[...new Set(data.rows.map(r=>n(r.material.elasticModulus/1e9)))].join('; ')} ГПа. {options.modulusConfirmed?'Модуль принят по проверенному источнику.':'E взят из модели; подтвердите его по источнику. Численные перемещения условные.'}</p>
   <p>Ось x направлена от заделки вдоль бруса; N &gt; 0 — растяжение, N &lt; 0 — сжатие. Направления сил: {forceRows.map(({r,force})=>`F${r.member.number}: ${signed(force/1000)} кН`).join('; ')}.</p>
  </section>
  <section><h2>1. Продольные силы</h2><p>Метод сечений: −N + ΣFсправа = 0 ⇒ N = ΣFсправа.</p>
   {rows.map(r=><p className="rgr-formula" key={r.member.id}>N{r.member.number} = {numericActions(r)} = {signed(r.N/1000)} кН.</p>)}
   <p>Реакция заделки: R = −ΣF = {signed(data.restraints[0]!.reaction/1000)} кН. Проверка: R + ΣF = {n((data.restraints[0]!.reaction+data.loads.reduce((s,l)=>s+l.force,0))/1000)} кН.</p>
  </section>
  <section><h2>2. Соотношение площадей</h2><p>A₀ — наименьшая базовая площадь. {sections.map(s=>`${s.name} = ${n(s.area/data.baseArea)}A₀`).join('; ')}.</p>
   <p>Соответствие по чертежу (слева направо): {data.rows.map(r=>`ℓ${r.member.number} → ${r.section.name}`).join('; ')}.</p>
  </section>
  <section><h2>3. Определение A₀ из условий прочности</h2><p>|σ| = |N|/A ≤ [σ]; при A = kA₀ получаем A₀ ≥ |N|/(k[σ]). Для растяжения используем [σ]р, для сжатия — [σ]сж.</p>
   {required.map(({r,k,allow})=><div className="rgr-section-calculation" key={r.member.id}>
    <p>Участок ℓ{r.member.number}, площадь {r.section.name} = {n(k)}A₀, {r.N>0?'растяжение':r.N<0?'сжатие':'не нагружен'}:</p>
    <p className="rgr-formula">A₀ ≥ {allow===null?'не определяется: задайте допускаемое напряжение':`${n(Math.abs(r.N))}/(${n(k)} × ${n(allow)} × 10⁶) = ${n(Math.abs(r.N)/(k*allow*1e6),true)} м²`}.</p>
   </div>)}
   <p>A₀,min = max(A₀,треб) = {minimum===null?'не определено':`${n(minimum,true)} м²`}.</p>
  </section>
  <section><h2>4. Принятые площади</h2><p>{sized?'Площади подобраны по прочности с сохранением заданного соотношения.':'Показаны площади текущей модели; найденный минимум не применяется к модели автоматически.'}</p>
   <p>A₀,прин = {n(data.baseArea,true)} м².</p>
   {sections.map(s=><p className="rgr-formula" key={s.id}>{s.name} = {n(s.area/data.baseArea)}A₀ = {n(s.area,true)} м² = {n(s.area*1e6)} мм².</p>)}
  </section>
  <section><h2>5. Нормальные напряжения</h2>
   {required.map(({r,allow})=><div key={r.member.id}><p className="rgr-formula">σ{r.member.number} = N{r.member.number}/{r.section.name} = ({n(r.N)} Н)/({n(r.section.area,true)} м²) = {n(r.stress,true)} Па = {signed(r.stress/1e6)} МПа.</p>
    <p>|σ{r.member.number}| = {n(Math.abs(r.stress)/1e6)} МПа; {allow===null?'допускаемое напряжение не задано':`[σ] = ${n(allow)} МПа — ${Math.abs(r.stress)<=allow*1e6*(1+1e-9)?'условие выполнено':'условие НЕ выполнено'}`}.</p></div>)}
   <p>Прочность: {minimum===null?'не проверена полностью':strength?'обеспечена':'не обеспечена'}.</p>
  </section>
  <section><h2>6. Деформации участков</h2><p>Δℓᵢ = Nᵢℓᵢ/(EᵢAучастка). Площадь каждого участка берётся по его подписи на схеме.</p>
   {rows.map(r=><p className="rgr-formula" key={r.member.id}>Δℓ{r.member.number} = ({n(r.N)} × {n(r.length)})/({n(r.material.elasticModulus,true)} × {n(r.section.area,true)}) = {n(r.delta,true)} м = {signed(r.delta*1000)} мм.</p>)}
  </section>
  <section><h2>7. Перемещения сечений</h2><p>В заделке u(0) = 0. Двигаясь вдоль оси x, суммируем деформации без промежуточного округления: uкон = uнач + Δℓ.</p>
   {data.rows.map(r=><p className="rgr-formula" key={r.member.id}>u({n(r.x1)} м) = {signed(r.u0*1000)} + ({signed(r.delta*1000)}) = {signed(r.u1*1000)} мм.</p>)}
   <p>Перемещение свободного конца: {signed(data.rows.at(-1)!.u1*1000)} мм; |u|max = {n(data.maximumDisplacement*1000)} мм.{!options.modulusConfirmed&&' Значения при принятом E; E по заданию не подтверждён.'}</p>
  </section>
  {options.includeGraphics!==false&&<section className="rgr-epures"><h2>Расчётная схема и эпюры</h2><p>Единая ось x; независимые вертикальные масштабы. Положительные значения выше оси, отрицательные ниже.</p><Scheme data={data}/><ChainDiagram data={data} kind="N" confirmed={options.modulusConfirmed}/><ChainDiagram data={data} kind="sigma" confirmed={options.modulusConfirmed}/><ChainDiagram data={data} kind="u" confirmed={options.modulusConfirmed}/></section>}
 </article>;
}

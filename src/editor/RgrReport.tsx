import {AssignmentRgrReport} from "./AssignmentRgrReport";
import {useNumberFormat} from "../display/NumberFormat";
import {formatNumber} from "../display/formatNumber";
import {ShortRgrReport} from "./ShortRgrReport";
import type { Project } from "../model";
import type { AnalysisSuccess } from "../solver";
import { axialReportData, positiveValue, type RgrOptions } from "./axialReport";

export const reportNumber=formatNumber;
import {Scheme,ChainDiagram} from "./AxialReportFigures";
import {hasCurrentAreaSizing} from "./areaSizing";

export function RgrReport({project,analysis,options,stale=false}:{project:Project;analysis:AnalysisSuccess;options:RgrOptions;stale?:boolean}){
  const {n,signed}=useNumberFormat();
  if(stale)return <article className="rgr-document"><p className="rgr-note">Модель изменена: пересчитайте её перед выводом отчёта.</p></article>;
  const data=axialReportData(project,analysis);
  if(!data.ok)return <article className="rgr-document"><h1>Отчёт РГР</h1><p className="rgr-note">{data.reason}</p><p>Для этой схемы доступен обычный отчёт с таблицами и эпюрами N/Q/M. Осевые формулы здесь не применяются.</p></article>;
  if(options.reportKind==="assignment")return <AssignmentRgrReport project={project} data={data} options={options}/>;
  if(options.reportKind==="short")return <ShortRgrReport project={project} data={data} options={options}/>;
  const tension=positiveValue(options.tensionMPa),compression=positiveValue(options.compressionMPa),allowedU=positiveValue(options.displacementMM);
  const required=data.rows.map(r=>({row:r,ratio:r.section.area/data.baseArea,allow:r.N>=0?tension:compression}));
  const canSize=required.every(r=>r.allow!==null);
  const baseRequired=canSize?Math.max(...required.map(r=>Math.abs(r.row.N)/(r.allow!*1e6*r.ratio))):null;
  const strength=required.every(r=>r.allow!==null&&Math.abs(r.row.stress)/1e6<=r.allow!*(1+1e-9));
  const signedLoads=data.loads.map(l=>signed(l.force/1000)).join(" ");
  const sum=data.loads.reduce((s,l)=>s+l.force,0);
  const reaction=data.reactions.reduce((s,r)=>s+r.force,0);
  return <article className="rgr-document">
    <section className="rgr-title-page">
      <p>{options.institution||"[Наименование учебного заведения]"}</p>
      <div className="rgr-title-center"><h1>Расчётно-графическая работа</h1><h2>Растяжение и сжатие ступенчатого стержня</h2><p>{project.metadata.title}</p><p>Дисциплина: {options.discipline||"[Дисциплина]"}</p></div>
      <div className="rgr-title-author"><p>Выполнил: {options.student||"[ФИО студента]"}</p><p>Группа: {options.group||"[Группа]"}</p><p>Проверил: {options.teacher||"[ФИО преподавателя]"}</p></div>
      <p>{options.city||"[Город]"}, {options.year}</p>
    </section>
    <section><h2>Исходные данные и расчётная схема</h2>
      <p>{project.metadata.description}</p>
      {options.includeGraphics!==false&&<Scheme data={data}/>}
      <p>Закрепления в узлах {data.restraints.map(s=>s.node.number).join(", ")}; в каждой заделке u = 0. Ось x направлена от узла {data.origin.number} вдоль цепочки. N &gt; 0 — растяжение; N &lt; 0 — сжатие. Полная длина L = {n(data.total)} м.</p>
      <table><thead><tr><th>Участок</th><th>x, м</th><th>ℓ, м</th><th>A, мм²</th><th>A/Aбаз</th><th>E, ГПа</th></tr></thead><tbody>{data.rows.map(r=><tr key={r.member.id}><td>{r.member.number}</td><td>{n(r.x0)}…{n(r.x1)}</td><td>{n(r.length)}</td><td>{n(r.section.area*1e6)}</td><td>{n(r.section.area/data.baseArea)}</td><td>{n(r.material.elasticModulus/1e9)}</td></tr>)}</tbody></table>
      <p>Материал модели: {[...new Set(data.rows.map(r=>r.material.name))].join("; ")}. E {options.modulusConfirmed?"подтверждён пользователем по условию задания":"не подтверждён по условию: численные перемещения ниже условные"}.</p>
      <p>Допускаемые напряжения: [σ]р = {tension===null?"не задано":`${n(tension)} МПа`}; [σ]сж = {compression===null?"не задано":`${n(compression)} МПа`}. Допускаемое |u|max: {allowedU===null?"не задано":`${n(allowedU)} мм`}.</p>
    </section>
    <section><h2>1. Определение реакций</h2>
      <p>{data.restraints.length===1?"Схема статически определима: одна осевая реакция.":`Схема статически неопределима. Степень статической неопределимости: ${data.restraints.length-1}. Реакции определяются из равновесия и совместности перемещений.`}</p>
      <p className="rgr-formula">ΣFx = 0: ΣR + ΣF = 0; ΣR + ({signedLoads||"0"}) = 0 ⇒ ΣR = {signed(reaction/1000)} кН.</p>
      {data.compatibility.map((c,i)=><div key={i}><p>Условие совместности между заделками в узлах {c.start.node.number} и {c.end.node.number}: uкон − uнач = 0.</p><p className="rgr-formula">Σ Nᵢℓᵢ/(EᵢAᵢ) = 0; участки: {c.segments.map(r=>r.member.number).join(", ")}.</p><p className="rgr-formula">{c.coefficients.map((a,j)=>`${n(a*1e6)} × R(узел ${data.restraints[j]!.node.number})`).join(" + ")} = {n(c.rhs*1000)} мм (R в кН).</p><p className="rgr-formula">Подстановка: {c.coefficients.map((a,j)=>`(${n(a*1e6)} × ${signed(data.restraints[j]!.reaction/1000)})`).join(" + ")} = {n(c.rhs*1000)} мм. Проверка ΣΔℓ = {n(c.residual*1000)} мм.</p></div>)}
      <p>Решение системы:</p><table><thead><tr><th>Заделка, узел</th><th>x, м</th><th>R, кН</th><th>u, мм</th></tr></thead><tbody>{data.restraints.map(s=><tr key={s.node.id}><td>{s.node.number}</td><td>{n(s.x)}</td><td>{signed(s.reaction/1000)}</td><td>0</td></tr>)}</tbody></table>
      <p>ΣFy = 0 ⇒ Ry = 0; ΣMz = 0 ⇒ Mзад = 0: все нагрузки действуют вдоль оси. Проверка: R + ΣF = {n((reaction+sum)/1000)} кН. Остаток равновесия ядра: {n(analysis.equilibrium.relativeResidual)}.</p>
    </section>
    <section><h2>2. Расчёт по участкам</h2><p>Метод сечений: рассматривается часть справа от сечения. −N + ΣFсправа + ΣRсправа = 0, поэтому N = ΣFсправа + ΣRсправа. Реакции заделок входят в сумму внешних сил. Далее σ = N/A; Δℓ = Nℓ/(EA); uкон = uнач + Δℓ. Формулы относятся к постоянному осевому усилию и линейно упругому материалу.</p>
      {data.rows.map(r=><div className="rgr-section-calculation" key={r.member.id}><h3>Участок {r.member.number}: x = {n(r.x0)}…{n(r.x1)} м</h3>
        <p className="rgr-formula">N{r.member.number} = {[...r.rightLoads,...r.rightReactions].map(l=>signed(l.force/1000)).join(" ")||"0"} = {signed(r.N/1000)} кН ({r.N>0?"растяжение":r.N<0?"сжатие":"не нагружен"}).</p>
        <p className="rgr-formula">σ{r.member.number} = N/A = ({n(r.N)} Н)/({n(r.section.area*1e6)} мм²) = {signed(r.stress/1e6)} МПа.</p>
        <p className="rgr-formula">Δℓ{r.member.number} = Nℓ/(EA) = ({n(r.N)} × {n(r.length*1000)}) / ({n(r.material.elasticModulus/1e6)} × {n(r.section.area*1e6)}) = {signed(r.delta*1000)} мм.</p>
        <p className="rgr-formula">uкон = {signed(r.u0*1000)} + ({signed(r.delta*1000)}) = {signed(r.u1*1000)} мм.</p>
        <p>По длине участка: u(x) = {signed(r.u0*1000)} + ({signed(r.N)}/({n(r.material.elasticModulus/1e6)} × {n(r.section.area*1e6)})) × (x − {n(r.x0*1000)}), мм; здесь x подставляется в мм.</p>
      </div>)}
    </section>
    <section><h2>3. Проверки прочности и жёсткости</h2><h3>{hasCurrentAreaSizing(project,tension,compression)?"Подбор площадей по прочности":"Проверка принятых площадей по прочности"}</h3>
      <p>При Aᵢ = kᵢAбаз условие |Nᵢ|/Aᵢ ≤ [σ]ᵢ даёт Aбаз ≥ |Nᵢ|/(kᵢ[σ]ᵢ). Для растяжения используется [σ]р, для сжатия — [σ]сж.</p>
      {required.map(({row:r,ratio,allow})=><p key={r.member.id} className="rgr-formula">Участок {r.member.number}: Aбаз ≥ {allow===null?"нельзя определить без допускаемого напряжения":`${n(Math.abs(r.N))}/(${n(ratio)} × ${n(allow)}) = ${n(Math.abs(r.N)/(ratio*allow))} мм²`}.</p>)}
      <p>Aбаз,min = {baseRequired===null?"не определено":`${n(baseRequired*1e6)} мм²`}; принято Aбаз = {n(data.baseArea*1e6)} мм².</p>
      <table><thead><tr><th>Участок</th><th>σ, МПа</th><th>Допуск, МПа</th><th>|σ|/[σ]</th><th>Вывод</th></tr></thead><tbody>{required.map(({row:r,allow})=><tr key={r.member.id}><td>{r.member.number}</td><td>{signed(r.stress/1e6)}</td><td>{allow===null?"не задан":n(allow)}</td><td>{allow===null?"—":n(Math.abs(r.stress)/1e6/allow)}</td><td>{allow===null?"не проверено":Math.abs(r.stress)/1e6<=allow*(1+1e-9)?"выполнено":"не выполнено"}</td></tr>)}</tbody></table>
      <p>Прочность: {canSize?(strength?"обеспечена при указанных допускаемых напряжениях":"не обеспечена") :"полный вывод невозможен без допускаемых напряжений"}.</p>
      <h3>Проверка жёсткости</h3><p>|u|max = {n(data.maximumDisplacement*1000)} мм {options.modulusConfirmed?"":"при принятом в модели E (условное значение)"}. Условие: |u|max ≤ [u].</p>
      <p>{!options.modulusConfirmed?"Проверка жёсткости не завершена: требуется подтвердить E по условию задания.":allowedU===null?"Проверка жёсткости не завершена: допускаемое перемещение [u] не задано.":`Сравнение: ${n(data.maximumDisplacement*1000)} ${data.maximumDisplacement*1000<=allowedU?"≤":" >"} ${n(allowedU)} мм. Жёсткость ${data.maximumDisplacement*1000<=allowedU?"обеспечена":"не обеспечена"}.`}</p>
    </section>
    {options.includeGraphics!==false&&<section className="rgr-epures"><h2>4. Эпюры</h2><p>Единая ось x от начала цепочки; участки подписаны в порядке схемы. Положительные значения выше оси, отрицательные ниже. Вертикальные масштабы N, σ и u независимы. Q = 0 и M = 0 на всех участках.</p>
      <ChainDiagram data={data} kind="N" confirmed={options.modulusConfirmed}/><ChainDiagram data={data} kind="sigma" confirmed={options.modulusConfirmed}/><ChainDiagram data={data} kind="u" confirmed={options.modulusConfirmed}/>
    </section>}
    <section><h2>5. Итоговые результаты</h2><p>Реакции заделок: {data.restraints.map(s=>`узел ${s.node.number}: ${signed(s.reaction/1000)} кН`).join("; ")}. Принятая базовая площадь: {n(data.baseArea*1e6)} мм². Наибольшее абсолютное напряжение: {n(Math.max(...data.rows.map(r=>Math.abs(r.stress)))/1e6)} МПа.</p>
      <table><thead><tr><th>Участок</th><th>N, кН</th><th>A, мм²</th><th>σ, МПа</th><th>Δℓ, мм</th><th>uкон, мм</th></tr></thead><tbody>{data.rows.map(r=><tr key={r.member.id}><td>{r.member.number}</td><td>{signed(r.N/1000)}</td><td>{n(r.section.area*1e6)}</td><td>{signed(r.stress/1e6)}</td><td>{signed(r.delta*1000)}</td><td>{signed(r.u1*1000)}</td></tr>)}</tbody></table>
      <p>Перемещение конечного узла: {signed(data.rows.at(-1)!.u1*1000)} мм. Численные деформации относятся к указанному в модели E; {options.modulusConfirmed?"E подтверждён пользователем":"E по условию не подтверждён"}.</p>
      <p>Расчётная модель: линейная упругость, малые перемещения, центральное растяжение/сжатие. Проверка устойчивости сжатых участков в этот осевой отчёт не входит. Версия ядра: {analysis.solverVersion}.</p>
    </section>
  </article>;
}

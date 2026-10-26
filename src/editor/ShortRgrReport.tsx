import type {Project} from '../model';
import {useNumberFormat} from '../display/NumberFormat';
import {positiveValue, type axialReportData, type RgrOptions} from './axialReport';
import {Scheme,ChainDiagram} from './AxialReportFigures';
import {hasCurrentAreaSizing} from './areaSizing';
type Data=Extract<ReturnType<typeof axialReportData>,{ok:true}>;
export function ShortRgrReport({project,data,options}:{project:Project;data:Data;options:RgrOptions}) {
  const {n,signed}=useNumberFormat();
  const tension=positiveValue(options.tensionMPa),compression=positiveValue(options.compressionMPa),allowedU=positiveValue(options.displacementMM);
  const sized=hasCurrentAreaSizing(project,tension,compression);
  const required=data.rows.map(r=>({r,k:r.section.area/data.baseArea,allow:r.N<0?compression:tension}));
  const minimum=required.every(v=>v.allow!==null)?Math.max(...required.map(v=>Math.abs(v.r.N)/(v.k*v.allow!*1e6))):null;
  const strength=required.every(v=>v.allow!==null&&Math.abs(v.r.stress)<=v.allow!*1e6*(1+1e-9));
  const initialSegments=data.rows.filter(r=>r.x1<=data.restraints[0]!.x+1e-10);
  const sumLoads=data.loads.reduce((s,l)=>s+l.force,0);
  const sumReactions=data.restraints.reduce((s,r)=>s+r.reaction,0);
  const actions=(r:Data['rows'][number])=>[...r.rightLoads.map(l=>`F(узел ${project.model.nodes.find(v=>v.id===l.nodeId)!.number})`),...r.rightReactions.map(l=>`R(узел ${project.model.nodes.find(v=>v.id===l.nodeId)!.number})`)].join(' + ')||'0';
  const numericActions=(r:Data['rows'][number])=>[...r.rightLoads,...r.rightReactions].map(l=>`(${signed(l.force/1000)})`).join(' + ')||'0';
  return <article className="rgr-document rgr-short">
    <h1>Краткая РГР: растяжение и сжатие</h1>
    <section><h2>Дано</h2>
      <p>{data.loads.map(l=>`F(узел ${project.model.nodes.find(v=>v.id===l.nodeId)!.number}) = ${signed(l.force/1000)} кН`).join('; ')}.</p>
      <p>Участки перечислены вдоль оси x от узла {data.origin.number}. N &gt; 0 — растяжение; N &lt; 0 — сжатие. Заделки: узлы {data.restraints.map(s=>s.node.number).join(', ')}; u = 0 в каждой.</p>
      {data.rows.map(r=><p key={r.member.id}>Участок {r.member.number}, узлы {r.start.number} → {r.end.number}: ℓ = {n(r.length)} м; {r.section.name} = {n(r.section.area/data.baseArea)}A₀; E = {n(r.material.elasticModulus/1e9)} ГПа.</p>)}
      <p>[σ]р = {tension===null?'не задано':`${n(tension)} МПа`}; [σ]сж = {compression===null?'не задано':`${n(compression)} МПа`}.{allowedU!==null&&` [u] = ${n(allowedU)} мм.`}</p>
      {!options.modulusConfirmed&&<p>E по условию не подтверждён; деформации и перемещения вычислены при E модели.</p>}
    </section>
    <section><h2>1. Реакции и продольные силы</h2>
      <p className="rgr-formula">ΣR + ΣF = 0 → ΣR + ({data.loads.map(l=>signed(l.force/1000)).join(' ')||'0'}) = 0 → ΣR = {signed(-sumLoads/1000)} кН.</p>
      {data.restraints.length>1&&<p>Степень статической неопределимости: {data.restraints.length-1}. Условия совместности:</p>}
      {data.compatibility.map((c,i)=><div key={i}>
        <p className="rgr-formula">u(узел {c.end.node.number}) − u(узел {c.start.node.number}) = Σ Nᵢℓᵢ/(EᵢAᵢ) = 0.</p>
        <p className="rgr-formula">{c.coefficients.map((a,j)=>`${n(a*1e6)} × R(узел ${data.restraints[j]!.node.number})`).join(' + ')} = {n(c.rhs*1000)} мм; реакции R в кН.</p>

      </div>)}
      <p className="rgr-formula">Решение {data.restraints.length>1?'системы':'уравнения'} → {data.restraints.map(s=>`R(узел ${s.node.number}) = ${signed(s.reaction/1000)} кН`).join('; ')}.</p>
      {data.compatibility.map((c,i)=><p className="rgr-formula" key={i}>Подстановка в условие совместности: {c.coefficients.map((a,j)=>`(${n(a*1e6)} × ${signed(data.restraints[j]!.reaction/1000)})`).join(' + ')} = {n(c.rhs*1000)} мм; ΣΔℓ = {n(c.residual*1000)} мм.</p>)}
      <p className="rgr-formula">Проверка равновесия: ΣR + ΣF → ({n(sumReactions/1000)}) + ({n(sumLoads/1000)}) = {n((sumReactions+sumLoads)/1000)} кН.</p>
      {data.rows.map(r=><p className="rgr-formula" key={r.member.id}>N{r.member.number} = ΣFсправа + ΣRсправа = {actions(r)} → {numericActions(r)} = {signed(r.N/1000)} кН.</p>)}
    </section>
    <section><h2>2. {sized?'Подбор площадей по прочности':'Проверка прочности при принятых площадях'}</h2>
      <p>Принятая базовая площадь A₀ = {n(data.baseArea,true)} м². {sized?'Площади выбраны пользователем командой подбора.':'Площади заданы вручную; выполнена проверка, а не подбор.'}</p>
      {required.map(({r,k,allow})=><div key={r.member.id}>
        <p className="rgr-formula">Участок {r.member.number}: A₀,треб ≥ |N|/(k[σ]) → {allow===null?'допускаемое напряжение не задано':`${n(Math.abs(r.N))}/(${n(k)} × ${n(allow*1e6)}) = ${n(Math.abs(r.N)/(k*allow*1e6),true)} м²`}.</p>
        <p className="rgr-formula">A{r.member.number},прин = kA₀ → {n(k)} × ({n(data.baseArea,true)}) = {n(r.section.area,true)} м² ({r.section.name}).</p>
      </div>)}
      <p>A₀,треб = {minimum===null?'не определено':`${n(minimum,true)} м²`}; A₀,прин = {n(data.baseArea,true)} м².</p>
    </section>
    <section><h2>3. Нормальные напряжения</h2>
      {required.map(({r,allow})=><div key={r.member.id}><p className="rgr-formula">σ{r.member.number} = N/A → ({n(r.N)})/({n(r.section.area,true)}) = {signed(r.stress)} Па = {signed(r.stress/1e6)} МПа.</p><p className="rgr-formula">|σ| ≤ [σ] → {n(Math.abs(r.stress)/1e6)} {allow===null?'МПа; допуск не задан':`${Math.abs(r.stress)/1e6<=allow*(1+1e-9)?'≤':'>'} ${n(allow)} МПа; ${Math.abs(r.stress)/1e6<=allow*(1+1e-9)?'выполнено':'не выполнено'}`}.</p></div>)}
    </section>
    <section><h2>4. Деформации участков</h2>
      {data.rows.map(r=><p className="rgr-formula" key={r.member.id}>Δℓ{r.member.number} = Nℓ/(EA) → ({n(r.N)} × {n(r.length)})/({n(r.material.elasticModulus)} × ({n(r.section.area,true)})) = {signed(r.delta)} м = {signed(r.delta*1000)} мм.</p>)}
    </section>
    <section><h2>5. Перемещения характерных сечений</h2>
      <p>Перемещения отсчитываются от закреплённого узла {data.restraints[0]!.node.number}, где u = 0; знак определяется осью x.</p>
      <p className="rgr-formula">Начальное сечение, узел {data.origin.number}: u(0) = uзад − ΣΔℓ → 0 − ({initialSegments.map(r=>`(${signed(r.delta*1000)})`).join(" + ")||"0"}) = {signed(data.rows[0]!.u0*1000)} мм.</p>
      {data.rows.map(r=><p className="rgr-formula" key={r.member.id}>Узел {r.end.number}, x = {n(r.x1)} м: uкон = uнач + Δℓ{r.member.number} → ({signed(r.u0*1000)}) + ({signed(r.delta*1000)}) = {signed(r.u1*1000)} мм.</p>)}
    </section>
    {allowedU!==null&&<section><h2>6. Проверка жёсткости</h2><p className="rgr-formula">|u|max ≤ [u] → {n(data.maximumDisplacement*1000)} {data.maximumDisplacement*1000<=allowedU?'≤':'>'} {n(allowedU)} мм.</p><p>{options.modulusConfirmed?`Жёсткость ${data.maximumDisplacement*1000<=allowedU?'обеспечена':'не обеспечена'}.`:'Окончательная проверка жёсткости требует подтверждения E по условию.'}</p></section>}
    <section><h2>Итог</h2><p>Прочность: {required.some(r=>r.allow===null)?'не проверена полностью — задайте допускаемые напряжения':strength?'обеспечена':'не обеспечена'}. |σ|max = {n(Math.max(...data.rows.map(r=>Math.abs(r.stress)))/1e6)} МПа; |u|max = {n(data.maximumDisplacement*1000)} мм.{allowedU===null?' Допуск перемещения не задан; жёсткость не проверена.':''}</p></section>
    {options.includeGraphics!==false&&<section className="rgr-epures"><h2>Схема и эпюры</h2><Scheme data={data}/><ChainDiagram data={data} kind="N" confirmed={options.modulusConfirmed}/><ChainDiagram data={data} kind="sigma" confirmed={options.modulusConfirmed}/><ChainDiagram data={data} kind="u" confirmed={options.modulusConfirmed}/></section>}
  </article>;
}

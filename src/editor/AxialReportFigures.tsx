import {useNumberFormat} from "../display/NumberFormat";
import {axialReportData} from "./axialReport";
type Data=Extract<ReturnType<typeof axialReportData>,{ok:true}>;

export function Scheme({data}:{data:Data}){
  const {n,signed}=useNumberFormat();
  const px=(x:number)=>65+x/data.total*620;
  const maxArea=Math.max(...data.rows.map(r=>r.section.area));
  const nodePositions=new Map([[data.origin.id,0],...data.rows.map(r=>[r.end.id,r.x1] as [string,number])]);
  return <svg className="rgr-scheme" viewBox="0 0 750 260" role="img" aria-label="Ступенчатый стержень с заделкой и осевыми силами">
    {data.restraints.map(s=>{const x=px(s.x),side=s.x===data.total?1:-1;return <g key={s.node.id} aria-label={`Заделка в узле ${s.node.number}`}><line x1={x} y1="55" x2={x} y2="190" stroke="#111" strokeWidth="4"/>{Array.from({length:11},(_,i)=><line key={i} x1={x+side*17} y1={65+i*12} x2={x} y2={55+i*12} stroke="#555"/>)}</g>;})}
    <line x1="65" y1="125" x2="685" y2="125" stroke="#888" strokeDasharray="5 4"/>
    {data.rows.map(r=>{const height=70*Math.sqrt(r.section.area/maxArea);return <g key={r.member.id}>
      <rect x={px(r.x0)} y={125-height/2} width={px(r.x1)-px(r.x0)} height={height} fill="none" stroke="#111" strokeWidth="2"/>
      <text x={px((r.x0+r.x1)/2)} y={110-height/2} textAnchor="middle">{r.section.name}</text>
      <line x1={px(r.x0)} y1="205" x2={px(r.x1)} y2="205" stroke="#555"/>
      <line x1={px(r.x0)} y1="193" x2={px(r.x0)} y2="214" stroke="#555"/>
      <line x1={px(r.x1)} y1="193" x2={px(r.x1)} y2="214" stroke="#555"/>
      <text x={px((r.x0+r.x1)/2)} y="229" textAnchor="middle">ℓ{r.member.number} = {n(r.length)} м</text>
    </g>;})}
    {data.loads.map((l,i)=>{const x=px(nodePositions.get(l.nodeId)!),end=x+Math.sign(l.force)*35;return <g key={i}>
      <line x1={x} y1="125" x2={end} y2="125" stroke="#9a2518" strokeWidth="2"/>
      <path d={`M ${end-Math.sign(l.force)*8} 120 L ${end} 125 L ${end-Math.sign(l.force)*8} 130`} fill="none" stroke="#9a2518" strokeWidth="2"/>
      <text x={x} y="44" textAnchor="middle">{signed(l.force/1000)} кН</text>
    </g>;})}
    <text x="65" y="249">x = 0</text><text x="685" y="249" textAnchor="end">x = {n(data.total)} м →</text>
  </svg>;
}
export function ChainDiagram({data,kind,confirmed}:{data:Data;kind:"N"|"sigma"|"u";confirmed:boolean}){
  const {n,signed}=useNumberFormat();
  const px=(x:number)=>65+x/data.total*620;
  const rows=data.rows;
  const value=(r:Data["rows"][number],end=false)=>kind==="N"?r.N/1000:kind==="sigma"?r.stress/1e6:(end?r.u1:r.u0)*1000;
  const max=Math.max(1e-12,...rows.flatMap(r=>[Math.abs(value(r)),Math.abs(value(r,true))]));
  const py=(v:number)=>95-v/max*48;
  const points=rows.flatMap(r=>[[px(r.x0),py(value(r))],[px(r.x1),py(value(r,true))]]);
  const curve=points.map(p=>p.join(",")).join(" ");
  const title=kind==="N"?"N, кН":kind==="sigma"?"σ, МПа":`u, мм${confirmed?"":" (при принятом E; условно)"}`;
  return <figure className="rgr-figure"><svg className="rgr-chain-diagram" viewBox="0 0 750 185" role="img" aria-label={`Эпюра ${title} вдоль всего стержня`}>
    <text x="15" y="22" fontWeight="700">{title}</text>
    <line x1="65" y1="95" x2="685" y2="95" stroke="#555"/>
    <polygon points={`65,95 ${curve} 685,95`} fill="#d9e7ed"/>
    <polyline points={`65,95 ${curve} 685,95`} fill="none" stroke="#163d54" strokeWidth="2"/>
    {rows.map(r=><g key={r.member.id}>
      <line x1={px(r.x0)} y1="36" x2={px(r.x0)} y2="150" stroke="#b0b8bc" strokeDasharray="3 3"/>
      <text x={px((r.x0+r.x1)/2)} y="165" textAnchor="middle">Участок {r.member.number}</text>
      {kind!=="u" && <text x={px((r.x0+r.x1)/2)} y={py(value(r))+(value(r)<0?16:-8)} textAnchor="middle">{signed(value(r))}</text>}
    </g>)}
    {kind==="u"&&[{x:0,v:rows[0]!.u0*1000},...rows.map(r=>({x:r.x1,v:r.u1*1000}))].map((p,i)=><text key={i} x={px(p.x)} y={py(p.v)+(p.v<0?16:-8)} textAnchor={i===0?"start":i===rows.length?"end":"middle"}>{signed(p.v)}</text>)}
    {[0,...rows.map(r=>r.x1)].map((x,i)=><text key={i} x={px(x)} y="181" textAnchor={i===0?"start":i===rows.length?"end":"middle"}>{n(x)}</text>)}
    <text x="716" y="181">x, м</text>
  </svg></figure>;
}


import {dimensionRows} from "./catalog";
import {PartCalculations} from "./PartCalculations";
import {useNumberFormat} from '../display/NumberFormat';
import {inUnit,unitLength,type SectionGeometry,type SectionResult,type Unit} from './types';
import {propertiesAtAxis} from './calculate';
import {SectionDrawing,type DrawingScale} from './SectionDrawing';
import {getLength} from './expressions';
export function SectionReport({geometry,result,unit,angle=0,short=false,scale='fit'}:{geometry:SectionGeometry;result:SectionResult;unit:Unit;angle?:number;short?:boolean;scale?:DrawingScale}){
 const {n}=useNumberFormat(),u=(v:number,power=1)=>n(inUnit(v,unit,power)),r=result,p=propertiesAtAxis(r,angle),term=(v:number,sign:number,power:number)=>`(${sign<0?'−':''}${u(v,power)})`;
 const sum=(field:'area'|'jx'|'jy'|'jxy',power:number)=>r.parts.map(v=>term(v[field],v.sign,power)).join(' + ');
 const row=geometry.dimensionRow?dimensionRows[geometry.dimensionRow-1]:null;
 const overridden=!!row&&(Math.abs((geometry.a??0)-row.a*.01)>1e-12||Math.abs((geometry.b??0)-row.b*.01)>1e-12);
 const formulas:Record<string,string>={rectangle:'A=wh; Jx=wh³/12; Jy=hw³/12; Jxy=0',triangle:'A=wh/2; C=(Σxвершин/3,Σyвершин/3); Jx=wh³/36',trapezoid:'A=(w+t)h/2; остальные характеристики — интегралы Грина по четырём вершинам',circle:'A=πr²; Jx=Jy=πr⁴/4; Jxy=0',semicircle:'A=πr²/2; yc=4r/(3π); Jx=πr⁴/8−Ayc²; Jy=πr⁴/8',polygon:'A=½Σ(xᵢyᵢ₊₁−xᵢ₊₁yᵢ); моменты — интегралы Грина по границе'};
 return <article className="rgr-document section-report"><h1>{short?'Краткая РГР':'Расчёт геометрических характеристик'}: {geometry.name}</h1>
  <section><h2>1. Разбиение сечения</h2><p>Числа округляются только для отображения; π и проверки используются без округления. Однородное сечение; оси x вправо, y вверх. Знак + — материал, − — вырез. Размеры в {unit}; повороты против часовой стрелки.</p>{geometry.a!==undefined&&<p>Дано: a={u(geometry.a)} {unit}; b={u(geometry.b!)} {unit}. Схема {geometry.scheme}; строка размеров {geometry.dimensionRow??'ручной ввод'}{overridden?' (размеры изменены вручную)':''}.</p>}
   {r.parts.map((v,i)=><p key={v.part.id}>Часть {i+1}: {v.part.name}; {v.part.cut?'вырез (−)':'материал (+)'}. Положение начала: ({u(v.part.x)}; {u(v.part.y)}) {unit}; α={n(v.part.angle*180/Math.PI)}°.</p>)}
   {geometry.parts.flatMap((part,i)=>Object.entries(part.expressions??{}).map(([key,binding])=><p key={`${part.id}:${key}`} className="rgr-formula">Часть {i+1}, {key}: {binding.text} → при a={n((geometry.a??0)/unitLength[binding.unit])}, b={n((geometry.b??0)/unitLength[binding.unit])} {binding.unit} → {u(getLength(part,key))} {unit}.</p>))}
  </section>
  <section><h2>2. Характеристики отдельных частей</h2>{r.parts.map((v,i)=><div key={v.part.id}><h3>Часть {i+1} ({v.sign>0?"+":"−"})</h3><PartCalculations part={v} unit={unit}/><p className="rgr-formula">{formulas[v.part.shape.kind]} → A{i+1}={u(v.area,2)} {unit}²; C{i+1}=({u(v.cx)}; {u(v.cy)}) {unit}.</p>{!short&&<p>Моменты приведены к глобально ориентированным осям через центр каждой части; поворот учтён аналитически.</p>}<p className="rgr-formula">Jx{i+1}={u(v.jx,4)}; Jy{i+1}={u(v.jy,4)}; Jxy{i+1}={u(v.jxy,4)} {unit}⁴.</p></div>)}
   <table><thead><tr><th>№ / знак</th><th>A, {unit}²</th><th>xc, {unit}</th><th>yc, {unit}</th><th>Jx, {unit}⁴</th><th>Jy, {unit}⁴</th><th>Jxy, {unit}⁴</th></tr></thead><tbody>{r.parts.map((v,i)=><tr key={v.part.id}><td>{i+1} / {v.sign>0?'+':'−'}</td><td>{u(v.area,2)}</td><td>{u(v.cx)}</td><td>{u(v.cy)}</td><td>{u(v.jx,4)}</td><td>{u(v.jy,4)}</td><td>{u(v.jxy,4)}</td></tr>)}</tbody></table>
  </section>
  <section><h2>3. Общая площадь и центр тяжести</h2>
   <p className="rgr-formula">A=ΣsᵢAᵢ → {sum('area',2)} = {u(r.area,2)} {unit}².</p>
   <p className="rgr-formula">Sx=ΣsᵢAᵢyᵢ → {r.parts.map(v=>`${term(v.area,v.sign,2)} × (${u(v.cy)})`).join(' + ')} = {u(r.sx,3)} {unit}³.</p>
   <p className="rgr-formula">Sy=ΣsᵢAᵢxᵢ → {r.parts.map(v=>`${term(v.area,v.sign,2)} × (${u(v.cx)})`).join(' + ')} = {u(r.sy,3)} {unit}³.</p>
   <p className="rgr-formula">xc=Sy/A → {u(r.sy,3)}/{u(r.area,2)} = {u(r.cx)} {unit}; yc=Sx/A → {u(r.sx,3)}/{u(r.area,2)} = {u(r.cy)} {unit}.</p>
  </section>
  <section><h2>4. Проверка статических моментов</h2><p className="rgr-formula">Sx,C=ΣsᵢAᵢ(yᵢ−yc) → {r.parts.map(v=>`${term(v.area,v.sign,2)} × (${u(v.cy)} − (${u(r.cy)}))`).join(' + ')} = {u(r.centralSx,3)} {unit}³ ≈ 0.</p><p className="rgr-formula">Sy,C=ΣsᵢAᵢ(xᵢ−xc) → {r.parts.map(v=>`${term(v.area,v.sign,2)} × (${u(v.cx)} − (${u(r.cx)}))`).join(' + ')} = {u(r.centralSy,3)} {unit}³ ≈ 0.</p></section>
  <section><h2>5. Перенос моментов инерции</h2>
   {(['jx','jy','jxy'] as const).map(key=><p className="rgr-formula" key={key}>{key==='jx'?'Jx=Σsᵢ(Jxᵢ+AᵢΔyᵢ²)':key==='jy'?'Jy=Σsᵢ(Jyᵢ+AᵢΔxᵢ²)':'Jxy=Σsᵢ(Jxyᵢ+AᵢΔxᵢΔyᵢ)'} → {r.parts.map(v=>`${v.sign<0?'−':'+'}(${u(v[key],4)} + ${u(v.area,2)} × ${key==='jxy'?`(${u(v.cx-r.cx)}) × (${u(v.cy-r.cy)})`:`(${u(key==='jx'?v.cy-r.cy:v.cx-r.cx)})²`})`).join(' ')} = {u(r[key],4)} {unit}⁴.</p>)}
  </section>
  <section><h2>6. Главные оси и главные моменты</h2><p className="rgr-formula">Jmax/min=(Jx+Jy ± √((Jx−Jy)²+4Jxy²))/2 → ({u(r.jx,4)}+{u(r.jy,4)} ± √(({u(r.jx,4)}−{u(r.jy,4)})²+4×({u(r.jxy,4)})²))/2 → {u(r.jmax,4)} / {u(r.jmin,4)} {unit}⁴.</p>
   <p>{r.angleMax===null?'Главные моменты равны: направление главных осей не единственно.':`θmax=½atan2(−2Jxy,Jx−Jy) → ½atan2(${u(-2*r.jxy,4)},${u(r.jx-r.jy,4)}) = ${n(r.angleMax*180/Math.PI)}°; θmin=${n(r.angleMin!*180/Math.PI)}°.`}</p><p>Проверки: Jxy главных осей ≈ 0; Jmax, Jmin &gt; 0; Jmax+Jmin=Jx+Jy. Выполнены по полным значениям.</p>
  </section>
  <section><h2>7. Радиусы инерции и их квадраты</h2>{[['max',r.jmax,r.iMax2,r.iMax],['min',r.jmin,r.iMin2,r.iMin]].map(([name,J,i2,i])=><p className="rgr-formula" key={name}>i²{name}=J/A → {u(Number(J),4)}/{u(r.area,2)} = {u(Number(i2),2)} {unit}²; i{name}=√i² → √({u(Number(i2),2)}) = {u(Number(i))} {unit}.</p>)}</section>
  <section><h2>8. Моменты сопротивления</h2><p>Выбранная центральная ось xθ: θ={n(angle*180/Math.PI)}°. Jxθ={u(p.j,4)} {unit}⁴; Jyθ={u(p.jOther,4)} {unit}⁴. Крайние точки взяты с фактической границы, включая поворот и вырезы.</p>{[['верх',p.j,p.upper,p.wUpper],['низ',p.j,p.lower,p.wLower],['право',p.jOther,p.right,p.wRight],['лево',p.jOther,p.left,p.wLeft]].map(([label,J,d,W])=><p className="rgr-formula" key={label}>W({label})=J/d → {u(Number(J),4)}/{u(Number(d))} = {u(Number(W),3)} {unit}³.</p>)}</section>
  <section><h2>9. Итоговая таблица и чертёж</h2><table><thead><tr><th>Характеристика</th><th>Значение</th><th>Единица</th></tr></thead><tbody>{[['A',r.area,2],['xc',r.cx,1],['yc',r.cy,1],['Jx',r.jx,4],['Jy',r.jy,4],['Jxy',r.jxy,4],['Jmax',r.jmax,4],['Jmin',r.jmin,4],['i²max',r.iMax2,2],['i²min',r.iMin2,2],['i max',r.iMax,1],['i min',r.iMin,1],['W верх',p.wUpper,3],['W низ',p.wLower,3],['W право',p.wRight,3],['W лево',p.wLeft,3]].map(([label,value,power])=><tr key={label}><td>{label}</td><td>{u(Number(value),Number(power))}</td><td>{unit}{Number(power)>1?`^${power}`:''}</td></tr>)}</tbody></table><SectionDrawing result={r} unit={unit} scale={scale}/></section>
 </article>;
}

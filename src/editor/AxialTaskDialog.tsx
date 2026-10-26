import {useNumberFormat} from "../display/NumberFormat";
import {useRef,useState} from "react";
import type {Project} from "../model";
import {emptyAxialTask,insertTaskRow,deleteTaskSelection,splitTaskRow,resizeTask,fixedHatchSide,type TaskSelection,projectFromTask,taskWithSizedArea,taskErrors,type AxialTask} from "./axialTask";
import {positiveValue,type RgrOptions} from "./axialReport";

type DrawTool='select'|'fixed'|'left'|'right'|'clear'|'length';
export function TaskSketch({task,onRow,onNode,selectedRow=-1,selectedNode=-1,onLength,onResizeNode}:{task:AxialTask;onLength?:(index:number)=>void;onResizeNode?:((index:number,lengthCM:string)=>void)|undefined;onRow?:(index:number)=>void;onNode?:(index:number,part?:'node'|'fixed'|'force')=>void;selectedRow?:number;selectedNode?:number}){
 const drag=useRef<{node:number;clientX:number;length:number;factor:number}|null>(null);
 const lengths=task.rows.map(r=>positiveValue(r.lengthCM)??1),total=lengths.reduce((a,b)=>a+b,0)||1;
 const areas=task.rows.map(r=>positiveValue(r.ratio)??1),largest=Math.max(1,...areas);
 const W=Math.max(760,task.rows.length*160+130),span=W-150;
 const px=(x:number)=>65+x/total*span;let x=0;const bounds=[0,...lengths.map(v=>{x+=v;return x;})];
 return <div className="task-sketch-wrap"><svg className="task-sketch" style={{minWidth:W}} viewBox={`0 0 ${W} 290`} role="img" aria-label="Свободная схема ступенчатого стержня" onPointerMove={e=>{const d=drag.current;if(d){const length=Math.max(.001,d.length+(e.clientX-d.clientX)*d.factor);onResizeNode?.(d.node,String(length));}}} onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{drag.current=null;}}>
  <line x1="65" y1="130" x2={W-45} y2="130" stroke="#9ca8a3" strokeDasharray="5 4"/>
  {task.rows.map((r,i)=>{const a=bounds[i]!,b=bounds[i+1]!,h=90*Math.sqrt(areas[i]!/largest),mid=px((a+b)/2);
    return <g key={r.number} className={onRow?'task-drawing-target':''} role={onRow?'button':undefined} tabIndex={onRow?0:undefined} aria-label={`Выбрать ступень ${r.number}`} onClick={e=>{if(onRow)e.currentTarget.focus();onRow?.(i);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onRow?.(i);}}}>
      <rect x={px(a)} y={130-h/2} width={px(b)-px(a)} height={h} fill={selectedRow===i?'#ffdfa7':'#e8f1ed'} stroke="#24483e" strokeWidth="2"/>
      <text x={mid} y={118-h/2} textAnchor="middle">{r.areaLabel} · {r.ratio||'?'}A₀</text>
      <line x1={px(a)} y1="217" x2={px(b)} y2="217" stroke="#687671"/>
      <line x1={px(a)} y1="207" x2={px(a)} y2="228" stroke="#687671"/><line x1={px(b)} y1="207" x2={px(b)} y2="228" stroke="#687671"/>
      <text x={mid} y="251" textAnchor="middle" onDoubleClick={e=>{e.stopPropagation();onLength?.(i);}}>ℓ{r.number}{r.lengthCM?` = ${r.lengthCM} см`:''}</text>
    </g>;
  })}
  {task.nodes.map((node,i)=>{const p=px(bounds[i]!),sign=node.direction==='left'?-1:1,tip=p+sign*35,hatchSign=fixedHatchSide(node,i,task.nodes.length)==='right'?1:-1;
    return <g key={i} className={onNode?'task-drawing-target':''} role={onNode?'button':undefined} tabIndex={onNode?0:undefined} aria-label={`Узел ${i+1}${node.fixed?', заделка':''}`} onClick={e=>{if(onNode)e.currentTarget.focus();onNode?.(i);}} onPointerDown={e=>{if(!onResizeNode||i===0||positiveValue(task.rows[i-1]!.lengthCM)===null)return;e.preventDefault();e.stopPropagation();const svg=e.currentTarget.ownerSVGElement!;svg.setPointerCapture(e.pointerId);drag.current={node:i,clientX:e.clientX,length:positiveValue(task.rows[i-1]!.lengthCM)!,factor:total/span*W/svg.getBoundingClientRect().width};}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onNode?.(i);}}}>
      {node.fixed&&<g className="task-fixed" data-side={hatchSign===1?'right':'left'} onClick={e=>{e.stopPropagation();if(onNode)e.currentTarget.parentElement?.focus();onNode?.(i,'fixed');}}><line x1={p} y1="65" x2={p} y2="190" stroke="#172d3b" strokeWidth="4"/>{Array.from({length:11},(_,j)=><line key={j} x1={p+hatchSign*17} y1={75+j*11} x2={p} y2={65+j*11} stroke="#687671"/>)}</g>}
      {node.direction!=='none'&&<g className="task-force" onClick={e=>{e.stopPropagation();if(onNode)e.currentTarget.parentElement?.focus();onNode?.(i,'force');}}><line x1={p} y1="130" x2={tip} y2="130" stroke="#a33c29" strokeWidth="2"/><path d={`M${tip-sign*8},125 L${tip},130 L${tip-sign*8},135`} stroke="#a33c29" fill="none" strokeWidth="2"/><text x={p} y={35+(i%2)*19} textAnchor="middle">F{ i+1} = {node.forceKN||'?'} кН</text></g>}
      <circle cx={p} cy="130" r="10" fill="transparent" stroke={selectedNode===i?'#e48b29':'transparent'} strokeWidth="4"/>
      <circle cx={p} cy="130" r="4" fill={node.fixed?'#172d3b':'#14634f'}/>
      <text x={p} y="280" textAnchor="middle">Узел {i+1}</text>
    </g>;
  })}
 </svg></div>;
}
export function AxialTaskDialog({onClose,onApply,initialTask}:{initialTask?:AxialTask|null;onClose:()=>void;onApply:(project:Project,criteria:Pick<RgrOptions,'tensionMPa'|'compressionMPa'>)=>void}){
 const {n}=useNumberFormat();
 const [task,setTask]=useState(()=>initialTask??emptyAxialTask()),[message,setMessage]=useState('');
 const [tool,setTool]=useState<DrawTool>('select'),[selection,setSelection]=useState<TaskSelection>({kind:'row',index:0});
 const selectedRow=selection.kind==='row'?selection.index:-1,selectedNode=selection.kind!=='row'?selection.index:-1;
 const setSelectedRow=(index:number)=>setSelection({kind:'row',index});
 const setSelectedNode=(index:number)=>{if(index>=0)setSelection({kind:'node',index});};
 const lengthInput=useRef<HTMLInputElement>(null);
 const [totalLength,setTotalLength]=useState('');
 const errors=taskErrors(task);
 const patch=(p:Partial<AxialTask>)=>{setTask(t=>({...t,...p}));setMessage('');};
 const removeSelected=()=>{try{const next=deleteTaskSelection(task,selection);setTask(next);if(selection.kind==='row'){if(next.rows.length)setSelectedRow(Math.max(0,selection.index-1));else setSelection({kind:'node',index:0});}setMessage('');}catch(e){setMessage(e instanceof Error?e.message:'Проверьте ввод');}};
 const editLength=(index:number)=>{setSelectedRow(index);setTool('length');requestAnimationFrame(()=>lengthInput.current?.focus());};
 const nodeClick=(index:number,part:'node'|'fixed'|'force'='node')=>{if(tool==='length'){if(index>0)setSelectedRow(index-1);return;}setSelection({kind:tool==='fixed'?'fixed':tool==='left'||tool==='right'?'force':part,index});if(tool==='select')return;
  patch({nodes:task.nodes.map((n,i)=>i!==index?n:tool==='fixed'?{...n,fixed:!n.fixed}:tool==='clear'?{...n,fixed:false,direction:'none',forceKN:'0'}:{...n,direction:tool as 'left'|'right'})});
 };
 return <div className="modal-backdrop" onKeyDown={e=>{if(e.key!=='Delete'&&e.key!=='Backspace')return;const target=e.target as HTMLElement;if(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable)return;e.preventDefault();e.stopPropagation();removeSelected();}}><section className="legacy-dialog panel" role="dialog" aria-modal="true" aria-labelledby="task-title">
  <div className="panel-title"><h2 id="task-title">Нарисовать ступенчатый стержень</h2><button onClick={onClose}>Закрыть</button></div>
  <div className="legacy-body"><label className="task-name">Название задания <input value={task.title} onChange={e=>patch({title:e.target.value})}/></label>
    <p>Создайте нужное число ступеней. Щёлкните по ступени, чтобы выбрать её строку; инструментом «Заделка» или «Сила» щёлкните по узлу. Все параметры также доступны в таблицах ниже.</p>
    <div className="task-draw-tools">{([['select','Выбор'],['fixed','Заделка'],['left','← Сила'],['right','Сила →'],['clear','Очистить узел'],['length','Изменить длину']] as const).map(([value,label])=><button key={value} aria-pressed={tool===value} className={tool===value?'primary':''} onClick={()=>setTool(value)}>{label}</button>)}<button onClick={()=>{setTask(insertTaskRow(task,task.rows.length-1));setSelectedRow(task.rows.length);setMessage('');}}>+ Ступень в конце</button><button disabled={selectedRow<0} onClick={()=>{setTask(insertTaskRow(task,selectedRow));setSelectedRow(selectedRow+1);setMessage('');}}>+ После выбранной</button><button onClick={removeSelected}>Удалить выбранное · Delete</button><button disabled={selectedRow<0} onClick={()=>{try{setTask(splitTaskRow(task,selectedRow));setMessage('Ступень разделена на два равных участка с сохранением общей длины.');}catch(e){setMessage(e instanceof Error?e.message:'Проверьте длину');}}}>Разделить пополам (ℓ + ℓ)</button></div>
    <div className="task-length-controls">{selectedRow>=0&&<label>Длина выбранной ступени, см <input ref={lengthInput} aria-label="Длина выбранной ступени, см" value={task.rows[selectedRow]!.lengthCM} onChange={e=>patch({rows:task.rows.map((r,i)=>i===selectedRow?{...r,lengthCM:e.target.value}:r)})}/></label>}<label>Общая длина, см <input aria-label="Общая длина, см" placeholder={task.rows.every(r=>positiveValue(r.lengthCM)!==null)?n(task.rows.reduce((a,r)=>a+positiveValue(r.lengthCM)!,0)):'Введите все длины'} value={totalLength} onChange={e=>setTotalLength(e.target.value)}/></label><button onClick={()=>{try{setTask(resizeTask(task,totalLength));setMessage('Общая длина изменена; отношения длин сохранены.');}catch(e){setMessage(e instanceof Error?e.message:'Проверьте длину');}}}>Применить общую длину</button></div>
    <TaskSketch task={task} onRow={setSelectedRow} onNode={nodeClick} onLength={editLength} onResizeNode={tool==='length'?(node,lengthCM)=>{setSelectedRow(node-1);patch({rows:task.rows.map((r,i)=>i===node-1?{...r,lengthCM}:r)});}:undefined} selectedRow={selectedRow} selectedNode={selectedNode}/>
    <p className="hint">Заделки можно поставить в любом узле, в том числе на обоих концах. Повторный щелчок инструментом «Заделка» снимает её. На правом конце штриховка направлена наружу. Двойной щелчок по размеру открывает изменение длины; инструментом «Изменить длину» можно тянуть правый узел ступени. При удалении ступени её граничные узлы объединяются: заделки сохраняются, силы складываются с учётом направлений. Числа длин задают пропорции чертежа; высоты показывают отношения площадей.</p>
    <h3>Ступени — слева направо ({task.rows.length})</h3>
    <div className="task-table-wrap"><table className="task-input-table"><thead><tr><th>Ступень</th><th>Длина ℓ, см</th><th>Обозначение площади</th><th>Соотношение A/A₀</th></tr></thead><tbody>{task.rows.map((r,i)=><tr key={r.number} tabIndex={0} className={selectedRow===i?'task-selected-row':''} onClick={()=>setSelectedRow(i)}><td>ℓ{r.number}</td>{(['lengthCM','areaLabel','ratio'] as const).map(key=><td key={key}><input aria-label={`${key} ступени ${r.number}`} value={r[key]} onChange={e=>patch({rows:task.rows.map((row,j)=>j===i?{...row,[key]:e.target.value}:row)})}/></td>)}</tr>)}</tbody></table></div>
    <h3>Узлы — закрепления и силы ({task.nodes.length})</h3>
    <div className="task-table-wrap"><table className="task-input-table"><thead><tr><th>Узел</th><th>Заделка</th><th>Сторона штриховки</th><th>Направление силы</th><th>Величина силы, кН</th></tr></thead><tbody>{task.nodes.map((n,i)=><tr key={i} tabIndex={0} className={selectedNode===i?'task-selected-row':''} onClick={()=>setSelectedNode(i)}><td>{i+1}{i===0?' · левый конец':i===task.nodes.length-1?' · правый конец':''}</td><td><input type="checkbox" aria-label={`Заделка в узле ${i+1}`} checked={n.fixed} onChange={e=>patch({nodes:task.nodes.map((node,j)=>j===i?{...node,fixed:e.target.checked}:node)})}/></td><td><select aria-label={`Сторона заделки в узле ${i+1}`} disabled={!n.fixed} value={n.fixedSide??'auto'} onChange={e=>patch({nodes:task.nodes.map((node,j)=>j===i?{...node,fixedSide:e.target.value as 'auto'|'left'|'right'}:node)})}><option value="auto">Автоматически</option><option value="left">Слева</option><option value="right">Справа</option></select></td><td><select aria-label={`Направление силы в узле ${i+1}`} value={n.direction} onChange={e=>patch({nodes:task.nodes.map((node,j)=>j===i?{...node,direction:e.target.value as typeof n.direction}:node)})}><option value="none">Нет силы</option><option value="left">← Влево</option><option value="right">→ Вправо</option></select></td><td><input aria-label={`Сила в узле ${i+1}, кН`} disabled={n.direction==='none'} value={n.forceKN} onChange={e=>patch({nodes:task.nodes.map((node,j)=>j===i?{...node,forceKN:e.target.value}:node)})}/></td></tr>)}</tbody></table></div>
    <h3>Базовая площадь и материал</h3><p>Для каждой ступени A = (соотношение из таблицы) × A₀. Например, 1; 1,5; 2 означают площади A₀; 1,5A₀; 2A₀.</p>
    <div className="rgr-fields">{([['baseAreaMM2','Базовая площадь A₀, мм²'],['modulusGPa','Модуль упругости E, ГПа'],['material','Материал'],['tensionMPa','[σ] растяжение, МПа'],['compressionMPa','[σ] сжатие, МПа']] as const).map(([key,label])=><label key={key}>{label}<input value={task[key]} onChange={e=>patch({[key]:e.target.value})}/></label>)}</div>
    <div className="rgr-actions"><button onClick={()=>{try{const sized=taskWithSizedArea(task);setTask(sized);setMessage(`A₀,min = ${n(sized.areaSizing!.minimumBaseArea*1e6)} мм²; принято ${sized.baseAreaMM2} мм².`);}catch(e){setMessage(e instanceof Error?e.message:'Проверьте ввод');}}}>Подобрать A₀ по прочности</button><button className="primary" disabled={errors.length>0} onClick={()=>{try{onApply(projectFromTask(task),{tensionMPa:task.tensionMPa,compressionMPa:task.compressionMPa});}catch(e){setMessage(e instanceof Error?e.message:'Проверьте ввод');}}}>Создать расчётную модель</button></div>
    {message&&<p role="status">{message}</p>}{errors.length>0&&<details><summary>Что нужно заполнить ({errors.length})</summary><ul>{errors.map((e,i)=><li key={i}>{e}</li>)}</ul></details>}
    <p className="hint">После создания модели доступны расчёт и сохранение JSON. Для одной или нескольких заделок доступен пошаговый осевой отчёт РГР с реакциями, условиями совместности и эпюрами N, σ и u.</p>
  </div>
 </section></div>;
}

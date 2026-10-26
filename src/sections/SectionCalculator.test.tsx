// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {Blob as NativeBlob} from 'node:buffer';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {SectionCalculator} from './SectionCalculator';
import {NumberFormatProvider} from '../display/NumberFormat';
import type {Section} from '../model';
import type {SectionGeometry} from './types';
let root:Root,downloaded:NativeBlob|null;
const used=vi.fn<(s:Section)=>void>(),draft=vi.fn<(g:SectionGeometry)=>void>(),printed=vi.fn();
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const button=(text:string)=>[...document.querySelectorAll('button')].find(b=>b.textContent===text)!;
const select=(label:string)=>document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
async function click(text:string){await act(async()=>button(text).click());}
async function change(el:HTMLInputElement|HTMLSelectElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(el instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLSelectElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event(el instanceof HTMLInputElement?'input':'change',{bubbles:true}));});}
beforeEach(async()=>{
 document.body.innerHTML='<div id="section-test"></div>';downloaded=null;used.mockClear();draft.mockClear();printed.mockClear();
 vi.stubGlobal('Blob',NativeBlob);
 URL.createObjectURL=vi.fn((blob)=>{downloaded=blob as unknown as NativeBlob;return 'blob:section-test';});URL.revokeObjectURL=vi.fn();
 vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 root=createRoot(document.getElementById('section-test')!);await act(async()=>root.render(<NumberFormatProvider places={3}><SectionCalculator onClose={()=>{}} onDraft={draft} onUse={used} onPrint={printed}/></NumberFormatProvider>));
});
afterEach(async()=>{await act(async()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();});
it('catalog→independent row→calculate→edit→save/open→transfer→report',async()=>{
 expect(select('Схема сечения').value).toBe('19');expect(select('Строка размеров').value).toBe('19');
 await change(select('Строка размеров'),'4');expect(select('Схема сечения').value).toBe('19');
 await click('Рассчитать сечение');expect(document.querySelector('.section-report')).not.toBeNull();
 await change(document.querySelector<HTMLInputElement>('input[aria-label="Размер a"]')!,'55,25');expect(document.querySelector('.section-report')).toBeNull();
 await click('Рассчитать сечение');await click('Сохранить сечение');
 const saved=JSON.parse(await downloaded!.text());expect(saved.geometry.scheme).toBe(19);expect(saved.geometry.dimensionRow).toBe(4);expect(saved.geometry.a).toBeCloseTo(.5525,14);
 await change(select('Схема сечения'),'1');
 const file=document.querySelector<HTMLInputElement>('input[type=file]')!;Object.defineProperty(file,'files',{value:[{name:'section.saprsection.json',text:async()=>JSON.stringify(saved)}],configurable:true});
 await act(async()=>file.dispatchEvent(new Event('change',{bubbles:true})));expect(select('Схема сечения').value).toBe('19');expect(select('Строка размеров').value).toBe('4');
 expect(document.querySelector('.section-report')).toBeNull();await click('Рассчитать сечение');
 const confirm=[...document.querySelectorAll('label')].find(l=>l.textContent?.includes('Подтверждаю'))!.querySelector('input')!;
 expect(button('Использовать сечение в проекте').disabled).toBe(true);await act(async()=>confirm.click());await click('Использовать сечение в проекте');
 expect(used).toHaveBeenCalledTimes(1);expect(used.mock.calls[0]![0].calculator!.geometry).toEqual(saved.geometry);
 await click('Печать сечения / A4');expect(printed).toHaveBeenCalledTimes(1);
 await change(document.querySelector<HTMLInputElement>('input[aria-label="Размер b"]')!,'15');expect(document.querySelector('.section-report')).toBeNull();
});
it('unconfirmed template explains missing geometry and cannot calculate',async()=>{
 await change(select('Схема сечения'),'20');expect(document.querySelector('[role=alert]')!.textContent).toContain('радиус');
 expect(button('Рассчитать сечение').disabled).toBe(true);expect(document.querySelector('.section-report')).toBeNull();
});
it('physical scale blocks oversized A4 and changing units preserves geometry',async()=>{
 await click('Рассчитать сечение');const original=draft.mock.calls.length;
 await change(select('Единицы сечения'),'mm');expect(draft.mock.calls.length).toBe(original);expect(document.querySelector('.section-report')).not.toBeNull();
 const scale=[...document.querySelectorAll('label')].find(l=>l.textContent?.startsWith('Масштаб чертежа'))!.querySelector('select')!;
 await change(scale,'2');expect(button('Печать сечения / A4').disabled).toBe(true);await change(scale,'fit');expect(button('Печать сечения / A4').disabled).toBe(false);
});
it('manual part edit keeps a/b editable and fixed dimensions independent of variables',async()=>{
 const x=[...document.querySelectorAll('label')].find(l=>l.textContent?.startsWith('Имя'))!.querySelector('input')!;
 await change(x,'Моя часть');expect(select('Схема сечения').value).toBe('0');
 const a=document.querySelector<HTMLInputElement>('input[aria-label="Размер a"]')!;
 expect(a.disabled).toBe(false);await change(a,'100');
 expect(draft.mock.calls.at(-1)![0].a).toBe(1); expect(draft.mock.calls.at(-1)![0].parts[0]!.name).toBe('Моя часть');
 await click('Рассчитать сечение');expect(document.querySelector('.section-report')).not.toBeNull();
});
it('draw custom polygon, recalculate, move part and delete with keyboard',async()=>{
 await click('Нарисовать с нуля');await change(select('Инструмент рисования'),'polygon');
 const canvas=document.querySelector<SVGSVGElement>('.section-sketch-canvas')!;
 const point=async(type:string,x:number,y:number,target:Element=canvas)=>act(async()=>{const e=new MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});Object.defineProperty(e,'pointerId',{value:1});target.dispatchEvent(e);});
 await point('pointerdown',150,300);await point('pointerdown',250,300);await point('pointerdown',150,200);await click('Замкнуть контур');
 expect(draft.mock.calls.at(-1)![0].parts).toHaveLength(1);await click('Рассчитать сечение');expect(document.querySelector('.section-report')).not.toBeNull();
 const shape=canvas.querySelector('[data-part]')!;await point('pointerdown',150,300,shape);await point('pointermove',170,300);await point('pointerup',170,300);
 expect(document.querySelector('.section-report')).toBeNull();await act(async()=>canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true})));
 expect(draft.mock.calls.at(-1)![0].parts).toHaveLength(0);
});
it('a=38 → width=3a → 114cm; variable edits, units and save/open preserve binding',async()=>{
 await click('Создать пользовательское сечение');
 const a=document.querySelector<HTMLInputElement>('[aria-label="Размер a"]')!;
 await change(a,'38');await change(document.querySelector<HTMLInputElement>('[aria-label="Ширина 1, cm"]')!,'3a');await change(document.querySelector<HTMLInputElement>('[aria-label="Высота 1, cm"]')!,'2b');
 let g=draft.mock.calls.at(-1)![0];expect((g.parts[0]!.shape as {width:number}).width).toBeCloseTo(1.14,13);expect(g.parts[0]!.expressions!.width!.text).toBe('3a');
 await click('Рассчитать сечение');expect(document.querySelector('.section-report')!.textContent).toContain('3a');
 await change(a,'40');expect(document.querySelector('.section-report')).toBeNull();g=draft.mock.calls.at(-1)![0];expect((g.parts[0]!.shape as {width:number}).width).toBeCloseTo(1.2,13);
 await change(select('Единицы сечения'),'mm');expect(document.querySelector<HTMLInputElement>('[aria-label="Ширина 1, mm"]')!.value).toBe('3a');
 await click('Сохранить сечение');const saved=JSON.parse(await downloaded!.text());expect(saved.geometry.parts[0].expressions.width).toEqual({text:'3a',unit:'cm'});
 const file=document.querySelector<HTMLInputElement>('input[type=file]')!;Object.defineProperty(file,'files',{value:[{text:async()=>JSON.stringify(saved)}],configurable:true});await act(async()=>file.dispatchEvent(new Event('change',{bubbles:true})));
 expect(document.querySelector<HTMLInputElement>('[aria-label="Ширина 1, mm"]')!.value).toBe('3a');
 await change(document.querySelector<HTMLInputElement>('[aria-label="Ширина 1, mm"]')!,'200');g=draft.mock.calls.at(-1)![0];expect((g.parts[0]!.shape as {width:number}).width).toBeCloseTo(.2,13);expect(g.parts[0]!.expressions!.width).toBeUndefined();
 await change(a,'450');expect((draft.mock.calls.at(-1)![0].parts[0]!.shape as {width:number}).width).toBeCloseTo(.2,13);
});
it('multiple invalid expressions remain blocking until all are fixed',async()=>{
 await click('Создать пользовательское сечение');await change(document.querySelector<HTMLInputElement>('[aria-label="Ширина 1, cm"]')!,'a/');await change(document.querySelector<HTMLInputElement>('[aria-label="Высота 1, cm"]')!,'b/');
 expect(button('Рассчитать сечение').disabled).toBe(true);expect(button('Сохранить сечение').disabled).toBe(true);
 await change(document.querySelector<HTMLInputElement>('[aria-label="Ширина 1, cm"]')!,'a');expect(button('Рассчитать сечение').disabled).toBe(true);
 await change(document.querySelector<HTMLInputElement>('[aria-label="Высота 1, cm"]')!,'b');expect(button('Рассчитать сечение').disabled).toBe(false);await click('Рассчитать сечение');expect(document.querySelector('.section-report')).not.toBeNull();
});
it('fixing a formula after rejected variable update adopts the visible current variables',async()=>{
 await click('Создать пользовательское сечение');const width=document.querySelector<HTMLInputElement>('[aria-label="Ширина 1, cm"]')!;
 await change(width,'a*b/(a-b)');await change(document.querySelector<HTMLInputElement>('[aria-label="Размер a"]')!,'14');expect(button('Рассчитать сечение').disabled).toBe(true);
 await change(width,'a');const g=draft.mock.calls.at(-1)![0];expect(g.a).toBeCloseTo(.14,13);expect((g.parts[0]!.shape as {width:number}).width).toBeCloseTo(.14,13);
 expect(button('Рассчитать сечение').disabled).toBe(false);await click('Рассчитать сечение');expect(document.querySelector('.section-report')).not.toBeNull();
});
it('old section file retains stretch mode until explicitly converted to variables',async()=>{
 const old={format:'saprbar-section',version:1,unit:'cm',geometry:{version:1,name:'old',a:.1,b:.1,parts:[{id:'old',name:'old',cut:false,x:0,y:0,angle:0,shape:{kind:'rectangle',width:.1,height:.1}}]}};
 const file=document.querySelector<HTMLInputElement>('input[type=file]')!;Object.defineProperty(file,'files',{value:[{text:async()=>JSON.stringify(old)}],configurable:true});await act(async()=>file.dispatchEvent(new Event('change',{bubbles:true})));
 expect(select('Режим a и b').value).toBe('scale');await change(document.querySelector<HTMLInputElement>('[aria-label="Размер a"]')!,'20');expect((draft.mock.calls.at(-1)![0].parts[0]!.shape as {width:number}).width).toBeCloseTo(.2,13);
 await change(document.querySelector<HTMLInputElement>('[aria-label="Ширина 1, cm"]')!,'3a');expect(select('Режим a и b').value).toBe('variables');await change(document.querySelector<HTMLInputElement>('[aria-label="Размер a"]')!,'38');expect((draft.mock.calls.at(-1)![0].parts[0]!.shape as {width:number}).width).toBeCloseTo(1.14,13);
});

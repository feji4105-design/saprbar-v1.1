// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {URL as NodeURL} from 'node:url';
import {readFileSync} from 'node:fs';
import App from '../App';
import * as solver from '../solver';
let root:Root;
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const fixture=readFileSync(new NodeURL('../../tests/fixtures/rgr-variant-4/VARIANT4.saprbar.json',import.meta.url),'utf8');
const button=(text:string)=>[...document.querySelectorAll('button')].find(b=>b.textContent===text)!;
async function click(text:string){await act(async()=>button(text).click());}
async function change(element:HTMLInputElement|HTMLSelectElement,value:string){await act(async()=>{
 const proto=element instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLSelectElement.prototype;
 Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(element,value);
 element.dispatchEvent(new Event(element instanceof HTMLInputElement?'input':'change',{bubbles:true}));
});}
beforeEach(async()=>{
 document.body.innerHTML='<div id="test-app"></div>';
 vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{cb(0);return 1;});
 vi.stubGlobal('print',vi.fn());
 root=createRoot(document.getElementById('test-app')!);
 await act(async()=>root.render(<App/>));
 const file=document.querySelector('input[type=file]')!;
 Object.defineProperty(file,'files',{value:[{name:'exercise.saprbar.json',text:async()=>fixture}],configurable:true});
 await act(async()=>file.dispatchEvent(new Event('change',{bubbles:true})));
 await click('Рассчитать');
});
afterEach(async()=>{await act(async()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();});
it('precision rerenders computed text without solving/stale; dialog settings survive close and print',async()=>{
 const analyze=vi.spyOn(solver,'analyzeProject');
 const precision=document.querySelector('.precision-setting select') as HTMLSelectElement;
 const previous=document.querySelector('.results-tables')!.textContent;
 await change(precision,'12');
 expect(document.querySelector('.results-tables')!.textContent).not.toBe(previous);
 expect(analyze).not.toHaveBeenCalled();expect(button('Отчёт РГР').disabled).toBe(false);expect(document.querySelector('.stale-banner')).toBeNull();
 await click('Отчёт РГР');
 const mode=document.querySelector('.rgr-settings select') as HTMLSelectElement;
 await change(mode,'short');
 const graphics=document.querySelector('.rgr-settings input[type=checkbox]') as HTMLInputElement;
 await act(async()=>graphics.click());
 expect(document.querySelector('.rgr-preview .rgr-short')).not.toBeNull();expect(document.querySelector('.rgr-preview svg')).toBeNull();
 await click('Закрыть');await click('Отчёт РГР');
 expect((document.querySelector('.rgr-settings select') as HTMLSelectElement).value).toBe('short');
 expect((document.querySelector('.rgr-settings input[type=checkbox]') as HTMLInputElement).checked).toBe(false);
 expect([...document.querySelectorAll('.precision-setting select')].every(s=>(s as HTMLSelectElement).value==='12')).toBe(true);
 await click('Печать / PDF');
 expect(window.print).toHaveBeenCalledTimes(1);
 expect(document.querySelector('.print-report .rgr-short')).not.toBeNull();
 expect(document.querySelector('.print-report .rgr-short')!.textContent).toBe(document.querySelector('.rgr-preview .rgr-short')!.textContent);expect(document.querySelector('.print-report svg')).toBeNull();
});
it('editing original data blocks final RGR until recalculate',async()=>{
 await click('Отчёт РГР');await click('Закрыть');
 await change(document.querySelector('.project-title') as HTMLInputElement,'Changed model');
 expect(button('Отчёт РГР').disabled).toBe(true);expect(document.querySelector('.stale-banner')).not.toBeNull();
 expect(document.querySelector('.print-report .rgr-short')).toBeNull();
 await click('Рассчитать');expect(button('Отчёт РГР').disabled).toBe(false);
});

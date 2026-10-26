// @vitest-environment jsdom
import {Blob as NodeBlob} from 'node:buffer';
import {readFileSync} from 'node:fs';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {unzipSync,strFromU8} from 'fflate';
import {parseProjectJson,serializeProject} from '../model';
import {LegacyImportDialog} from './LegacyImportDialog';
let root:Root;let downloaded:NodeBlob[];let names:string[];
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('Blob',NodeBlob);
 downloaded=[];names=[];URL.createObjectURL=vi.fn(blob=>{downloaded.push(blob as unknown as NodeBlob);return 'blob:test';});URL.revokeObjectURL=vi.fn();
 vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){names.push(this.download);});
 document.body.innerHTML='<div id="test-root"></div>';root=createRoot(document.getElementById('test-root')!);
});
afterEach(async()=>{await act(async()=>root.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();});
const project=()=>parseProjectJson(readFileSync('tests/fixtures/rgr1-scheme19/project.saprbar.json','utf8'));
async function click(text:string){const button=[...document.querySelectorAll('button')].find(b=>b.textContent===text)!;expect(button).toBeTruthy();await act(async()=>button.click());}
async function set(label:string,value:string){const input=document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
it('requires missing properties, generates ZIP from model instead of old buffers and persists settings to JSON',async()=>{
 const p=project(),save=vi.fn();await act(async()=>root.render(<LegacyImportDialog project={p} onApply={()=>{}} onClose={()=>{}} onSaveExportSettings={save} initialFiles={{CN:{name:'OLD.CN',text:'old CN'},LD:{name:'OLD.LD',text:'old LD'},MD:{name:'OLD.MD',text:'old MD'}}}/>));
 await click('Скачать комплект CN/LD/MD в ZIP');expect(document.querySelector('[role="alert"]')!.textContent).toContain('плотност');expect(downloaded).toHaveLength(0);expect(save).not.toHaveBeenCalled();
 for(const [key,val] of [['Имя комплекта','V4SIGN'],['Плотность Ro','8000'],['Коэффициент aT','0.000012'],['Допускаемое растяжение Sp','70'],['Допускаемое сжатие Sc','120']])await set(key!,val!);
 await click('Скачать комплект CN/LD/MD в ZIP');expect(document.querySelector('[role="alert"]')).toBeNull();expect(names).toEqual(['V4SIGN.zip']);expect(save).toHaveBeenCalledOnce();
 const entries=unzipSync(new Uint8Array(await downloaded[0]!.arrayBuffer()));expect(Object.keys(entries).sort()).toEqual(['V4SIGN.CN','V4SIGN.LD','V4SIGN.MD']);
 expect(strFromU8(entries['V4SIGN.CN']!)).toContain('8000 1.2e-5');expect(strFromU8(entries['V4SIGN.CN']!)).toContain('-0.019364916731037084');expect(strFromU8(entries['V4SIGN.MD']!)).toContain('1e-8 1.0 1.0 1.0 0 0 0 0 9.81 0');
 expect(strFromU8(entries['V4SIGN.CN']!)).not.toContain('old');expect(p.legacyExport).toBeUndefined();
 p.legacyExport=save.mock.calls[0]![0];const restored=parseProjectJson(serializeProject(p));
 await act(async()=>root.unmount());root=createRoot(document.getElementById('test-root')!);
 await act(async()=>root.render(<LegacyImportDialog project={restored} onApply={()=>{}} onClose={()=>{}}/>));
 expect(document.querySelector<HTMLInputElement>('input[aria-label="Коэффициент aT"]')!.value).toBe('0.000012');
 await click('Скачать комплект CN/LD/MD в ZIP');expect(names).toEqual(['V4SIGN.zip','V4SIGN.zip']);
});

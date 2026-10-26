// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from 'vitest';
import {exportReportPdf} from './exportReportPdf';
const pdf=vi.hoisted(()=>({source:'',save:vi.fn(),render:vi.fn(async()=>{})}));
vi.mock('html2pdf.js',()=>({default:()=>{
 const worker={set:()=>worker,from:(el:HTMLElement)=>{pdf.source=el.outerHTML;return worker;},toPdf:()=>pdf.render(),save:pdf.save};return worker;
}}));
beforeEach(()=>{document.body.innerHTML='<header>SAPR-BAR Web https://gringol.ru</header><div class="rgr-preview"><article class="rgr-document rgr-short"><p>N = 60 кН</p><svg><text>σ = 70 МПа</text></svg></article></div>';pdf.source='';pdf.save.mockReset();pdf.render.mockReset();pdf.render.mockResolvedValue(undefined);});
const report=()=>document.querySelector<HTMLElement>('.rgr-document')!;
it('exports only report content and leaves preview intact',async()=>{
 const original=report().outerHTML;
 expect(await exportReportPdf(report(),'report.pdf')).toBe(true);
 expect(pdf.source).toContain('N = 60 кН');expect(pdf.source).toContain('σ = 70 МПа');
 expect(pdf.source).not.toMatch(/SAPR-BAR Web|https:\/\/gringol/);
 expect(pdf.save).toHaveBeenCalledTimes(1);expect(report().outerHTML).toBe(original);expect(document.querySelector('.rgr-pdf-stage')).toBeNull();
});
it('stale/cancelled generation cannot download and temporary DOM is cleaned',async()=>{
 expect(await exportReportPdf(report(),'report.pdf',()=>false)).toBe(false);expect(pdf.save).not.toHaveBeenCalled();
 let current=true;pdf.render.mockImplementation(async()=>{current=false;});
 expect(await exportReportPdf(report(),'report.pdf',()=>current)).toBe(false);expect(pdf.save).not.toHaveBeenCalled();expect(document.querySelector('.rgr-pdf-stage')).toBeNull();
});
it('renderer errors are propagated without modifying report',async()=>{
 const original=report().outerHTML;pdf.render.mockRejectedValue(new Error('render failed'));
 await expect(exportReportPdf(report(),'report.pdf')).rejects.toThrow('render failed');
 expect(pdf.save).not.toHaveBeenCalled();expect(report().outerHTML).toBe(original);expect(document.querySelector('.rgr-pdf-stage')).toBeNull();
});

import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {catalogSection,textbookExample} from './catalog';
import {calculateSection} from './calculate';
import {SectionReport} from './SectionReport';
import {SectionDrawing,drawingLayout} from './SectionDrawing';
import {NumberFormatProvider} from '../display/NumberFormat';
it('both reports contain 9 stages, negative substitutions and consistent units',()=>{
 const geometry=textbookExample(),result=calculateSection(geometry);
 for(const short of [true,false])for(const unit of ['cm','mm','m'] as const){const html=renderToStaticMarkup(<SectionReport geometry={geometry} result={result} unit={unit} short={short}/>);
  for(let i=1;i<=9;i++)expect(html).toContain(`<h2>${i}.`);
  expect(html).toContain('Верхний равнобедренный вырез');expect(html).toContain('−');expect(html).toContain('→');expect(html).not.toMatch(/NaN|Infinity/);
  expect(html).toContain(`W(верх)`);expect(html).toContain(`W(лево)`);expect(html).toContain(`${unit}⁴`);
 }
});
it('drawing uses exact same edges and one uniform coordinate scale; A4 actual ratio',()=>{
 const result=calculateSection(catalogSection(19,.5,.14,19));
 expect(drawingLayout(result,'2').fits).toBe(false);expect(drawingLayout(result,'5').fits).toBe(false);
 const fit=drawingLayout(result,'fit');expect(fit.fits).toBe(true);expect(fit.ratio).toBeGreaterThan(5);
 const html=renderToStaticMarkup(<SectionDrawing result={result} unit="cm"/>);
 expect(html).toContain('preserveAspectRatio="xMidYMid meet"');expect(html).toContain('scale(1,-1)');expect(html).toContain('<mask');expect(html).toContain('fill="black"');
 const tiny=calculateSection(catalogSection(19,.02,.005));expect(drawingLayout(tiny,'2').fits).toBe(true);
});
it('precision affects only report text, not geometry or moments',()=>{
 const geometry=catalogSection(19,.5,.14),r=calculateSection(geometry),snapshot=JSON.stringify({geometry,r});
 const html=(places:number)=>renderToStaticMarkup(<NumberFormatProvider places={places}><SectionReport geometry={geometry} result={r} unit="m" short/></NumberFormatProvider>);
 expect(html(0)).not.toBe(html(8));expect(JSON.stringify({geometry,r})).toBe(snapshot);
});

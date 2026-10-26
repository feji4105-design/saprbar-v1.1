import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ResultsDiagrams, ElementDiagram } from "./ResultsDiagrams";
import { ResultsPanel } from "./ResultsPanel";
import { PrintReport } from "./PrintReport";
import { parseProjectJson } from "../model";
import { analyzeProject } from "../solver";

const project=parseProjectJson(readFileSync(new URL("../../tests/fixtures/ivanov-corrected/IVANOV_SI.saprbar.json",import.meta.url),"utf8"));
const analysis=analyzeProject(project);
if(!analysis.ok) throw new Error("Расчёт Иванова не выполнен");

it("строит 12 самостоятельных эпюр Иванова с усилиями, единицами и нулевыми Q/M",()=>{
  const markup=renderToStaticMarkup(<ResultsDiagrams project={project} analysis={analysis}/>);
  expect(markup.match(/class="result-diagram"/g)).toHaveLength(12);
  expect(markup).toContain('>60</text>');expect(markup).toContain('>10</text>');expect(markup).toContain('>90</text>');
  expect(markup.match(/Qy = 0 на всём стержне/g)).toHaveLength(4);
  expect(markup.match(/Mz = 0 на всём стержне/g)).toHaveLength(4);
  expect(markup).toContain('i: узел 4 → j: узел 5');
  expect(markup).toContain('x=0,35 м; Nx=60 кН');
  expect(markup).not.toMatch(/NaN|Infinity/);
});

it("ординаты и абсциссы SVG соответствуют результату, включая промежуточную точку",()=>{
  const element={...analysis.elements[0]!,length:2,diagram:[0,.5,2].map((x,i)=>({...analysis.elements[0]!.diagram[0]!,x,bendingMoment:[-2000,1000,0][i]!}))};
  const markup=renderToStaticMarkup(<ElementDiagram result={element} field="bendingMoment" title="Mz" unit="кН·м" color="#000"/>);
  expect(markup).toContain('points="42,115 42,177 111,84 318,115 318,115"');
  expect(markup).toContain('x=0,5 м; Mz=1 кН·м');
});

it("включает эпюры в печать и убирает неактуальные графики",()=>{
  const fresh=renderToStaticMarkup(<PrintReport project={project} analysis={analysis} stale={false}/>);
  expect(fresh.match(/class="result-diagram"/g)).toHaveLength(12);
  expect(fresh).not.toContain('Скачать SVG');
  expect(renderToStaticMarkup(<PrintReport project={project} analysis={analysis} stale/>)).not.toContain('class="result-diagram"');
  expect(renderToStaticMarkup(<ResultsPanel project={project} analysis={analysis} stale layer="none" deformationScale={1} onLayer={()=>{}} onDeformationScale={()=>{}}/>)).not.toContain('class="result-diagram"');
});

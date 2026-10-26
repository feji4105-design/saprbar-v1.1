import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
 const {projectFromTask}=await server.ssrLoadModule('/src/editor/axialTask.ts');
 const {sizingModelSnapshot}=await server.ssrLoadModule('/src/editor/areaSizing.ts');
 const {serializeProject}=await server.ssrLoadModule('/src/model/projectFormat.ts');
 const {analyzeProject}=await server.ssrLoadModule('/src/solver/index.ts');
 const {RgrReport}=await server.ssrLoadModule('/src/editor/RgrReport.tsx');
 const {initialRgrOptions}=await server.ssrLoadModule('/src/editor/axialReport.ts');
 const {NumberFormatProvider}=await server.ssrLoadModule('/src/display/NumberFormat.tsx');
 const p=projectFromTask({title:'РГР 1 — схема 19, вариант 4',
  rows:[{number:4,lengthCM:'75',ratio:'2.4',areaLabel:'A4'},{number:3,lengthCM:'65',ratio:'1',areaLabel:'A1'},{number:2,lengthCM:'50',ratio:'2',areaLabel:'A3'},{number:1,lengthCM:'35',ratio:'1.5',areaLabel:'A2'}],
  nodes:[{fixed:true,fixedSide:'left',forceKN:'0',direction:'none'},...[90,80,50,-60].map(f=>({fixed:false,forceKN:String(Math.abs(f)),direction:f>0?'right':'left'}))],
  baseAreaMM2:'1000',modulusGPa:'80',tensionMPa:'70',compressionMPa:'120',material:'Чугун; E=80 ГПа по формулам RGR1.docx'});
 p.metadata.description+=' Источники: IMG_3315.jpg, таблица 1, вариант 4; IMG_3316.jpg, схема 19. E=80 ГПа взят из формул RGR1.docx, а не из таблицы. A₀,min=1000 мм² определено независимо методом сечений: max(60000/(1.5*120),10000/(2*120),70000/70,160000/(2.4*70)) мм². Квадратная форма — соглашение веб-модели; в осевом расчёте используется только EA. Плотность не задана.';
 p.metadata.areaSizing={modelSnapshot:sizingModelSnapshot(p),minimumBaseArea:.001,tensionMPa:70,compressionMPa:120};
 const a=analyzeProject(p);if(!a.ok)throw Error(JSON.stringify(a.diagnostics));
 const options={...initialRgrOptions(p),reportKind:'assignment',includeGraphics:true,modulusConfirmed:true};
 const body=renderToStaticMarkup(createElement(NumberFormatProvider,{places:5},createElement(RgrReport,{project:p,analysis:a,options})));
 const css=await readFile('src/editor/rgrReport.css','utf8');
 const dir='output/rgr19-variant4';await mkdir(dir,{recursive:true});
 await writeFile(`${dir}/RGR19V4.saprbar.json`,serializeProject(p));
 await writeFile(`${dir}/RGR19V4-report.html`,`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>РГР 1 — схема 19, вариант 4</title><style>${css}</style></head><body>${body}</body></html>`);
 console.log(JSON.stringify({reaction:a.reactions[0],displacements:a.displacements.map(d=>d.ux),area:.001}));
} finally {await server.close();}

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importLegacyFiles } from "./importLegacy";
import { parseProjectJson, serializeProject } from "../model";
import { analyzeProject } from "../solver";
import { createLegacyTemplate } from "./templates";

const fixture=(name:string)=>({name,text:readFileSync(new URL(`../../tests/fixtures/legacy-synthetic/${name}`,import.meta.url),"utf8")});

describe("импорт документированной структуры SAPR-BAR",()=>{
  it.each(["B","R"] as const)("создаёт валидируемый синтетический комплект варианта %s",(variant)=>{
    const files=createLegacyTemplate(variant);
    const result=importLegacyFiles(files.CN,files.LD,files.MD,{variant,unitSystem:"mm-kN-MPa"});
    expect(result.ok).toBe(true);if(!result.ok)return;
    expect(result.report.blockers).toEqual([]);
    expect(result.report.counts).toMatchObject({nodes:2,elements:1,supports:1,nodalLoads:1});
  });

  it("читает оформленный B-профиль настоящего редактора SAPR-BAR",()=>{
    const cn={name:"FORMATTED.CN",text:`CN: C:\\SAPR_B30\\FORMATTED.CN\r\n
************* NR NS NC ND NM *************\r\n
 2 1 1 0 0\r\n
*** XR ***\r\n
=01 0 0\r\n
=02 1000 0\r\n
=03\r\n
*** XS ***\r\n
=01 1 2 1\r\n
*** XC ***\r\n
=01 1 210000 0 0 100 8333333.333333 50 50 0 0\r\n
*** CN: End ***\r\n`};
    const ld={name:"FORMATTED.LD",text:`LD: C:\\SAPR_B30\\FORMATTED.LD\r\n
*** NA NQR NQS NT ***\r\n
1 1 0 0\r\n
*** NB ***\r\n
=01 1 1 1 1 0 0 0\r\n
*** QR ***\r\n
=01 2 0 -1 0\r\n
*** QS ***\r\n
=01\r\n
*** LD: End ***\r\n`};
    const md={name:"FORMATTED.MD",text:`MD: C:\\SAPR_B30\\FORMATTED.MD\r\n
*** EPS q_0 q_k dq ***\r\n
0 1 1 1 0 0 0 0 0 0\r\n
*** NP NL NG NZ ***\r\n
1 0 0 0 0 0 0 0 0 1\r\n
*** MD: End ***\r\n`};
    const result=importLegacyFiles(cn,ld,md,{variant:"B",unitSystem:"mm-kN-MPa"});
    expect(result.ok).toBe(true);if(!result.ok)return;
    expect(result.report.blockers).toEqual([]);
    expect(result.project.model.nodes[1]).toMatchObject({x:1,y:0});
  });

  it("импортирует синтетическую линейно-статическую консоль с выбранными единицами",()=>{
    const result=importLegacyFiles(fixture("cantilever.CN"),fixture("cantilever.LD"),fixture("cantilever.MD"),{variant:"B",unitSystem:"mm-kN-MPa"});
    expect(result.ok).toBe(true);if(!result.ok)return;
    expect(result.report.blockers).toEqual([]);
    expect(result.project.model.nodes[1]).toMatchObject({x:1,y:0});
    expect(result.project.model.materials[0]?.elasticModulus).toBe(210e9);
    expect(result.project.loadCases[0]?.nodalLoads[0]?.fy).toBe(-1000);
    expect(result.project.legacyImport?.compatibility).toBe("parser-validated-not-original-verified");
    expect(result.project.legacyImport?.originalFiles.cn).toContain("210000");
    const restored=parseProjectJson(serializeProject(result.project));
    expect(restored.legacyImport?.unitSystem).toBe("mm-kN-MPa");
    const analysis=analyzeProject(restored);expect(analysis.ok).toBe(true);if(!analysis.ok)return;
    expect(analysis.displacements[1]?.uy).toBeCloseTo(-1.9047619e-4,10);
    expect(analysis.displacements[1]?.rz).toBeCloseTo(-2.8571429e-4,10);
  });

  it("сообщает файл, строку и поле для ссылки вне диапазона",()=>{
    const result=importLegacyFiles(fixture("broken-index.CN"),fixture("cantilever.LD"),fixture("cantilever.MD"),{variant:"B",unitSystem:"mm-kN-MPa"});
    expect(result.ok).toBe(false);if(result.ok)return;
    expect(result.issues).toContainEqual(expect.objectContaining({file:"CN",line:4,field:"XS.J"}));
  });

  it("не удаляет температуру молча и блокирует расчёт",()=>{
    const result=importLegacyFiles(fixture("cantilever.CN"),fixture("unsupported-temperature.LD"),fixture("cantilever.MD"),{variant:"B",unitSystem:"mm-kN-MPa"});
    expect(result.ok).toBe(true);if(!result.ok)return;
    expect(result.report.blockers).toContainEqual(expect.objectContaining({file:"LD",field:"QS.T"}));
    expect(result.project.legacyImport?.calculationBlockedReasons[0]).toContain("QS.T");
  });

  it("блокирует диапазон параметра нагрузки, отличный от единственного q=1",()=>{
    const md={name:"range.MD",text:"1e-8 0.5 2 0.25 0 0 0 0 0 0\n1 0 0 0 0 0 0 0 0 1\n"};
    const result=importLegacyFiles(fixture("cantilever.CN"),fixture("cantilever.LD"),md,{variant:"B",unitSystem:"mm-kN-MPa"});
    expect(result.ok).toBe(true);if(!result.ok)return;
    expect(result.report.blockers).toContainEqual(expect.objectContaining({file:"MD",field:"PZ[2..4].q_0/q_k/dq"}));
  });

  it("отклоняет нечисловое поле и неверное число полей",()=>{
    const bad={name:"bad.CN",text:"1 0 1 0 0\nX 0\n1 210000 0\n"};
    const result=importLegacyFiles(bad,fixture("cantilever.LD"),fixture("cantilever.MD"),{variant:"B",unitSystem:"SI"});
    expect(result.ok).toBe(false);if(result.ok)return;
    expect(result.issues.some(x=>x.file==="CN"&&x.line===2&&x.field==="поле 1")).toBe(true);
  });
});

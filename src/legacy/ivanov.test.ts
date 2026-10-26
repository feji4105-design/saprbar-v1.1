import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { importLegacyFiles } from "./importLegacy";
import { analyzeProject } from "../solver";

it("исправленный Иванов SI: размеры, баланс, усилия и аналитические перемещения", () => {
  const file = (ext: string) => ({name:`IVANOV_SI.${ext}`, text:readFileSync(new URL(`../../tests/fixtures/ivanov-corrected/IVANOV_SI.${ext}`,import.meta.url),"utf8")});
  const imported = importLegacyFiles(file("CN"),file("LD"),file("MD"),{variant:"B",unitSystem:"SI"});
  expect(imported.ok).toBe(true); if(!imported.ok) throw new Error(JSON.stringify(imported.issues));
  expect(imported.report.blockers).toEqual([]);
  expect(imported.project.model.nodes.map(n=>n.x)).toEqual([0,.35,.85,1.5,2.25]);
  expect(imported.project.loadCases[0]!.nodalLoads.map(l=>l.fx)).toEqual([-60000,50000,-80000,90000]);
  const result = analyzeProject(imported.project);
  expect(result.ok).toBe(true); if(!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const forces = [60000,10000,90000,0];
  const lengths = [.35,.5,.65,.75];
  const widths = [.025,.03065,.03535,.03872];
  result.elements.forEach((e,i) => e.diagram.forEach(p=>{
    expect(p.axialForce).toBeCloseTo(forces[i]!,6);
    expect(p.shearForce).toBeCloseTo(0,8);
    expect(p.bendingMoment).toBeCloseTo(0,8);
  }));
  result.displacements.forEach((d,i) => {
    const expected = -forces.slice(i).reduce((sum,n,j)=>sum+n*lengths[i+j]!/(80e9*widths[i+j]!**2),0);
    expect(d.ux).toBeCloseTo(expected,12);
    expect(d.uy).toBe(0); expect(d.rz).toBe(0);
  });
  expect(result.reactions[0]!.fx).toBeCloseTo(0,6);
  expect(result.equilibrium.relativeResidual).toBeLessThan(1e-9);
});

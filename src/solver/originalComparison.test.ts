import { expect, test } from "vitest";
import { APP_VERSION, PROJECT_SCHEMA_VERSION, type Project } from "../model";
import { analyzeProject, type AnalysisSuccess } from ".";

function axialProject(coordinates:number[],widths:number[],loads:Array<[number,number]>,fixed:number[]):Project {
  const now=new Date(0).toISOString();return{schemaVersion:PROJECT_SCHEMA_VERSION,appVersion:APP_VERSION,metadata:{id:"pdf",title:"SAPR-BAR PDF comparison",description:"",createdAt:now,updatedAt:now},displayUnits:{length:"m",force:"N",stress:"Pa",angle:"rad"},model:{nodes:coordinates.map((x,i)=>({id:`n${i+1}`,number:i+1,x,y:0})),materials:[{id:"m",name:"PDF",elasticModulus:8e10}],sections:widths.map((b,i)=>({id:`s${i+1}`,name:`S${i+1}`,area:b*b,inertiaZ:b**4/12,yMinus:b/2,yPlus:b/2,source:{kind:"rectangle",width:b,height:b}})),elements:widths.map((_,i)=>({id:`e${i+1}`,number:i+1,nodeI:`n${i+1}`,nodeJ:`n${i+2}`,materialId:"m",sectionId:`s${i+1}`,releases:{rotationI:false,rotationJ:false}})),supports:fixed.map(i=>({nodeId:`n${i}`,ux:true,uy:true,rz:true}))},loadCases:[{id:"lc",name:"PDF",type:"linear-static",nodalLoads:loads.map(([i,fx],k)=>({id:`l${k+1}`,nodeId:`n${i}`,fx,fy:0,mz:0})),elementLoads:[]}],analysisSettings:{analysisType:"linear-static",activeLoadCaseId:"lc",solverVersion:null,singularityTolerance:1e-12}};
}
function solve(project:Project):AnalysisSuccess {const result=analyzeProject(project);expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.diagnostics.map(x=>x.message).join("; "));return result;}

test("PDF лабораторная 1 — три согласованных значения напряжений SAPR-BAR",()=>{const result=solve(axialProject([0,.35,.85,1.5,2.25],[.04,.031622,.025819,.036514],[[4,9e4],[3,8e4],[2,5e4],[1,-6e4]],[5]));const web=result.elements.map(x=>x.diagram[10]!.stressLower);const original=[3.75e7,1.000049e7,-1.050072e8];original.forEach((expected,i)=>expect(Math.abs(web[i]!-expected)/Math.abs(expected)).toBeLessThanOrEqual(5e-7));});

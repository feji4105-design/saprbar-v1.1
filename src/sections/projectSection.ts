import type {Section} from '../model';
import type {SectionGeometry} from './types';
import {calculateSection,propertiesAtAxis,SectionError} from './calculate';
export function sectionForFrame(geometry:SectionGeometry,angle:number,confirmed:boolean,id:string):Section {
 if(!confirmed)throw new SectionError('Подтвердите, что выбранная ось соответствует локальной z элемента, а перпендикулярная — его локальной y.');
 if(!Number.isFinite(angle))throw new SectionError('Угол плоскости изгиба должен быть конечным.');
 const r=calculateSection(geometry),p=propertiesAtAxis(r,angle);
 if(Math.abs(p.product)>Math.max(r.jmax,1e-30)*1e-9)throw new SectionError('Выбранные оси не главные: Jxy ≠ 0. Плоское рамное ядро не учитывает связанный изгиб; выберите главную ось.');
 return {id,name:geometry.name,area:r.area,inertiaZ:p.j,yMinus:p.lower,yPlus:p.upper,source:{kind:'general'},calculator:{geometry:structuredClone(geometry),axisAngle:angle,principalPlaneConfirmed:true}};
}
export function verifyCalculatedSection(section:Section):void {
 const binding=section.calculator;if(!binding)return;
 const expected=sectionForFrame(binding.geometry,binding.axisAngle,binding.principalPlaneConfirmed,section.id);
 for(const key of ['area','inertiaZ','yMinus','yPlus'] as const)if(Math.abs(section[key]-expected[key])>Math.max(Math.abs(expected[key]),1e-30)*1e-9)throw new SectionError('Геометрия и сохранённые характеристики сечения расходятся; пересчитайте его.');
}

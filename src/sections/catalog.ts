import type {SectionGeometry,SectionPart,Primitive} from './types';
export const dimensionRows=[
 [30,18],[34,16],[30,14],[34,12],[24,20],[36,18],[40,16],[50,18],[36,14],[32,15],
 [34,20],[24,16],[38,14],[40,12],[42,20],[44,18],[46,16],[48,18],[50,14],[30,16]
].map(([a,b],i)=>({number:i+1,a:a!,b:b!,unit:'cm' as const}));
const uncertain:Record<number,string>={
 9:'Не указан отдельный размер высоты нижнего прямоугольного выреза (внешний нижний участок дан как 2b).',
 11:'Не указан отдельный размер высоты нижнего прямоугольного выреза.',
 13:'Не подтверждена горизонтальная ширина верхнего V-образного выреза: отдельной размерной линии нет.',
 14:'Не подтверждена горизонтальная ширина верхнего V-образного выреза.',
 20:'Кривая снизу не названа дугой окружности; радиус/тип кривой не указан. По внешнему виду он не восстанавливается.',
 24:'Не подтверждена горизонтальная ширина верхнего V-образного выреза.'
};
export const sectionCatalog=Array.from({length:30},(_,i)=>({number:i+1,id:`table-2.3-${i+1}`,source:'Табл. 2.3, фотографии 15.46.32 и 15.46.29',confirmed:!uncertain[i+1],reason:uncertain[i+1]}));
export function catalogSection(number:number,a:number,b:number,dimensionRow?:number):SectionGeometry {
 if(!sectionCatalog[number-1]||uncertain[number])throw Error(uncertain[number]??'Неизвестная схема.');
 if(![a,b].every(v=>Number.isFinite(v)&&v>0))throw Error('a и b должны быть положительными.');
 const parts:SectionPart[]=[];
 const part=(shape:Primitive,x=0,y=0,cut=false,angle=0,name?:string)=>parts.push({id:`part-${parts.length+1}`,name:name??`Часть ${parts.length+1}`,shape,x,y,cut,angle});
 const rect=(w:number,h:number,x=0,y=0,cut=false)=>part({kind:'rectangle',width:w,height:h},x,y,cut);
 const poly=(v:number[][],cut=false)=>part({kind:'polygon',vertices:v.map(([x,y])=>({x:x!*a,y:y!*b}))},0,0,cut);
 const tri=(w:number,h:number,x:number,y:number,cut=true,angle=0)=>part({kind:'triangle',width:w,height:h,apex:w/2},x,y,cut,angle);
 const bottomCorners=(height:number)=>{poly([[0,0],[1,0],[0,height]],true);poly([[2,0],[3,0],[3,height]],true);};
 const topCorners=(top:number,height=1)=>{poly([[0,top-height],[1,top],[0,top]],true);poly([[2,top],[3,top-height],[3,top]],true);};
 const bottomSides=()=>{rect(a,b,0,0,true);rect(a,b,2*a,0,true);};
 switch(number){
 case 1:rect(3*a,4*b);rect(a,b,a,0,true);rect(a,2*b,0,2*b,true);rect(a,2*b,2*a,2*b,true);break;
 case 2:rect(3*a,b);rect(a,b,a,b);part({kind:'semicircle',radius:1.5*a},1.5*a,0,false,Math.PI);break;
 case 3:rect(4*a,3*b);tri(2*a,b,a,3*b,false);rect(2*a,b,a,0,true);break;
 case 4:rect(3*a,3*b);tri(3*a,b,0,3*b,false);tri(a,b,a,0);break;
 case 5:rect(3*a,4*b);rect(a,b,a,3*b,true);bottomCorners(1);break;
 case 6:rect(3*a,4*b);topCorners(4);bottomCorners(2);rect(a,b,a,2*b,true);break;
 case 7:rect(3*a,4*b);rect(a,b,0,2*b,true);rect(a,b,2*a,2*b,true);break;
 case 8:rect(3*a,4*b);topCorners(4);bottomCorners(1);rect(a,b,a,b,true);break;
 case 10:case 23:rect(3*a,3*b);bottomCorners(1);rect(a,b,a,b,true);break;
 case 12:rect(4*a,3*b);tri(4*a,b,0,3*b,false);rect(2*a,b,a,0,true);break;
 case 15:rect(3*a,4*b);topCorners(4);rect(a,2*b,a,0,true);break;
 case 16:rect(3*a,4*b);rect(a,b,a,3*b,true);tri(a,b,a,0);break;
 case 17:rect(3*a,3*b);rect(a,b,a,2*b,true);bottomSides();break;
 case 18:rect(3*a,4*b);topCorners(4);bottomSides();rect(a,b,a,2*b,true);break;
 case 19:rect(3*a,4*b);rect(a,b,a,3*b,true);bottomSides();break;
 case 21:rect(a,2*b,a);part({kind:'trapezoid',width:3*a,top:a,height:2*b,shift:0},0,2*b);break;
 case 22:rect(3*a,3*b);rect(a,b,a,2*b,true);bottomCorners(2);break;
 case 25:rect(3*a,4*b);rect(a,b,0,3*b,true);rect(a,b,2*a,3*b,true);bottomCorners(1);break;
 case 26:rect(3*a,4*b);rect(a,2*b,a,2*b,true);rect(a,b,a,0,true);break;
 case 27:rect(3*a,4*b);rect(a,b,a,3*b,true);rect(a,b,a,b,true);break;
 case 28:rect(3*a,3*b);rect(a,b,0,2*b,true);rect(a,b,2*a,2*b,true);rect(a,2*b,a,0,true);break;
 case 29:rect(3*a,3*b);tri(3*a,b,0,3*b,false);bottomSides();break;
 case 30:rect(3*a,4*b);rect(a,b,0,3*b,true);rect(a,b,2*a,3*b,true);bottomCorners(2);break;
 }
 return {version:1,name:`Схема ${number}`,parts,scheme:number,a,b,...(dimensionRow?{dimensionRow}:{} )};
}
export function textbookExample():SectionGeometry {
 return {version:1,name:'Пример методички: 90×48 см',parts:[
 {id:'rect',name:'Прямоугольник 90×48 см',cut:false,x:-.45,y:0,angle:0,shape:{kind:'rectangle',width:.9,height:.48}},
 {id:'triangle',name:'Верхний равнобедренный вырез',cut:true,x:.45,y:.48,angle:Math.PI,shape:{kind:'triangle',width:.9,height:.24,apex:.45}},
 {id:'semicircle',name:'Нижний полукруглый вырез Ø30 см',cut:true,x:0,y:0,angle:0,shape:{kind:'semicircle',radius:.15}}
 ]};
}

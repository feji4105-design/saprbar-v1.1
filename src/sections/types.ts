export type Point={x:number;y:number};
export type Primitive=
 | {kind:'rectangle';width:number;height:number}
 | {kind:'triangle';width:number;height:number;apex:number}
 | {kind:'trapezoid';width:number;height:number;top:number;shift:number}
 | {kind:'circle'|'semicircle';radius:number}
 | {kind:'polygon';vertices:Point[]};
export interface LengthExpression {text:string;unit:Unit}
export interface SectionPart {id:string;name:string;cut:boolean;x:number;y:number;angle:number;shape:Primitive;expressions?:Record<string,LengthExpression>}
export interface SectionGeometry {version:1;name:string;parts:SectionPart[];scheme?:number;dimensionRow?:number;a?:number;b?:number;referenceMode?:'variables'|'scale'}
export type Unit='mm'|'cm'|'m';
export const unitLength:Record<Unit,number>={mm:.001,cm:.01,m:1};
export const inUnit=(v:number,unit:Unit,power=1)=>v/unitLength[unit]**power;
export interface Moments {area:number;cx:number;cy:number;jx:number;jy:number;jxy:number}
export type Edge={kind:'line';a:Point;b:Point}|{kind:'arc';c:Point;r:number;start:number;sweep:number};
export interface PartResult extends Moments {part:SectionPart;edges:Edge[];sign:number}
export interface SectionResult extends Moments {parts:PartResult[];sx:number;sy:number;centralSx:number;centralSy:number;jmax:number;jmin:number;angleMax:number|null;angleMin:number|null;iMax2:number;iMin2:number;iMax:number;iMin:number;boundary:Edge[];checks:{static:boolean;principal:boolean;positive:boolean;trace:boolean}}

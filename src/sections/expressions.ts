import {unitLength,type LengthExpression,type SectionGeometry,type SectionPart,type Unit} from './types';
export const isLiteralLength=(text:string)=>/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(text.trim());

/** Arithmetic only, no eval, functions or property access. Values in the binding's input unit. */
export function evaluateLength(text:string,a:number|undefined,b:number|undefined,unit:Unit):number{
 if(typeof text!=='string'||text.length>256)throw Error('Выражение должно содержать не более 256 символов.');
 const source=text.toLowerCase().replace(/[а]/g,'a').replace(/[бв]/g,'b').replaceAll(',','.').replaceAll('−','-').replaceAll('×','*').replaceAll('·','*');
 const tokens:string[]=[];let pos=0;
 while(pos<source.length){if(/\s/.test(source[pos]!)){pos++;continue;}const match=/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|^[ab()+*/-]/.exec(source.slice(pos));if(!match)throw Error('Допустимы числа, a, b, +, −, *, / и скобки.');tokens.push(match[0]);pos+=match[0].length;if(tokens.length>128)throw Error('Выражение слишком сложное.');}
 type Quantity={v:number;power:number};
 let i=0,depth=0;
 const primary=():Quantity=>{if(++depth>32)throw Error('Слишком много вложенных скобок.');const t=tokens[i++];let q:Quantity;
  if(t==='+'||t==='-'){q=primary();q={...q,v:(t==='-'?-1:1)*q.v};}
  else if(t==='('){q=sum();if(tokens[i++]!==')')throw Error('Закройте скобку.');}
  else if(t==='a'||t==='b'){const p=t==='a'?a:b;if(!Number.isFinite(p)||p!<=0)throw Error(`Задайте положительное значение ${t}.`);q={v:p!/unitLength[unit],power:1};}
  else if(t!==undefined&&/^\d|^\./.test(t))q={v:Number(t),power:0};
  else throw Error('Нужно число, a, b или выражение в скобках.');
  depth--;if(!Number.isFinite(q.v))throw Error('Результат выражения должен быть конечным.');return q;
 };
 const product=():Quantity=>{let q=primary();while(i<tokens.length){const t=tokens[i]!;if(t==='*'||t==='/'){i++;const rhs=primary();if(t==='/'&&rhs.v===0)throw Error('Деление на ноль.');q=t==='*'?{v:q.v*rhs.v,power:q.power+rhs.power}:{v:q.v/rhs.v,power:q.power-rhs.power};}
   else if(t==='a'||t==='b'||t==='('){const rhs=primary();q={v:q.v*rhs.v,power:q.power+rhs.power};}else break;}return q;};
 const sum=():Quantity=>{let q=product();while(tokens[i]==='+'||tokens[i]==='-'){const sign=tokens[i++],rhs=product();if(q.power!==rhs.power&&!(Math.min(q.power,rhs.power)===0&&Math.max(q.power,rhs.power)===1))throw Error('Слагаемые должны иметь одинаковую размерность.');q={v:q.v+(sign==='+'?rhs.v:-rhs.v),power:Math.max(q.power,rhs.power)};}return q;};
 const q=sum(),value=q.v*unitLength[unit];if(i!==tokens.length||!Number.isFinite(value))throw Error('Некорректное выражение.');
 if(q.power!==1&&(q.power!==0||tokens.some(t=>t==='a'||t==='b')))throw Error('Размер должен быть длиной: используйте, например, 3a или a/2; a*b — площадь.');return value;
}
export function getLength(p:SectionPart,key:string):number{
 if(key==='x'||key==='y')return p[key];
 const vertex=/^vertices\.(\d+)\.([xy])$/.exec(key);
 if(vertex&&p.shape.kind==='polygon'){const v=p.shape.vertices[Number(vertex[1])];if(v)return v[vertex[2] as 'x'|'y'];}
 if(['width','height','apex','top','shift','radius'].includes(key)&&key in p.shape)return (p.shape as unknown as Record<string,number>)[key]!;
 throw Error(`Недопустимое поле выражения: ${key}.`);
}
export function withLength(p:SectionPart,key:string,value:number):SectionPart{
 getLength(p,key);
 if(key==='x'||key==='y')return {...p,[key]:value};
 const vertex=/^vertices\.(\d+)\.([xy])$/.exec(key);
 if(vertex&&p.shape.kind==='polygon')return {...p,shape:{...p.shape,vertices:p.shape.vertices.map((v,i)=>i===Number(vertex[1])?{...v,[vertex[2]!]:value}:v)}};
 return {...p,shape:{...p.shape,[key]:value} as SectionPart['shape']};
}
export function bindLength(p:SectionPart,key:string,text:string,unit:Unit,g:Pick<SectionGeometry,'a'|'b'>):SectionPart{
 const value=evaluateLength(text,g.a,g.b,unit),next=withLength(p,key,value),expressions={...p.expressions};
 // Literal input becomes a fixed number; all other arithmetic remains editable source.
 if(isLiteralLength(text))delete expressions[key];else expressions[key]={text,unit};
 if(Object.keys(expressions).length)next.expressions=expressions;else delete next.expressions;
 return next;
}
export function resolveExpressions(g:SectionGeometry):SectionGeometry{
 return {...g,parts:g.parts.map(p=>{let next=p;for(const [key,binding] of Object.entries(p.expressions??{}))next=withLength(next,key,evaluateLength(binding.text,g.a,g.b,binding.unit));return next;})};
}
export function validateExpressions(g:SectionGeometry):void{
 if(g.referenceMode!==undefined&&!['variables','scale'].includes(g.referenceMode))throw Error('Неизвестный режим a/b.');
 for(const p of g.parts){if(p.expressions===undefined)continue;
  if(!p.expressions||typeof p.expressions!=='object'||Array.isArray(p.expressions))throw Error('Некорректные выражения части.');
  for(const [key,binding] of Object.entries(p.expressions)){
   if(!binding||typeof binding.text!=='string'||!Object.hasOwn(unitLength,binding.unit))throw Error('Некорректное выражение или единица.');
   const expected=evaluateLength(binding.text,g.a,g.b,binding.unit),actual=getLength(p,key);
   if(Math.abs(actual-expected)>Math.max(Math.abs(actual),Math.abs(expected),1e-30)*1e-12)throw Error('Значения и выражения расходятся; пересчитайте размеры сечения.');
  }
 }
}
export function clearExpressions(p:SectionPart,keys:string[]):SectionPart{
 const expressions={...p.expressions};for(const key of keys)delete expressions[key];const next={...p};
 if(Object.keys(expressions).length)next.expressions=expressions;else delete next.expressions;return next;
}
export const expressionUnit=(binding:LengthExpression|undefined,fallback:Unit)=>binding?.unit??fallback;

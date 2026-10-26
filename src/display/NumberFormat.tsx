import {createContext, useContext, type ReactNode} from 'react';
import {decimalPlaces, DEFAULT_DECIMAL_PLACES, formatNumber, formatSigned} from './formatNumber';
export const NumberFormatContext = createContext(DEFAULT_DECIMAL_PLACES);
export function NumberFormatProvider({places, children}: {places:number;children:ReactNode}) {
  return <NumberFormatContext.Provider value={decimalPlaces(places)}>{children}</NumberFormatContext.Provider>;
}
export function useNumberFormat() {
  const places = useContext(NumberFormatContext);
  return {places, n:(value:number, scientific=false)=>formatNumber(value,places,scientific), signed:(value:number)=>formatSigned(value,places)};
}
export function PrecisionSelect({value,onChange}: {value:number;onChange:(value:number)=>void}) {
  return <label className="precision-setting">Знаков после запятой <select value={value} onChange={e=>onChange(decimalPlaces(Number(e.target.value)))}>{Array.from({length:13},(_,i)=><option key={i} value={i}>{i}</option>)}</select></label>;
}

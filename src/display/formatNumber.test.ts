import {expect,it} from 'vitest';
import {formatNumber,formatSigned,decimalPlaces} from './formatNumber';
it('decimal comma, 0–12 decimal places, sign and exact zero',()=>{
  expect(formatNumber(12.34567)).toBe('12,346');
  expect(formatNumber(-12.34567,2)).toBe('−12,35');
  expect(formatNumber(12.34567,0)).toBe('12');
  expect(formatNumber(1.234567891,8)).toBe('1,23456789');
  expect(formatNumber(0.123456789012,12)).toBe('0,123456789012');
  expect(formatNumber(0)).toBe('0');expect(formatNumber(-0)).toBe('0');
  expect(formatSigned(-0)).toBe('0');expect(formatSigned(.125,3)).toBe('+0,125');
  expect(decimalPlaces(-1)).toBe(3);expect(decimalPlaces(13)).toBe(3);
});
it('small nonzero values never become zero; mantissa obeys selected precision',()=>{
  expect(formatNumber(-1e-9,3)).toBe('−1,000 · 10⁻⁹');
  expect(formatNumber(1.234567e-8,2)).toBe('1,23 · 10⁻⁸');
  expect(formatNumber(.001488,3,true)).toBe('1,488 · 10⁻³');
  expect(formatNumber(1.234e11,2)).toBe('1,23 · 10¹¹');
  for(let digits=0;digits<=12;digits++)for(const v of [Number.MIN_VALUE,-Number.MIN_VALUE,1e-10,-1e-10,.0001,-.0001]){
    expect(formatNumber(v,digits)).not.toBe('0');expect(formatNumber(v,digits)).not.toMatch(/^[-−]0(?:,0+)?$/);
  }
  expect(formatNumber(NaN)).toBe('—');expect(formatNumber(Infinity)).toBe('—');
});

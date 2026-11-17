// 화면에 보이는 수치 표기(B1). 계산값은 바꾸지 않고 표시만 다듬는다.

/** 백분율 숫자(예: 7.000000000000001)를 소수점 digits자리에서 반올림하고 뒤의 0을 뗀 문자열로. */
export function percentNumber(value: number, digits = 2): string {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** 비율(0.07)을 백분율 문자열('7')로. % 기호는 붙이지 않는다. */
export function percent(ratio: number, digits = 2): string {
  return percentNumber(ratio * 100, digits);
}

export default { percent, percentNumber };

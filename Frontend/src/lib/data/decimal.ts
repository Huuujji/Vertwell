import { invalidResponse } from './contracts';

// Reject scale/precision loss instead of silently rounding database stock or money.
export function scaledDecimal(value: string, scale: number): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match || (match[3]?.length ?? 0) > scale) invalidResponse('invalid decimal scale');
  return BigInt(`${match[1]}${match[2]}${(match[3] ?? '').padEnd(scale, '0')}`);
}
export function displayDecimal(value: string, scale: number, factor = 1): number {
  const scaled = scaledDecimal(value, scale);
  if (scaled > BigInt(Number.MAX_SAFE_INTEGER) || scaled < BigInt(Number.MIN_SAFE_INTEGER)) invalidResponse('decimal exceeds display precision');
  const result = Number(scaled) / 10 ** scale / factor;
  if (BigInt(Math.round(result * factor * 10 ** scale)) !== scaled) invalidResponse('decimal loses display precision');
  return result;
}

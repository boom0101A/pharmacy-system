import { describe, expect, it } from 'vitest';
import { parseIdParam } from './parseIdParam.js';
import { AppError } from '../middleware/errors.js';

describe('parseIdParam', () => {
  it('parses a plain numeric id', () => {
    expect(parseIdParam('42')).toBe(42);
  });

  it('rejects non-numeric text instead of letting NaN reach the database', () => {
    expect(() => parseIdParam('abc')).toThrow(AppError);
  });

  it('rejects a fractional id', () => {
    expect(() => parseIdParam('1.5')).toThrow(AppError);
  });

  it('rejects a negative id', () => {
    expect(() => parseIdParam('-1')).toThrow(AppError);
  });

  it('rejects undefined (a route param that was never supplied)', () => {
    expect(() => parseIdParam(undefined)).toThrow(AppError);
  });

  it('names the field in the error message when a label is given', () => {
    expect(() => parseIdParam('abc', 'معرّف الصنف')).toThrow('معرّف الصنف');
  });
});

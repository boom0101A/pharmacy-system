// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NumberCellInput } from './NumberCellInput';

describe('NumberCellInput', () => {
  it('allows clearing the field to empty while typing, instead of snapping back to a default value', () => {
    render(<NumberCellInput value={5} min={1} onCommit={vi.fn()} aria-label="qty" />);
    const input = screen.getByLabelText('qty') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });

    expect(input.value).toBe('');
  });

  it('commits the typed number on blur', () => {
    const onCommit = vi.fn();
    render(<NumberCellInput value={5} min={1} onCommit={onCommit} aria-label="qty" />);
    const input = screen.getByLabelText('qty') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(12);
  });

  it('reverts to the last committed value on blur when left empty, instead of submitting a missing quantity', () => {
    const onCommit = vi.fn();
    render(<NumberCellInput value={5} min={1} onCommit={onCommit} aria-label="qty" />);
    const input = screen.getByLabelText('qty') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('5');
  });

  it.each([
    ['Arabic-Indic digits', '٨٠٠٠', 8000],
    ['a thousands separator', '8,000', 8000],
  ])('accepts %s', (_label, typed, expected) => {
    const onCommit = vi.fn();
    render(<NumberCellInput value={5} min={0} onCommit={onCommit} aria-label="price" />);
    const input = screen.getByLabelText('price') as HTMLInputElement;

    fireEvent.change(input, { target: { value: typed } });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(expected);
  });

  it('as a money cell, shows thousands separators and still commits the plain number', () => {
    const onCommit = vi.fn();
    render(<NumberCellInput money value={8000} min={0} onCommit={onCommit} aria-label="price" />);
    const input = screen.getByLabelText('price') as HTMLInputElement;
    expect(input.value).toBe('8,000');

    fireEvent.change(input, { target: { value: '12500' } });
    expect(input.value).toBe('12,500');
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(12500);
  });

  it('reverts to the last committed value on blur when below the configured minimum', () => {
    const onCommit = vi.fn();
    render(<NumberCellInput value={5} min={1} onCommit={onCommit} aria-label="qty" />);
    const input = screen.getByLabelText('qty') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('5');
  });
});

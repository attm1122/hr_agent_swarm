import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'inactive')).toBe('base active');
  });

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null)).toBe('base');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('merges tailwind conflicting classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('merges tailwind color variants', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('handles objects', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });
});

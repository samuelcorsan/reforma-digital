import { expect, it } from 'vitest';
import { cn } from './utils';

it('keeps a theme size next to a color and merges it with other sizes', () => {
  expect(cn('text-28', 'text-brand')).toBe('text-28 text-brand');
  expect(cn('text-sm', 'text-fluid-36-72')).toBe('text-fluid-36-72');
  expect(cn('font-mono', 'font-650')).toBe('font-mono font-650');
  expect(cn('rounded-xl', 'rounded-20')).toBe('rounded-20');
  expect(cn('tracking-wide', 'tracking-eyebrow')).toBe('tracking-eyebrow');
  expect(cn('gap-4', 'gap-em-50')).toBe('gap-em-50');
});

import { describe, expect, it } from 'vitest';
import { defineStateMachine } from './index.js';

type S = 'A' | 'B' | 'C';
const sm = defineStateMachine<S>('Thing', { A: ['B'], B: ['C'], C: [] });

describe('StateMachine', () => {
  it('allows valid transitions', () => {
    expect(sm.canTransition('A', 'B')).toBe(true);
    expect(() => sm.assertTransition('A', 'B')).not.toThrow();
  });
  it('rejects invalid transitions with a typed error', () => {
    expect(sm.canTransition('A', 'C')).toBe(false);
    expect(() => sm.assertTransition('A', 'C')).toThrowError(/cannot transition/);
  });
  it('detects terminal states', () => {
    expect(sm.isTerminal('C')).toBe(true);
    expect(sm.isTerminal('A')).toBe(false);
  });
});

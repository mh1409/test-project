import { InvalidStateTransitionError } from '../errors/index.js';

export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

/**
 * Lightweight declarative state machine. Used for Orders, Returns, Disputes, Payouts,
 * Seller verification, Products, Auctions, Support tickets. Business services call
 * `assertTransition` inside a DB transaction before persisting.
 */
export class StateMachine<S extends string> {
  constructor(
    private readonly entity: string,
    private readonly transitions: TransitionMap<S>,
    private readonly terminal: readonly S[] = [],
  ) {}

  canTransition(from: S, to: S): boolean {
    return (this.transitions[from] ?? []).includes(to);
  }

  assertTransition(from: S, to: S): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidStateTransitionError(this.entity, from, to);
    }
  }

  nextStates(from: S): readonly S[] {
    return this.transitions[from] ?? [];
  }

  isTerminal(state: S): boolean {
    return this.terminal.includes(state) || (this.transitions[state] ?? []).length === 0;
  }

  states(): S[] {
    return Object.keys(this.transitions) as S[];
  }
}

export const defineStateMachine = <S extends string>(
  entity: string,
  transitions: TransitionMap<S>,
  terminal?: readonly S[],
) => new StateMachine<S>(entity, transitions, terminal);

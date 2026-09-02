import type { Type } from '@nestjs/common';
import { IdentityModule } from './identity';

/** Domain module registry. Each module exposes a public index; internals are private (enforced by lint). */
export const DomainModules: Type<unknown>[] = [IdentityModule];

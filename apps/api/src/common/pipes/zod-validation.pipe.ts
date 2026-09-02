import { Injectable, type PipeTransform } from '@nestjs/common';
import { ValidationError } from '@souq/shared';
import type { ZodSchema } from 'zod';

/** Validates and transforms request payloads with a Zod schema. Strips unknown keys (anti mass-assignment). */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ValidationError(
        'Validation failed',
        result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code })),
      );
    }
    return result.data;
  }
}

export const zodBody = <T>(schema: ZodSchema<T>) => new ZodValidationPipe(schema);

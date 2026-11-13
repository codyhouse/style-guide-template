import * as z from 'zod/mini';

export function valueAs<S extends z.core.$ZodType>(schema: S, value: unknown): z.output<S> | null {
  const result = z.safeParse(schema, value);
  return result.success ? result.data : null;
}

import * as z from 'zod/mini';
import { child, isHandSet, vendorData, withVendorData } from './tree.js';
import type { Dimension, TokenNode } from './types.js';

const scaleSpec = z.object({
  base: z.object({ value: z.number(), unit: z.string() }),
  steps: z.record(z.string(), z.number()),
  ratio: z.optional(z.number()),
});

export type ScaleSpec = z.infer<typeof scaleSpec>;

export const scaleOf = (group: TokenNode | undefined, vendor: string): ScaleSpec | null => {
  const spec = z.safeParse(scaleSpec, vendorData(group, vendor).scale);
  return spec.success ? spec.data : null;
};

const round = (n: number) => Math.round(n * 1e4) / 1e4;

export function generateScale({ base, steps, ratio }: ScaleSpec): Record<string, Dimension> {
  return Object.fromEntries(
    Object.entries(steps).map(([name, step]) => [
      name,
      { value: round(ratio ? base.value * ratio ** step : base.value * step), unit: base.unit },
    ]),
  );
}

export function applyScale(group: TokenNode, vendor: string): TokenNode {
  const out = structuredClone(group);
  const scale = scaleOf(out, vendor);
  if (!scale) return out;
  for (const [name, value] of Object.entries(generateScale(scale))) {
    const token = child(out, name);
    if (isHandSet(token, vendor)) continue;
    out[name] = { ...token, $value: value };
  }
  return out;
}

export function setStep(group: TokenNode, step: string, dimension: Dimension, vendor: string): TokenNode {
  const out = structuredClone(group);
  const token = child(out, step);
  out[step] = withVendorData({ ...token, $value: dimension }, vendor, { overridden: true });
  return out;
}

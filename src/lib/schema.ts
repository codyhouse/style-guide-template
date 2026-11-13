import * as z from 'zod/mini';
import type { Problem, TokenNode } from './types.js';
import { child, isNode } from './tree.js';

export const RESOLVER_SCHEMA = 'https://www.designtokens.org/schemas/2025.10/resolver.json';

const COLOR_SPACES = [
  'srgb',
  'srgb-linear',
  'hsl',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'display-p3',
  'a98-rgb',
  'prophoto-rgb',
  'rec2020',
  'xyz-d65',
  'xyz-d50',
] as const;
const WEIGHTS = [
  'thin',
  'hairline',
  'extra-light',
  'ultra-light',
  'light',
  'normal',
  'regular',
  'book',
  'medium',
  'semi-bold',
  'demi-bold',
  'bold',
  'extra-bold',
  'ultra-bold',
  'black',
  'heavy',
  'extra-black',
  'ultra-black',
] as const;
const STROKES = ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'outset', 'inset'] as const;
const TOKEN_KEYS = new Set(['$type', '$value', '$description', '$extensions', '$deprecated']);
const GROUP_KEYS = new Set(['$type', '$description', '$extensions', '$deprecated', '$extends', '$root']);

const isAlias = (v: unknown) =>
  (typeof v === 'string' && /^\{[^{}]+\}$/.test(v)) || (isNode(v) && typeof v.$ref === 'string');
const join = (path: string, key: string | number) => (path ? `${path}.${key}` : String(key));

export const problems = (error: z.core.$ZodError, base = ''): Problem[] =>
  error.issues.map((i) => ({
    path: i.path.reduce<string>((p, k) => join(p, String(k)), base),
    message: i.message,
  }));

const alias = z.custom<string>(isAlias, 'must be an alias');
const orAlias = <T extends z.core.SomeType>(schema: T) => z.union([alias, schema]);
const dimension = (units: readonly [string, ...string[]]) =>
  z.object({
    value: z.number({ error: 'must be { value: number, unit }' }),
    unit: z.enum(units, { error: `unit must be ${units.join('|')}` }),
  });
const size = dimension(['px', 'rem']);
const duration = dimension(['ms', 's']);
const component = z.union([z.number(), z.literal('none')]);
export const color = z.object({
  colorSpace: z.enum(COLOR_SPACES, {
    error: (iss) => `colorSpace "${String(iss.input)}" is not a DTCG color space`,
  }),
  components: z.tuple([component, component, component], {
    error: 'components must be an array of 3 numbers or "none"',
  }),
  alpha: z.optional(z.number().check(z.gte(0), z.lte(1))),
  hex: z.optional(z.string().check(z.regex(/^#[0-9a-fA-F]{6}$/, 'hex must be 6-digit #rrggbb'))),
});
const cubicBezier = z.tuple([z.number(), z.number(), z.number(), z.number()], {
  error: 'must be [x1, y1, x2, y2]',
});
const fontFamily = z.union([z.string(), z.array(z.string()).check(z.minLength(1))], {
  error: 'must be a string or an array of strings',
});
const fontWeight = z.union([z.number().check(z.gte(1), z.lte(1000)), z.enum(WEIGHTS)], {
  error: 'must be 1..1000 or a weight keyword',
});
const strokeStyle = z.union([z.enum(STROKES), z.looseObject({})], {
  error: `stroke style must be one of ${STROKES.join(', ')}`,
});
const shadowLayer = z.object({
  color: orAlias(color),
  offsetX: orAlias(size),
  offsetY: orAlias(size),
  blur: orAlias(size),
  spread: orAlias(size),
  inset: z.optional(z.boolean()),
});

export const VALUES = {
  color,
  dimension: size,
  duration,
  number: z.number({ error: 'must be a number' }),
  fontFamily,
  fontWeight,
  cubicBezier,
  strokeStyle,
  shadow: z.union([shadowLayer, z.array(orAlias(shadowLayer))]),
  border: z.object({ color: orAlias(color), width: orAlias(size), style: orAlias(strokeStyle) }),
  transition: z.object({
    duration: orAlias(duration),
    delay: orAlias(duration),
    timingFunction: orAlias(cubicBezier),
  }),
  typography: z.object({
    fontFamily: orAlias(fontFamily),
    fontSize: orAlias(size),
    fontWeight: orAlias(fontWeight),
    letterSpacing: orAlias(size),
    lineHeight: orAlias(z.number()),
  }),
  gradient: z.array(z.looseObject({})),
} satisfies Record<string, z.core.$ZodType>;

const isValueType = (type: string): type is keyof typeof VALUES => Object.hasOwn(VALUES, type);

function checkValue(type: keyof typeof VALUES, value: unknown, path: string): Problem[] {
  if (isAlias(value)) return [];
  const result = z.safeParse(VALUES[type], value);
  if (result.success) return [];
  return result.error.issues.map((i) => ({
    path,
    message: i.path.length ? `${i.path.join(' ')}: ${i.message}` : i.message,
  }));
}

export function deepMerge(target: TokenNode, source: TokenNode): TokenNode {
  const out = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const existing = out[key];
    if (!isNode(value) || !isNode(existing)) out[key] = value;
    else out[key] = '$value' in value ? { ...existing, ...value } : deepMerge(existing, value);
  }
  return out;
}

function validateToken(token: TokenNode, path: string, groupType?: string): Problem[] {
  const errors: Problem[] = Object.keys(token)
    .filter((key) => key.startsWith('$') && !TOKEN_KEYS.has(key))
    .map((key) => ({ path, message: `unknown reserved key ${key}` }));
  const type = token.$type ?? groupType;
  if (!type) errors.push({ path, message: 'token has no $type (own or inherited from a group)' });
  else if (!isValueType(type)) errors.push({ path, message: `unknown $type "${type}"` });
  else errors.push(...checkValue(type, token.$value, path));
  return errors;
}

function validateEntry(
  key: string,
  node: unknown,
  path: string,
  groupType?: string,
  only?: TokenNode,
): Problem[] {
  if (key.startsWith('$') && key !== '$root')
    return GROUP_KEYS.has(key) ? [] : [{ path, message: `unknown reserved key ${key}` }];
  if (/[{}.]/.test(key)) return [{ path, message: `name "${key}" must not contain {, } or .` }];
  if (!isNode(node)) return [{ path, message: 'must be a token or a group' }];
  if (only && only[key] === undefined) return [];
  if (!('$value' in node)) return validateTokens(node, path, groupType, child(only, key));
  return validateToken(node, path, groupType);
}

export function validateTokens(tree: TokenNode, path = '', inherited?: string, only?: TokenNode): Problem[] {
  const groupType = tree.$type ?? inherited;
  const errors: Problem[] = [];
  if (tree.$type !== undefined && !isValueType(tree.$type))
    errors.push({ path, message: `unknown $type "${tree.$type}"` });
  for (const [key, node] of Object.entries(tree))
    errors.push(...validateEntry(key, node, join(path, key), groupType, only));
  return errors;
}

const tokenTree = z
  .record(z.string(), z.custom<unknown>())
  .check(
    z.refine((s) => typeof s.$ref !== 'string', 'file references are not supported here; inline the tokens'),
  );
const sources = z.array(tokenTree, { error: 'must be an array of token objects' });

export const resolverDoc = z.object({
  $schema: z.optional(z.string()),
  version: z.literal('2025.10', { error: 'version must be "2025.10"' }),
  name: z.optional(z.string()),
  description: z.optional(z.string()),
  sets: z.record(
    z.string(),
    z.looseObject({ sources, $extensions: z.optional(z.record(z.string(), z.custom<unknown>())) }),
  ),
  modifiers: z.optional(
    z.record(
      z.string(),
      z.object({ contexts: z.record(z.string(), sources), default: z.optional(z.string()) }),
    ),
  ),
  resolutionOrder: z.array(z.object({ $ref: z.string() }), { error: 'resolutionOrder must be an array' }),
});

export type ResolverDoc = z.infer<typeof resolverDoc>;

const mergeSources = (list: TokenNode[]) => list.reduce((acc, s) => deepMerge(acc, s), {});

export function validateResolver(input: unknown): { ok: boolean; errors: Problem[] } {
  const parsed = z.safeParse(resolverDoc, input);
  if (!parsed.success) return { ok: false, errors: problems(parsed.error) };
  const doc = parsed.data;
  const modifiers = doc.modifiers ?? {};
  const errors: Problem[] = [];
  doc.resolutionOrder.forEach(({ $ref }, i) => {
    const [, kind, name] = /^#\/(sets|modifiers)\/(.+)$/.exec($ref) ?? [];
    if (!(kind === 'sets' ? name in doc.sets : kind === 'modifiers' && name in modifiers)) {
      errors.push({ path: `resolutionOrder.${i}`, message: `${$ref} does not point to a set or modifier` });
    }
  });
  const base = mergeSources(Object.values(doc.sets).flatMap((s) => s.sources));
  errors.push(...validateTokens(base));
  for (const [name, mod] of Object.entries(modifiers)) {
    if (mod.default !== undefined && !(mod.default in mod.contexts)) {
      errors.push({
        path: `modifiers.${name}.default`,
        message: `default "${mod.default}" is not a context`,
      });
    }
    for (const [context, list] of Object.entries(mod.contexts)) {
      const own = mergeSources(list);
      errors.push(
        ...validateTokens(deepMerge(base, own), `modifiers.${name}.contexts.${context}`, undefined, own),
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

export const isResolver = (json: unknown): json is ResolverDoc =>
  isNode(json) && Array.isArray(json.resolutionOrder);

export function toResolver(json: TokenNode, name: string): ResolverDoc {
  if (isResolver(json)) return json;
  return {
    $schema: RESOLVER_SCHEMA,
    version: '2025.10',
    name,
    sets: { foundation: { sources: [json] } },
    modifiers: { theme: { contexts: { light: [], dark: [] }, default: 'light' } },
    resolutionOrder: [{ $ref: '#/sets/foundation' }, { $ref: '#/modifiers/theme' }],
  };
}

export const isSafeSrc = (src: unknown): src is string =>
  typeof src === 'string' &&
  src !== '' &&
  !/^[a-z][a-z0-9+.-]*:|^\/|\\/i.test(src) &&
  !src.split('/').includes('..');

export const fontStyle = z.enum(['normal', 'italic', 'oblique'], {
  error: 'style must be normal, italic or oblique',
});
export type FontStyle = z.infer<typeof fontStyle>;
export const isFontStyle = (s: string): s is FontStyle => z.safeParse(fontStyle, s).success;

const src = z.custom<string>(isSafeSrc, {
  error: (iss) => `src "${String(iss.input)}" must be a relative path`,
});
const assetItem = z.looseObject({
  src,
  label: z.optional(z.string()),
  description: z.optional(z.string()),
  provider: z.optional(z.string()),
});
const assetGroup = z.looseObject({
  id: z.string().check(
    z.regex(/^[a-z0-9][a-z0-9-]*$/, {
      error: (iss) => `group id "${String(iss.input)}" must use a-z, 0-9 and -`,
    }),
  ),
  label: z.optional(z.string()),
  items: z.array(assetItem, { error: 'group needs an items array' }),
});
const fontFile = z
  .looseObject({
    ...assetItem.shape,
    family: z.string({ error: 'font file needs a family' }).check(z.minLength(1, 'font file needs a family')),
    weight: z._default(
      z.number().check(z.gte(1, 'weight must be 1..1000'), z.lte(1000, 'weight must be 1..1000')),
      400,
    ),
    style: z._default(fontStyle, 'normal'),
    subset: z.optional(z.string()),
    unicodeRange: z.optional(z.string()),
    fontsourceId: z.optional(
      z.string().check(z.regex(/^[a-z0-9-]+$/, 'fontsourceId must use a-z, 0-9 and -')),
    ),
    version: z.optional(z.string().check(z.regex(/^\d[\da-z.-]*$/, 'version must look like 5.3.0'))),
  })
  .check(
    z.refine(
      (f) => f.provider !== 'fontsource' || (f.fontsourceId !== undefined && f.version !== undefined),
      'a Fontsource font needs fontsourceId and version',
    ),
  );

export const brandMeta = z.looseObject({
  assetGroups: z._default(z.array(assetGroup), []),
  fontFiles: z._default(z.array(fontFile), []),
});

export type AssetItem = z.infer<typeof assetItem>;
export type AssetGroup = z.infer<typeof assetGroup>;
export type FontFile = z.infer<typeof fontFile>;
export type BrandMeta = z.infer<typeof brandMeta>;

export function validateBrandMeta(meta: unknown, path = 'brand'): Problem[] {
  const result = z.safeParse(brandMeta, meta);
  return result.success ? [] : problems(result.error, path);
}

export const manifest = z.object({
  files: z.array(z.string()),
  brands: z
    .array(z.object({ name: z.string(), path: z.string() }))
    .check(z.minLength(1, 'the manifest lists no brands')),
});
export type Manifest = z.infer<typeof manifest>;

export const fontListing = z.object({
  id: z.string(),
  family: z.string(),
  category: z.string(),
  weights: z.array(z.number()),
  styles: z.array(z.string()),
  defSubset: z.string(),
  license: z.string(),
});
export type FontListing = z.infer<typeof fontListing>;

const variant = z.object({ url: z.optional(z.object({ woff2: z.optional(z.string()) })) });
export const fontDetail = z.object({
  ...fontListing.shape,
  subsets: z.array(z.string()),
  npmVersion: z.string(),
  unicodeRange: z.optional(z.record(z.string(), z.string())),
  variants: z.optional(z.record(z.string(), z.record(z.string(), z.record(z.string(), variant)))),
});
export type FontDetail = z.infer<typeof fontDetail>;

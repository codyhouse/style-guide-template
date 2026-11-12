// Validation of DTCG 2025.10 token trees and resolver documents.
// https://www.designtokens.org/tr/2025.10/format/ , /color/ , /resolver/

export const RESOLVER_SCHEMA = 'https://www.designtokens.org/schemas/2025.10/resolver.json';

const TYPES = new Set(['color', 'dimension', 'fontFamily', 'fontWeight', 'duration', 'cubicBezier', 'number',
  'strokeStyle', 'border', 'transition', 'shadow', 'gradient', 'typography']);
const TOKEN_KEYS = new Set(['$type', '$value', '$description', '$extensions', '$deprecated']);
const GROUP_KEYS = new Set(['$type', '$description', '$extensions', '$deprecated', '$extends', '$root']);
const COLOR_SPACES = new Set(['srgb', 'srgb-linear', 'hsl', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'display-p3',
  'a98-rgb', 'prophoto-rgb', 'rec2020', 'xyz-d65', 'xyz-d50']);
const WEIGHTS = new Set(['thin', 'hairline', 'extra-light', 'ultra-light', 'light', 'normal', 'regular', 'book',
  'medium', 'semi-bold', 'demi-bold', 'bold', 'extra-bold', 'ultra-bold', 'black', 'heavy', 'extra-black', 'ultra-black']);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isAlias = (v) => (typeof v === 'string' && /^\{[^{}]+\}$/.test(v)) || (isObj(v) && typeof v.$ref === 'string');
const join = (path, key) => (path ? `${path}.${key}` : key);

export function deepMerge(target, source) {
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (!isObj(v) || !isObj(out[k])) out[k] = v;
    else out[k] = '$value' in v ? { ...out[k], ...v } : deepMerge(out[k], v); // a token override keeps its own $type
  }
  return out;
}

const checkDimension = (v, units = ['px', 'rem']) => {
  if (isAlias(v)) return null;
  if (!isObj(v) || typeof v.value !== 'number') return 'must be { value: number, unit }';
  if (!units.includes(v.unit)) return `unit must be ${units.join('|')}`;
  return null;
};

function checkColor(v) {
  if (isAlias(v)) return null;
  if (!isObj(v)) return 'color must be an object { colorSpace, components }';
  if (!COLOR_SPACES.has(v.colorSpace)) return `colorSpace "${v.colorSpace}" is not a DTCG color space`;
  if (!Array.isArray(v.components) || v.components.some((c) => c !== 'none' && typeof c !== 'number')) {
    return 'components must be an array of numbers or "none"';
  }
  if (v.alpha !== undefined && (typeof v.alpha !== 'number' || v.alpha < 0 || v.alpha > 1)) return 'alpha must be 0..1';
  if (v.hex !== undefined && !/^#[0-9a-fA-F]{6}$/.test(v.hex)) return 'hex must be 6-digit #rrggbb';
  return null;
}

function checkShadow(v) {
  if (isAlias(v)) return null;
  for (const s of Array.isArray(v) ? v : [v]) {
    if (isAlias(s)) continue;
    if (!isObj(s)) return 'shadow must be an object or an array of objects';
    const color = checkColor(s.color);
    if (color) return `shadow color: ${color}`;
    for (const k of ['offsetX', 'offsetY', 'blur', 'spread']) {
      const e = checkDimension(s[k]);
      if (e) return `shadow ${k}: ${e}`;
    }
  }
  return null;
}

function checkValue(type, v) {
  if (isAlias(v)) return null;
  switch (type) {
    case 'color': return checkColor(v);
    case 'dimension': return checkDimension(v);
    case 'duration': return checkDimension(v, ['ms', 's']);
    case 'number': return typeof v === 'number' ? null : 'must be a number';
    case 'fontFamily':
      return typeof v === 'string' || (Array.isArray(v) && v.length && v.every((f) => typeof f === 'string'))
        ? null : 'must be a string or an array of strings';
    case 'fontWeight':
      return (typeof v === 'number' && v >= 1 && v <= 1000) || WEIGHTS.has(v) ? null : 'must be 1..1000 or a weight keyword';
    case 'cubicBezier':
      return Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number') ? null : 'must be [x1, y1, x2, y2]';
    case 'shadow': return checkShadow(v);
    case 'typography': {
      if (!isObj(v)) return 'typography must be an object';
      const parts = [['fontFamily', 'fontFamily'], ['fontSize', 'dimension'], ['fontWeight', 'fontWeight'],
        ['letterSpacing', 'dimension'], ['lineHeight', 'number']];
      for (const [k, t] of parts) {
        if (v[k] === undefined) return `typography is missing ${k}`;
        const e = checkValue(t, v[k]);
        if (e) return `typography ${k}: ${e}`;
      }
      return null;
    }
    default: return isObj(v) || Array.isArray(v) || typeof v === 'string' ? null : 'invalid value';
  }
}

// Walks a token tree. `only` limits reported errors to paths that exist in that tree.
export function validateTokens(tree, path = '', inherited, errors = [], only) {
  const groupType = tree.$type ?? inherited;
  if (tree.$type !== undefined && !TYPES.has(tree.$type)) errors.push({ path, message: `unknown $type "${tree.$type}"` });
  for (const [key, node] of Object.entries(tree)) {
    const p = join(path, key);
    if (key.startsWith('$') && key !== '$root') {
      if (!GROUP_KEYS.has(key)) errors.push({ path: p, message: `unknown reserved key ${key}` });
      continue;
    }
    if (!isObj(node)) { errors.push({ path: p, message: 'must be a token or a group' }); continue; }
    const onlyNode = only?.[key];
    if (only && onlyNode === undefined) continue;
    if ('$value' in node) {
      for (const k of Object.keys(node)) {
        if (k.startsWith('$') && !TOKEN_KEYS.has(k)) errors.push({ path: p, message: `unknown reserved key ${k}` });
      }
      const type = node.$type ?? groupType;
      if (!type) errors.push({ path: p, message: 'token has no $type (own or inherited from a group)' });
      else if (!TYPES.has(type)) errors.push({ path: p, message: `unknown $type "${type}"` });
      else {
        const e = checkValue(type, node.$value);
        if (e) errors.push({ path: p, message: e });
      }
    } else validateTokens(node, p, groupType, errors, onlyNode);
  }
  return errors;
}

const mergeSources = (sources) => sources.reduce((acc, s) => deepMerge(acc, s), {});

export function validateResolver(doc) {
  const errors = [];
  if (!isObj(doc)) return { ok: false, errors: [{ path: '', message: 'document must be a JSON object' }] };
  if (doc.version !== '2025.10') errors.push({ path: 'version', message: 'version must be "2025.10"' });
  const sets = isObj(doc.sets) ? doc.sets : {};
  const modifiers = isObj(doc.modifiers) ? doc.modifiers : {};
  const checkSources = (list, path) => {
    if (!Array.isArray(list)) { errors.push({ path, message: 'must be an array of token objects' }); return []; }
    return list.filter((s, i) => {
      if (!isObj(s)) { errors.push({ path: `${path}[${i}]`, message: 'must be a token object' }); return false; }
      if (typeof s.$ref === 'string') {
        errors.push({ path: `${path}[${i}]`, message: 'file references are not supported here; inline the tokens' });
        return false;
      }
      return true;
    });
  };
  if (!Array.isArray(doc.resolutionOrder)) {
    errors.push({ path: 'resolutionOrder', message: 'resolutionOrder must be an array' });
  } else {
    doc.resolutionOrder.forEach((r, i) => {
      const m = typeof r?.$ref === 'string' && r.$ref.match(/^#\/(sets|modifiers)\/(.+)$/);
      const target = m && (m[1] === 'sets' ? sets : modifiers)[m[2]];
      if (!target) errors.push({ path: `resolutionOrder[${i}]`, message: `${r?.$ref ?? 'entry'} does not point to a set or modifier` });
    });
  }
  let base = {};
  for (const [name, set] of Object.entries(sets)) {
    base = deepMerge(base, mergeSources(checkSources(set?.sources, `sets.${name}.sources`)));
  }
  validateTokens(base, '', undefined, errors);
  for (const [name, mod] of Object.entries(modifiers)) {
    if (!isObj(mod?.contexts)) { errors.push({ path: `modifiers.${name}`, message: 'modifier needs contexts' }); continue; }
    if (mod.default !== undefined && !(mod.default in mod.contexts)) {
      errors.push({ path: `modifiers.${name}.default`, message: `default "${mod.default}" is not a context` });
    }
    for (const [ctx, list] of Object.entries(mod.contexts)) {
      const own = mergeSources(checkSources(list, `modifiers.${name}.contexts.${ctx}`));
      validateTokens(deepMerge(base, own), `modifiers.${name}.contexts.${ctx}`, undefined, errors, own);
    }
  }
  return { ok: errors.length === 0, errors };
}

export const isResolver = (json) => isObj(json) && Array.isArray(json.resolutionOrder);

export function toResolver(json, name) {
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

import type { BrandMeta, Tokens } from '../../lib/types.js';

const builtIn = new Set(['logos', 'favicons', 'icons']);
const shownInOwnSection = ['color.', 'spacing.', 'radius.', 'shadow.', 'font-size.', 'typography.', 'font.'];

export const isOtherToken = (path: string) => !shownInOwnSection.some((prefix) => path.startsWith(prefix));

export interface Section {
  id: string;
  title: string;
  cls?: string;
  group?: string;
}

export function sectionsOf(meta: BrandMeta, tokens: Tokens): Section[] {
  const groups = meta.assetGroups
    .filter((g) => !builtIn.has(g.id))
    .map((g) => ({ id: `group-${g.id}`, title: g.label ?? g.id, cls: 'cd-group', group: g.id }));
  const other = [...tokens.keys()].some(isOtherToken);
  return [
    { id: 'branding', title: 'Branding', cls: 'cd-branding' },
    { id: 'colors', title: 'Colors', cls: 'cd-colors' },
    { id: 'typography', title: 'Typography', cls: 'cd-typography' },
    { id: 'icons', title: 'Icons', cls: 'cd-icons' },
    ...groups,
    { id: 'spacing', title: 'Spacing', cls: 'cd-spacing' },
    { id: 'radius', title: 'Radius', cls: 'cd-radius' },
    { id: 'shadow', title: 'Shadow', cls: 'cd-shadow' },
    ...(other ? [{ id: 'other-tokens', title: 'Other tokens' }] : []),
    { id: 'css-variables', title: 'Code', cls: 'cd-css-variables' },
  ];
}

<script setup lang="ts">
import { computed } from 'vue';
import { RovingFocusGroup, RovingFocusItem } from 'reka-ui';
import { cmyk, toHex, toOklchString, toRgbaString } from '../../lib/color.js';
import { ROLES } from '../../lib/contrast.js';
import { cssName } from '../../lib/css.js';
import type { DtcgColor, ResolvedToken, Tokens } from '../../lib/types.js';
import { byShadeOrder } from '../../lib/palette.js';
import { isNode } from '../../lib/tree.js';
import { VALUES } from '../../lib/schema.js';
import { valueAs } from '../../lib/values.js';
import CopyButton from './CopyButton.vue';

interface Shade {
  path: string;
  group: string;
  step: string;
  name: string;
  hex: string;
  copies: { text: string; shown: string }[];
}
interface Row {
  path: string;
  source: string;
  hex: string;
}

const props = defineProps<{ tokens: Tokens; vendor: string }>();

function shade(path: string, token: ResolvedToken): Shade | null {
  const [, group, step] = path.split('.');
  const color = valueAs(VALUES.color, token.resolved);
  if (!color) return null;
  const extension = token.extensions?.[props.vendor];
  const own = isNode(extension) ? extension : {};
  const printedCmyk = Array.isArray(own.cmyk) ? own.cmyk : null;
  const cmykText = `CMYK ${(printedCmyk ?? cmyk(color)).join(' ')}`;
  const copies = [toHex(color), toRgbaString(color), toOklchString(color)].map((text) => ({
    text,
    shown: text,
  }));
  copies.push({ text: cmykText, shown: printedCmyk ? cmykText : `${cmykText} (approx.)` });
  if (typeof own.pantone === 'string') copies.push({ text: own.pantone, shown: own.pantone });
  return { path, group, step, name: `${group}-${step}`, hex: toHex(color), copies };
}

function sourceOf(value: unknown, color: DtcgColor): string {
  if (typeof value === 'string') return value;
  if (isNode(value) && typeof value.$ref === 'string') return value.$ref;
  return toOklchString(color);
}

function row(path: string, token: ResolvedToken): Row | null {
  const color = valueAs(VALUES.color, token.resolved);
  return color && { path, source: sourceOf(token.value, color), hex: toHex(color) };
}

type Kind = 'palette' | 'role' | 'other';

function kindOf(path: string): Kind {
  const [, group, step, ...deeper] = path.split('.');
  if (ROLES.includes(group)) return 'role';
  return step && !deeper.length ? 'palette' : 'other';
}

const color = computed(() => {
  const palette = new Map<string, Shade[]>();
  const rows: Record<'role' | 'other', Row[]> = { role: [], other: [] };
  for (const [path, token] of props.tokens) {
    if (token.type !== 'color' || !path.startsWith('color.')) continue;
    const kind = kindOf(path);
    const swatch = kind === 'palette' ? shade(path, token) : null;
    const line = swatch ? null : row(path, token);
    if (swatch) palette.set(swatch.group, [...(palette.get(swatch.group) ?? []), swatch]);
    else if (line) rows[kind === 'role' ? 'role' : 'other'].push(line);
  }
  const hues = [...palette].map(
    ([id, shades]) => [id, shades.toSorted((a, b) => byShadeOrder(a.step, b.step))] as const,
  );
  const tables = [{ title: 'Roles', rows: rows.role }];
  if (rows.other.length) tables.push({ title: 'Other tokens', rows: rows.other });
  return { hues, tables };
});

const background = (path: string) => ({ background: `var(${cssName(path)})` });
</script>

<template>
  <template v-for="[hue, shades] in color.hues" :key="hue">
    <h3 :id="`hue-${hue}`">{{ hue }}</h3>
    <RovingFocusGroup as="ul" class="cd-scale" :aria-labelledby="`hue-${hue}`">
      <li v-for="s in shades" :key="s.path">
        <RovingFocusItem as-child>
          <CopyButton :text="s.hex" :label="`${s.name}: copy ${s.hex}`" class="cd-copy cd-copy-swatch">
            <span class="cd-color-swatch" :style="background(s.path)"></span>
          </CopyButton>
        </RovingFocusItem>
        <b>{{ s.name }}</b>
        <CopyButton
          v-for="copy in s.copies"
          :key="copy.shown"
          :text="copy.text"
          :tabindex="-1"
          class="cd-copy"
        >
          <small>{{ copy.shown }}</small>
        </CopyButton>
      </li>
    </RovingFocusGroup>
  </template>
  <template v-for="table in color.tables" :key="table.title">
    <h3>{{ table.title }}</h3>
    <div class="cd-box">
      <table class="cd-roles">
        <thead>
          <tr>
            <th>Token</th>
            <th>Value</th>
            <th>Hex</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in table.rows" :key="r.path">
            <td>
              <span class="cd-chip" :style="background(r.path)"></span><code>{{ cssName(r.path) }}</code>
            </td>
            <td>
              <code>{{ r.source }}</code>
            </td>
            <td>{{ r.hex }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RovingFocusGroup, RovingFocusItem } from 'reka-ui';
import { cmyk, toHex, toOklchString, toRgbaString } from '../../lib/color.js';
import { ROLES } from '../../lib/contrast.js';
import { cssName } from '../../lib/css.js';
import type { ResolvedToken, Tokens } from '../../lib/types.js';
import CopyButton from './CopyButton.vue';

interface Shade {
  path: string;
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

const isStep = (part?: string) => !!part && Number.isInteger(Number(part));

function shade(path: string, name: string, token: ResolvedToken): Shade {
  const own = token.extensions?.[props.vendor] ?? {};
  const printed = Array.isArray(own.cmyk);
  const cmykText = `CMYK ${(printed ? own.cmyk : cmyk(token.resolved)).join(' ')}`;
  const copies = [toHex(token.resolved), toRgbaString(token.resolved), toOklchString(token.resolved)].map(
    (text) => ({ text, shown: text }),
  );
  copies.push({ text: cmykText, shown: printed ? cmykText : `${cmykText} (approx.)` });
  if (own.pantone) copies.push({ text: String(own.pantone), shown: String(own.pantone) });
  return { path, name, hex: toHex(token.resolved), copies };
}

function row(path: string, token: ResolvedToken): Row {
  const { value } = token;
  const source = typeof value === 'string' ? value : (value?.$ref ?? toOklchString(value));
  return { path, source, hex: toHex(token.resolved) };
}

const color = computed(() => {
  const hues = new Map<string, Shade[]>();
  const roles: Row[] = [];
  const other: Row[] = [];
  for (const [path, token] of props.tokens) {
    if (token.type !== 'color' || !path.startsWith('color.')) continue;
    const [, group, step, ...deeper] = path.split('.');
    if (ROLES.includes(group)) roles.push(row(path, token));
    else if (isStep(step) && !deeper.length)
      hues.set(group, [...(hues.get(group) ?? []), shade(path, `${group}-${step}`, token)]);
    else other.push(row(path, token));
  }
  const tables = [{ title: 'Roles', rows: roles }];
  if (other.length) tables.push({ title: 'Other tokens', rows: other });
  return { hues: [...hues], tables };
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

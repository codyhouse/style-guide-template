<script setup lang="ts">
import { computed } from 'vue';
import { cmyk, toHex, toOklchString, toRgbaString } from '../../lib/color.js';
import { ROLES } from '../../lib/contrast.js';
import { cssName } from '../../lib/css.js';
import type { ResolvedToken, Tokens } from '../../lib/types.js';
import CopyButton from './CopyButton.vue';

type Row = [path: string, token: ResolvedToken];
const props = defineProps<{ tokens: Tokens; vendor: string }>();
const color = computed(() => {
  const hues = new Map<string, Row[]>(),
    roles: Row[] = [],
    other: Row[] = [];
  for (const [path, token] of props.tokens) {
    if (token.type !== 'color' || !path.startsWith('color.')) continue;
    const [, group, shade, ...rest] = path.split('.');
    if (ROLES.includes(group)) roles.push([path, token]);
    else if (/^\d+$/.test(shade) && !rest.length)
      hues.set(group, [...(hues.get(group) ?? []), [path, token]]);
    else other.push([path, token]);
  }
  return { hues: [...hues], roles, other };
});
const background = (path: string) => ({ background: `var(${cssName(path)})` });
const extension = (token: ResolvedToken) => token.extensions?.[props.vendor] ?? {};
const cmykText = (token: ResolvedToken) =>
  `CMYK ${(Array.isArray(extension(token).cmyk) ? extension(token).cmyk : cmyk(token.resolved)).join(' ')}`;
function rove(e: KeyboardEvent) {
  const list = [...(e.currentTarget as Element).querySelectorAll<HTMLElement>('.cd-copy-swatch')];
  const i = list.indexOf(document.activeElement as HTMLElement);
  const moves: Record<string, number> = {
    ArrowRight: i + 1,
    ArrowDown: i + 1,
    ArrowLeft: i - 1,
    ArrowUp: i - 1,
    Home: 0,
    End: list.length - 1,
  };
  if (i < 0 || !(e.key in moves)) return;
  e.preventDefault();
  const j = Math.max(0, Math.min(list.length - 1, moves[e.key]));
  list[i].tabIndex = -1;
  list[j].tabIndex = 0;
  list[j].focus();
}
</script>

<template>
  <template v-for="[hue, shades] in color.hues" :key="hue">
    <h3 :id="`hue-${hue}`">{{ hue }}</h3>
    <ul class="cd-scale" :aria-labelledby="`hue-${hue}`" @keydown="rove">
      <li v-for="([path, token], index) in shades" :key="path">
        <CopyButton
          :text="toHex(token.resolved)"
          :label="`${path.replace(/^color\./, '').replace('.', '-')}: copy ${toHex(token.resolved)}`"
          :tabindex="index ? -1 : 0"
          class="cd-copy cd-copy-swatch"
        >
          <span class="cd-color-swatch" :style="background(path)"></span>
        </CopyButton>
        <b>{{ path.replace(/^color\./, '').replace('.', '-') }}</b>
        <CopyButton :text="toHex(token.resolved)" :tabindex="-1" class="cd-copy"
          ><small>{{ toHex(token.resolved) }}</small></CopyButton
        >
        <CopyButton :text="toRgbaString(token.resolved)" :tabindex="-1" class="cd-copy"
          ><small>{{ toRgbaString(token.resolved) }}</small></CopyButton
        >
        <CopyButton :text="toOklchString(token.resolved)" :tabindex="-1" class="cd-copy"
          ><small>{{ toOklchString(token.resolved) }}</small></CopyButton
        >
        <CopyButton :text="cmykText(token)" :tabindex="-1" class="cd-copy"
          ><small
            >{{ cmykText(token) }}{{ Array.isArray(extension(token).cmyk) ? '' : ' (approx.)' }}</small
          ></CopyButton
        >
        <CopyButton
          v-if="extension(token).pantone"
          :text="String(extension(token).pantone)"
          :tabindex="-1"
          class="cd-copy"
          ><small>{{ extension(token).pantone }}</small></CopyButton
        >
      </li>
    </ul>
  </template>
  <h3>Roles</h3>
  <template
    v-for="[name, rows] in [
      ['Roles', color.roles],
      ['Other tokens', color.other],
    ] as const"
    :key="name"
  >
    <h3 v-if="name === 'Other tokens' && rows.length">Other tokens</h3>
    <div v-if="name === 'Roles' || rows.length" class="cd-box">
      <table class="cd-roles">
        <thead>
          <tr>
            <th>Token</th>
            <th>Value</th>
            <th>Hex</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[path, token] in rows" :key="path">
            <td>
              <span class="cd-chip" :style="background(path)"></span><code>{{ cssName(path) }}</code>
            </td>
            <td>
              <code>{{
                typeof token.value === 'string'
                  ? token.value
                  : (token.value?.$ref ?? toOklchString(token.value))
              }}</code>
            </td>
            <td>{{ toHex(token.resolved) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>

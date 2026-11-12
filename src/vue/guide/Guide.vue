<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, onUpdated } from 'vue';
import type { Session } from '../../app/session.js';
import { missingAssets } from '../../lib/assets.js';
import { checkContrast } from '../../lib/contrast.js';
import { cssName, cssValue } from '../../lib/css.js';
import { fileName } from '../../lib/path.js';
import type { BrandMeta, ResolverDoc, Tokens } from '../../lib/types.js';
import AssetImage from './AssetImage.vue';
import Code from './Code.vue';
import Colors from './Colors.vue';
import FileCard from './FileCard.vue';
import Panels from './Panels.vue';
import Scale from './Scale.vue';
import Typography from './Typography.vue';
import { sectionsOf } from './sections.js';
const props = defineProps<{
  session: Session;
  doc: ResolverDoc;
  tokens: Tokens;
  meta: BrandMeta;
  covered: boolean;
}>();
const sections = computed(() => sectionsOf(props.meta, props.tokens));
const group = (id: string) => props.meta.assetGroups.find((g) => g.id === id)?.items ?? [];
const rest = computed(() =>
  [...props.tokens].filter(
    ([p]) =>
      !['color.', 'spacing.', 'radius.', 'shadow.', 'font-size.', 'typography.', 'font.'].some((x) =>
        p.startsWith(x),
      ),
  ),
);
function measureSpecimen() {
  const heading = document.querySelector<HTMLElement>('#typography > .cd-box h1');
  for (const el of [heading, heading?.nextElementSibling]) {
    const label = el?.querySelector('.cd-specimen-label');
    if (!el || !label) continue;
    const s = getComputedStyle(el);
    label.textContent = `${s.fontWeight} ${s.fontFamily.split(',')[0].replace(/['"]/g, '')} ${Math.round(parseFloat(s.fontSize))}px`;
  }
}
onMounted(() => {
  addEventListener('resize', measureSpecimen);
  document.fonts?.addEventListener('loadingdone', measureSpecimen);
  nextTick(measureSpecimen);
});
onUpdated(measureSpecimen);
onUnmounted(() => {
  removeEventListener('resize', measureSpecimen);
  document.fonts?.removeEventListener('loadingdone', measureSpecimen);
});
</script>

<template>
  <main :inert="covered || undefined">
    <h1>{{ doc.name ?? 'Style Guide' }}</h1>
    <div class="cd-panels" aria-live="polite">
      <Panels :session="session" :contrast="checkContrast(doc)" :missing="missingAssets(meta, session.ctx)" />
    </div>
    <section v-for="section in sections" :id="section.id" :key="section.id" :class="section.cls">
      <h2>{{ section.title }}</h2>
      <div v-if="section.id === 'typography'" class="cd-box">
        <h1 role="none">Heading, <span class="cd-specimen-label"></span></h1>
        <p>
          Aa - <span class="cd-specimen-label"></span>. Lorem ipsum dolor sit amet, consectetur adipisicing
          elit. Omnis voluptate distinctio reprehenderit, autem deleniti ad <a href="#0">voluptatum eaque</a>.
          Optio ea aperiam nisi distinctio nemo repellat, voluptate fugiat. Quidem neque illum, blanditiis!
        </p>
      </div>
      <div class="cd-section-body">
        <template v-if="section.id === 'branding'">
          <ul class="cd-logos">
            <li v-for="item in group('logos')" :key="item.src" class="cd-box">
              <AssetImage :item="item" :ctx="session.ctx" />
            </li>
          </ul>
          <ul class="cd-favicons">
            <li v-for="item in group('favicons')" :key="item.src">
              <AssetImage :item="item" :ctx="session.ctx" />
            </li>
          </ul>
        </template>
        <Colors v-else-if="section.id === 'colors'" :tokens="tokens" :vendor="session.vendor" />
        <Typography v-else-if="section.id === 'typography'" :tokens="tokens" :meta="meta" />
        <ul v-else-if="section.id === 'icons'" class="cd-box">
          <li v-for="item in group('icons')" :key="item.src">
            <figure>
              <AssetImage :item="item" :ctx="session.ctx" alt="" />
              <figcaption>{{ item.label ?? fileName(item.src) }}</figcaption>
            </figure>
          </li>
        </ul>
        <Scale
          v-else-if="section.id === 'spacing' || section.id === 'radius' || section.id === 'shadow'"
          :kind="section.id"
          :tokens="tokens"
        />
        <div v-else-if="section.id === 'other-tokens'" class="cd-box">
          <table class="cd-roles">
            <thead>
              <tr>
                <th>Token</th>
                <th>Type</th>
                <th>CSS value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="[path, token] in rest" :key="path">
                <td>
                  <code>{{ cssName(path) }}</code>
                </td>
                <td>{{ token.type }}</td>
                <td>
                  <code>{{ cssValue(token.type, token.value) ?? '' }}</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Code v-else-if="section.id === 'css-variables'" :doc="doc" :vendor="session.vendor" />
        <template v-else>
          <div v-if="group(section.id.replace(/^group-/, '')).length" class="cd-files">
            <FileCard
              v-for="item in group(section.id.replace(/^group-/, ''))"
              :key="item.src"
              :item="item"
              :ctx="session.ctx"
            />
          </div>
          <p v-else>No files in this group yet.</p>
        </template>
      </div>
    </section>
  </main>
</template>

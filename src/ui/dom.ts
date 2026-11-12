import { html, svg } from 'lit-html';

// lucide paths (https://lucide.dev), drawn with currentColor
const ICONS = {
  check: svg`<path d="M20 6 9 17l-5-5"/>`,
  alert: svg`<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
  chevron: svg`<path d="m6 9 6 6 6-6"/>`,
  copy: svg`<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
  trash: svg`<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>`,
  up: svg`<path d="m18 15-6-6-6 6"/>`,
  down: svg`<path d="m6 9 6 6 6-6"/>`,
};

export type IconName = keyof typeof ICONS;

export const icon = (name: IconName) => html`<svg class="cd-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

export function download(name: string, data: string | Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

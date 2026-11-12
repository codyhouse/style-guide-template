// <sg-colors>: each hue's shades with their values, then the role and other color tokens.
import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { cmyk, toHex, toOklchString, toRgbaString } from '../../lib/color.js';
import { ROLES } from '../../lib/contrast.js';
import { cssName } from '../../lib/css.js';
import type { ResolvedToken, Tokens } from '../../lib/types.js';
import { LightElement } from '../light-element.js';
import { copyable } from './parts.js';

type Row = [path: string, token: ResolvedToken];

const background = (path: string) => styleMap({ background: `var(${cssName(path)})` });

// One Tab stop per hue row; arrow keys, Home and End move between its shades.
function roveSwatches(e: KeyboardEvent) {
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

@customElement('sg-colors')
export class Colors extends LightElement {
  @property({ attribute: false }) tokens: Tokens = new Map();
  @property() vendor = '';

  private swatch([path, token]: Row, first: boolean) {
    const ext = token.extensions?.[this.vendor] ?? {};
    const c = token.resolved;
    const name = path.replace(/^color\./, '').replace('.', '-');
    const hex = toHex(c);
    const cmykText = `CMYK ${(Array.isArray(ext.cmyk) ? ext.cmyk : cmyk(c)).join(' ')}`;
    // value lines copy on click; keyboard users get one stop per swatch (the hex) instead of five
    const line = (text: string, shown = text) =>
      copyable(text, html`<small>${shown}</small>`, { tabindex: '-1' });
    return html`
      <li>
        ${copyable(hex, html`<span class="cd-color-swatch" style=${background(path)}></span>`, {
          cls: 'cd-copy cd-copy-swatch',
          label: `${name}: copy ${hex}`,
          tabindex: first ? '0' : '-1',
        })}
        <b>${name}</b>
        ${line(hex)} ${line(toRgbaString(c))} ${line(toOklchString(c))}
        ${line(cmykText, Array.isArray(ext.cmyk) ? cmykText : `${cmykText} (approx.)`)}
        ${ext.pantone ? line(String(ext.pantone)) : nothing}
      </li>
    `;
  }

  private table(rows: Row[]) {
    return html`
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
            ${rows.map(
              ([path, t]) => html`
                <tr>
                  <td>
                    <span class="cd-chip" style=${background(path)}></span><code>${cssName(path)}</code>
                  </td>
                  <td>
                    <code
                      >${typeof t.value === 'string' ? t.value : (t.value?.$ref ?? toOklchString(t.value))}</code
                    >
                  </td>
                  <td>${toHex(t.resolved)}</td>
                </tr>
              `,
            )}
          </tbody>
        </table>
      </div>
    `;
  }

  protected override render() {
    const hues = new Map<string, Row[]>();
    const roles: Row[] = [];
    const other: Row[] = [];
    for (const [path, t] of this.tokens) {
      if (t.type !== 'color' || !path.startsWith('color.')) continue;
      const [, group, shade, ...rest] = path.split('.');
      if (ROLES.includes(group)) roles.push([path, t]);
      else if (/^\d+$/.test(shade) && !rest.length) hues.set(group, [...(hues.get(group) ?? []), [path, t]]);
      else other.push([path, t]);
    }
    return html`
      ${[...hues].map(
        ([hue, shades]) => html`
          <h3 id="hue-${hue}">${hue}</h3>
          <ul class="cd-scale" aria-labelledby="hue-${hue}" @keydown=${roveSwatches}>
            ${shades.map((row, i) => this.swatch(row, i === 0))}
          </ul>
        `,
      )}
      <h3>Roles</h3>
      ${this.table(roles)}
      ${
        other.length
          ? html`<h3>Other tokens</h3>
              ${this.table(other)}`
          : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-colors': Colors;
  }
}

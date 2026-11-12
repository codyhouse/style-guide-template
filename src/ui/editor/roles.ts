// <sg-edit-roles>: which shade each role property uses, in the theme being edited.
import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ROLES } from '../../lib/contrast.js';
import * as E from '../../lib/edit.js';
import type { ListboxOption } from '../listbox.js';
import { EditorArea, type EditorContext } from './context.js';
import { cap, choose } from './fields.js';
import { huesOf, shadesOf } from './palette.js';

@customElement('sg-edit-roles')
export class EditRoles extends EditorArea {
  protected renderArea({ tree, tokens, theme, session, set }: EditorContext) {
    const shades: ListboxOption[] = huesOf(tree).flatMap((hue) =>
      shadesOf(tree, hue).map((s) => ({
        value: `{color.${hue}.${s}}`,
        label: `${hue}-${s}`,
        swatch: `var(--color-${hue}-${s})`,
      })),
    );
    const roleField = (path: string, value: string) => {
      // a value that is not one of the palette's shades stays selectable as itself
      const options = shades.some((o) => o.value === value)
        ? shades
        : [{ value, label: 'Custom value', swatch: `var(--${path.replace(/\./g, '-')})` }, ...shades];
      const [, role, ...prop] = path.split('.');
      return choose(cap(`${role} ${prop.join(' ').replace(/-/g, ' ')}`), options, value, (v) =>
        set(E.setRole(session.store.get(), theme, path.replace(/^color\./, ''), v)),
      );
    };
    return html`
      <p class="cd-hint">Editing the ${theme} theme. Switch the theme in the header to edit the other.</p>
      ${ROLES.map((role) => {
        const props = [...tokens].filter(([p]) => p.startsWith(`color.${role}.`));
        return props.length ? html`<div>${props.map(([p, t]) => roleField(p, t.value))}</div>` : nothing;
      })}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sg-edit-roles': EditRoles;
  }
}

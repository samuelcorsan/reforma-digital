import { createElement, createRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { ButtonLink } from './button-link';
import { Checkbox } from './checkbox';
import { Select, SelectTrigger, SelectValue } from './select';

describe('controles shadcn/Base UI', () => {
  it('mantiene la semántica de navegación de los enlaces con estilo de botón', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const ref = createRef<HTMLAnchorElement>();
    let clicks = 0;
    try {
      flushSync(() =>
        root.render(
          createElement(
            ButtonLink,
            {
              href: '#destino',
              ref,
              variant: 'outline',
              onClick: () => {
                clicks++;
              },
            },
            'Continuar',
          ),
        ),
      );
      expect(ref.current?.getAttribute('href')).toBe('#destino');
      expect(ref.current?.tagName).toBe('A');
      expect(ref.current?.getAttribute('role')).toBeNull();
      expect(ref.current?.dataset.variant).toBe('outline');
      ref.current?.click();
      expect(clicks).toBe(1);
    } finally {
      flushSync(() => root.unmount());
      host.remove();
    }
  });
  it('envía el valor real del select, incluida la opción Todos vacía', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    try {
      for (const defaultValue of ['', 'PP']) {
        flushSync(() =>
          root.render(
            createElement(
              'form',
              {},
              createElement(
                Select,
                {
                  key: defaultValue,
                  name: 'grupo',
                  defaultValue,
                  items: [
                    { value: '', label: 'Todos' },
                    { value: 'PP', label: 'PP' },
                  ],
                },
                createElement(SelectTrigger, { 'aria-label': 'Grupo' }, createElement(SelectValue)),
              ),
            ),
          ),
        );
        const form = host.querySelector('form');
        if (!form) throw new Error('Falta el formulario');
        expect(new FormData(form).get('grupo')).toBe(defaultValue);
        expect(host.querySelector('[role="combobox"]')?.getAttribute('aria-label')).toBe('Grupo');
        expect(host.querySelector('[data-slot="select-value"]')?.textContent).toBe(
          defaultValue || 'Todos',
        );
      }
    } finally {
      flushSync(() => root.unmount());
      host.remove();
    }
  });
  it('comunica la selección del checkbox y mantiene su etiqueta', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    let checked = false;
    try {
      flushSync(() =>
        root.render(
          createElement(
            'label',
            {},
            createElement(Checkbox, {
              defaultChecked: false,
              onCheckedChange: (value) => {
                checked = value;
              },
            }),
            'PP · 137',
          ),
        ),
      );
      const control = host.querySelector<HTMLButtonElement>('[role="checkbox"]');
      expect(control?.closest('label')?.textContent).toBe('PP · 137');
      flushSync(() => control?.click());
      expect(checked).toBe(true);
    } finally {
      flushSync(() => root.unmount());
      host.remove();
    }
  });
});

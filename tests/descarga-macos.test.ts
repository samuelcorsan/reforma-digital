// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { EnlaceDescarga } from '../apps/web/app/(search)/escritorio/descargar';

it('muestra la guía solo para macOS y conserva la descarga', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    for (const sistema of ['macos', 'windows', 'linux'] as const) {
      await act(async () => {
        root.render(createElement(EnlaceDescarga, { sistema, href: '#archivo' }, 'Descargar'));
      });
      const link = container.querySelector('a')!;
      expect(link.getAttribute('href')).toBe('#archivo');
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      await act(async () => {
        link.dispatchEvent(click);
      });
      expect(click.defaultPrevented).toBe(false);
      const dialog = document.querySelector('[role="dialog"]');
      if (sistema === 'macos') {
        expect(dialog?.textContent).toContain('Cómo instalar en tu Mac');
        const pulsar = async (texto: string) => {
          const boton = [...dialog!.querySelectorAll('button')].find((b) =>
            b.textContent?.includes(texto),
          );
          expect(boton).toBeDefined();
          await act(async () => {
            boton!.click();
          });
        };
        expect(dialog?.querySelector('img')?.getAttribute('src')).toContain('aviso.webp');
        await pulsar('Siguiente');
        expect(dialog?.textContent).toContain('Privacidad y seguridad');
        await pulsar('Atrás');
        expect(dialog?.querySelector('img')?.getAttribute('src')).toContain('aviso.webp');
        await pulsar('Siguiente');
        await pulsar('Siguiente');
        expect(dialog?.querySelector('img')?.getAttribute('src')).toContain('confirmar.webp');
        await act(async () => {
          [...dialog!.querySelectorAll('button')]
            .find((b) => b.textContent === 'Entendido')
            ?.click();
        });
        expect(document.querySelector('[role="dialog"]')).toBeNull();
      } else {
        expect(dialog).toBeNull();
      }
    }
  } finally {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  }
});

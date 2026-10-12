// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EligeProvincia } from '../apps/web/app/(search)/elecciones/elige-provincia';
import { InfoDato } from '../apps/web/app/(search)/elecciones/info-dato';
import { SimuladorDhondt } from '../apps/web/app/(search)/elecciones/simulador-dhondt';
import { TablaProvincias } from '../apps/web/app/(search)/elecciones/tabla-provincias';
import Elecciones, { generateMetadata } from '../apps/web/app/(search)/elecciones/page';
import { cartograma, provincias, recuadroCanarias } from '../apps/web/lib/elecciones';

const pagina = async (query: Record<string, string | string[]>) =>
  renderToStaticMarkup(await Elecciones({ searchParams: Promise.resolve(query) }));
const ficha = (html: string) =>
  new DOMParser().parseFromString(html, 'text/html').getElementById('el-ficha')?.innerHTML ?? '';

describe('?provincia= en /elecciones', () => {
  it('abre la ficha de la provincia con sus cifras, y la página cita las fuentes oficiales', async () => {
    const pag = await pagina({ provincia: '42' });
    const html = ficha(pag);
    expect(html).toContain('<h3 class="el-ficha-titulo">Soria</h3>');
    expect(html).toContain('<p class="chat-detail-figure">2</p>');
    expect(html).toContain('<p class="chat-detail-figure">90.234</p>');
    expect(html).toContain('<p class="chat-detail-figure">45.117</p>');
    expect(html).toContain('68 % menos que la media (140.327)');
    expect(html).toContain('Los 2 que da la ley');
    expect(html).toContain('aria-label="Qué significa «Votos por escaño en 2023»"');
    expect(html).toContain('a candidaturas y en blanco, sin los nulos');
    expect(pag).toContain('https://www.boe.es/buscar/doc.php?id=BOE-A-2026-20742');
    expect(pag).toContain('https://www.boe.es/buscar/doc.php?id=BOE-A-2025-25362');
    expect(pag).toContain('https://infoelectoral.interior.gob.es/');
  });

  it('muestra el cambio de escaños frente a 2023 y su reparto', async () => {
    const madrid = ficha(await pagina({ provincia: '28' }));
    expect(madrid).toContain('1 más que en 2023');
    expect(madrid).toContain('2 por ley y 36 por población');
    expect(ficha(await pagina({ provincia: '11' }))).toContain('1 menos que en 2023');
    expect(ficha(await pagina({ provincia: '42' }))).toContain('igual que en 2023');
    expect(ficha(await pagina({ provincia: '51' }))).toContain('Fijado por la ley');
  });

  it('ignora códigos que no son una circunscripción', async () => {
    for (const provincia of ['99', '', ['42', '28']]) {
      const html = ficha(await pagina({ provincia }));
      expect(html).toContain('<p class="el-ficha-titulo">España</p>');
      expect(html).not.toContain('<h3 class="el-ficha-titulo">');
    }
  });

  it('enlaza la imagen OG de la provincia elegida', async () => {
    const og = async (provincia: string) => {
      const images = (await generateMetadata({ searchParams: Promise.resolve({ provincia }) }))
        .openGraph?.images;
      return (Array.isArray(images) ? images : [images]).map((i) =>
        typeof i === 'object' && i && 'url' in i ? String(i.url) : String(i),
      );
    };
    expect(await og('52')).toEqual(['/elecciones/og/52']);
    expect(await og('99')).toEqual(['/og/portada.jpg']);
  });

  it('elige provincia en el desplegable o en la tabla sin perder la vista', async () => {
    const doc = new DOMParser().parseFromString(
      await pagina({ provincia: '42', vista: 'escanos' }),
      'text/html',
    );
    const desplegable = doc.querySelector<HTMLSelectElement>('select[name="provincia"]')!;
    expect(desplegable.form?.getAttribute('action')).toBe('/elecciones');
    expect(desplegable.labels[0]?.textContent).toBe('Elige tu provincia');
    expect(desplegable.options).toHaveLength(53);
    expect(desplegable.value).toBe('42');
    expect(desplegable.form?.querySelector('input[name="vista"]')?.getAttribute('value')).toBe(
      'escanos',
    );
    expect(
      [...doc.querySelectorAll('.el-tabla tbody th a')]
        .find((a) => a.textContent === 'Soria')
        ?.getAttribute('href'),
    ).toBe('/elecciones?provincia=42&vista=escanos#el-ficha');
  });
});

it('muestra un solo nombre por provincia, con el artículo delante', () => {
  expect(provincias.map((p) => p.name).filter((n) => /[/()]/.test(n))).toEqual([]);
});

it('dibuja Canarias dentro de su recuadro, con margen', () => {
  const { x, y, width, height } = recuadroCanarias;
  for (const id of ['35', '38']) {
    const n = provincias
      .find((p) => p.id === id)!
      .path.match(/-?\d+(\.\d+)?/g)!
      .map(Number);
    for (const [i, v] of n.entries()) {
      const [min, max] = i % 2 === 0 ? [x, x + width] : [y, y + height];
      expect(v).toBeGreaterThanOrEqual(min + 6);
      expect(v).toBeLessThanOrEqual(max - 6);
    }
  }
});

describe('cartograma de escaños', () => {
  it('da a cada provincia un círculo de área proporcional a sus escaños, sin solaparse', () => {
    expect(cartograma.map((c) => c.id)).toEqual(provincias.map((p) => p.id));
    for (const [i, a] of cartograma.entries()) {
      expect(a.r ** 2 / provincias[i]!.seats).toBeCloseTo(
        cartograma[0]!.r ** 2 / provincias[0]!.seats,
      );
      expect(a.x - a.r).toBeGreaterThanOrEqual(0);
      expect(a.x + a.r).toBeLessThanOrEqual(600);
      expect(a.y - a.r).toBeGreaterThanOrEqual(0);
      expect(a.y + a.r).toBeLessThanOrEqual(520);
      for (const b of cartograma.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });
});

it('la tabla busca sin tildes y ordena por nombre o escaños', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const nombres = () => [...container.querySelectorAll('tbody th')].map((e) => e.textContent);
  const cambiar = async (control: HTMLInputElement | HTMLSelectElement, valor: string) => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), 'value')?.set?.call(
      control,
      valor,
    );
    await act(async () => control.dispatchEvent(new Event('change', { bubbles: true })));
  };
  try {
    const items = provincias.map((p) => ({ ...p, href: `/elecciones?provincia=${p.id}` }));
    await act(async () => root.render(createElement(TablaProvincias, { items })));
    const busqueda = container.querySelector('input')!;
    const orden = container.querySelector('select')!;
    expect(nombres().slice(0, 3)).toEqual(['A Coruña', 'Álava', 'Albacete']);
    await cambiar(orden, 'escanos');
    expect(nombres().slice(0, 3)).toEqual(['Madrid', 'Barcelona', 'Valencia']);
    expect([...orden.options].map((o) => o.text)).toEqual(['Nombre', 'Escaños']);
    await cambiar(busqueda, 'avila');
    expect(nombres()).toEqual(['Ávila']);
    await cambiar(busqueda, 'cruz tenerife');
    expect(nombres()).toEqual(['Santa Cruz de Tenerife']);
    await cambiar(busqueda, 'xyz');
    expect(nombres()).toEqual([]);
    expect(container.textContent).toContain('Ninguna circunscripción coincide con «xyz».');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it('el desplegable abre la ficha al elegir y sigue a la provincia del mapa sin perder el foco', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const form = document.createElement('form');
  document.body.append(form);
  const enviadas: (FormDataEntryValue | null)[] = [];
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    enviadas.push(new FormData(form).get('provincia'));
  });
  const root = createRoot(form);
  const opciones = provincias.map(({ id, name }) => ({ id, name }));
  const pintar = (actual: string | undefined) =>
    act(async () => root.render(createElement(EligeProvincia, { actual, opciones })));
  try {
    await pintar(undefined);
    const select = form.querySelector('select')!;
    select.focus();
    select.value = '42';
    await act(async () => select.dispatchEvent(new Event('change', { bubbles: true })));
    expect(enviadas).toEqual(['42']);
    await pintar('28');
    expect(form.querySelector('select')).toBe(select);
    expect(select.value).toBe('28');
    expect(document.activeElement).toBe(select);
  } finally {
    await act(async () => root.unmount());
    form.remove();
    vi.unstubAllGlobals();
  }
});

it('la «i» se abre al pasar el ratón, al tocarla o con teclado, y se cierra al salir, fuera o con Esc', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(InfoDato, { titulo: 'Habitantes', ayuda: 'Personas empadronadas' }),
      ),
    );
    const boton = container.querySelector('button')!;
    const texto = container.querySelector('[role="tooltip"]')!;
    const abierto = () => !texto.hasAttribute('hidden');
    const raton = (tipo: string, relatedTarget: Element) =>
      act(async () => boton.dispatchEvent(new MouseEvent(tipo, { bubbles: true, relatedTarget })));
    expect(boton.getAttribute('aria-describedby')).toBe(texto.id);
    expect(abierto()).toBe(false);
    await raton('mouseover', document.body);
    expect(abierto()).toBe(true);
    await act(async () =>
      container
        .querySelector('.el-dato')!
        .dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })),
    );
    expect(abierto()).toBe(false);
    await act(async () => boton.click());
    expect(abierto()).toBe(true);
    await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(abierto()).toBe(false);
    await act(async () => boton.focus());
    expect(abierto()).toBe(true);
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(abierto()).toBe(false);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("el simulador reparte con D'Hondt, aplica la barrera del 3 % y sigue los escaños de la provincia", async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const orden = () =>
    [...container.querySelectorAll('.el-sim-orden li')].map((li) => li.textContent?.slice(-1));
  const ganados = () =>
    [...container.querySelectorAll('.el-sim-ganados strong')].map((e) => Number(e.textContent));
  try {
    await act(async () => root.render(createElement(SimuladorDhondt, {})));
    // 5 escaños: A y B empatan a 14.000 en el último y lo gana A, con más votos (art. 163.1.d).
    expect(orden()).toEqual(['A', 'B', 'A', 'C', 'A']);
    expect(ganados()).toEqual([3, 1, 1, 0, 0]);
    expect(container.textContent).toContain('no llega al 3 %');
    expect(container.querySelectorAll('.el-sim-tabla td[data-gana]')).toHaveLength(5);

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Un escaño más"]')!.click(),
    );
    expect(ganados()).toEqual([3, 2, 1, 0, 0]);

    const e = container.querySelector<HTMLInputElement>('#el-sim-E')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(e, '20000');
    await act(async () => e.dispatchEvent(new Event('input', { bubbles: true })));
    expect(container.textContent).not.toContain('no llega al 3 %');

    // La página lo vuelve a montar (key) al cambiar de provincia.
    await act(async () => root.render(createElement('div')));
    await act(async () =>
      root.render(createElement(SimuladorDhondt, { provincia: { name: 'Soria', seats: 2 } })),
    );
    expect(container.querySelector('.el-sim-paso output')?.textContent).toBe('2');
    expect(container.textContent).toContain('Los de Soria');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

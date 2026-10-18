import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  LATE_CONTENT_MS,
  mountAdapter,
  startAdapter,
  type RuntimeController,
} from '@reforma-digital/runtime';
import { extranjeriaAdapter as adapter } from '../src';
import { fixture, URLS, type Fixture } from './helpers';

let controller: RuntimeController | undefined;
beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  controller?.dispose();
  controller = undefined;
  vi.useRealTimers();
});

const hosts = () => document.querySelectorAll('[data-bg-host]');
const shadowText = () => Array.from(hosts(), (h) => h.shadowRoot?.textContent ?? '').join(' ');
const button = (text: RegExp) =>
  Array.from(hosts())
    .flatMap((h) => Array.from(h.shadowRoot?.querySelectorAll('button') ?? []))
    .find((b) => text.test(b.textContent ?? ''))!;
function mount(name: Fixture, url: string) {
  fixture(name);
  controller = mountAdapter(adapter, { url: new URL(url) });
  return controller;
}

it('adds the top bar and panels without touching official content', () => {
  fixture('landing');
  const before = document.querySelector('#mainWindow .mf-main--content')!.innerHTML;
  controller = mountAdapter(adapter, { url: new URL(URLS.landing) });
  expect(controller.state()).toBe('active');
  expect(hosts()).toHaveLength(3); // barra + panel + rótulo «Información oficial»
  expect(shadowText()).toContain('Interfaz comunitaria · sitio oficial');
  expect(document.documentElement.getAttribute('data-bg-site')).toBe('extranjeria');
  expect(document.documentElement.getAttribute('data-bg-page')).toBe('landing');
  const after = document.querySelector('#mainWindow .mf-main--content')!.cloneNode(true) as Element;
  after.querySelectorAll('[data-bg-host]').forEach((n) => n.remove());
  expect(after.innerHTML).toBe(before);
});

it('starts the official procedure through the bridge', () => {
  mount('landing', URLS.landing);
  const click = vi.fn((event: Event) => event.preventDefault());
  document.querySelector('form#formulario input[type="submit"]')!.addEventListener('click', click);
  button(/Empezar en la web oficial/).click();
  expect(click).toHaveBeenCalledOnce();
});

it('drives the official province select and the official Aceptar button', async () => {
  mount('provincias', URLS.provincias);
  const select = document.querySelector<HTMLSelectElement>('select#form')!;
  const change = vi.fn();
  select.addEventListener('change', change);
  const madrid = Array.from(hosts())
    .flatMap((h) =>
      Array.from(h.shadowRoot?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? []),
    )
    .find((r) => r.parentElement?.textContent?.trim() === 'Madrid')!;
  madrid.click();
  expect(select.options[select.selectedIndex]?.text).toBe('Madrid');
  expect(change).toHaveBeenCalled();
  const accept = vi.fn();
  document.querySelector('#btnAceptar')!.addEventListener('click', accept);
  await vi.waitFor(() => expect(button(/Continuar con Madrid/).disabled).toBe(false));
  button(/Continuar con Madrid/).click();
  expect(accept).toHaveBeenCalledOnce();
});

it('keeps "Continuar" disabled until a trámite is chosen', async () => {
  mount('tramites', URLS.tramites);
  expect(button(/^Continuar/).disabled).toBe(true);
  const radio = Array.from(hosts())
    .flatMap((h) =>
      Array.from(
        h.shadowRoot?.querySelectorAll<HTMLInputElement>('input[name="bg-tramite"]') ?? [],
      ),
    )
    .at(0)!;
  radio.click();
  expect(document.querySelector<HTMLSelectElement>('[id="tramiteGrupo[0]"]')!.value).not.toBe('-1');
  await vi.waitFor(() => expect(button(/^Continuar/).disabled).toBe(false));
});

it('restores the original page when an official control disappears', async () => {
  mount('provincias', URLS.provincias);
  document.querySelector('select#form')!.remove();
  await vi.waitFor(() => expect(controller!.state()).toBe('original'));
  expect(hosts()).toHaveLength(0);
  expect(document.documentElement.hasAttribute('data-bg-site')).toBe(false);
  expect(document.documentElement.hasAttribute('data-bg-page')).toBe(false);
});

it('"Ver original" removes panels, page attributes and styles', () => {
  mount('tramites', URLS.tramites);
  button(/^Ver original$/).click();
  expect(controller!.state()).toBe('original');
  expect(hosts()).toHaveLength(0);
  expect(document.documentElement.hasAttribute('data-bg-site')).toBe(false);
});

it('waits for official content that renders late', async () => {
  controller = startAdapter(adapter, { url: new URL(URLS.tramites) });
  expect(controller.state()).toBe('unsupported');
  fixture('tramites');
  await vi.waitFor(() => expect(controller!.state()).toBe('active'));
});

it('stops waiting for late content once the page URL changes', async () => {
  const start = location.href;
  controller = startAdapter(adapter, { url: new URL(URLS.tramites) });
  history.pushState(null, '', '/otra-pantalla');
  try {
    fixture('tramites');
    await new Promise((resolve) => setTimeout(resolve));
    expect(controller.state()).toBe('unsupported');
    expect(hosts()).toHaveLength(0);
  } finally {
    history.replaceState(null, '', start);
  }
});

it('shows a dismissible notice when an expected screen never matches', async () => {
  vi.useFakeTimers();
  document.body.innerHTML = '<h1>Página bloqueada</h1>';
  controller = startAdapter(adapter, { url: new URL(URLS.tramites) });
  vi.advanceTimersByTime(LATE_CONTENT_MS + 1);
  const notice = document.querySelector('[data-bg-notice]');
  expect(notice?.shadowRoot?.textContent).toContain('se muestra la web oficial sin cambios');
  expect(hosts()).toHaveLength(0);
});

it('leaves unknown screens untouched and shows no notice', () => {
  vi.useFakeTimers();
  fixture('info');
  controller = startAdapter(adapter, { url: new URL(URLS.entrada) });
  vi.advanceTimersByTime(LATE_CONTENT_MS + 1);
  expect(controller.state()).toBe('unsupported');
  expect(document.querySelector('[data-bg-host], [data-bg-notice]')).toBeNull();
});

import { afterEach, expect, it } from 'vitest';
import { matchesSite, type Enhancement } from '@reforma-digital/registry';
import { extranjeriaAdapter as adapter } from '../src';
import { landingBindings } from '../src/pages/landing/bindings';
import { provinciasBindings } from '../src/pages/provincias/bindings';
import { tramitesBindings } from '../src/pages/tramites/bindings';
import { infoBindings } from '../src/pages/info/bindings';
import { fixture, URLS } from './helpers';

let enhancement: Enhancement | null;
afterEach(() => {
  enhancement?.bridge.dispose();
  enhancement = null;
  document.body.innerHTML = '';
});
const prepare = (url: string) => (enhancement = adapter.prepare(document, new URL(url), () => {}));

it('matches only the exact official origins and routes', () => {
  for (const url of Object.values(URLS)) expect(matchesSite(adapter, new URL(url))).toBe(true);
  for (const url of [
    'http://icp.administracionelectronica.gob.es/icpplus/index.html',
    'https://icp.administracionelectronica.gob.es.evil.test/icpplus/index.html',
    'https://icp.administracionelectronica.gob.es/icpfalso/citar',
    'https://sede.administracionespublicas.gob.es/pagina/index/directorio/otra',
    'https://evil.test/pagina/index/directorio/icpplus',
  ])
    expect(matchesSite(adapter, new URL(url))).toBe(false);
});

it('expects one screen per public step and none for personal-data pages', () => {
  for (const url of [URLS.landing, URLS.provincias, URLS.tramites, URLS.info])
    expect(adapter.expects(new URL(url))).toBe(true);
  expect(
    adapter.expects(new URL('https://icp.administracionelectronica.gob.es/icpco/selectSede')),
  ).toBe(true);
  expect(adapter.expects(new URL(URLS.entrada))).toBe(false);
});

it('reads the landing summary and official instructions from the real page', () => {
  fixture('landing');
  const b = landingBindings(document)!;
  expect(b.destinationHost).toBe('icp.administracionelectronica.gob.es');
  expect(b.summary).toMatch(/Cita previa para la presentación de autorizaciones/);
  expect(b.whoRequests).toHaveLength(4);
  expect(b.responsible).toHaveLength(2);
  expect(b.technicalRequirements?.text).toBe('requisitos técnicos');
  expect(prepare(URLS.landing)?.panels).toHaveLength(2);
  expect(enhancement?.slots).toHaveLength(0);
  expect(enhancement?.page).toBe('landing');
});

it('reads provinces, offices, trámite groups and access options', () => {
  fixture('provincias');
  const p = provinciasBindings(document)!;
  expect(Array.from(p.select.options).map((o) => o.text)).toContain('Madrid');
  expect(p.noticeLinks.some((l) => l.text === 'MERCURIO')).toBe(true);
  expect(p.noticeLinks.every((l) => !l.text.includes('Abre en ventana nueva'))).toBe(true);
  expect(prepare(URLS.provincias)?.bridge.getField('provincia').options.length).toBeGreaterThan(40);
  enhancement?.bridge.dispose();

  fixture('tramites');
  const t = tramitesBindings(document)!;
  expect(t.province).toBe('Madrid');
  expect(t.officeHint).toMatch(/deberás acudir/);
  expect(t.groups[0]?.label).toMatch(/TRÁMITES/);
  const office = prepare(URLS.tramites)!.bridge.getField('oficina');
  expect(office.options.some((o) => o.group === 'Elegir oficina')).toBe(true);
  enhancement?.bridge.dispose();

  fixture('info');
  const i = infoBindings(document)!;
  expect(i.tramiteName).toMatch(/TOMA DE HUELLAS/);
  expect(i.withClave?.title).toBe('Presentación con Cl@ve');
  expect(i.withoutClave?.title).toBe('Presentación sin Cl@ve');
  expect(i.claveInfoLink?.href).toBe('https://clave.gob.es/clave_Home/clave.html');
  fixture('info', (h) => h.replace('https://clave.gob.es/', 'https://clave.gob.es.evil.test/'));
  expect(infoBindings(document)?.claveInfoLink).toBeNull();
  expect(prepare(URLS.info)?.bridge.actionSpec('sinClave').custom).toBe(true);
});

it('keeps the original page when the DOM does not match the reviewed contract', () => {
  fixture('landing', (h) => h.replace('id="formulario"', 'id="otro"'));
  expect(prepare(URLS.landing)).toBeNull();
  fixture('landing', (h) =>
    h.replace(
      'action="https://icp.administracionelectronica.gob.es/icpplus/index.html"',
      'action="https://evil.test/"',
    ),
  );
  expect(prepare(URLS.landing)).toBeNull();
  fixture('tramites', (h) => h.replaceAll('tramiteGrupo[', 'grupo['));
  expect(prepare(URLS.tramites)).toBeNull();
  fixture('info', (h) =>
    h.replace('id="btnAccesoClave"', 'id="x1"').replace('id="btnEntrar"', 'id="x2"'),
  );
  expect(prepare(URLS.info)).toBeNull();
});

it('never adapts the personal-data form (acEntrada)', () => {
  fixture('info');
  expect(prepare(URLS.entrada)).toBeNull();
});

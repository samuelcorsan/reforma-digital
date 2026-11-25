import { DomBridge, scrollToOfficial } from '@reforma-digital/bridge';
import { BoundField, BridgeProvider, useBoundField, useDomValue } from '@reforma-digital/react';
import type { SitePage } from '@reforma-digital/registry';
import { Callout, ExternalLink, LinkButton, OfficialDivider, Panel } from '@reforma-digital/design';
import { pageClassName } from '../../styles/theme';
import { consultaBindings, consultaState, RESULTS_TABLE, type ConsultaBindings } from './bindings';

const SEDE = 'https://sede.interior.gob.es';
/** Ficha oficial del procedimiento en la Sede (enlace «Más Información» del listado de trámites). */
const FICHA = 'https://sede.interior.gob.es/portal/sede/tramites/detalle-tramite?id=49';

export const consultaPage: SitePage = {
  id: 'consulta',
  matches: (url) => url.origin === SEDE && url.pathname === '/portal/sede/asociacionesLegacy',
  prepare(document, _url, restore) {
    const bindings = consultaBindings(document);
    if (!bindings) return null;
    const bridge = new DomBridge(
      {
        denominacion: {
          element: bindings.denominacion,
          label: bindings.label,
          help:
            bindings.minLength > 0
              ? `Mínimo ${bindings.minLength} caracteres, según la web oficial.`
              : '',
        },
      },
      { buscar: { element: bindings.buscar, label: 'Buscar' } },
      { onIssue: restore },
    );
    return {
      bridge,
      title: 'Consulta asociaciones',
      description: 'Fichero de Denominaciones de Asociaciones',
      page: 'consulta',
      pageClassName,
      shell: { anchor: bindings.title, position: 'beforebegin' },
      panels: [
        {
          anchor: bindings.title,
          position: 'afterend',
          render: () => (
            <BridgeProvider value={bridge}>
              <Consulta bindings={bindings} />
            </BridgeProvider>
          ),
        },
        { anchor: bindings.content, position: 'afterbegin', render: () => <OfficialDivider /> },
      ],
      // El buscador oficial se sustituye en su sitio; «Búsqueda exacta» y «Buscar» siguen siendo originales.
      slots: [
        {
          source: bindings.denominacion,
          render: () => (
            <BridgeProvider value={bridge}>
              <BoundField binding="denominacion" submitAction="buscar" />
            </BridgeProvider>
          ),
        },
      ],
      health: () => bindings.denominacion.isConnected && bindings.buscar.isConnected,
    };
  },
};

function Consulta({ bindings }: { bindings: ConsultaBindings }) {
  const doc = bindings.title.ownerDocument;
  const term = useBoundField('denominacion').value;
  const state = useDomValue(doc.getElementById('main-content') ?? doc.body, () =>
    consultaState(doc),
  );

  return (
    <Panel
      title="Consulta si una asociación está inscrita"
      lead={
        <p>
          Busca por palabras de la denominación en el Fichero de Denominaciones de Asociaciones del
          Ministerio del Interior. La consulta es pública: no necesita identificación.
        </p>
      }
    >
      {state.kind === 'results' && (
        <Callout tone="info" title={term ? `Resultados para «${term}»` : 'Resultados'}>
          <p>
            {state.page ? `Página ${state.page}. ` : ''}
            {state.rows} {state.rows === 1 ? 'asociación' : 'asociaciones'} en esta página, con su
            registro de procedencia.
          </p>
          <LinkButton onClick={() => scrollToOfficial(doc.querySelector(RESULTS_TABLE))}>
            Ir a los resultados
          </LinkButton>
        </Callout>
      )}
      {state.kind === 'empty' && state.message && (
        <Callout tone="warning" role="status" title="La web oficial indica:">
          {state.message}
        </Callout>
      )}
      {state.kind === 'form' && (
        <Callout tone="neutral">
          Escribe las palabras en el buscador de abajo y pulsa «Buscar» o la tecla Intro. La
          búsqueda la hace la web oficial.
        </Callout>
      )}
      <p className={'text-sm [line-height:1.5] [color:rgb(var(--bg-ink-muted))]'}>
        Información del procedimiento:{' '}
        <ExternalLink href={FICHA}>ficha oficial en la Sede</ExternalLink>
      </p>
    </Panel>
  );
}

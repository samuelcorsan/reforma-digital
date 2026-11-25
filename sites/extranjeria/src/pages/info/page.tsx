import { Button } from '@reforma-digital/design/ui/button';
import { DomBridge, scrollToOfficial } from '@reforma-digital/bridge';
import { useBridge } from '@reforma-digital/react';
import type { SitePage } from '@reforma-digital/registry';
import {
  Callout,
  ExternalLink,
  LinkButton,
  Panel,
  ProgressSteps,
  SecondaryAction,
} from '@reforma-digital/design';
import { pageClassName } from '../../styles/theme';
import { icpScreen } from '../../components/official';
import { communityBar, screenPanels } from '../../components/panels';
import { OUT_OF_SCOPE_FROM, STEPS } from '../../components/steps';
import { infoBindings, type InfoBindings } from './bindings';

export const infoPage: SitePage = {
  id: 'info',
  matches: (url) => icpScreen(url) === 'acInfo',
  prepare(document, _url, restore) {
    const bindings = infoBindings(document);
    if (!bindings) return null;
    // Las dos opciones oficiales son <div> clicables revisados a mano: se declaran `custom`.
    const bridge = new DomBridge(
      {},
      {
        ...(bindings.withClave
          ? {
              conClave: {
                element: bindings.withClave.element,
                label: bindings.withClave.title,
                custom: true,
              },
            }
          : {}),
        ...(bindings.withoutClave
          ? {
              sinClave: {
                element: bindings.withoutClave.element,
                label: bindings.withoutClave.title,
                custom: true,
              },
            }
          : {}),
        ...(bindings.back ? { volver: { element: bindings.back, label: 'Volver' } } : {}),
      },
      { onIssue: restore },
    );
    return {
      bridge,
      title: 'Cita previa de Extranjería',
      description: 'Requisitos y forma de acceso',
      page: 'info',
      pageClassName,
      slots: [],
      shell: communityBar(bindings.header),
      panels: screenPanels(bindings.header, bindings.content, bridge, () => (
        <Info bindings={bindings} restore={restore} />
      )),
      health: () =>
        bindings.header.isConnected &&
        (bindings.withClave ?? bindings.withoutClave)!.element.isConnected,
    };
  },
};

function Info({ bindings, restore }: { bindings: InfoBindings; restore: () => void }) {
  const bridge = useBridge();
  const options = [
    bindings.withClave && { id: 'conClave', ...bindings.withClave },
    bindings.withoutClave && { id: 'sinClave', ...bindings.withoutClave },
  ].filter((o) => !!o);

  return (
    <Panel
      title="Lee los requisitos y elige cómo continuar"
      lead={
        bindings.tramiteName ? (
          <p>
            Trámite: <strong className="font-semibold text-ink">{bindings.tramiteName}</strong>
          </p>
        ) : null
      }
      progress={<ProgressSteps steps={STEPS} current="info" outOfScopeFrom={OUT_OF_SCOPE_FROM} />}
    >
      <Callout tone="warning" title="Primero, lee la información oficial del trámite">
        Más abajo, la web oficial explica la documentación, las condiciones y los avisos de este
        trámite. Léela completa antes de continuar.{' '}
        {bindings.officialInfo && (
          <LinkButton onClick={() => scrollToOfficial(bindings.officialInfo)}>
            Ir a la información oficial
          </LinkButton>
        )}
      </Callout>

      <div>
        {/* Opciones oficiales equivalentes: ninguna se destaca (DESIGN.md §3 · Botón principal). */}
        <h3
          className={
            '[font-size:20px] [line-height:1.3] [font-weight:650] [color:rgb(var(--bg-ink))]'
          }
        >
          Elige cómo continuar en la web oficial
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {options.map((option) => (
            <div key={option.id} className="flex flex-col rounded-control border border-line p-4">
              <p
                className={
                  '[font-size:17px] [line-height:1.4] font-semibold [color:rgb(var(--bg-ink))]'
                }
              >
                {option.title}
              </p>
              {option.description && (
                <p
                  className={
                    'text-sm [line-height:1.5] [color:rgb(var(--bg-ink-muted))] mt-1 flex-1'
                  }
                >
                  {option.description}
                </p>
              )}
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  if (!bridge.activate(option.id)) restore();
                }}
                className={'mt-4 w-full'}
              >
                {option.title}
                <span aria-hidden="true">→</span>
              </Button>
            </div>
          ))}
        </div>
        {bindings.claveInfoLink && (
          <p className="mt-3 text-[15px]">
            <ExternalLink href={bindings.claveInfoLink.href}>
              {bindings.claveInfoLink.text || 'Más información sobre Cl@ve'}
            </ExternalLink>
          </p>
        )}
      </div>

      <Callout tone="neutral" title="Aquí termina la ayuda de Reforma Digital">
        A partir de aquí (tus datos, la disponibilidad y la reserva) todo ocurre en la web oficial
        sin cambios. La extensión no rellena formularios, no busca citas ni entra en páginas con
        identificación.
      </Callout>

      {bindings.back && (
        <div className="border-t border-line pt-5">
          <SecondaryAction onClick={() => bridge.activate('volver')}>
            Volver a elegir trámite
          </SecondaryAction>
        </div>
      )}
    </Panel>
  );
}

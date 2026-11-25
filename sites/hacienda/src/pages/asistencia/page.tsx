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
  SectionTitle,
} from '@reforma-digital/design';
import { pageClassName } from '../../styles/theme';
import { aeatLayout } from '../../components/panels';
import { OUT_OF_SCOPE_FROM, STEPS } from '../../components/steps';
import { asistenciaBindings, type AsistenciaBindings } from './bindings';

const SEDE = 'https://sede.agenciatributaria.gob.es';

export const asistenciaPage: SitePage = {
  id: 'asistencia',
  matches: (url) => url.origin === SEDE && url.pathname === '/Sede/procedimientoini/GC29.shtml',
  prepare(document, _url, restore) {
    const bindings = asistenciaBindings(document);
    if (!bindings) return null;
    const bridge = new DomBridge(
      {},
      {
        ...Object.fromEntries(
          bindings.options.map((o, i) => [`gestion${i}`, { element: o.element, label: o.label }]),
        ),
        catalogo: { element: bindings.catalogo, label: 'Catálogo de servicios de asistencia' },
      },
      { onIssue: restore },
    );
    return {
      bridge,
      title: 'Asistencia y Cita',
      description: 'Agencia Tributaria · Tipo de cita',
      page: 'asistencia',
      pageClassName,
      slots: [],
      ...aeatLayout(bindings.title, bindings.description, bridge, () => (
        <Asistencia bindings={bindings} restore={restore} />
      )),
      health: () =>
        bindings.catalogo.isConnected && bindings.options.every((o) => o.element.isConnected),
    };
  },
};

const ACCESS: Record<'SinCert' | 'Cert', string> = {
  SinCert: 'Sin certificado electrónico. La web oficial te pedirá NIF y nombre.',
  Cert: 'Con certificado electrónico.',
};

function Asistencia({ bindings, restore }: { bindings: AsistenciaBindings; restore: () => void }) {
  const bridge = useBridge();
  const go = (id: string) => {
    if (!bridge.activate(id)) restore();
  };

  return (
    <Panel
      title="Pide asistencia o cita en la Agencia Tributaria"
      lead={
        <p>
          Elige para quién es la cita. Todo lo que eliges aquí continúa en la aplicación oficial de
          la Agencia Tributaria.
        </p>
      }
      progress={
        <ProgressSteps steps={STEPS} current="servicio" outOfScopeFrom={OUT_OF_SCOPE_FROM} />
      }
    >
      {bindings.notices.length > 0 && (
        <Callout tone="warning" title="La web oficial avisa">
          {bindings.notices.map((notice) => (
            <p key={notice}>{notice}</p>
          ))}
        </Callout>
      )}

      <div>
        <SectionTitle>¿Para quién es la cita?</SectionTitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {bindings.options.map((option, i) => (
            <div
              key={option.label}
              className="flex flex-col rounded-control border border-line p-4"
            >
              <p
                className={
                  '[font-size:17px] [line-height:1.4] font-semibold [color:rgb(var(--bg-ink))]'
                }
              >
                {option.label}
              </p>
              {option.access && (
                <p
                  className={
                    'text-sm [line-height:1.5] [color:rgb(var(--bg-ink-muted))] mt-1 flex-1'
                  }
                >
                  {ACCESS[option.access]}
                </p>
              )}
              <Button
                variant="outline"
                type="button"
                onClick={() => go(`gestion${i}`)}
                className={'mt-4 w-full'}
              >
                Continuar
                <span aria-hidden="true">→</span>
              </Button>
              {option.help && (
                <p className="mt-2 text-[14px]">
                  <ExternalLink href={option.help.href}>Tutorial oficial</ExternalLink>
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <Callout tone="info" title="¿No sabes qué servicio necesitas?">
        <p>
          La Agencia Tributaria publica un catálogo con todos sus servicios de asistencia y los
          canales de cada uno.
        </p>
        <div className="mt-3">
          <SecondaryAction onClick={() => go('catalogo')}>
            Ver el catálogo de servicios
          </SecondaryAction>
        </div>
      </Callout>

      {bindings.otherChannels.length > 0 && (
        <div>
          <SectionTitle>Otras vías según la web oficial</SectionTitle>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
            {bindings.otherChannels.map((channel) => (
              <li key={channel}>{channel}</li>
            ))}
          </ul>
        </div>
      )}

      <Callout tone="neutral" title="Hasta aquí llega Reforma Digital">
        La aplicación de cita pide tu NIF y tu nombre en el siguiente paso: desde ahí todo ocurre en
        la web oficial sin cambios.{' '}
        <LinkButton onClick={() => scrollToOfficial(bindings.description)}>
          Ir a la información oficial
        </LinkButton>
      </Callout>
    </Panel>
  );
}

import { DomBridge, scrollToOfficial } from '@reforma-digital/bridge';
import { useBridge } from '@reforma-digital/react';
import type { SitePage } from '@reforma-digital/registry';
import {
  Callout,
  ExternalLink,
  LinkButton,
  Panel,
  PrimaryAction,
  ProgressSteps,
  SectionTitle,
} from '@reforma-digital/design';
import { pageClassName } from '../../styles/theme';
import { communityBar, screenPanels } from '../../components/panels';
import { OUT_OF_SCOPE_FROM, STEPS } from '../../components/steps';
import { landingBindings, type LandingBindings } from './bindings';

const SEDE = 'https://sede.administracionespublicas.gob.es';

export const landingPage: SitePage = {
  id: 'landing',
  matches: (url) => url.origin === SEDE && url.pathname === '/pagina/index/directorio/icpplus',
  prepare(document, _url, restore) {
    const bindings = landingBindings(document);
    if (!bindings) return null;
    const bridge = new DomBridge(
      {},
      { acceder: { element: bindings.submit, label: 'Acceder al Procedimiento' } },
      { onIssue: restore },
    );
    return {
      bridge,
      title: 'Cita previa de Extranjería',
      description: 'Información del trámite',
      page: 'landing',
      pageClassName,
      slots: [],
      shell: communityBar(bindings.header),
      panels: screenPanels(bindings.header, bindings.content, bridge, () => (
        <Landing bindings={bindings} restore={restore} />
      )),
      health: () => bindings.submit.isConnected && bindings.header.isConnected,
    };
  },
};

function Landing({ bindings, restore }: { bindings: LandingBindings; restore: () => void }) {
  const bridge = useBridge();
  const start = () => {
    if (!bridge.activate('acceder')) restore();
  };

  return (
    <Panel
      title="Pide cita previa de Extranjería"
      lead={bindings.summary ? <p>Según la web oficial: {bindings.summary}</p> : null}
      progress={
        <ProgressSteps steps={STEPS} current="landing" outOfScopeFrom={OUT_OF_SCOPE_FROM} />
      }
    >
      <PrimaryAction
        onClick={start}
        hint={
          <>
            Usa el botón oficial «Acceder al Procedimiento» y abre{' '}
            <strong className="font-semibold text-ink">{bindings.destinationHost}</strong>, la
            aplicación oficial de cita previa.
          </>
        }
      >
        Empezar en la web oficial
      </PrimaryAction>

      <div>
        <SectionTitle>Qué vas a hacer en la web oficial</SectionTitle>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            'Elegir la provincia donde quieres la cita.',
            'Elegir la oficina y el trámite de la lista que ofrece esa provincia.',
            'Leer la información oficial del trámite y elegir si continúas con Cl@ve o sin Cl@ve.',
            'Introducir tus datos y consultar disponibilidad, solo en la web oficial.',
          ].map((text, i) => (
            <li key={text} className="flex gap-3 rounded-control border border-line p-3 text-15">
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-13 font-bold text-brand-700"
              >
                {i + 1}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </div>

      {bindings.whoRequests.length > 0 && (
        <div>
          <SectionTitle>Quién debe pedir la cita</SectionTitle>
          <p className={'text-sm leading-normal text-ink-muted mt-1'}>
            Resumen de las «Instrucciones del procedimiento» de la página oficial.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {bindings.whoRequests.map((item) => (
              <li
                key={item.title + item.text}
                className="rounded-control border border-line p-3 text-15"
              >
                {item.title && <p className="font-semibold">{item.title}</p>}
                <p className="text-ink-muted">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bindings.responsible.length > 0 && (
        <div>
          <SectionTitle>Quién atiende la cita</SectionTitle>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-15">
            {bindings.responsible.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <Callout tone="info" title="Antes de empezar">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Reforma Digital no busca, reserva ni garantiza citas. La disponibilidad depende solo de
            la web oficial.
          </li>
          <li>
            Debajo sigue el texto oficial completo, con el aviso de protección de datos.{' '}
            <LinkButton onClick={() => scrollToOfficial(bindings.content)}>
              Ir al texto oficial
            </LinkButton>
          </li>
          {bindings.technicalRequirements && (
            <li>
              La web oficial pide cumplir sus{' '}
              <ExternalLink href={bindings.technicalRequirements.href}>
                {bindings.technicalRequirements.text || 'requisitos técnicos'}
              </ExternalLink>
              .
            </li>
          )}
        </ul>
      </Callout>
    </Panel>
  );
}

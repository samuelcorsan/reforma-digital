import { RadioGroup } from '@reforma-digital/design/ui/radio-group';
import { useId, useMemo, useState } from 'react';
import { DomBridge, scrollToOfficial } from '@reforma-digital/bridge';
import { useBoundField, useBridge, useDomValue } from '@reforma-digital/react';
import type { SitePage } from '@reforma-digital/registry';
import {
  Actions,
  Callout,
  Choice,
  ExternalLink,
  LinkButton,
  Panel,
  PrimaryAction,
  ProgressSteps,
  SearchField,
  SecondaryAction,
} from '@reforma-digital/design';
import { pageClassName } from '../../styles/theme';
import { icpScreen, readVisibleErrors } from '../../components/official';
import { communityBar, screenPanels } from '../../components/panels';
import { matchesQuery } from '../../components/search';
import { OUT_OF_SCOPE_FROM, STEPS } from '../../components/steps';
import { PROVINCIAS_ERROR, provinciasBindings, type ProvinciasBindings } from './bindings';

export const provinciasPage: SitePage = {
  id: 'provincias',
  matches: (url) => ['', 'index.html'].includes(icpScreen(url) ?? '-'),
  prepare(document, _url, restore) {
    const bindings = provinciasBindings(document);
    if (!bindings) return null;
    const bridge = new DomBridge(
      { provincia: { element: bindings.select, label: 'Provincia' } },
      {
        aceptar: { element: bindings.accept, label: 'Aceptar' },
        ...(bindings.back ? { volver: { element: bindings.back, label: 'Volver' } } : {}),
      },
      { onIssue: restore },
    );
    return {
      bridge,
      title: 'Cita previa de Extranjería',
      description: 'Selección de provincia',
      page: 'provincias',
      pageClassName,
      slots: [],
      shell: communityBar(bindings.header),
      panels: screenPanels(bindings.header, bindings.content, bridge, () => (
        <Provincias bindings={bindings} restore={restore} />
      )),
      health: () => bindings.select.isConnected && bindings.accept.isConnected,
    };
  },
};

function Provincias({ bindings, restore }: { bindings: ProvinciasBindings; restore: () => void }) {
  const bridge = useBridge();
  const field = useBoundField('provincia');
  const doc = bindings.select.ownerDocument;
  const [query, setQuery] = useState('');
  const searchId = useId();
  const legendId = useId();

  const provinces = field.options.filter((option) => option.value && !option.disabled);
  const officialErrors = useDomValue(bindings.select.form ?? doc.body, () =>
    readVisibleErrors(doc, [PROVINCIAS_ERROR]),
  );
  const filtered = useMemo(
    () => provinces.filter((p) => matchesQuery(p.label, query)),
    [provinces, query],
  );
  const selectedLabel = provinces.find((p) => p.value === field.value)?.label;

  const choose = (value: string) => {
    if (!bridge.setValue('provincia', value)) restore();
  };
  const next = () => {
    if (!bridge.activate('aceptar')) restore();
  };

  return (
    <Panel
      title="Elige la provincia"
      lead={
        <p>
          Selecciona la provincia en la que quieres pedir la cita. La lista es la que ofrece la web
          oficial.
        </p>
      }
      progress={
        <ProgressSteps steps={STEPS} current="provincias" outOfScopeFrom={OUT_OF_SCOPE_FROM} />
      }
    >
      <fieldset className="space-y-3">
        <legend
          id={legendId}
          className={
            '[font-size:20px] [line-height:1.3] [font-weight:650] [color:rgb(var(--bg-ink))]'
          }
        >
          Provincias disponibles{' '}
          <span className="font-normal text-ink-subtle">({provinces.length})</span>
        </legend>
        <SearchField
          id={searchId}
          label="Buscar provincia"
          value={query}
          onChange={setQuery}
          placeholder="Ej.: Málaga, Barcelona, Illes Balears…"
        />
        <p className="sr-only" aria-live="polite">
          {filtered.length} provincias coinciden con la búsqueda
        </p>
        <RadioGroup
          name="bg-provincia"
          value={typeof field.value === 'string' ? field.value : ''}
          onValueChange={choose}
          aria-labelledby={legendId}
          className="grid max-h-[380px] grid-cols-2 gap-2 overflow-y-auto p-1 sm:grid-cols-3 lg:grid-cols-4"
        >
          {filtered.map((p) => (
            <Choice key={p.value} value={p.value}>
              {p.label}
            </Choice>
          ))}
          {filtered.length === 0 && (
            <p
              className={'text-sm [line-height:1.5] [color:rgb(var(--bg-ink-muted))] col-span-full'}
            >
              Ninguna provincia coincide con «{query}».
            </p>
          )}
        </RadioGroup>
      </fieldset>

      {officialErrors.length > 0 && (
        <Callout tone="danger" role="alert" title="La web oficial indica:">
          {officialErrors.join(' ')}
        </Callout>
      )}

      <Callout tone="warning" title="Antes de continuar, lee los avisos oficiales">
        <p>
          Están debajo de este panel.{' '}
          {bindings.notices && (
            <LinkButton onClick={() => scrollToOfficial(bindings.notices)}>
              Ir a los avisos oficiales
            </LinkButton>
          )}
        </p>
        {bindings.noticeLinks.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {bindings.noticeLinks.map((l) => (
              <li key={l.href}>
                <ExternalLink href={l.href}>{l.text}</ExternalLink>
              </li>
            ))}
          </ul>
        )}
      </Callout>

      <Actions>
        <PrimaryAction
          onClick={next}
          disabled={!selectedLabel}
          hint={
            selectedLabel
              ? 'La web oficial cargará las oficinas y trámites de esa provincia.'
              : 'Elige una provincia para continuar.'
          }
        >
          {selectedLabel ? `Continuar con ${selectedLabel}` : 'Continuar'}
        </PrimaryAction>
        {bindings.back && (
          <SecondaryAction onClick={() => bridge.activate('volver')}>Volver</SecondaryAction>
        )}
      </Actions>
    </Panel>
  );
}

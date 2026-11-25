import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from '@reforma-digital/design/ui/select';
import { RadioGroup } from '@reforma-digital/design/ui/radio-group';
import { useId, useState, useSyncExternalStore } from 'react';
import {
  DomBridge,
  isVisible,
  scrollToOfficial,
  textOf,
  type FieldSnapshot,
} from '@reforma-digital/bridge';
import { useBridge, useDomValue } from '@reforma-digital/react';
import type { SitePage } from '@reforma-digital/registry';
import {
  Actions,
  Callout,
  Choice,
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
import {
  EMPTY,
  PROVINCE_MESSAGES,
  SUB_TRAMITES,
  TRAMITE_ERRORS,
  TRAMITE_MESSAGES,
  tramitesBindings,
  type TramitesBindings,
} from './bindings';

const group = (index: number) => `grupo${index}`;

export const tramitesPage: SitePage = {
  id: 'tramites',
  matches: (url) => ['citar', 'selectSede'].includes(icpScreen(url) ?? ''),
  prepare(document, _url, restore) {
    const bindings = tramitesBindings(document);
    if (!bindings) return null;
    const bridge = new DomBridge(
      {
        oficina: { element: bindings.office, label: 'Oficina' },
        ...Object.fromEntries(
          bindings.groups.map((g, i) => [group(i), { element: g.select, label: g.label }]),
        ),
      },
      {
        aceptar: { element: bindings.accept, label: 'Aceptar' },
        ...(bindings.back ? { volver: { element: bindings.back, label: 'Volver' } } : {}),
      },
      { onIssue: restore },
    );
    return {
      bridge,
      title: 'Cita previa de Extranjería',
      description: 'Selección de oficina y trámite',
      page: 'tramites',
      pageClassName,
      slots: [],
      shell: communityBar(bindings.header),
      panels: screenPanels(bindings.header, bindings.content, bridge, () => (
        <Tramites bindings={bindings} restore={restore} />
      )),
      health: () => bindings.form.isConnected && bindings.accept.isConnected,
    };
  },
};

function Tramites({ bindings, restore }: { bindings: TramitesBindings; restore: () => void }) {
  const bridge = useBridge();
  useSyncExternalStore(bridge.subscribe, bridge.getRevision);
  const doc = bindings.form.ownerDocument;
  const office = bridge.getField('oficina');
  const [query, setQuery] = useState('');
  const officeId = useId();
  const officeHintId = useId();
  const searchId = useId();

  // Solo puede haber un trámite elegido: la web oficial vacía el resto de grupos al cambiar uno.
  const groups = bindings.groups.map((g, index) => ({
    ...g,
    index,
    field: bridge.getField(group(index)),
  }));
  const selected = groups.find((g) => g.field.value && g.field.value !== EMPTY);
  const selectedLabel = selected?.field.options.find(
    (o) => o.value === selected.field.value,
  )?.label;
  const total = groups.reduce((n, g) => n + tramitesOf(g.field).length, 0);

  const official = useDomValue(doc.getElementById('mainWindow') ?? doc.body, () => {
    const messages = doc.querySelector(TRAMITE_MESSAGES);
    return {
      hasTramiteMessages: !!messages && textOf(messages).length > 0,
      hasSubTramites: isVisible(doc.querySelector(SUB_TRAMITES)),
      errors: readVisibleErrors(doc, TRAMITE_ERRORS),
    };
  });

  const act = (ok: boolean) => {
    if (!ok) restore();
  };

  return (
    <Panel
      title="Elige oficina y trámite"
      lead={
        <p>
          Provincia:{' '}
          <strong className="font-semibold text-ink">{bindings.province || 'sin indicar'}</strong>.
          Las oficinas y trámites son los que ofrece la web oficial para esta provincia.
        </p>
      }
      progress={
        <ProgressSteps steps={STEPS} current="tramites" outOfScopeFrom={OUT_OF_SCOPE_FROM} />
      }
    >
      <Callout tone="warning" title="La web oficial pide leer toda la información de esta página">
        Incluye avisos de la provincia más abajo.{' '}
        <LinkButton onClick={() => scrollToOfficial(doc.querySelector(PROVINCE_MESSAGES))}>
          Ir a la información de la provincia
        </LinkButton>
      </Callout>

      <div>
        <label htmlFor={officeId} className={'text-20 leading-1.3 font-650 text-ink mb-1 block'}>
          Oficina
        </label>
        {bindings.officeHint && (
          <p id={officeHintId} className={'text-sm leading-normal text-ink-muted mb-3'}>
            Según la web oficial: {bindings.officeHint}
          </p>
        )}
        {/* Cambiar de oficina envía el formulario oficial: la web recarga la página. */}
        <Select
          value={typeof office.value === 'string' ? office.value : ''}
          items={office.options}
          onValueChange={(value) => {
            if (value !== null) act(bridge.setValue('oficina', value));
          }}
        >
          <SelectTrigger
            id={officeId}
            aria-describedby={bindings.officeHint ? officeHintId : undefined}
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groupOptions(office).map(({ label, options }, index) => (
              <SelectGroup key={label ?? index}>
                {label && <SelectLabel>{label}</SelectLabel>}
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <p className={'text-sm leading-normal text-ink-muted mt-2'}>
          Al cambiar de oficina, la web oficial recarga la página y puede mostrar trámites
          distintos.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className={'text-20 leading-1.3 font-650 text-ink'}>
          Trámite <span className="font-normal text-ink-subtle">({total} disponibles)</span>
        </legend>
        <p className={'text-sm leading-normal text-ink-muted'}>
          Agrupados por el organismo que los atiende, igual que en la web oficial.
        </p>
        <SearchField
          id={searchId}
          label="Buscar trámite"
          value={query}
          onChange={setQuery}
          placeholder="Ej.: huellas, NIE, certificado, arraigo…"
        />
        <RadioGroup
          className="space-y-5 pt-1"
          name="bg-tramite"
          value={selected ? `${selected.index}:${selected.field.value}` : ''}
          onValueChange={(value) => {
            const [index, ...parts] = value.split(':');
            act(bridge.setValue(group(Number(index)), parts.join(':')));
          }}
          aria-label="Trámite"
        >
          {groups.map((g) => {
            const options = tramitesOf(g.field).filter((o) => matchesQuery(o.label, query));
            return (
              <div key={g.select.id} role="group" aria-label={g.label}>
                <h4
                  className={
                    'text-xs leading-1.4 font-semibold tracking-eyebrow uppercase text-ink-subtle mb-2'
                  }
                >
                  {g.label} · {options.length}
                </h4>
                <ul className="max-h-[360px] space-y-2 overflow-y-auto p-1">
                  {options.map((o) => (
                    <li key={o.value}>
                      <Choice value={`${g.index}:${o.value}`}>{o.label}</Choice>
                    </li>
                  ))}
                  {options.length === 0 && (
                    <li className={'text-sm leading-normal text-ink-muted px-1'}>
                      {query
                        ? 'Ningún trámite de este grupo coincide con la búsqueda.'
                        : 'Este grupo no tiene trámites disponibles.'}
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </RadioGroup>
      </fieldset>

      {official.hasTramiteMessages && (
        <Callout tone="info" title="La web oficial muestra información sobre este trámite">
          <LinkButton onClick={() => scrollToOfficial(doc.querySelector(TRAMITE_MESSAGES))}>
            Leer la información oficial del trámite
          </LinkButton>
        </Callout>
      )}
      {official.hasSubTramites && (
        <Callout tone="warning" title="Este trámite tiene opciones adicionales">
          Elige una en el formulario oficial («Más trámites en la provincia seleccionada»).{' '}
          <LinkButton onClick={() => scrollToOfficial(doc.querySelector(SUB_TRAMITES))}>
            Ir al formulario oficial
          </LinkButton>
        </Callout>
      )}
      {official.errors.length > 0 && (
        <Callout tone="danger" role="alert" title="La web oficial indica:">
          {official.errors.join(' ')}
        </Callout>
      )}

      <Actions>
        <PrimaryAction
          onClick={() => act(bridge.activate('aceptar'))}
          disabled={!selectedLabel}
          hint={
            selectedLabel ? (
              <>
                Elegido: {selectedLabel}. La web oficial mostrará su información antes de pedir
                datos.
              </>
            ) : (
              'Elige un trámite para continuar.'
            )
          }
        >
          Continuar
        </PrimaryAction>
        {bindings.back && (
          <SecondaryAction onClick={() => bridge.activate('volver')}>Volver</SecondaryAction>
        )}
      </Actions>
    </Panel>
  );
}

function tramitesOf(field: FieldSnapshot) {
  return field.options.filter((o) => o.value && o.value !== EMPTY && !o.disabled);
}

function groupOptions(field: FieldSnapshot) {
  const out: { label: string | null; options: FieldSnapshot['options'][number][] }[] = [];
  for (const option of field.options) {
    const last = out.at(-1);
    if (last && last.label === option.group) last.options.push(option);
    else out.push({ label: option.group, options: [option] });
  }
  return out;
}

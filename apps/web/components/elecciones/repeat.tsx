import { deputyName, getElections, getIndex, read, slug } from '../../lib/congreso/data';
import { balanceSchema } from '../../lib/congreso/schema';
import { shortDate, thousands, toDay } from '../../lib/elecciones/format';
import { Empty, href } from '../congreso/common';
import { Relevos, type Departure, type RelevoSeat } from './relevos';
import { Cell, Grid, ReportIntro, SectionHeading } from './report';

const longDate = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const dateOf = (iso: string) => new Date(`${iso}T00:00:00Z`);

// «¿Repite?»: hasta que se publiquen las listas, cuánto falta y los relevos de la legislatura
// (quién dejó el escaño y quién entró por la lista). Estructura de Escaño Abierto.
export async function Repeat() {
  const [election, source, index] = await Promise.all([
    getElections(),
    read('elecciones/elecciones.json', balanceSchema),
    getIndex(),
  ]);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const lists = election.calendario.find((m) => m.hito.startsWith('Listas presentadas'));
  const proclaimed = election.calendario.find((m) => m.hito.startsWith('Proclamación'));
  const left = lists ? toDay(lists.fecha) - toDay(today) : 0;

  // Cada escaño con la cadena de quienes lo ocuparon: se siguen los relevos hasta quien lo ocupa hoy.
  const byName = new Map(index.diputados.map((d) => [d.nombre, d]));
  const next = new Map(source.relevos.salidas.map(([out, entry]) => [out, entry]));
  const holder = (name: string) => {
    let current = name;
    for (let k = 0; k < 10 && next.has(current); k++) current = next.get(current) ?? current;
    return byName.get(current);
  };
  const groupOf = (group: string) => index.grupos[group];
  const chains = new Map<string, { name: string; from: string; to: string }[]>();
  const seatOf = new Map<string, string>();
  for (const d of index.diputados)
    if (!d.baja && d.x !== null && d.y !== null)
      chains.set(`${d.x}|${d.y}`, [{ name: d.nombre, from: d.alta, to: '' }]);
  for (const [out] of source.relevos.salidas) {
    const last = holder(out);
    if (!last || last.x === null || last.y === null) continue;
    const key = `${last.x}|${last.y}`;
    seatOf.set(out, key);
    const chain = chains.get(key) ?? [];
    const person = byName.get(out);
    if (!chain.some((p) => p.name === out))
      chain.push({ name: out, from: person?.alta ?? '', to: person?.baja ?? '' });
    chains.set(key, chain);
  }
  const when = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? shortDate(iso) : '');
  const seats: RelevoSeat[] = [...chains].map(([key, chain]) => {
    chain.sort((a, b) => a.from.localeCompare(b.from));
    const [x = '0', y = '0'] = key.split('|');
    const current = byName.get(chain.at(-1)?.name ?? '');
    const group = groupOf(current?.grupo ?? '');
    return {
      key,
      x: Number(x),
      y: Number(y),
      color: group?.color ?? '#8A8F98',
      changed: chain.length > 1,
      title: `${current?.provincia ?? ''} · ${group?.nombre ?? current?.grupo ?? ''}`,
      chain: chain
        .map((p) => `${deputyName(p.name)} (${when(p.from)} – ${p.to ? when(p.to) : 'hoy'})`)
        .join(' → '),
      href: href(`diputado/${slug(current?.nombre ?? '')}`),
    };
  });
  const xs = seats.map((s) => s.x);
  const ys = seats.map((s) => s.y);
  const box = `${Math.min(...xs) - 7} ${Math.min(...ys) - 7} ${Math.max(...xs) - Math.min(...xs) + 14} ${Math.max(...ys) - Math.min(...ys) + 14}`;

  const person = (name: string) => {
    const d = byName.get(name);
    return {
      name: deputyName(name),
      href: d ? href(`diputado/${slug(name)}`) : null,
      color: (d && groupOf(d.grupo)?.color) ?? '#8A8F98',
    };
  };
  const departures: Departure[] = source.relevos.salidas.map(
    ([out, entry, date, province, party]) => ({
      seat: seatOf.get(out) ?? null,
      date,
      out: person(out),
      in: person(entry),
      where: `${province} · ${party}`,
    }),
  );
  // Un mes por columna, del inicio de la legislatura a la disolución.
  const span: string[] = [];
  for (let m = source.balance.desde.slice(0, 7); m <= source.balance.hasta.slice(0, 7);) {
    span.push(m);
    const [y = 0, mm = 0] = m.split('-').map(Number);
    m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`;
  }

  return (
    <>
      <ReportIntro title="¿Repite?">
        <p>Quién de los 350 vuelve a ir en las listas, en qué puesto y por qué provincia.</p>
      </ReportIntro>
      <Grid>
        {source.hay.candidaturas ? (
          <Cell>
            <Empty>
              Las listas están disponibles en los conjuntos públicos de la convocatoria.
            </Empty>
          </Cell>
        ) : (
          <Cell className="sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8">
            <p className="m-0 grid gap-1">
              <b className="font-heading text-6xl leading-none font-normal tabular-nums">
                {left > 0 ? left : lists ? shortDate(lists.fecha) : '—'}
              </b>
              <span className="text-sm text-muted-foreground">
                {left > 1
                  ? 'días para las listas'
                  : left === 1
                    ? 'día para las listas'
                    : 'las listas, en el BOE'}
              </span>
            </p>
            <div className="grid gap-2">
              <h2 className="m-0 font-heading text-2xl leading-tight font-normal">
                Las listas aún no se conocen
              </h2>
              <p className="m-0 max-w-[75ch] text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
                Las candidaturas presentadas se publican en el BOE el{' '}
                <b>{lists ? longDate.format(dateOf(lists.fecha)) : '—'}</b>; las Juntas Electorales
                las proclaman el{' '}
                <b>{proclaimed ? longDate.format(dateOf(proclaimed.fecha)) : '—'}</b> y el BOE las
                publica al día siguiente. Ese día, aquí: quién de los 350 vuelve a ir en una lista,
                en qué puesto y si es de salida, quién cambia de provincia o de siglas y quién no se
                presenta.
              </p>
            </div>
          </Cell>
        )}
      </Grid>
      <section className="mt-16 grid gap-6">
        <SectionHeading title="Antes de las listas: los relevos">
          En los 350 escaños de la XV legislatura se han sentado{' '}
          {thousands(source.relevos.personas)} personas: {source.relevos.salidas.length} diputados
          dejaron el escaño y entró el siguiente de su lista.
        </SectionHeading>
        <Grid>
          <Relevos seats={seats} box={box} departures={departures} span={span} />
        </Grid>
      </section>
    </>
  );
}

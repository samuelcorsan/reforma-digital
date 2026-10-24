import Link from 'next/link';
import { cn } from '@reforma-digital/design/lib/utils';
import { buttonVariants } from '@reforma-digital/design/ui/button';
import { getGeography } from '../../lib/congreso/data';
import { formatDate, percent, thousands } from '../../lib/elecciones/format';
import { electionsHref } from '../../lib/elecciones/pages';
import { shortParty } from '../../lib/elecciones/parties';
import { Icon } from '../brand/icon';
import { electionData } from './election-data';
import { Hemicycle, ProvinceSection } from './province-section';
import { ProvinceTable } from './province-table';
import { Cell, Grid, Label, Legend, ReportIntro, SectionHeading, Stat } from './report';
import { River, type RiverElection } from './river';
import { Tips } from './tips';
import { Years } from './years';

const milestones: [string, string][] = [
  ['197706', 'Cortes constituyentes'],
  ['198210', 'Mayoría absoluta del PSOE'],
  ['199603', 'Primer Gobierno del PP'],
  ['201111', 'Mayoría absoluta del PP'],
  ['201512', 'Fin del bipartidismo'],
  ['201904', 'Entra Vox'],
];

// «Elecciones desde 1977»: la elección elegida (`?eleccion=AAAAMM`, la última si no hay) en su
// hemiciclo, los 350 escaños legislatura a legislatura, las 52 provincias en un mapa, quién ganó
// cada una en cada elección y la tabla de circunscripciones. Estructura de Escaño Abierto.
export async function ElectionHistory({ election }: { election?: string }) {
  const [data, geography] = await Promise.all([electionData(election), getGeography()]);
  const { history, E, k, e, color, label, codes, name, provinceHref, winners, topName, provinces } =
    data;
  const yearHref = (x: (typeof E)[number]) => `${electionsHref('historico')}?eleccion=${x.id}`;

  const { withSeats, largest, majority, legislature, president } = data;

  // El río: cada familia, con el nombre de su candidatura más votada en cada elección.
  const river: RiverElection[] = E.map((x) => ({
    id: x.id,
    href: yearHref(x),
    short: label(x),
    long: formatDate(x.fecha, { month: 'long', year: 'numeric' }),
    start: x.fecha,
    end: x.hasta,
    valid: x.validos,
    fam: x.fam,
    names: Object.fromEntries(history.familias.map((f) => [f.id, topName(x, f.id)])),
  }));

  // Elección a elección: las provincias de cada comunidad, con su ganador en cada elección.
  const regions = Object.values(geography.ccaa).map((c) => ({
    name: c.n,
    codes: c.provincias.filter((code) => codes.includes(code)),
  }));
  const legend = new Map<string, string[]>();
  for (const w of winners.flat()) {
    if (!w) continue;
    const names = legend.get(w.color) ?? [];
    if (!names.includes(w.brand)) legend.set(w.color, [...names, w.brand]);
  }

  return (
    <>
      <ReportIntro title="Elecciones desde 1977">
        <p>
          Las {E.length} generales y sus {codes.length} provincias: el hemiciclo de cada una, quién
          ganó dónde y cómo ha cambiado cada circunscripción.
        </p>
      </ReportIntro>
      <Years
        current={e.id}
        items={E.map((x) => ({ id: x.id, label: label(x), href: yearHref(x) }))}
      />
      <Grid>
        <Cell span={7}>
          <Hemicycle data={data} limit={8} caption={label(e)} />
        </Cell>
        <Cell span={5}>
          <Label>
            {formatDate(e.fecha, { day: 'numeric', month: 'long', year: 'numeric' })} ·{' '}
            {legislature}
          </Label>
          <div className="grid gap-1">
            <p className="m-0 text-sm text-muted-foreground">Presidencia</p>
            <p className="m-0 text-lg font-medium">{president}</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-4">
            <Stat value={percent(e.votantes / e.censo)} caption="participación" />
            <Stat value={withSeats.length} caption="candidaturas con escaño" />
            <Stat
              value={majority ? 'Sí' : 'No'}
              caption={`mayoría absoluta${majority && largest ? ` (${shortParty(largest[0])})` : ''}`}
            />
          </div>
          <ul className="relative m-0 grid list-none gap-1.5 p-0 text-sm">
            {withSeats.slice(0, 7).map(([s, full, f, v, n]) => (
              <li
                key={s}
                title={full}
                className="grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_2.5rem_3.5rem] items-center gap-2"
              >
                <span className="font-medium break-words">{shortParty(s)}</span>
                <span className="relative h-3 rounded-xs bg-muted">
                  <i
                    className="absolute inset-y-0 left-0 block rounded-xs"
                    style={{ width: `${(n / 350) * 100}%`, background: color(f) }}
                  />
                  <i
                    className="absolute -inset-y-1 block w-px border-l border-dashed border-foreground"
                    style={{ left: `${(176 / 350) * 100}%` }}
                  />
                </span>
                <b className="text-right font-mono font-medium tabular-nums">{n}</b>
                <span className="text-right font-mono text-muted-foreground tabular-nums">
                  {percent(v / e.validos)}
                </span>
              </li>
            ))}
            <li className="grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_2.5rem_3.5rem] gap-2">
              <span />
              <span className="relative h-5">
                <span
                  className="absolute -translate-x-1/2 font-mono text-sm whitespace-nowrap text-muted-foreground"
                  style={{ left: `${(176 / 350) * 100}%` }}
                >
                  176 · mayoría absoluta
                </span>
              </span>
            </li>
          </ul>
          <Link
            href={electionsHref(e.id)}
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'justify-self-start')}
          >
            La elección y su legislatura, en detalle <Icon name="derecha" size={16} />
          </Link>
        </Cell>
      </Grid>

      <section className="mt-16 grid gap-6">
        <SectionHeading title="Los 350 escaños, legislatura a legislatura">
          Cada familia en su sitio, de 1977 a la disolución de {E.at(-1)?.hasta.slice(0, 4)}, con el
          nombre de su candidatura más votada en cada elección. Pulsa una legislatura para verla en
          toda la página.
        </SectionHeading>
        <Grid>
          <Cell>
            <River
              elections={river}
              families={history.familias.map((f) => ({ id: f.id, color: f.color }))}
              selected={k}
              milestones={milestones.flatMap(([id, text]) => {
                const j = E.findIndex((x) => x.id === id);
                return j >= 0 ? [{ index: j, text }] : [];
              })}
            />
          </Cell>
        </Grid>
      </section>

      <ProvinceSection data={data} title="Provincia a provincia">
        Las {codes.length} circunscripciones en {label(e)}. Pulsa una provincia para ver su
        resultado.
      </ProvinceSection>

      <section className="mt-16 grid gap-6">
        <SectionHeading title="Elección a elección">
          Quién ganó cada provincia en las {E.length} generales. Pulsa un año para verlo arriba;
          pulsa una provincia para abrir su ficha.
        </SectionHeading>
        <Grid>
          <Cell>
            <div className="overflow-x-auto">
              <Tips>
                <table className="w-full min-w-[40rem] table-fixed border-separate border-spacing-0.5 text-sm">
                  <thead>
                    <tr>
                      <th className="w-36" />
                      {E.map((x, j) => (
                        <th key={x.id} className="p-0 font-normal">
                          <Link
                            href={yearHref(x)}
                            scroll={false}
                            aria-current={j === k ? 'page' : undefined}
                            title={formatDate(x.fecha, { month: 'long', year: 'numeric' })}
                            className={cn(
                              buttonVariants({
                                variant: j === k ? 'default' : 'ghost',
                                size: 'xs',
                              }),
                              'w-full',
                            )}
                          >
                            ’{label(x).slice(2, 4)}
                            {label(x).length > 4 ? label(x)[5] : ''}
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {regions.map((r) => (
                    <tbody key={r.name}>
                      <tr>
                        <th
                          colSpan={E.length + 1}
                          className="pt-3 pb-1 text-left font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase"
                        >
                          {r.name}
                        </th>
                      </tr>
                      {r.codes.map((code) => {
                        const i = codes.indexOf(code);
                        return (
                          <tr key={code}>
                            <th className="pr-3 text-left font-normal whitespace-nowrap">
                              <Link
                                href={provinceHref(code)}
                                className="hover:underline underline-offset-4"
                              >
                                {name(code)}
                              </Link>
                            </th>
                            {E.map((x, j) => {
                              const w = winners[i]?.[j];
                              const p = x.prov[code];
                              return (
                                <td
                                  key={x.id}
                                  className={cn(
                                    'h-5 min-w-6 rounded-xs p-0',
                                    j === k && 'outline-1 outline-foreground',
                                  )}
                                  style={{ background: w?.color ?? 'transparent' }}
                                  data-tip={w ? `${name(code)} · ${label(x)}` : undefined}
                                  data-tip-text={
                                    w && p
                                      ? `Ganó ${w.name} con el ${percent(w.share)} de los votos; ${w.seats} de ${p.e} ${p.e === 1 ? 'escaño' : 'escaños'}.`
                                      : undefined
                                  }
                                  data-tip-color={w?.color}
                                />
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </table>
              </Tips>
            </div>
            <Legend
              small
              items={[...legend].map(([c, names]) => ({ label: names.join(' · '), color: c }))}
            />
          </Cell>
        </Grid>
      </section>

      <section className="mt-16 grid gap-6">
        <ProvinceTable
          key={e.id}
          year={label(e)}
          selected={k}
          rows={provinces.map((p) => ({
            code: p.code,
            name: p.name,
            href: p.href,
            seats: p.seats,
            seatsHistory: E.map((x) => x.prov[p.code]?.e ?? null),
            turnout: p.turnout,
            price: p.price,
            winner: p.winner ? { name: p.winner.name, color: p.winner.color } : null,
            margin: p.last?.missing ?? null,
          }))}
        />
        <p className="m-0 max-w-[65ch] text-sm text-muted-foreground">
          Fuente: Ministerio del Interior, resultados oficiales de las elecciones al Congreso. Las
          candidaturas se agrupan con su cabecera nacional y cada una se asigna a una familia con
          reglas fijas, iguales para las {E.length} elecciones. Votos válidos en {label(e)}:{' '}
          {thousands(e.validos)}.
        </p>
      </section>
    </>
  );
}

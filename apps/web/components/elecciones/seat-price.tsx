import { cn } from '@reforma-digital/design/lib/utils';
import { getHistory, getIndex, read } from '../../lib/congreso/data';
import { historicalProvinceSchema, mapSchema } from '../../lib/congreso/schema';
import { decimal, electionLabel, ramp, thousands } from '../../lib/elecciones/format';
import { realHemicycle } from '../../lib/elecciones/hemicycle';
import { electionsHref } from '../../lib/elecciones/pages';
import { CouldBe, type LastSeat } from './could-be';
import { Cell, Grid, Heading, ReportIntro, SectionHeading, Stat } from './report';
import { Tips } from './tips';
import { Years } from './years';
import { ExampleSimulator, type PriceProvince } from './simulator';
import { YourVote } from './your-vote';

// Los datos de la elección elegida; el índice del Congreso, solo para el hemiciclo, al final: si
// falta lo demás, ni se pide.
async function load(election?: string) {
  const [history, map] = await Promise.all([
    getHistory(),
    read('elecciones/geo-provincias.json', mapSchema),
  ]);
  const e = history.elecciones.find((x) => x.id === election) ?? history.elecciones.at(-1);
  if (!e) throw new Error('El histórico de elecciones está vacío');
  const detail = await read(`elecciones/historico-${e.id}.json`, historicalProvinceSchema);
  const index = await getIndex();
  return { history, map, e, detail, index };
}

// «El precio de un escaño», para cualquier elección desde 1977 (`?eleccion=AAAAMM`): cuánto vale
// un voto en cada provincia, a quién favorece la ley, el Congreso que pudo ser y el reparto D'Hondt
// de cada provincia con sus votos reales. Estructura de Escaño Abierto.
// Sin datos, la página sigue sirviendo: explica el reparto con un ejemplo.
export async function SeatPrice({ election }: { election?: string }) {
  const data = await load(election).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Error';
    console.error(
      'seat_price_unavailable',
      message.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[url]').slice(0, 300),
    );
    return null;
  });
  if (!data) return <SeatPriceExample />;
  const { history, map, e, detail, index } = data;
  const label = (x: (typeof history.elecciones)[number]) =>
    electionLabel(history.elecciones, x.fecha);
  const familyColor = (id: string) => history.familias.find((f) => f.id === id)?.color ?? '#8A8F98';
  const name = (code: string) => map.provincias[code]?.corto ?? code;

  // Cada provincia: escaños, votos válidos, votos sin escaño y las candidaturas que cuentan.
  const provinces: PriceProvince[] = Object.entries(detail.prov).map(([code, p]) => ({
    code,
    name: name(code),
    seats: p.e,
    valid: p.validos,
    lost: p.sin_escano,
    parties: p.c
      .filter(([, , votes]) => votes >= p.validos * 0.005)
      .slice(0, 10)
      .map(([party, family, votes]) => [party, familyColor(family), votes]),
  }));
  const prices = provinces.map((p) => p.valid / p.seats);
  const lostShares = provinces.map((p) => p.lost / p.valid);
  const range = (xs: number[]): [number, number] => [Math.min(...xs), Math.max(...xs)];
  const ranges = { price: range(prices), lost: range(lostShares) };
  const byPrice = [...provinces].sort((a, b) => a.valid / a.seats - b.valid / b.seats);
  const cheapest = byPrice[0];
  const dearest = byPrice.at(-1);
  const lost = provinces.reduce((sum, p) => sum + p.lost, 0);

  // El último escaño de cada provincia y cuántos votos le faltaron al segundo.
  const lastSeats: LastSeat[] = Object.entries(detail.prov)
    .flatMap(([code, p]) => {
      const u = p.ultimo;
      if (!u) return [];
      const family = (party: string) => p.c.find(([n]) => n === party)?.[1] ?? 'OTROS';
      return [
        {
          code,
          name: name(code),
          missing: u.faltan,
          from: { party: u.gana, family: family(u.gana) },
          to: { party: u.segundo, family: family(u.segundo) },
        },
      ];
    })
    .sort((a, b) => a.missing - b.missing);
  const families = history.familias
    .map((f) => ({ id: f.id, name: f.nombre, color: f.color, seats: e.fam[f.id]?.[1] ?? 0 }))
    .filter(
      (f) => f.seats || lastSeats.some((s) => s.from.family === f.id || s.to.family === f.id),
    );
  const hemicycle = realHemicycle(index, history);

  return (
    <>
      <ReportIntro title="El precio de un escaño">
        <p>
          Cuántos votos cuesta un diputado en cada provincia, a quién favorece la ley, el último
          escaño de cada una y un simulador D&apos;Hondt con los votos reales.
        </p>
      </ReportIntro>
      <Years
        current={e.id}
        items={history.elecciones.map((x) => ({
          id: x.id,
          label: label(x),
          href: `${electionsHref('escano')}?eleccion=${x.id}`,
        }))}
      />
      <Grid>
        <YourVote
          key={e.id}
          provinces={provinces}
          initial={detail.prov['28'] ? '28' : (cheapest?.code ?? '')}
          year={label(e)}
          average={e.validos / 350}
          ranges={ranges}
          map={
            <svg
              key="mapa"
              viewBox={`0 0 ${map.ancho} ${map.alto}`}
              role="img"
              aria-label="Mapa de España con los votos por escaño de cada provincia"
              className="block h-auto w-full"
            >
              {Object.entries(map.provincias).map(([code, shape]) => {
                const p = detail.prov[code];
                if (!p) return null;
                const price = p.validos / p.e;
                const share = p.sin_escano / p.validos;
                const t = (v: number, [lo, hi]: [number, number]) => (v - lo) / (hi - lo || 1);
                return (
                  <path
                    key={code}
                    d={shape.d}
                    fill={ramp('price', t(price, ranges.price))}
                    className="stroke-background"
                    strokeWidth={0.8}
                    data-province={code}
                    data-price={ramp('price', t(price, ranges.price))}
                    data-lost={ramp('lost', t(share, ranges.lost))}
                    data-tip={shape.corto}
                    data-tip-text={`${p.e} escaños · ${thousands(price)} votos por escaño · ${Math.round(share * 100)} % de votos sin escaño`}
                  />
                );
              })}
              <path d={map.canarias} fill="none" className="stroke-border" strokeWidth={0.8} />
            </svg>
          }
          kpis={
            <>
              {cheapest && (
                <Cell span={3}>
                  <Stat
                    value={thousands(cheapest.valid / cheapest.seats)}
                    caption={`votos por escaño en ${cheapest.name}, la más barata`}
                  />
                </Cell>
              )}
              {dearest && (
                <Cell span={3}>
                  <Stat
                    value={thousands(dearest.valid / dearest.seats)}
                    caption={`votos por escaño en ${dearest.name}, la más cara`}
                  />
                </Cell>
              )}
              <Cell span={3}>
                <Stat
                  value={`${decimal(lost / 1e6, 2)} M`}
                  caption="votos fueron a candidaturas que no sacaron escaño en su provincia"
                />
              </Cell>
              <Cell span={3}>
                <Stat
                  value={lastSeats.filter((s) => s.missing < 1000).length}
                  caption="últimos escaños decididos por menos de 1.000 votos"
                />
              </Cell>
            </>
          }
          beside={<Favours election={e} familyColor={familyColor} />}
          middle={
            <CouldBe
              key={e.id}
              seats={lastSeats}
              families={families}
              hemicycle={hemicycle}
              voters={e.votantes}
            />
          }
        />
      </Grid>
    </>
  );
}

// «Votos y escaños: a quién favorece la ley»: cada partido, sus votos en toda España frente a sus
// escaños; la diagonal es el reparto proporcional (escalas de raíz, para que sea recta).
function Favours({
  election: e,
  familyColor,
}: {
  election: Awaited<ReturnType<typeof getHistory>>['elecciones'][number];
  familyColor: (id: string) => string;
}) {
  const W = 520;
  const H = 400;
  const m = { l: 44, r: 16, t: 14, b: 34 };
  const parties = e.partidos.filter(([, , , votes, seats]) => votes >= e.validos * 0.003 || seats);
  const proportional = (votes: number) => (votes / e.validos) * 350;
  const maxV = Math.max(...parties.map(([, , , v]) => v));
  const maxS = Math.max(...parties.map(([, , , v, s]) => Math.max(s, proportional(v))));
  const x = (v: number) => m.l + Math.sqrt(v / maxV) * (W - m.l - m.r);
  const y = (s: number) => H - m.b - Math.sqrt(s / maxS) * (H - m.t - m.b);
  const ticksV = [1e5, 5e5, 1e6, 2e6, 4e6, 8e6].filter((v) => v <= maxV * 1.02);
  const ticksS = [1, 5, 10, 25, 50, 100, 150].filter((s) => s <= maxS * 1.02);
  const end = Math.min(maxV, (maxS * e.validos) / 350);
  // Rótulos sin pisarse: cada uno, en el primer hueco libre alrededor de su bola.
  const taken = parties.map(([, , , v, s]) => ({
    x0: x(v) - 7,
    x1: x(v) + 7,
    y0: y(s) - 7,
    y1: y(s) + 7,
  }));
  const spots: [number, number, 'middle' | 'start' | 'end'][] = [
    [0, -11, 'middle'],
    [0, 20, 'middle'],
    [11, 4, 'start'],
    [-11, 4, 'end'],
    [7, -10, 'start'],
    [-7, -10, 'end'],
    [0, -25, 'middle'],
    [0, 34, 'middle'],
  ];
  const labels = parties
    .filter(([, , , v, s]) => s >= 2 || v > e.validos * 0.03)
    .sort((a, b) => b[3] - a[3])
    .map(([short, , , v, s]) => {
      const cx = x(v);
      const cy = y(s);
      const w = short.length * 6.8 + 6;
      const box = ([dx, dy, anchor]: (typeof spots)[number]) => {
        const x0 =
          anchor === 'middle' ? cx + dx - w / 2 : anchor === 'start' ? cx + dx : cx + dx - w;
        return { x0, x1: x0 + w, y0: cy + dy - 11, y1: cy + dy + 3 };
      };
      const free =
        spots.find((o) => {
          const b = box(o);
          return (
            b.x0 > 2 &&
            b.x1 < W - 2 &&
            taken.every((k) => b.x1 < k.x0 || b.x0 > k.x1 || b.y1 < k.y0 || b.y0 > k.y1)
          );
        }) ?? spots[0];
      if (free) taken.push(box(free));
      return {
        short,
        x: cx + (free?.[0] ?? 0),
        y: cy + (free?.[1] ?? 0),
        anchor: free?.[2] ?? 'middle',
      };
    });
  const balance = parties
    .map((p) => ({ p, s: Math.round(p[4] - proportional(p[3])) }))
    .filter(({ s }) => s)
    .sort((a, b) => b.s - a.s);
  const moved = balance.reduce((sum, { s }) => sum + Math.max(0, s), 0);

  return (
    <Cell span={6}>
      <Heading title="Votos y escaños: a quién favorece la ley">
        Cada bola es un partido: sus votos en toda España y los escaños que sacó. La diagonal marca
        lo que le tocaría con un reparto proporcional: por encima, la ley le da más escaños que su
        parte de los votos; por debajo, menos.
      </Heading>
      {/* En pantallas estrechas se desplaza: así los rótulos no bajan de 12 px. */}
      <div className="overflow-x-auto">
        <Tips className="min-w-[520px]">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Votos y escaños de cada partido frente al reparto proporcional"
            className="block h-auto w-full overflow-visible"
          >
            <g className="fill-muted-foreground stroke-border font-mono text-xs">
              {ticksV.map((v) => (
                <g key={v}>
                  <line x1={x(v)} x2={x(v)} y1={m.t} y2={H - m.b} />
                  <text x={x(v)} y={H - m.b + 16} textAnchor="middle" stroke="none">
                    {v >= 1e6 ? `${decimal(v / 1e6, 0)} M` : `${thousands(v / 1000)} mil`}
                  </text>
                </g>
              ))}
              {ticksS.map((s) => (
                <g key={s}>
                  <line x1={m.l} x2={W - m.r} y1={y(s)} y2={y(s)} />
                  <text x={m.l - 6} y={y(s) + 4} textAnchor="end" stroke="none">
                    {s}
                  </text>
                </g>
              ))}
              <text x={W - m.r} y={H - 2} textAnchor="end" stroke="none">
                votos →
              </text>
              <text x={m.l - 6} y={m.t - 2} textAnchor="end" stroke="none">
                escaños
              </text>
            </g>
            <line
              x1={x(0)}
              y1={y(0)}
              x2={x(end)}
              y2={y((end / e.validos) * 350)}
              className="stroke-muted-foreground"
              strokeDasharray="4 4"
            />
            <text
              x={x(end * 0.55)}
              y={y((end * 0.55 * 350) / e.validos) + 16}
              className="fill-muted-foreground text-xs"
            >
              reparto proporcional
            </text>
            {parties.map(([short, full, family, v, s]) => (
              <circle
                key={`${short}-${full}`}
                cx={x(v)}
                cy={y(s)}
                r={7}
                fill={familyColor(family)}
                className="stroke-background"
                strokeWidth={1.5}
                data-tip={full}
                data-tip-text={`${thousands(v)} votos · ${s} ${s === 1 ? 'escaño' : 'escaños'}; con un reparto proporcional, ${decimal(proportional(v))}`}
                data-tip-color={familyColor(family)}
              />
            ))}
            {labels.map((l) => (
              <text
                key={l.short}
                x={l.x}
                y={l.y}
                textAnchor={l.anchor}
                className="pointer-events-none fill-foreground text-xs font-medium"
              >
                {l.short}
              </text>
            ))}
          </svg>
        </Tips>
      </div>
      <div className="grid gap-2 border-t border-border pt-4">
        <p className="m-0 text-sm text-muted-foreground">
          Frente a un reparto proporcional, la ley mueve{' '}
          <b className="font-medium text-foreground">{moved}</b> escaños. Cada cuadrado es uno.
        </p>
        <p
          className="m-0 grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase"
          aria-hidden="true"
        >
          <span />
          <span className="text-right">Le quita</span>
          <span>Le da</span>
        </p>
        <Tips>
          <ul className="m-0 grid list-none gap-1 p-0 text-sm">
            {balance.map(({ p: [short, long, family, votes, seats], s }) => (
              <li
                key={short}
                tabIndex={0}
                data-tip={long}
                data-tip-text={`Sacó ${seats} ${seats === 1 ? 'escaño' : 'escaños'}; con un reparto proporcional, ${decimal(proportional(votes))}. ${s > 0 ? `La ley le da ${s} de más` : `La ley le quita ${-s}`}.`}
                data-tip-color={familyColor(family)}
                className="-mx-1.5 grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-center gap-2 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span>{short}</span>
                <span className="flex flex-wrap justify-end gap-0.5" aria-hidden="true">
                  {s < 0 &&
                    Array.from({ length: -s }, (_, j) => (
                      <i
                        key={j}
                        className="block size-2.5 shrink-0 rounded-xs border-[1.5px]"
                        style={{ borderColor: familyColor(family) }}
                      />
                    ))}
                </span>
                <span className="flex flex-wrap gap-0.5" aria-hidden="true">
                  {s > 0 &&
                    Array.from({ length: s }, (_, j) => (
                      <i
                        key={j}
                        className="block size-2.5 shrink-0 rounded-xs"
                        style={{ background: familyColor(family) }}
                      />
                    ))}
                </span>
                <span
                  className={cn(
                    'text-right font-mono tabular-nums',
                    s > 0 ? 'text-[#2E7D5B]' : 'text-brand',
                  )}
                >
                  {s > 0 ? '+' : '−'}
                  {Math.abs(s)}
                </span>
              </li>
            ))}
          </ul>
        </Tips>
      </div>
    </Cell>
  );
}

// Cuando no se pueden leer los resultados: el reparto D'Hondt de una provincia inventada, con el
// mismo simulador que las de verdad.
function SeatPriceExample() {
  return (
    <>
      <ReportIntro title="El precio de un escaño">
        <p>
          Cuántos votos cuesta un diputado en cada provincia, a quién favorece la ley, el último
          escaño de cada una y un simulador D&apos;Hondt con los votos reales.
        </p>
      </ReportIntro>
      <section className="grid gap-6">
        <SectionHeading title="Cómo se reparte un escaño">
          Los resultados de cada provincia no están disponibles ahora mismo. Mientras tanto, la
          regla con una provincia de ejemplo: cambia los votos y mira cómo se reparten sus escaños.
        </SectionHeading>
        <Grid>
          <ExampleSimulator
            province={{
              code: 'ejemplo',
              name: 'Una provincia de ejemplo',
              seats: 10,
              valid: 100_000,
              lost: 0,
              parties: [
                ['Candidatura A', '#2C7BC4', 50_000],
                ['Candidatura B', '#D8342B', 30_000],
                ['Candidatura C', '#5BA83A', 15_000],
                ['Candidatura D', '#C92F72', 5_000],
              ],
            }}
          />
        </Grid>
      </section>
    </>
  );
}

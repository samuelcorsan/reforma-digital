import type { ReactNode } from 'react';
import { semicircle } from '../../lib/elecciones/hemicycle';
import { shortParty } from '../../lib/elecciones/parties';
import type { ElectionData } from './election-data';
import { ProvinceMap } from './province-map';
import { Grid, Legend, SectionHeading } from './report';

// El hemiciclo de la elección, una cuña por familia, con las `limit` candidaturas con más escaños en
// la leyenda. `caption` se escribe en el centro.
export function Hemicycle({
  data,
  limit,
  caption,
  small,
}: {
  data: ElectionData;
  limit: number;
  caption?: string;
  small?: boolean;
}) {
  const { withSeats, seatColors, color } = data;
  const hemicycle = semicircle();
  return (
    <>
      <svg
        viewBox={hemicycle.box}
        role="img"
        aria-label={`Hemiciclo${caption ? ` de ${caption}` : ''}: ${withSeats.map(([s, , , , n]) => `${shortParty(s)} ${n}`).join(', ')}`}
        className="block h-auto w-full"
      >
        {hemicycle.points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={5.3} fill={seatColors[i] ?? 'var(--muted)'} />
        ))}
        {caption && (
          <text
            x={hemicycle.label.x}
            y={hemicycle.label.y}
            textAnchor="middle"
            className="fill-foreground font-heading"
            style={{ fontSize: hemicycle.label.size }}
          >
            {caption}
          </text>
        )}
      </svg>
      <Legend
        small={small}
        items={[
          ...withSeats.slice(0, limit).map(([s, , f, , n]) => ({
            label: `${shortParty(s)} ${n}`,
            color: color(f),
          })),
          ...(withSeats.length > limit
            ? [{ label: `y ${withSeats.length - limit} más`, color: 'transparent' }]
            : []),
        ]}
      />
    </>
  );
}

// «Provincia a provincia»: el mapa de la elección con sus modos y la ficha de cada provincia. El
// mapa se dibuja aquí; `ProvinceMap` lo pinta según lo que se elija.
export function ProvinceSection({
  data,
  title,
  children,
}: {
  data: ElectionData;
  title: string;
  children: ReactNode;
}) {
  const { E, k, e, map, codes, label, name, tipFor, byCode } = data;
  const previous = k > 0 ? E[k - 1] : undefined;
  return (
    <section id="provincias" className="mt-16 grid scroll-mt-28 gap-6">
      <SectionHeading title={title}>{children}</SectionHeading>
      <Grid>
        <ProvinceMap
          key={e.id}
          year={label(e)}
          previous={previous ? label(previous) : null}
          years={E.map(label)}
          provinces={data.provinces}
          parties={data.parties}
          brandColor={data.brandColor}
          centres={Object.fromEntries(codes.map((c) => [c, map.provincias[c]?.c ?? [0, 0]]))}
          size={[map.ancho, map.alto]}
          map={
            <svg
              key="mapa"
              viewBox={`0 0 ${map.ancho} ${map.alto}`}
              aria-hidden="true"
              className="block h-auto w-full"
            >
              {codes.map((code) => (
                <path
                  key={code}
                  d={map.provincias[code]?.d}
                  data-province={code}
                  data-tip={`${name(code)} · ${label(e)}`}
                  data-tip-text={tipFor(code)}
                  data-tip-color={byCode[code]?.winner?.color}
                  className="cursor-pointer fill-muted stroke-background"
                  strokeWidth={0.8}
                />
              ))}
              <path d={map.canarias} fill="none" className="stroke-border" strokeWidth={0.8} />
            </svg>
          }
        />
      </Grid>
    </section>
  );
}

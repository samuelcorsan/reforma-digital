import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { Button } from '@reforma-digital/design/sol';
import { DetailCard, DetailGrid, Question, QuestionDetail } from '@reforma-digital/design/sol/chat';
import { InfoPage } from '../../../components/sol/info-page';
import { Icon } from '../../../components/sol/icon';
import { JsonLd } from '../../../components/json-ld';
import { breadcrumbs, pageMetadata, webPage } from '../../../lib/seo';
import {
  averagePerSeat,
  bands,
  cartograma,
  provinciaDe,
  provincias,
  recuadroCanarias,
  SEATS,
  type Provincia,
} from '../../../lib/elecciones';
import { EligeProvincia } from './elige-provincia';
import { InfoDato } from './info-dato';
import { SimuladorDhondt } from './simulador-dhondt';
import { TablaProvincias } from './tabla-provincias';
import './elecciones.css';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const path = '/elecciones';
const title = '¿Cuánto vale tu voto? · Reforma Digital';
const description =
  'Cuántos escaños elige cada provincia el 29 de noviembre de 2026 y cuántos habitantes hay por escaño, con datos oficiales.';

const numero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const escanosDe = (n: number) => `${n} ${n === 1 ? 'escaño' : 'escaños'}`;
const fuentes = {
  escanos: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2026-20742',
  poblacion: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2025-25362',
  loreg: 'https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672#a162',
  dhondt: 'https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672#a163',
  resultados2023:
    'https://infoelectoral.interior.gob.es/es/elecciones-celebradas/area-de-descargas/',
};
// Ejemplos para empezar: la que más escaños elige, la que menos habitantes tiene por escaño y dos
// intermedias.
const ejemplos = ['28', '42', '08', '44'].flatMap((id) => provinciaDe(id) ?? []);
const opciones = provincias
  .map(({ id, name }) => ({ id, name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'es'));

const graph = [
  webPage({ name: title, description, path }),
  breadcrumbs('¿Cuánto vale tu voto?', path),
];

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const provincia = provinciaDe((await searchParams).provincia);
  if (!provincia) return pageMetadata({ title, description, path, og: 'portada' });
  const provinciaTitle = `${provincia.name}: ¿cuánto vale tu voto? · Reforma Digital`;
  const provinciaDescription = `${provincia.name} elige ${provincia.seats} de los ${SEATS} escaños del Congreso el 29 de noviembre de 2026: ${numero.format(provincia.perSeat)} habitantes por escaño.`;
  const url = `${path}?provincia=${provincia.id}`;
  const base = pageMetadata({
    title: provinciaTitle,
    description: provinciaDescription,
    path: url,
    og: 'portada',
  });
  const images = [
    { url: `${path}/og/${provincia.id}`, width: 1200, height: 630, alt: provinciaTitle },
  ];
  return {
    ...base,
    openGraph: { ...base.openGraph, images },
    twitter: { ...base.twitter, images },
  };
}

export default async function Elecciones({ searchParams }: Props) {
  const params = await searchParams;
  const provincia = provinciaDe(params.provincia);
  const escanos = params.vista === 'escanos';
  const href = (id: string | undefined, vistaEscanos: boolean) => {
    const query = new URLSearchParams();
    if (id) query.set('provincia', id);
    if (vistaEscanos) query.set('vista', 'escanos');
    return `${path}${query.size ? `?${query}` : ''}`;
  };

  return (
    <InfoPage>
      <JsonLd graph={graph} />
      <Question
        level={1}
        details={
          <QuestionDetail icon={<Icon name="calendario" size={16} />}>
            Generales del 29 de noviembre de 2026
          </QuestionDetail>
        }
      >
        ¿Cuánto vale tu voto?
      </Question>
      <p className="info-entradilla el-entradilla">
        Cuántos diputados elige tu provincia y cuántas personas hay detrás de cada escaño, con datos
        oficiales.
      </p>

      {/* Escritorio: el mapa a la izquierda y, a la derecha, el desplegable sobre la ficha.
          Móvil: desplegable, mapa y ficha. */}
      <section className="el-mapa" aria-labelledby="el-mapa-titulo">
        <h2 id="el-mapa-titulo" className="sr-only">
          Mapa de circunscripciones
        </h2>
        <Form action={path} scroll={false} className="el-elige">
          <label htmlFor="el-elige">Elige tu provincia</label>
          <span className="el-elige-campo">
            <Icon name="ubicacion" />
            <EligeProvincia actual={provincia?.id} opciones={opciones} />
            <Icon name="abajo" size={16} />
          </span>
          {escanos && <input type="hidden" name="vista" value="escanos" />}
          {/* Sin JavaScript el cambio no envía el formulario. */}
          <noscript>
            <Button type="submit">Ver</Button>
          </noscript>
        </Form>
        <div className="el-lienzo caja-plana">
          <div className="el-barra">
            <nav className="el-vistas" aria-label="Vista del mapa">
              <Link
                href={href(provincia?.id, false)}
                scroll={false}
                aria-current={escanos ? undefined : 'true'}
              >
                Mapa
              </Link>
              <Link
                href={href(provincia?.id, true)}
                scroll={false}
                aria-current={escanos ? 'true' : undefined}
              >
                Por escaños
              </Link>
            </nav>
            <Escala />
          </div>
          <svg
            className="el-svg"
            viewBox="0 0 600 520"
            role="group"
            aria-labelledby="el-svg-titulo el-svg-descripcion"
          >
            <title id="el-svg-titulo">
              {escanos ? 'Provincias según sus escaños' : 'Mapa de provincias'}
            </title>
            <desc id="el-svg-descripcion">
              {escanos
                ? 'Cada círculo es una provincia, sobre su lugar en el mapa, y su área es proporcional a los escaños que elige.'
                : 'Canarias está representada en un recuadro separado.'}{' '}
              El tono indica los habitantes por escaño. También puedes elegirla en el desplegable o
              en la tabla de datos.
            </desc>
            <rect className="el-recuadro" rx="12" {...recuadroCanarias} />
            <text className="el-rotulo" x="12" y="420" aria-hidden="true">
              Canarias
            </text>
            {/* Cambiar de vista vuelve a montar la capa, que entra con un fundido. */}
            <g key={escanos ? 'escanos' : 'mapa'} className="el-capa">
              {escanos && (
                <path
                  className="el-silueta"
                  d={provincias.map((p) => p.path).join('')}
                  fillRule="evenodd"
                  aria-hidden="true"
                />
              )}
              {provincias.map((p) => (
                <Link
                  key={p.id}
                  href={href(p.id, escanos)}
                  scroll={false}
                  className="el-provincia"
                  aria-label={`${p.name}: ${escanosDe(p.seats)}`}
                  aria-current={provincia?.id === p.id ? 'true' : undefined}
                >
                  <title>{`${p.name}: ${escanosDe(p.seats)}`}</title>
                  {escanos ? <Circulo p={p} /> : <Silueta p={p} />}
                </Link>
              ))}
            </g>
          </svg>
          <p className="el-credito">
            Cartografía: IGN vía <a href="https://www.geoboundaries.org/">geoBoundaries</a> (
            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>), simplificada.
          </p>
        </div>
        <div id="el-ficha" className="el-ficha" aria-live="polite" aria-atomic>
          {provincia ? (
            <Ficha key={provincia.id} p={provincia} />
          ) : (
            <SinProvincia href={(id) => href(id, escanos)} />
          )}
        </div>
      </section>

      <section className="el-reparto" aria-labelledby="el-reparto-titulo">
        <h2 id="el-reparto-titulo">Y dentro de la provincia, ¿quién se lleva los escaños?</h2>
        <p>
          Se reparten con la ley D&apos;Hondt: los votos de cada candidatura se dividen entre 1, 2,
          3… y los escaños van a los cocientes más altos. Solo entran las que superan el 3 % de los
          votos válidos (
          <a className="enlace" href={fuentes.dhondt}>
            art. 163 de la LOREG
          </a>
          ). Prueba con estas candidaturas de ejemplo.
        </p>
        <SimuladorDhondt
          key={provincia?.id ?? 'ninguna'}
          provincia={provincia && { name: provincia.name, seats: provincia.seats }}
        />
      </section>

      {/* Alternativa al mapa que no depende del color; plegada para no cargar la página. */}
      <details className="el-tabla">
        <summary>
          <Icon name="derecha" size={16} />
          Ver todos los datos en una tabla
        </summary>
        <div className="el-tabla-contenido">
          <TablaProvincias
            items={provincias.map(({ id, name, seats, seats2023, population, perSeat }) => ({
              // La ficha está arriba: el enlace baja hasta ella.
              href: `${href(id, escanos)}#el-ficha`,
              name,
              seats,
              seats2023,
              population,
              perSeat,
            }))}
          />
        </div>
      </details>

      <div className="info-prosa">
        <h2>Cómo se reparten los escaños.</h2>
        <p>
          Cada provincia tiene 2 escaños por ley, y Ceuta y Melilla, 1. Los 248 restantes se
          reparten según la población (
          <a className="enlace" href={fuentes.loreg}>
            art. 162 de la LOREG
          </a>
          ), así que los habitantes por escaño cambian de una provincia a otra.
        </p>
        <section className="el-fuentes" aria-labelledby="el-fuentes-titulo">
          <h3 id="el-fuentes-titulo">Fuentes oficiales</h3>
          <dl className="chat-source-meta">
            {[
              { dato: 'Escaños', href: fuentes.escanos, texto: 'Real Decreto 806/2026' },
              { dato: 'Población', href: fuentes.poblacion, texto: 'Real Decreto 1117/2025' },
              {
                dato: 'Resultados de 2023',
                href: fuentes.resultados2023,
                texto: 'Ministerio del Interior',
              },
            ].map((f) => (
              <div key={f.href}>
                <dt>{f.dato}</dt>
                <dd>
                  <a className="enlace" href={f.href}>
                    {f.texto}
                    <Icon name="arrowUpRight" size={12} />
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </InfoPage>
  );
}

function Circulo({ p }: { p: Provincia }) {
  const circulo = cartograma.find((c) => c.id === p.id);
  if (!circulo) return null;
  return (
    <>
      <circle cx={circulo.x} cy={circulo.y} r={circulo.r} data-band={p.band} />
      {circulo.r >= 12 && (
        <text
          className="el-cifra"
          x={circulo.x}
          y={circulo.y}
          data-band={p.band}
          aria-hidden="true"
        >
          {p.seats}
        </text>
      )}
    </>
  );
}

function Silueta({ p }: { p: Provincia }) {
  return (
    <>
      {/* Ceuta y Melilla miden unas pocas unidades: área de pulsación y rótulo. */}
      {p.id === '51' && <rect x="170" y="398" width="76" height="30" fill="transparent" />}
      {p.id === '52' && <rect x="268" y="430" width="84" height="30" fill="transparent" />}
      <path d={p.path} data-band={p.band} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
      {(p.id === '51' || p.id === '52') && (
        <circle cx={p.centro.x} cy={p.centro.y} r={6} data-band={p.band} />
      )}
      {p.id === '51' && (
        <text className="el-rotulo" x="196" y="420" aria-hidden="true">
          Ceuta
        </text>
      )}
      {p.id === '52' && (
        <text className="el-rotulo" x="286" y="450" aria-hidden="true">
          Melilla
        </text>
      )}
    </>
  );
}

// Leyenda como escala: cuatro tramos seguidos con los cortes debajo. La lista oculta da los tramos
// completos a los lectores de pantalla.
function Escala() {
  return (
    <div className="el-escala">
      <p id="el-leyenda-titulo">Habitantes por escaño</p>
      <ul className="sr-only" aria-labelledby="el-leyenda-titulo">
        {bands.map((b) => (
          <li key={b.label}>{b.label}</li>
        ))}
      </ul>
      <div className="el-escala-barra" aria-hidden="true">
        {bands.map((b, i) => (
          <span key={b.label} data-band={i} />
        ))}
      </div>
      <div className="el-escala-cortes t-dato" aria-hidden="true">
        {bands.slice(0, -1).map((b) => (
          <span key={b.max}>{numero.format(b.max)}</span>
        ))}
      </div>
    </div>
  );
}

function SinProvincia({ href }: { href: (id: string) => string }) {
  return (
    <>
      <p className="el-ficha-titulo">España</p>
      <p className="el-ficha-resumen">{SEATS} escaños · 52 circunscripciones</p>
      <DetailGrid>
        <DetailCard label="Escaños" figure={String(SEATS)}>
          2 por provincia y el resto por población
        </DetailCard>
        <DetailCard label="Habitantes por escaño" figure={numero.format(averagePerSeat)} highlight>
          Media de España
        </DetailCard>
      </DetailGrid>
      <p className="el-ficha-texto">Prueba con</p>
      <div className="chat-followups el-ejemplos">
        {ejemplos.map((p, i) => (
          <Link
            key={p.id}
            className="chat-suggestion"
            style={{ '--index': i } as CSSProperties}
            href={href(p.id)}
            scroll={false}
          >
            {p.name}
            <Icon name="derecha" size={16} />
          </Link>
        ))}
      </div>
    </>
  );
}

function Ficha({ p }: { p: Provincia }) {
  const media = Math.round((p.perSeat / averagePerSeat - 1) * 100);
  const diferencia = p.seats - p.seats2023;
  return (
    <>
      <h3 className="el-ficha-titulo">{p.name}</h3>
      <p className="el-ficha-resumen">
        {p.seats} de {SEATS} escaños ·{' '}
        {diferencia === 0
          ? 'igual que en 2023'
          : `${Math.abs(diferencia)} ${diferencia > 0 ? 'más' : 'menos'} que en 2023`}
      </p>
      <DetailGrid>
        <DetailCard
          label={
            <InfoDato
              titulo="Escaños en 2026"
              ayuda="Diputados que elige esta provincia en el Congreso el 29 de noviembre de 2026. La ley da 2 a cada provincia (1 a Ceuta y a Melilla) y reparte el resto según la población; los fija el Real Decreto 806/2026."
            />
          }
          figure={String(p.seats)}
        >
          {p.seats === 1
            ? 'Fijado por la ley'
            : p.seats === 2
              ? 'Los 2 que da la ley'
              : `2 por ley y ${p.seats - 2} por población`}
        </DetailCard>
        <DetailCard
          label={
            <InfoDato
              titulo="Habitantes por escaño"
              ayuda="Habitantes divididos entre escaños: cuántas personas hay, de media, por cada diputado de la provincia. La media de España divide toda la población entre los 350 escaños."
            />
          }
          figure={numero.format(p.perSeat)}
          highlight
        >
          {media === 0
            ? 'Igual que la media'
            : `${Math.abs(media)} % ${media > 0 ? 'más' : 'menos'} que la media`}{' '}
          ({numero.format(averagePerSeat)})
        </DetailCard>
        <DetailCard
          label={
            <InfoDato
              titulo="Habitantes"
              ayuda="Personas empadronadas en la provincia el 1 de enero de 2025, la cifra oficial vigente al convocar las elecciones. Incluye a quienes no votan, como menores o extranjeros."
            />
          }
          figure={numero.format(p.population)}
        >
          A 1 de enero de 2025
        </DetailCard>
        <DetailCard
          label={
            <InfoDato
              titulo="Votos por escaño en 2023"
              ayuda="En las generales de julio de 2023, los votos válidos (a candidaturas y en blanco, sin los nulos) divididos entre los escaños que elegía la provincia: cuántos votos hubo, de media, por cada diputado elegido allí."
            />
          }
          figure={numero.format(p.validVotesPerSeat2023)}
        >
          Votos válidos, sin nulos
        </DetailCard>
      </DetailGrid>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';

/** La petición de ejemplo, con datos inventados; `m` es el marcador que le llega a la IA. */
const PETICION: { t: string; m?: string }[] = [
  { t: 'Soy ' },
  { t: 'Lucía Martín', m: '{{nombre}}' },
  { t: ', con DNI ' },
  { t: '12345678Z', m: '{{documento_numero}}' },
  { t: '. Quiero empadronarme en ' },
  { t: 'calle Ficticia 12, Sevilla', m: '{{direccion_1}}' },
  { t: '.' },
];
const LETRAS = PETICION.reduce((n, p) => n + p.t.length, 0);
const POR_LETRA = 26;

/** Cada fase y cuánto dura, en milisegundos. Al acabar vuelve a empezar. Es la de la bienvenida de la app. */
const FASES = [
  ['escribe', LETRAS * POR_LETRA + 500],
  ['detecta', 1000],
  ['cifra', 4000],
  ['sale', 600],
] as const;
type Fase = (typeof FASES)[number][0];
const orden = (f: Fase) => FASES.findIndex(([n]) => n === f);
const SIGNOS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+=?';

const marcador = 'rounded-md bg-brand-yellow px-1.5 py-0.5 font-mono text-[15px] text-foreground';

/** Un dato que se cifra a la vista: las letras cambian al azar hasta quedar en su marcador. */
function Cifrado({ de, a }: { de: string; a: string }) {
  const [texto, setTexto] = useState(de);
  const [hecho, setHecho] = useState(false);
  useEffect(() => {
    const pasos = 16;
    let paso = 0;
    const t = setInterval(() => {
      paso += 1;
      const largo = Math.round(de.length + ((a.length - de.length) * paso) / pasos);
      const fijas = Math.floor((a.length * paso) / pasos);
      setTexto(
        Array.from({ length: largo }, (_, i) =>
          i < fijas ? a[i] : SIGNOS[Math.floor(Math.random() * SIGNOS.length)],
        ).join(''),
      );
      if (paso >= pasos) {
        clearInterval(t);
        setTexto(a);
        setHecho(true);
      }
    }, 55);
    return () => clearInterval(t);
  }, [de, a]);
  return (
    <span
      className={cn(
        'transition-colors duration-300',
        hecho ? marcador : 'rounded-md bg-brand/10 px-1.5 py-0.5 font-mono text-[15px] text-brand',
      )}
    >
      {texto}
    </span>
  );
}

/** La petición con los marcadores ya puestos: sin JavaScript o sin movimiento, se queda así. */
const final = PETICION.map((parte, i) =>
  parte.m ? (
    <mark key={i} className={marcador}>
      {parte.m}
    </mark>
  ) : (
    parte.t
  ),
);

function Escena({ alAcabar }: { alAcabar: () => void }) {
  const [fase, setFase] = useState<Fase>('escribe');
  const [letras, setLetras] = useState(0);
  const p = orden(fase);
  useEffect(() => {
    const t = setTimeout(() => {
      const siguiente = FASES[p + 1];
      if (siguiente) setFase(siguiente[0]);
      else alAcabar();
    }, FASES[p]![1]);
    return () => clearTimeout(t);
  }, [p, alAcabar]);
  useEffect(() => {
    if (fase !== 'escribe') return;
    const t = setInterval(() => setLetras((n) => Math.min(n + 1, LETRAS)), POR_LETRA);
    return () => clearInterval(t);
  }, [fase]);
  let quedan = letras;
  const escrito = PETICION.map((parte, i) => {
    const visible = parte.t.slice(0, Math.max(0, quedan));
    quedan -= parte.t.length;
    if (!visible) return null;
    if (!parte.m) return <span key={i}>{visible}</span>;
    if (p >= orden('cifra')) return <Cifrado key={`${i}c`} de={parte.t} a={parte.m} />;
    return (
      <span
        key={i}
        className={cn(
          'rounded-md transition-colors duration-300',
          p >= orden('detecta') && 'bg-brand/10 text-brand',
        )}
      >
        {visible}
      </span>
    );
  });
  return (
    <Tarjeta
      etiqueta={p >= orden('cifra') ? 'Lo que llega a la IA' : 'Lo que escribes'}
      aviso={fase === 'cifra'}
      className={cn('transition-opacity duration-500', fase === 'sale' && 'opacity-0')}
    >
      {escrito}
      {fase === 'escribe' && (
        <span className="ml-px inline-block h-5 w-px translate-y-1 animate-pulse bg-foreground" />
      )}
    </Tarjeta>
  );
}

function Tarjeta({
  etiqueta,
  aviso,
  className,
  children,
}: {
  etiqueta: string;
  aviso?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl bg-background shadow-(--shadow-overlay)',
        className,
      )}
    >
      <p className="m-0 flex min-h-11 items-center justify-between gap-3 border-b border-border px-5 text-sm text-muted-foreground">
        {etiqueta}
        <span className={cn('transition-opacity duration-300', !aviso && 'opacity-0')}>
          3 datos ocultos antes de enviar
        </span>
      </p>
      {/* Las dos versiones, invisibles, reservan el alto: el texto no salta mientras cambia. */}
      <div className="grid p-5 text-lg leading-8 *:[grid-area:1/1]">
        <p className="invisible m-0">{PETICION.map((parte) => parte.t)}</p>
        <p className="invisible m-0">{final}</p>
        <p className="m-0">{children}</p>
      </div>
    </div>
  );
}

/** La pieza amarilla de Sol sobre la que flotan las maquetas (DESIGN.md §8). */
const fondoSol =
  'bg-[radial-gradient(100%_100%_at_100%_0%,color-mix(in_oklch,var(--brand-yellow),var(--background)_60%)_0%,transparent_70%),linear-gradient(150deg,var(--brand-yellow)_35%,color-mix(in_oklch,var(--brand-yellow),var(--brand-orange)_55%)_100%)]';

/** Lo que escribes y lo que llega a la IA, con datos inventados, como en la bienvenida de la app. */
export function Marcadores() {
  const [movimiento, setMovimiento] = useState(false);
  // Cada vuelta monta la escena de nuevo, desde el principio.
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    setMovimiento(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);
  return (
    <figure className="m-0 grid gap-4">
      <div aria-hidden="true" className={cn(fondoSol, 'rounded-[28px] p-[clamp(16px,4vw,40px)]')}>
        {movimiento ? (
          <Escena key={vuelta} alAcabar={() => setVuelta((v) => v + 1)} />
        ) : (
          <Tarjeta etiqueta="Lo que llega a la IA">{final}</Tarjeta>
        )}
      </div>
      <div className="sr-only">
        <p>Lo que escribes: {PETICION.map((parte) => parte.t)}</p>
        <p>Lo que llega a la IA: {PETICION.map((parte) => parte.m ?? parte.t)}</p>
      </div>
      <figcaption className="text-sm text-(--text-secondary)">
        Datos inventados. La app detecta los datos personales en tu ordenador, sin enviarlos.
      </figcaption>
    </figure>
  );
}

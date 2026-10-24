import Image, { type StaticImageData } from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@reforma-digital/design/ui/collapsible';
import type { Candidate } from '../../lib/elecciones/interviews';
import { Icon } from '../brand/icon';
import abascal from './candidatos/abascal.png';
import colau from './candidatos/colau.png';
import feijoo from './candidatos/feijoo.png';
import sanchez from './candidatos/sanchez.png';

const photos: Record<Candidate['slug'], StaticImageData> = {
  'ada-colau': colau,
  'santiago-abascal': abascal,
  'pedro-sanchez': sanchez,
  'alberto-nunez-feijoo': feijoo,
};

// Retrato: la cara ocupa el 38 % del alto y empieza al 20 %. Avatar: cuadrado y con la cara más grande.
const frames = {
  portrait: { face: 0.38, top: 0.2, ratio: 3 / 4, box: 'aspect-[3/4] rounded-xl' },
  avatar: { face: 0.52, top: 0.2, ratio: 1, box: 'aspect-square rounded-full' },
};

// Coloca la foto para que la cara tenga el mismo tamaño y la misma altura en los cuatro, como en
// El VAR Electoral. Todo en fracciones del alto del contenedor.
function place(c: Candidate, photo: StaticImageData, f: (typeof frames)[keyof typeof frames]) {
  const faceHeight = c.face.size / 0.8 / c.adjust;
  const faceTop = c.face.y - 0.27 * faceHeight;
  const height = f.face / faceHeight;
  const width = (height * photo.width) / photo.height;
  return {
    width: `${(width / f.ratio) * 100}%`,
    left: `${((0.5 * f.ratio - c.face.x * width) / f.ratio) * 100}%`,
    top: `${(f.top - faceTop * height) * 100}%`,
  };
}

// Las fotos acaban en los hombros con un corte recto: el retrato se funde por abajo.
const fade = 'linear-gradient(to bottom, #000 72%, transparent 98%)';

// La foto es más ancha que su caja (la cara manda), así que `sizes` tiene que pedir de más.
export function Portrait({
  candidate,
  kind = 'portrait',
  sizes,
  className,
}: {
  candidate: Candidate;
  kind?: keyof typeof frames;
  sizes: string;
  className?: string;
}) {
  const photo = photos[candidate.slug];
  const frame = frames[kind];
  return (
    <div className={cn('relative overflow-hidden bg-muted', frame.box, className)}>
      <Image
        src={photo}
        alt=""
        sizes={sizes}
        draggable={false}
        className="pointer-events-none absolute h-auto max-w-none select-none"
        style={{
          ...place(candidate, photo, frame),
          ...(kind === 'portrait' && { maskImage: fade, WebkitMaskImage: fade }),
        }}
      />
    </div>
  );
}

// Los créditos, enlazados a su original: CC BY-SA pide autor, licencia y que se diga que se ha
// cambiado. Con una foto, una línea; con varias, una lista desplegable junto a `children`.
export function PhotoCredits({
  people,
  children,
}: {
  people: readonly Candidate[];
  children?: ReactNode;
}) {
  const [first] = people;
  if (people.length === 1 && first) {
    return (
      <p className="m-0 text-sm text-muted-foreground">
        Foto: <Original candidate={first} />, recortada y en blanco y negro.
      </p>
    );
  }
  return (
    <Collapsible className="grid gap-3 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        {children}
        <CollapsibleTrigger className="group flex min-h-11 items-center gap-2 font-medium text-foreground">
          Créditos de las fotos
          <span aria-hidden="true" className="flex group-data-open:rotate-180">
            <Icon name="abajo" size={16} />
          </span>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <ul className="m-0 grid list-none gap-2 border-t border-border p-0 pt-3">
          {people.map((c) => (
            <li
              key={c.slug}
              className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] gap-x-4 max-sm:grid-cols-1"
            >
              <span className="text-foreground">{c.name}</span>
              <Original candidate={c} />
            </li>
          ))}
        </ul>
        <p className="m-0 mt-3">Recortadas y en blanco y negro. Originales en Wikimedia Commons.</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Original({ candidate: c }: { candidate: Candidate }) {
  return (
    <a
      href={c.source}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-4 hover:text-foreground"
    >
      {c.author} · {c.license}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (se abre en una pestaña nueva)</span>
    </a>
  );
}

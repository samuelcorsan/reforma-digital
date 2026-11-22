import Image, { type StaticImageData } from 'next/image';
import { cn } from '@reforma-digital/design/lib/utils';
import type { Candidate } from '../../lib/elecciones/candidates';
import abascal from './candidatos/abascal.png';
import colau from './candidatos/colau.png';
import feijoo from './candidatos/feijoo.png';
import sanchez from './candidatos/sanchez.png';
import abascalColor from './candidatos/abascal-color.png';
import colauColor from './candidatos/colau-color.png';
import feijooColor from './candidatos/feijoo-color.png';
import sanchezColor from './candidatos/sanchez-color.png';

const photos: Record<Candidate['slug'], StaticImageData> = {
  'ada-colau': colau,
  'santiago-abascal': abascal,
  'pedro-sanchez': sanchez,
  'alberto-nunez-feijoo': feijoo,
};
// La misma foto a color, con el mismo encuadre y el mismo recorte, para pasar el ratón.
const colorPhotos: Record<Candidate['slug'], StaticImageData> = {
  'ada-colau': colauColor,
  'santiago-abascal': abascalColor,
  'pedro-sanchez': sanchezColor,
  'alberto-nunez-feijoo': feijooColor,
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

// El retrato se funde por abajo, a la misma altura en los cuatro: la máscara va en una capa del
// tamaño del marco, no en la foto, que puede ser más alta que él (o acabar en un corte recto).
const fade = 'linear-gradient(to bottom, #000 72%, transparent 98%)';

// La foto es más ancha que su caja (la cara manda), así que `sizes` tiene que pedir de más.
export function Portrait({
  candidate,
  kind = 'portrait',
  sizes,
  hoverColor,
  className,
}: {
  candidate: Candidate;
  kind?: keyof typeof frames;
  sizes: string;
  // En blanco y negro; a color al pasar el ratón por la foto o por la tarjeta (`group/candidato`).
  hoverColor?: boolean;
  className?: string;
}) {
  const photo = photos[candidate.slug];
  const frame = frames[kind];
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted',
        hoverColor && 'group/candidato',
        frame.box,
        className,
      )}
    >
      <div
        className="absolute inset-0"
        style={kind === 'portrait' ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
      >
        <Image
          src={photo}
          alt=""
          sizes={sizes}
          draggable={false}
          className="pointer-events-none absolute h-auto max-w-none select-none"
          style={place(candidate, photo, frame)}
        />
        {hoverColor && (
          <Image
            src={colorPhotos[candidate.slug]}
            alt=""
            sizes={sizes}
            draggable={false}
            className="pointer-events-none absolute h-auto max-w-none opacity-0 transition-opacity duration-500 ease-(--ease-brand) select-none group-hover/candidato:opacity-100 motion-reduce:transition-none"
            style={place(candidate, photo, frame)}
          />
        )}
      </div>
    </div>
  );
}

// Los créditos, enlazados a su original: CC BY-SA pide autor, licencia y que se diga que se ha
// cambiado. Van todos juntos en la metodología.
export function PhotoCredits({ people }: { people: readonly Candidate[] }) {
  return (
    <div className="grid gap-3 text-sm text-muted-foreground">
      <ul className="m-0 grid list-none gap-2 p-0">
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
      <p className="m-0">
        Recortadas; se muestran en blanco y negro y, al pasar el ratón, en color. Originales en
        Wikimedia Commons.
      </p>
    </div>
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

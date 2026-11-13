'use client';

import { useEffect, useRef, useState } from 'react';

// El índice de la página, fijo bajo la cabecera al bajar. Solo las secciones que tiene, y marcada
// la que se está leyendo: la última cuyo título ya ha pasado bajo el índice.
export function PageIndex({ items }: { items: [string | false, string][] }) {
  const shown = items.filter((item): item is [string, string] => !!item[0]);
  const ids = shown.map(([id]) => id).join(' ');
  const [current, setCurrent] = useState<string | null>(null);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const sections = ids
      .split(' ')
      .map((id) => document.getElementById(id))
      .filter((section) => section !== null);
    const update = () =>
      setCurrent(sections.filter((s) => s.getBoundingClientRect().top <= 200).at(-1)?.id ?? null);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [ids]);

  // En el móvil el índice se desplaza de lado: la sección marcada queda a la vista.
  useEffect(() => {
    const link = nav.current?.querySelector<HTMLElement>('[aria-current]');
    if (nav.current && link)
      nav.current.scrollLeft = link.offsetLeft - (nav.current.clientWidth - link.clientWidth) / 2;
  }, [current]);

  return (
    <nav
      ref={nav}
      aria-label="En esta página"
      className="sticky top-22 z-20 -mx-2 mb-4 overflow-x-auto px-2 py-1 [scrollbar-width:none]"
    >
      <ul className="m-0 flex w-max list-none gap-1 rounded-full bg-background/80 p-1 ring-1 ring-foreground/10 backdrop-blur-md">
        {shown.map(([id, name]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={id === current ? 'location' : undefined}
              className="flex min-h-9 items-center rounded-full px-3.5 text-sm whitespace-nowrap no-underline transition-colors hover:bg-muted aria-[current=location]:bg-foreground aria-[current=location]:text-background motion-reduce:transition-none"
            >
              {name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

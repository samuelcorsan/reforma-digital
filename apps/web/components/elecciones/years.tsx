'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@reforma-digital/design/ui/button';

// Las elecciones, una por botón; «Reproducir» las recorre de una en una desde la elegida.
export function Years({
  items,
  current,
}: {
  items: { id: string; label: string; href: string }[];
  current: string;
}) {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const index = items.findIndex((x) => x.id === current);
  const next = items[index + 1];
  const active = playing && !!next;

  useEffect(() => {
    if (!active || !next) return;
    const timer = setTimeout(() => router.push(next.href, { scroll: false }), 2200);
    return () => clearTimeout(timer);
  }, [active, next, router]);

  const toggle = () => {
    if (active) return setPlaying(false);
    setPlaying(true);
    const first = next ?? items[0];
    if (first) router.push(first.href, { scroll: false });
  };

  return (
    <nav aria-label="Elección" className="mb-6 flex flex-wrap items-center gap-1.5">
      <Button variant="sunset" size="sm" className="mr-1" onClick={toggle}>
        {active ? 'Pausa' : 'Reproducir'}
      </Button>
      {items.map((x) => (
        <Link
          key={x.id}
          href={x.href}
          aria-current={x.id === current ? 'page' : undefined}
          scroll={false}
          onClick={() => setPlaying(false)}
          className={buttonVariants({
            variant: x.id === current ? 'default' : 'ghost',
            size: 'sm',
          })}
        >
          {x.label}
        </Link>
      ))}
    </nav>
  );
}

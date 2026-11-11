'use client';

import { useState } from 'react';
import { Button } from '@reforma-digital/design/ui/button';
import { Icon } from '../brand/icon';

const labels = {
  idle: 'Compartir',
  copied: 'Enlace copiado',
  failed: 'No se pudo copiar el enlace',
};

// Comparte la página con el menú del sistema (móvil) o, si no lo hay, copia su enlace.
export function ShareButton({ title }: { title: string }) {
  const [state, setState] = useState<keyof typeof labels>('idle');

  async function share() {
    const url = location.href;
    if (navigator.share) {
      // Si se cancela el menú, no hay nada que avisar.
      await navigator.share({ title, url }).catch(() => {});
      return;
    }
    const copied = await navigator.clipboard.writeText(url).then(
      () => true,
      () => false,
    );
    setState(copied ? 'copied' : 'failed');
    setTimeout(() => setState('idle'), 2500);
  }

  return (
    <Button variant="outline" size="xl" onClick={() => void share()}>
      <Icon name={state === 'copied' ? 'hecho' : 'copiar'} size={18} />
      <span aria-live="polite">{labels[state]}</span>
    </Button>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@reforma-digital/design/ui/button';
import { Icon } from './brand/icon';

export function CopyButton({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    // Sin permiso de portapapeles el código sigue a la vista para seleccionarlo.
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'NotAllowedError')) throw error;
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="m-2 shrink-0 text-background/70 hover:bg-background/15 hover:text-background"
      onClick={() => void copy()}
      aria-label={copied ? 'Copiado' : `Copiar ${label}`}
    >
      <Icon name={copied ? 'hecho' : 'copiar'} size={16} />
    </Button>
  );
}

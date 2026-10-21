'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MousePointer2 } from 'lucide-react';
import styles from './guia-mac.module.css';
import { Button } from '@reforma-digital/design/ui/button';
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@reforma-digital/design/ui/dialog';

const pasos = [
  {
    texto:
      'Abre el .dmg, arrastra la app a Aplicaciones y ábrela. Si ves este aviso, pulsa Aceptar.',
    imagen: 'aviso',
    alt: 'Aviso de macOS: No se ha abierto Reforma Digital. El botón Aceptar está abajo.',
    ancho: 683,
    alto: 645,
    boton: { left: '50%', top: '85%' },
  },
  {
    texto:
      'Ve a Ajustes del Sistema → Privacidad y seguridad. Baja hasta Seguridad y pulsa Abrir igualmente.',
    imagen: 'ajustes',
    alt: 'Sección Seguridad de macOS con el aviso de Reforma Digital y el botón Abrir igualmente a la derecha.',
    ancho: 1110,
    alto: 340,
    boton: { left: '87%', top: '57%' },
  },
  {
    texto:
      'Pulsa Abrir igualmente otra vez. Introduce tu contraseña si macOS te la pide. Ya puedes usar la app.',
    imagen: 'confirmar',
    alt: 'Confirmación ¿Abrir Reforma Digital?, con el botón Abrir igualmente en el centro.',
    ancho: 625,
    alto: 706,
    boton: { left: '50%', top: '81%' },
  },
];

export function GuiaMac() {
  const [paso, setPaso] = useState(0);
  const actual = pasos[paso]!;
  return (
    <DialogContent
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 text-base sm:max-w-xl"
      showCloseButton={false}
    >
      <div className="flex items-center justify-between gap-4">
        <DialogTitle className="text-xl leading-tight">Cómo instalar en tu Mac</DialogTitle>
        <DialogClose render={<Button variant="ghost" size="xl" />}>Cerrar</DialogClose>
      </div>
      <DialogDescription>
        Apple aún no ha verificado esta app. Continúa solo si confías en la descarga.
      </DialogDescription>
      <div aria-live="polite" aria-atomic="true" className="grid gap-4">
        <p className="leading-relaxed">
          <span className="font-semibold">
            {paso + 1} de {pasos.length}.{' '}
          </span>
          {actual.texto}
        </p>
        <div
          key={actual.imagen}
          className="relative mx-auto"
          style={{ width: `min(100%, ${(45 * actual.ancho) / actual.alto}dvh)` }}
        >
          <Image
            unoptimized
            src={`/instalacion-mac/${actual.imagen}.webp`}
            alt={actual.alt}
            width={actual.ancho}
            height={actual.alto}
            className="h-auto w-full"
          />
          <span aria-hidden="true" className={styles.objetivo} style={actual.boton}>
            <span className={styles.clic} />
            <MousePointer2 className={styles.cursor} size={30} fill="white" stroke="black" />
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="xl" disabled={paso === 0} onClick={() => setPaso(paso - 1)}>
          Atrás
        </Button>
        {paso < pasos.length - 1 ? (
          <Button size="xl" onClick={() => setPaso(paso + 1)}>
            Siguiente
          </Button>
        ) : (
          <DialogClose render={<Button size="xl" />}>Entendido</DialogClose>
        )}
      </div>
    </DialogContent>
  );
}

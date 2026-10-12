'use client';

import { useEffect, useRef } from 'react';

// Desplegable que abre la ficha al elegir, sin botón: envía su formulario en cada cambio.
export function EligeProvincia({
  actual,
  opciones,
}: {
  actual: string | undefined;
  opciones: { id: string; name: string }[];
}) {
  const ref = useRef<HTMLSelectElement>(null);
  // Al elegir en el mapa o la tabla, sigue a la ficha sin volver a montarse ni perder el foco.
  useEffect(() => {
    if (ref.current) ref.current.value = actual ?? '';
  }, [actual]);

  return (
    <select
      ref={ref}
      id="el-elige"
      name="provincia"
      defaultValue={actual ?? ''}
      required
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      <option value="" disabled>
        Provincia
      </option>
      {opciones.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

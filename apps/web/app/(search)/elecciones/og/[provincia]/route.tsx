import { ImageResponse } from 'next/og';
import {
  averagePerSeat,
  provinciaDe,
  provincias,
  recuadroCanarias,
} from '../../../../../lib/elecciones';

export const dynamicParams = false;

export function generateStaticParams() {
  return provincias.map((p) => ({ provincia: p.id }));
}

const numero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

export async function GET(_: Request, { params }: { params: Promise<{ provincia: string }> }) {
  const provincia = provinciaDe((await params).provincia);
  if (!provincia) return new Response('Not found', { status: 404 });
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        padding: 56,
        background: '#df1717',
        color: '#ffffff',
        fontSize: 32,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ fontWeight: 700 }}>Reforma Digital</div>
        <div style={{ marginTop: 56 }}>¿Cuánto vale tu voto?</div>
        <div style={{ marginTop: 8, fontSize: 76, lineHeight: 1.05 }}>{provincia.name}</div>
        <div style={{ marginTop: 32, fontSize: 40 }}>
          {`${provincia.seats} ${provincia.seats === 1 ? 'escaño' : 'escaños'} · ${numero.format(provincia.perSeat)} habitantes por escaño`}
        </div>
        <div style={{ marginTop: 'auto' }}>
          {`Media de España: ${numero.format(averagePerSeat)} · Generales del 29 de noviembre de 2026`}
        </div>
      </div>
      <svg width={460} height={399} viewBox="0 0 600 520" style={{ marginTop: 40 }}>
        <rect {...recuadroCanarias} fill="none" stroke="#ffffff" strokeOpacity={0.5} />
        {provincias.map((p) => (
          <path
            key={p.id}
            d={p.path}
            fillRule="evenodd"
            fill={p.id === provincia.id ? '#ffbe0b' : '#ffffff'}
            fillOpacity={p.id === provincia.id ? 1 : 0.3}
            stroke="#df1717"
            strokeWidth={0.6}
          />
        ))}
        {/* Ceuta y Melilla miden unas pocas unidades: un anillo las señala. */}
        {(provincia.id === '51' || provincia.id === '52') && (
          <circle
            cx={provincia.centro.x}
            cy={provincia.centro.y}
            r={14}
            fill="none"
            stroke="#ffbe0b"
            strokeWidth={4}
          />
        )}
      </svg>
    </div>,
  );
}

import type { ReactNode } from 'react';
import { Header } from '../../../components/brand/header';
import { Footer } from '../../../components/brand/footer';
import { electionsBase } from '../../../lib/elecciones/pages';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    // Desde 1100 px la sección lleva barra lateral: la cabecera se ensancha con la página para que el
    // logo quede alineado con la barra, como en El Congreso.
    <div className="[--elecciones-ancho:calc(var(--container-content)+296px)] min-[1100px]:[&_.in-nav]:[--container-content:var(--elecciones-ancho)]">
      <Header current={electionsBase} />
      {children}
      <Footer />
    </div>
  );
}

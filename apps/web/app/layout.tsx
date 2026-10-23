import '@reforma-digital/design/web.css';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { fuentesSol } from '../components/brand/fuentes';
import { Estadisticas } from '../components/estadisticas';
import { RouteFocus } from '../components/route-focus';
import { pageMetadata } from '../lib/seo';
import { siteUrl } from '../lib/site';

// Valores por defecto para las páginas sin metadatos propios. Sin canonical: cada página declara
// el suyo, y heredarlo haría que una 404 apuntara a la portada.
export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Reforma Digital · Lo público, a la altura de las personas',
    description:
      'Creamos herramientas y propuestas para hacer más clara, accesible y sencilla nuestra relación con lo público.',
    path: '/',
    og: 'portada',
  }),
  alternates: null,
  metadataBase: siteUrl,
  robots: {
    index: true,
    follow: true,
    googleBot: { 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};
export const viewport: Viewport = { themeColor: '#df1717' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${fuentesSol} motion-safe:[&::view-transition-new(.equipo-entra)]:[animation:sol-pagina-entra_200ms_var(--ease-brand)_both] motion-safe:[&::view-transition-old(.equipo-sale)]:[animation:sol-pagina-sale_160ms_var(--ease-brand)_both] motion-reduce:[&::view-transition-new(.equipo-entra)]:animate-none motion-reduce:[&::view-transition-old(.equipo-sale)]:animate-none`}
      data-bg-landing=""
      data-scroll-behavior="smooth"
    >
      <body className="bg-background font-sans text-base leading-[1.55] text-foreground antialiased [font-synthesis:none] [:where(&)_h1]:font-heading [:where(&)_h1]:font-normal [:where(&)_h2]:font-heading [:where(&)_h2]:font-normal [&_:is(h1,h2,h3,h4,dt)]:text-balance [&_:is(p,li,dd,figcaption,small)]:text-pretty selection:bg-brand-yellow selection:text-foreground [&_main:focus]:outline-none [&_.cg-voto-si]:[background:#237647] [&_.cg-voto-si]:[fill:#237647] [&_.cg-voto-no]:[background:var(--brand)] [&_.cg-voto-no]:[fill:var(--brand)] [&_.cg-voto-abst]:[background:var(--brand-yellow)] [&_.cg-voto-abst]:[fill:var(--brand-yellow)] [&_.cg-voto-ausente]:[background:var(--disabled)] [&_.cg-voto-ausente]:[fill:var(--disabled)]">
        <a
          className={
            'sol-salto fixed top-2 left-2 [z-index:100] inline-flex items-center min-h-11 [padding:0_16px] [border-radius:12px] [background:var(--foreground)] [color:var(--background)] [font-size:15px] font-medium no-underline [transform:translateY(calc(-100%_-_16px))] [&:focus-visible]:[transform:none]'
          }
          href="#main"
        >
          Saltar al contenido
        </a>
        <RouteFocus />
        {children}
        <Analytics />
        <Estadisticas />
      </body>
    </html>
  );
}

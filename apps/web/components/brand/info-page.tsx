import type { ReactNode } from 'react';
import { Header } from './header';
import { Footer } from './footer';

export function InfoPage({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <>
      <Header />
      <main
        id="main"
        tabIndex={-1}
        className={`info-pagina [max-width:var(--container-content)] [min-height:55vh] [margin-inline:auto] [padding:64px_var(--page-gutter)_80px] [&_>_h1]:[max-width:22ch] [&_>_h1]:mb-6 [&_>_h1]:[font:400_clamp(36px,_4.5vw,_60px)/1.1_var(--font-brand-heading)] [&_form:has(select)]:flex [&_form:has(select)]:items-center [&_form:has(select)]:flex-wrap [&_form:has(select)]:gap-3 [&_form:has(select)]:my-6 [&_table]:w-full [&_table]:[border-collapse:collapse] [&_table]:text-sm [&_table]:my-4 [&_:is(th,_td)]:p-3 [&_:is(th,_td)]:[border-bottom:1px_solid_var(--border)] [&_:is(th,_td)]:text-left [&_:is(th,_td)]:[font-variant-numeric:tabular-nums] [@media(max-width:_600px)]:[padding-block:40px_64px]${narrow ? ' info-lectura [max-width:760px] [&_>_h2]:[margin-block:40px_16px] [&_>_h2]:[font-size:clamp(24px,_3vw,_32px)] [&_>_h2]:[line-height:1.2] [&_>_p:not(.info-entradilla)]:my-4 [&_>_p:not(.info-entradilla)]:[color:var(--text-secondary)] [&_li]:my-4 [&_li]:[color:var(--text-secondary)] [&_ol]:pl-6 [&_li]:pl-2 [&_strong]:[color:var(--foreground)]' : ''}`}
      >
        {children}
      </main>
      <Footer />
    </>
  );
}

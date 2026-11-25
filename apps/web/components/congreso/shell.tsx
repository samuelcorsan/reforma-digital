import type { ReactNode } from 'react';
import { Header } from '../brand/header';
import { Footer } from '../brand/footer';
import { congressBase } from '../../lib/congreso/routes';
import { CongressNav } from './nav';

export function CongressShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={
        "[color:var(--foreground)] [&_:is([data-part=cg-nav],_[data-part=cg-lateral])_[aria-current='page']]:[background:var(--muted)] [--cg-ancho:calc(_var(--container-content)_+_264px_)] [@media(min-width:_1100px)]:[&_[data-part=in-nav]]:[--container-content:var(--cg-ancho)] [&_blockquote]:[margin:20px_0] [&_blockquote]:[font-family:var(--font-brand-heading)] [&_blockquote]:text-2xl [&_blockquote]:[line-height:1.35] [&_blockquote.cg-card]:m-0 [&_blockquote_footer]:mt-4 [&_blockquote_footer]:[font-family:var(--font-brand-text)] [&_blockquote_footer]:text-sm [&_blockquote_footer]:[color:var(--muted-foreground)]"
      }
    >
      <Header current={congressBase} />
      <div
        className={
          '[@media(min-width:_1100px)]:grid [@media(min-width:_1100px)]:[grid-template-columns:232px_minmax(0,_1fr)] [@media(min-width:_1100px)]:gap-x-8 [@media(min-width:_1100px)]:items-start [@media(min-width:_1100px)]:[max-width:var(--cg-ancho)] [@media(min-width:_1100px)]:[margin:auto] [@media(min-width:_1100px)]:[padding-inline:var(--page-gutter)] [@media(min-width:_1100px)]:[&_[data-part=cg-hero]]:[margin-inline:0] [@media(min-width:_1100px)]:[&_[data-part=cg-body]]:[padding-inline:0]'
        }
      >
        <CongressNav />
        {children}
      </div>
      <Footer />
    </div>
  );
}

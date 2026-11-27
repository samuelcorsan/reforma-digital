import type { ReactNode } from 'react';
import { Header } from '../brand/header';
import { Footer } from '../brand/footer';
import { congressBase } from '../../lib/congreso/routes';
import { CongressNav } from './nav';

export function CongressShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={
        "text-foreground [&_:is([data-part=cg-nav],_[data-part=cg-lateral])_[aria-current='page']]:bg-muted [--cg-ancho:calc(_var(--container-content)_+_264px_)] [@media(min-width:_1100px)]:[&_[data-part=in-nav]]:[--container-content:var(--cg-ancho)] [&_blockquote]:[margin:20px_0] [&_blockquote]:font-heading [&_blockquote]:text-2xl [&_blockquote]:leading-1.35 [&_blockquote[data-part=cg-card]]:m-0 [&_blockquote_footer]:mt-4 [&_blockquote_footer]:font-sans [&_blockquote_footer]:text-sm [&_blockquote_footer]:text-muted-foreground"
      }
    >
      <Header current={congressBase} />
      <div
        className={
          '[@media(min-width:_1100px)]:grid [@media(min-width:_1100px)]:[grid-template-columns:232px_minmax(0,_1fr)] [@media(min-width:_1100px)]:gap-x-8 [@media(min-width:_1100px)]:items-start [@media(min-width:_1100px)]:[max-width:var(--cg-ancho)] [@media(min-width:_1100px)]:[margin:auto] [@media(min-width:_1100px)]:px-(--page-gutter) [@media(min-width:_1100px)]:[&_[data-part=cg-hero]]:[margin-inline:0] [@media(min-width:_1100px)]:[&_[data-part=cg-body]]:px-0'
        }
      >
        <CongressNav />
        {children}
      </div>
      <Footer />
    </div>
  );
}

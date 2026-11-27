'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@reforma-digital/design/ui/button';
import { ButtonLink } from '@reforma-digital/design/ui/button-link';
import { Sheet, SheetContent, SheetTitle } from '@reforma-digital/design/ui/sheet';
import { Icon } from './icon';
import { Logo } from './logo';

type MenuLink = {
  href: string;
  text: string;
  current: boolean;
  /** Una sección con subpáginas (Desarrolladores): su nombre y debajo los enlaces. */
  children?: { href: string; text: string }[];
};

export function MobileMenu({ links }: { links: readonly MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="hidden size-11 max-[800px]:inline-flex"
        aria-label="Abrir el menú"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Icon name="mas" size={18} />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="top"
          showCloseButton={false}
          className="data-[side=top]:inset-2 data-[side=top]:h-[calc(100dvh-16px)]"
        >
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <div className="flex min-h-20 items-center justify-between px-(--page-gutter) py-4">
            <Link href="/" aria-label="Reforma Digital, portada de la iniciativa" onClick={close}>
              <Logo size={36} />
            </Link>
            <Button
              variant="sunset"
              size="icon"
              className="size-11"
              aria-label="Cerrar el menú"
              onClick={close}
            >
              <span className="rotate-45">
                <Icon name="mas" size={18} />
              </span>
            </Button>
          </div>
          <nav
            aria-label="Menú"
            className="mx-[var(--page-gutter)] mt-8 grid border-t border-foreground/15"
          >
            {links.map(({ href, text, current, children }) =>
              children ? (
                <div key={href} className="border-b border-foreground/15 pt-5 pb-3">
                  <p className="font-heading text-4xl leading-tight">{text}</p>
                  {children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={close}
                      className="flex min-h-12 items-center justify-between pl-4 text-2xl no-underline"
                    >
                      {child.text}
                      <Icon name="derecha" size={16} />
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={href}
                  href={href}
                  aria-current={current ? 'page' : undefined}
                  onClick={close}
                  className="flex min-h-[76px] items-center justify-between border-b border-foreground/15 font-heading text-4xl leading-tight no-underline"
                >
                  {text}
                  <Icon name="derecha" size={18} />
                </Link>
              ),
            )}
          </nav>
          <ButtonLink
            render={<Link href="/#participar" />}
            onClick={close}
            variant="sunset"
            className="mx-[var(--page-gutter)] mt-auto mb-[var(--page-gutter)] min-h-13"
          >
            Participar <Icon name="derecha" size={16} />
          </ButtonLink>
        </SheetContent>
      </Sheet>
    </>
  );
}

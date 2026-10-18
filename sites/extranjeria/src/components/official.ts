import { textOf } from '@reforma-digital/bridge';

export interface OfficialLink {
  text: string;
  href: string;
}

/**
 * Texto de un enlace oficial sin el aviso accesible que añade la propia web
 * (<span class="ac-blank-lnk"> Abre en ventana nueva</span>); nuestra interfaz añade el suyo.
 */
export function linkText(a: HTMLAnchorElement): string {
  const clone = a.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.ac-blank-lnk').forEach((n) => n.remove());
  return textOf(clone);
}

/** Enlaces HTTPS sin credenciales de un bloque oficial, sin duplicados (criterio de officialHref). */
export function officialLinks(root: Element | null): OfficialLink[] {
  if (!root) return [];
  const seen = new Set<string>();
  const links: OfficialLink[] = [];
  for (const a of Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const text = linkText(a);
    if (!text || a.protocol !== 'https:' || a.username || a.password || seen.has(a.href)) continue;
    seen.add(a.href);
    links.push({ text, href: a.href });
  }
  return links;
}

/** Textos de error visibles que muestra la propia web oficial. */
export function readVisibleErrors(doc: Document, selectors: readonly string[]): string[] {
  const out: string[] = [];
  for (const selector of selectors) {
    for (const el of Array.from(doc.querySelectorAll<HTMLElement>(selector))) {
      const text = textOf(el);
      if (!text) continue;
      const hidden =
        el.style.display === 'none' ||
        el.closest('[style*="display: none"], [style*="display:none"]') ||
        doc.defaultView?.getComputedStyle(el).display === 'none';
      if (!hidden) out.push(text);
    }
  }
  return Array.from(new Set(out));
}

/** Rutas de la app ICP: /<app>/<pantalla>, a veces con ";jsessionid=…" pegado. */
export function icpScreen(url: URL): string | null {
  return /^\/icp[a-z]*\/([A-Za-z.]*)$/.exec(url.pathname.replace(/;.*$/, ''))?.[1] ?? null;
}

import { Button } from '@reforma-digital/design/ui/button';
import { PortalContainerContext } from '@reforma-digital/design/lib/portal';
import { Component, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import {
  matchesSite,
  type Enhancement,
  type PanelPosition,
  type SiteAdapter,
} from '@reforma-digital/registry';
import { CommunityBadge, FallbackNotice } from '@reforma-digital/design';
import uiStyles from '@reforma-digital/design/shadow.css?inline';
import portalStyles from '@reforma-digital/design/portal.css?inline';

export type RuntimeState = 'active' | 'original' | 'unsupported' | 'disabled';
export interface RuntimeController {
  restore: () => void;
  dispose: () => void;
  state: () => RuntimeState;
}

class RenderBoundary extends Component<
  { children: ReactNode; restore: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    queueMicrotask(this.props.restore);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Top bar shown on every enhanced page (DESIGN.md §3). Pages without panels also get an intro. */
function Shell({
  enhancement,
  restore,
  demo,
  host,
  inline,
}: {
  enhancement: Enhancement;
  restore: () => void;
  demo: boolean;
  host: string;
  /** Placed inside the page flow (Enhancement.shell) instead of at the top of <body>. */
  inline: boolean;
}) {
  return (
    <section
      className={
        inline
          ? 'bg-card [background-color:rgb(var(--bg-surface))] border-0 [border-radius:var(--bg-radius-card)] [box-shadow:var(--bg-shadow-card)] bg-text [font-family:var(--bg-font)] text-base [line-height:1.6] [color:rgb(var(--bg-ink))] my-3'
          : 'bg-text [font-family:var(--bg-font)] text-base [line-height:1.6] [color:rgb(var(--bg-ink))] border-b border-line bg-surface'
      }
      aria-label="Reforma Digital"
    >
      <div
        className={
          inline
            ? 'flex flex-wrap items-center justify-between gap-3 px-4 py-2.5'
            : 'mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-4 py-2.5'
        }
      >
        <div className="min-w-0 flex-1">
          <CommunityBadge host={host} />
        </div>
        <Button variant="outline" type="button" className={'print:hidden'} onClick={restore}>
          Ver original
        </Button>
      </div>
      {enhancement.panels?.length ? null : (
        <div className="mx-auto max-w-content px-4 pb-4">
          <h1
            className={
              'bg-h1 [font-size:28px] [line-height:1.2] font-medium [color:rgb(var(--bg-ink))] [letter-spacing:-0.035em] [@media(max-width:_639px)]:text-2xl'
            }
          >
            {enhancement.title}
          </h1>
          <p
            className={
              'bg-lead [font-size:17px] [line-height:1.6] [color:rgb(var(--bg-ink-muted))] mt-1'
            }
          >
            {enhancement.description}
          </p>
        </div>
      )}
      {demo ? (
        <p
          className={
            'bg-small text-sm [line-height:1.5] [color:rgb(var(--bg-ink-muted))] mx-auto max-w-content px-4 pb-3'
          }
        >
          Prueba local con datos ficticios. No reserva citas.
        </p>
      ) : null}
    </section>
  );
}

/** Mounts only known slots. Everything outside them, including security widgets, stays in place. */
export function mountAdapter(
  adapter: SiteAdapter,
  options: { url?: URL; demo?: boolean; onState?: (state: RuntimeState) => void } = {},
): RuntimeController {
  let state: RuntimeState = 'unsupported';
  const roots: Root[] = [];
  const hosts: HTMLElement[] = [];
  const sources: { source: HTMLElement; previous: string | null }[] = [];
  const sourceParents = new Map<HTMLElement, Node | null>();
  const sourceAppearance = new Map<HTMLElement, string>();
  const labels: { label: HTMLLabelElement; previous: string | null }[] = [];
  let enhancement: Enhancement | null = null;
  let observer: MutationObserver | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let pageStyle: HTMLStyleElement | undefined;
  let addedClasses: string[] = [];
  const initialURL = location.href;
  const oldSite = document.body.getAttribute('data-bg-site');
  const root = document.documentElement;
  const oldRootSite = root.getAttribute('data-bg-site');
  const oldRootPage = root.getAttribute('data-bg-page');
  const notify = (next: RuntimeState) => {
    state = next;
    options.onState?.(next);
  };
  const cleanup = () => {
    observer?.disconnect();
    clearInterval(timer);
    document.removeEventListener('invalid', invalid, true);
    document.removeEventListener('focusin', originalFocus, true);
    window.removeEventListener('pagehide', restore);
    window.removeEventListener('popstate', restore);
    for (const { source, previous } of sources) {
      if (previous === null) source.removeAttribute('data-bg-source');
      else source.setAttribute('data-bg-source', previous);
    }
    for (const { label, previous } of labels) {
      if (previous === null) label.removeAttribute('data-bg-label');
      else label.setAttribute('data-bg-label', previous);
    }
    enhancement?.bridge.dispose();
    for (const root of roots) root.unmount();
    for (const host of hosts) host.remove();
    pageStyle?.remove();
    root.classList.remove(...addedClasses);
    addedClasses = [];
    if (oldSite === null) document.body.removeAttribute('data-bg-site');
    else document.body.setAttribute('data-bg-site', oldSite);
    if (oldRootSite === null) root.removeAttribute('data-bg-site');
    else root.setAttribute('data-bg-site', oldRootSite);
    if (oldRootPage === null) root.removeAttribute('data-bg-page');
    else root.setAttribute('data-bg-page', oldRootPage);
  };
  const restore = () => {
    if (state !== 'active') return;
    cleanup();
    notify('original');
  };
  // Reveal before the browser focuses the invalid field and displays its own error.
  const invalid = (event: Event) => {
    if (sources.some(({ source }) => source === event.target)) restore();
  };
  const originalFocus = (event: Event) => {
    if (sources.some(({ source }) => source === event.target)) restore();
  };
  const controller = { restore, dispose: restore, state: () => state };
  const url = options.url ?? new URL(location.href);
  if (!matchesSite(adapter, url)) return controller;
  try {
    enhancement = adapter.prepare(document, url, restore);
  } catch {
    return controller;
  }
  if (!enhancement) return controller;
  const captured = enhancement;
  const sourcesUnique = new Set(captured.slots.map((slot) => slot.source));
  if (
    sourcesUnique.size !== captured.slots.length ||
    captured.slots.some(({ source }) => !source.isConnected)
  ) {
    captured.bridge.dispose();
    return controller;
  }
  notify('active');
  function makeHost(
    place: HTMLElement | { anchor: Element; position: PanelPosition } | null,
    content: ReactNode,
  ) {
    const host = document.createElement('div');
    host.setAttribute('data-bg-host', '');
    host.style.setProperty('display', 'block', 'important');
    host.style.setProperty('color-scheme', 'light', 'important');
    // Styling isolation only. A ShadowRoot is not a security boundary against the host page.
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = uiStyles;
    shadow.append(style);
    const mount = document.createElement('div');
    shadow.append(mount);
    if (place instanceof HTMLElement) place.before(host);
    else if (place) place.anchor.insertAdjacentElement(place.position, host);
    else document.body.prepend(host);
    hosts.push(host);
    const root = createRoot(mount);
    roots.push(root);
    flushSync(() =>
      root.render(
        <PortalContainerContext value={mount}>
          <RenderBoundary restore={restore}>{content}</RenderBoundary>
        </PortalContainerContext>,
      ),
    );
  }
  try {
    makeHost(
      captured.shell ?? null,
      <Shell
        enhancement={captured}
        restore={restore}
        demo={options.demo ?? false}
        host={url.hostname}
        inline={!!captured.shell}
      />,
    );
    for (const panel of captured.panels ?? []) makeHost(panel, panel.render());
    for (const slot of captured.slots) {
      makeHost(slot.source, slot.render());
      sources.push({ source: slot.source, previous: slot.source.getAttribute('data-bg-source') });
      sourceParents.set(slot.source, slot.source.parentNode);
      sourceAppearance.set(
        slot.source,
        JSON.stringify([
          slot.source.getAttribute('style'),
          slot.source.hidden,
          slot.source.getAttribute('aria-hidden'),
        ]),
      );
      if (
        slot.source instanceof HTMLInputElement ||
        slot.source instanceof HTMLSelectElement ||
        slot.source instanceof HTMLTextAreaElement
      ) {
        for (const label of slot.source.labels ?? []) {
          if (label.contains(slot.source)) continue;
          labels.push({ label, previous: label.getAttribute('data-bg-label') });
          label.setAttribute('data-bg-label', '');
        }
      }
      slot.source.setAttribute('data-bg-source', '');
    }
    pageStyle = document.createElement('style');
    pageStyle.textContent = portalStyles;
    const classes =
      `[&_[data-bg-source]]:hidden! [&_[data-bg-label]]:hidden! ${captured.pageClassName ?? ''}`
        .split(/\s+/)
        .filter(Boolean);
    addedClasses = classes.filter((value) => !root.classList.contains(value));
    root.classList.add(...addedClasses);
    document.head.append(pageStyle);
    document.body.setAttribute('data-bg-site', adapter.id);
    root.setAttribute('data-bg-site', adapter.id);
    if (captured.page) root.setAttribute('data-bg-page', captured.page);
    document.addEventListener('invalid', invalid, true);
    document.addEventListener('focusin', originalFocus, true);
    window.addEventListener('pagehide', restore);
    window.addEventListener('popstate', restore);
    const health = () => {
      if (state !== 'active') return;
      try {
        if (
          location.href !== initialURL ||
          !captured.health() ||
          hosts.some((host) => !host.isConnected) ||
          sources.some(
            ({ source }) =>
              !source.isConnected ||
              source.parentNode !== sourceParents.get(source) ||
              JSON.stringify([
                source.getAttribute('style'),
                source.hidden,
                source.getAttribute('aria-hidden'),
              ]) !== sourceAppearance.get(source),
          )
        )
          restore();
      } catch {
        restore();
      }
    };
    observer = new MutationObserver(health);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    timer = setInterval(health, 300);
  } catch {
    restore();
  }
  return controller;
}

/** How long to wait for official content that renders late (e.g. after an anti-bot check). */
export const LATE_CONTENT_MS = 12_000;

/**
 * Content-script entry point. Mounts immediately when possible. If a registered screen claims the
 * URL but its DOM is not ready yet, keeps observing until LATE_CONTENT_MS; if it never matches,
 * the official page stays untouched and a small dismissible notice explains why.
 */
export function startAdapter(
  adapter: SiteAdapter,
  options: { url?: URL; demo?: boolean; onState?: (state: RuntimeState) => void } = {},
): RuntimeController {
  const url = options.url ?? new URL(location.href);
  const startHref = location.href;
  let current = mountAdapter(adapter, options);
  let observer: MutationObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let notice: (() => void) | undefined;
  const stop = () => {
    observer?.disconnect();
    clearTimeout(timer);
    observer = undefined;
  };
  if (current.state() === 'unsupported' && adapter.expects(url)) {
    observer = new MutationObserver(() => {
      // `url` describes the page this started on; after history navigation it no longer applies.
      if (location.href !== startHref) return stop();
      const next = mountAdapter(adapter, options);
      if (next.state() === 'active') {
        stop();
        current = next;
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    timer = setTimeout(() => {
      stop();
      notice = showOriginalNotice(adapter.name);
    }, LATE_CONTENT_MS);
  }
  return {
    restore: () => {
      stop();
      notice?.();
      current.restore();
    },
    dispose: () => {
      stop();
      notice?.();
      current.dispose();
    },
    state: () => current.state(),
  };
}

function showOriginalNotice(siteName: string): () => void {
  const host = document.createElement('div');
  host.setAttribute('data-bg-notice', '');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = uiStyles;
  const mount = document.createElement('div');
  shadow.append(style, mount);
  document.body.append(host);
  const root = createRoot(mount);
  const close = () => {
    root.unmount();
    host.remove();
  };
  flushSync(() =>
    root.render(
      <FallbackNotice
        adapterName={siteName}
        reason="La pantalla no coincide con la estructura revisada."
        onClose={close}
      />,
    ),
  );
  return close;
}

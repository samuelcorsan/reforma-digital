import { Button } from '@reforma-digital/design/ui/button';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './popup.css';

type Status = { site: string; name: string; state: string };
const stateText: Record<string, string> = {
  active: 'Interfaz activada',
  original: 'Estás usando la interfaz original',
  disabled: 'Desactivada para este portal',
  unsupported: 'Esta pantalla conserva la interfaz original',
};
async function send(type: string): Promise<Status | { state: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  return chrome.tabs.sendMessage(tab.id, { type });
}
function Popup() {
  const [status, setStatus] = useState<Status | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void send('status')
      .then((value) => setStatus(value as Status))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  async function toggle() {
    if (!status) return;
    setBusy(true);
    setError('');
    try {
      const saved = await chrome.storage.local.get('disabledSites');
      const ids = new Set<string>(
        Array.isArray(saved.disabledSites)
          ? saved.disabledSites.filter((v: unknown): v is string => typeof v === 'string')
          : [],
      );
      if (status.state === 'disabled') ids.delete(status.site);
      else ids.add(status.site);
      await chrome.storage.local.set({ disabledSites: [...ids] });
      if (!ids.has(status.site)) await send('enable');
      else await send('restore');
      setStatus((await send('status')) as Status);
    } catch {
      setError('No se pudo cambiar la vista. Recarga esta página e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }
  async function showOriginal() {
    setBusy(true);
    try {
      await send('restore');
      setStatus((await send('status')) as Status);
    } catch {
      setError('No se pudo cambiar la vista. Recarga esta página e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className={
        'w-[340px] bg-background [font-family:var(--bg-font)] text-base [line-height:1.6] [color:rgb(var(--bg-ink))] space-y-3 p-4 text-[14px]'
      }
    >
      <header>
        <h1
          className={
            '[font-size:17px] [line-height:1.4] font-semibold [color:rgb(var(--bg-ink))] leading-tight'
          }
        >
          Reforma Digital
        </h1>
        <p
          className={
            'text-xs [line-height:1.4] font-semibold [letter-spacing:0.06em] uppercase [color:rgb(var(--bg-ink-subtle))]'
          }
        >
          Interfaz comunitaria · sitio oficial
        </p>
      </header>
      <section className="rounded-control bg-surface-muted p-3" aria-live="polite">
        <h2
          className={
            'text-xs [line-height:1.4] font-semibold [letter-spacing:0.06em] uppercase [color:rgb(var(--bg-ink-subtle))]'
          }
        >
          Esta pestaña
        </h2>
        <p className="mt-1">
          {!ready
            ? 'Comprobando esta página…'
            : status
              ? stateText[status.state]
              : 'No hay una integración disponible en esta pestaña.'}
        </p>
        {status ? (
          <p className={'text-sm [line-height:1.5] [color:rgb(var(--bg-ink-muted))]'}>
            {status.name}
          </p>
        ) : null}
      </section>
      {status ? (
        <div className="space-y-2">
          {status.state === 'active' ? (
            <Button
              variant="outline"
              type="button"
              className={'w-full'}
              disabled={busy}
              onClick={() => void showOriginal()}
            >
              Ver original en esta pestaña
            </Button>
          ) : null}
          <Button type="button" className={'w-full'} disabled={busy} onClick={() => void toggle()}>
            {busy
              ? 'Aplicando…'
              : status.state === 'disabled'
                ? 'Activar en este portal'
                : 'Desactivar en este portal'}
          </Button>
        </div>
      ) : (
        <section>
          <h2
            className={
              'text-xs [line-height:1.4] font-semibold [letter-spacing:0.06em] uppercase [color:rgb(var(--bg-ink-subtle))]'
            }
          >
            Portales incluidos
          </h2>
          <ul className="mt-1 space-y-1.5">
            {__BG_SITES__.map((site) => (
              <li key={site.id}>
                <a
                  className={
                    'relative after:absolute after:inset-x-0 after:-inset-y-3.5 [color:rgb(var(--bg-brand-600))] [text-decoration-line:underline] [text-decoration-thickness:1px] [text-underline-offset:3px] [text-decoration-color:rgb(var(--bg-brand-600)_/_0.4)] font-medium cursor-pointer [&:hover]:[color:rgb(var(--bg-brand-700))] [&:hover]:[text-decoration-color:currentColor] [&:hover]:[text-decoration-thickness:2px] [&:focus-visible]:[outline:3px_solid_rgb(var(--bg-brand-600))] [&:focus-visible]:[outline-offset:2px] [&:focus-visible]:[border-radius:2px]'
                  }
                  href={site.homepage}
                  target="_blank"
                  rel="noreferrer"
                >
                  {site.name} ↗
                </a>
                <span
                  className={'text-sm [line-height:1.5] [color:rgb(var(--bg-ink-muted))] block'}
                >
                  {site.status === 'verified' ? 'Verificado' : 'Experimental'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {error ? (
        <p
          role="alert"
          className={
            '[padding:14px_16px] [border-radius:var(--bg-radius-control)] [border:1px_solid] [border-left-width:4px] [font-size:15px] [line-height:1.55] [background-color:rgb(var(--bg-danger-bg))] [border-color:rgb(var(--bg-danger-line))] [color:rgb(var(--bg-danger-fg))]'
          }
        >
          {error}
        </p>
      ) : null}
      <footer
        className={
          'text-sm [line-height:1.5] [color:rgb(var(--bg-ink-muted))] border-t border-line pt-3'
        }
      >
        Adaptaciones comunitarias. No es un servicio oficial. Sin servidores propios ni telemetría.
      </footer>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Popup />);

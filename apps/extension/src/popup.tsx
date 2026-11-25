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
        'w-[340px] bg-background font-(family-name:--bg-font) text-base text-ink space-y-3 p-4 text-14 leading-1.6'
      }
    >
      <header>
        <h1 className={'text-17 leading-1.4 font-semibold text-ink'}>Reforma Digital</h1>
        <p
          className={'text-xs leading-1.4 font-semibold tracking-eyebrow uppercase text-ink-subtle'}
        >
          Interfaz comunitaria · sitio oficial
        </p>
      </header>
      <section className="rounded-control bg-surface-muted p-3" aria-live="polite">
        <h2
          className={'text-xs leading-1.4 font-semibold tracking-eyebrow uppercase text-ink-subtle'}
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
        {status ? <p className={'text-sm leading-normal text-ink-muted'}>{status.name}</p> : null}
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
              'text-xs leading-1.4 font-semibold tracking-eyebrow uppercase text-ink-subtle'
            }
          >
            Portales incluidos
          </h2>
          <ul className="mt-1 space-y-1.5">
            {__BG_SITES__.map((site) => (
              <li key={site.id}>
                <a
                  className={
                    'relative after:absolute after:inset-x-0 after:-inset-y-3.5 text-brand-600 underline decoration-1 underline-offset-3 decoration-brand-600/40 font-medium cursor-pointer [&:hover]:text-brand-700 [&:hover]:decoration-current [&:hover]:decoration-2 [&:focus-visible]:outline-3 [&:focus-visible]:outline-brand-600 [&:focus-visible]:outline-offset-2 [&:focus-visible]:rounded-xs'
                  }
                  href={site.homepage}
                  target="_blank"
                  rel="noreferrer"
                >
                  {site.name} ↗
                </a>
                <span className={'text-sm leading-normal text-ink-muted block'}>
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
            'py-3.5 px-4 rounded-control border border-current text-15 leading-1.55 bg-danger-bg text-danger-fg'
          }
        >
          {error}
        </p>
      ) : null}
      <footer className={'text-sm leading-normal text-ink-muted border-t border-line pt-3'}>
        Adaptaciones comunitarias. No es un servicio oficial. Sin servidores propios ni telemetría.
      </footer>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Popup />);

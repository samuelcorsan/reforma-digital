import { adapters } from 'virtual:site-adapters';
import { matchesSite, type SiteAdapter } from '@reforma-digital/registry';
import { startAdapter, type RuntimeController } from '@reforma-digital/runtime';

/** Test builds only: the local playground serves each site's fixtures under their official paths. */
function officialURL(local: URL, sites: readonly SiteAdapter[]): URL {
  for (const site of sites)
    for (const route of site.routes)
      if (
        'path' in route
          ? local.pathname === route.path
          : local.pathname.startsWith(route.pathPrefix)
      )
        return new URL(local.pathname + local.search, route.origin);
  return local;
}

/** Read on every mount: the page may have changed its URL with history.pushState since injection. */
function currentURL(): URL {
  const url = new URL(location.href);
  return __BG_TEST__ && url.origin === 'http://127.0.0.1:4173' ? officialURL(url, adapters) : url;
}

async function start() {
  const adapter = adapters.find((item) => matchesSite(item, currentURL()));
  if (!adapter) return;
  let controller: RuntimeController | undefined;
  let disabled = false;
  try {
    const saved = await chrome.storage.local.get('disabledSites');
    disabled = Array.isArray(saved.disabledSites) && saved.disabledSites.includes(adapter.id);
    if (!disabled) controller = startAdapter(adapter, { url: currentURL(), demo: __BG_TEST__ });
  } catch {
    return;
  }
  const changes = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !changes.disabledSites) return;
    const value: unknown = changes.disabledSites.newValue;
    disabled = Array.isArray(value) && value.includes(adapter.id);
    if (disabled) controller?.restore();
  };
  chrome.storage.onChanged.addListener(changes);
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    // Only the extension's packaged popup may control this content script.
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html'))
      return;
    if (!message || typeof message !== 'object' || !('type' in message)) return;
    if (message.type === 'status')
      sendResponse({
        site: adapter.id,
        name: adapter.name,
        state: disabled ? 'disabled' : (controller?.state() ?? 'unsupported'),
      });
    if (message.type === 'restore') {
      controller?.restore();
      sendResponse({ ok: true });
    }
    if (message.type === 'enable' && !disabled) {
      controller?.dispose();
      controller = startAdapter(adapter, { url: currentURL(), demo: __BG_TEST__ });
      sendResponse({ state: controller.state() });
    }
  });
}
void start();

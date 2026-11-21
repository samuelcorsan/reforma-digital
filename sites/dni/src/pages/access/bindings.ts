import config from '../../../site.config.json';

export function officialAccessLink(document: Document): HTMLAnchorElement | null {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(
    (link) => {
      const url = new URL(link.href, document.baseURI);
      return (
        config.origins.includes(url.origin) &&
        url.pathname === '/citaPreviaDni/InicioDNINIE.action' &&
        !url.search &&
        link.textContent.trim() === 'Acceso con datos DNI/NIE'
      );
    },
  );
  return links.length === 1 ? links[0]! : null;
}

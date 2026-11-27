/** A real link preserves middle-click, browser navigation and context menus. */
export function AccessCard({ source }: { source: HTMLAnchorElement }) {
  return (
    <a
      className={
        'bg-card bg-surface border-0 rounded-card shadow-card font-(family-name:--bg-font) text-base leading-1.6 text-ink my-3 block max-w-[690px] p-4 no-underline hover:border-brand-600 hover:bg-brand-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600'
      }
      href={source.href}
      target={source.target || undefined}
      rel={source.rel || undefined}
    >
      <span>
        <strong className={'text-17 leading-1.4 font-semibold block text-brand-700'}>
          Acceder con DNI o NIE
        </strong>
      </span>
    </a>
  );
}

/** A real link preserves middle-click, browser navigation and context menus. */
export function AccessCard({ source }: { source: HTMLAnchorElement }) {
  return (
    <a
      className={
        'bg-card [background-color:rgb(var(--bg-surface))] border-0 [border-radius:var(--bg-radius-card)] [box-shadow:var(--bg-shadow-card)] [font-family:var(--bg-font)] text-base [line-height:1.6] [color:rgb(var(--bg-ink))] my-3 block max-w-[690px] p-4 no-underline hover:border-brand-600 hover:bg-brand-50 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-brand-600'
      }
      href={source.href}
      target={source.target || undefined}
      rel={source.rel || undefined}
    >
      <span>
        <strong
          className={
            '[font-size:17px] [line-height:1.4] font-semibold [color:rgb(var(--bg-ink))] block text-brand-700'
          }
        >
          Acceder con DNI o NIE
        </strong>
      </span>
    </a>
  );
}

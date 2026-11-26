import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible';
import { Button } from '../../ui/button';
/**
 * Aviso discreto y no bloqueante cuando un adaptador no puede aplicarse
 * (DESIGN.md §3 · Aviso de fallback). La web oficial queda como la sirve la Administración.
 */
export function FallbackNotice({
  adapterName,
  reason,
  onClose,
}: {
  adapterName: string;
  reason: string;
  onClose: () => void;
}) {
  return (
    // La superficie de la extensión (como la de runtime), no la `Card` de la web.
    <div
      role="status"
      className={
        'bg-card bg-surface border-0 rounded-card shadow-card font-(family-name:--bg-font) text-base fixed bottom-3 left-3 right-3 z-[2147483646] max-w-sm p-4 text-14 leading-1.6 sm:right-auto'
      }
    >
      <p className={'text-xs leading-1.4 font-semibold tracking-eyebrow uppercase text-ink-subtle'}>
        Reforma Digital · web original
      </p>
      <p className="mt-1.5">
        La mejora «{adapterName}» no es compatible con esta versión de la página, así que se muestra
        la web oficial sin cambios.
      </p>
      <Collapsible className={'text-sm leading-normal text-ink-muted mt-2'}>
        <CollapsibleTrigger className="cursor-pointer">Detalle técnico</CollapsibleTrigger>
        <CollapsibleContent>
          <p className="mt-1 break-words">{reason}</p>
        </CollapsibleContent>
      </Collapsible>
      <Button variant="outline" type="button" onClick={onClose} className={'mt-3'}>
        Cerrar aviso
      </Button>
    </div>
  );
}

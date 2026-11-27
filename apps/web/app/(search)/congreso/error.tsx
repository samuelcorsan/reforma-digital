'use client';
import { Button } from '@reforma-digital/design/ui/button';

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main
      id="main"
      tabIndex={-1}
      data-part="cg-body"
      className={
        '[max-width:var(--container-content)] [margin:auto] pt-8 px-(--page-gutter) pb-20 [&_.sol-tabs]:mb-6 [container-type:inline-size] [&_a:not([data-slot=button][data-variant=default],_[data-slot=button][data-variant=sunset],_[data-slot=button][data-variant=outline],_[data-slot=button][data-variant=ghost],_[data-slot=button][data-size=icon],_[data-slot=button][data-size=icon-lg],_[data-part=cg-card]):hover]:underline [&_a:not([data-slot=button][data-variant=default],_[data-slot=button][data-variant=sunset],_[data-slot=button][data-variant=outline],_[data-slot=button][data-variant=ghost],_[data-slot=button][data-size=icon],_[data-slot=button][data-size=icon-lg],_[data-part=cg-card]):hover]:underline-offset-3'
      }
    >
      <h1>El Congreso no está disponible ahora</h1>
      <p>No hemos podido cargar los datos. Puedes volver a intentarlo.</p>
      <Button onClick={retry} variant="sunset" size="xl">
        Reintentar
      </Button>
    </main>
  );
}

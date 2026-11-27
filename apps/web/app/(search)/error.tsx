'use client';
import { Button } from '@reforma-digital/design/ui/button';

import { InfoPage } from '../../components/brand/info-page';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <InfoPage narrow>
      <h1>No hemos podido cargar esta página.</h1>
      <p
        data-part="info-entradilla"
        className={'[max-width:65ch] mb-10 text-(--text-secondary) text-lg leading-1.6'}
      >
        Inténtalo de nuevo en un momento.
      </p>
      <Button onClick={reset} variant="sunset" size="xl">
        Volver a intentar
      </Button>
    </InfoPage>
  );
}

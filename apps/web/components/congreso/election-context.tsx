import { GeographyVote } from '../elecciones/geography-vote';
import { Metrics } from '../elecciones/metrics';
import { Municipalities } from '../elecciones/municipalities';
import { Expiring } from '../elecciones/expiring';
import { LegislatureFigures } from '../elecciones/legislature';
import { Repeat } from '../elecciones/repeat';

export function ElectionContext({
  detail,
  query,
  page,
}: {
  detail: string;
  query: string;
  page: number;
}) {
  if (detail === 'caducan') return <Expiring />;
  if (detail === 'legislatura') return <LegislatureFigures />;
  if (detail === 'metricas') return <Metrics />;
  if (detail === 'mapa') return <Municipalities query={query} page={page} />;
  if (detail === 'voto') return <GeographyVote />;
  return <Repeat />;
}

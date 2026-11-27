import { ButtonLink } from '@reforma-digital/design/ui/button-link';
import { Icon } from '../brand/icon';

import { Intro, Section, Source } from './common';

export function Information({ section, title }: { section: string; title: string }) {
  const terms = [
    ['Pleno', 'La reunión de todos los diputados. Debate, vota y controla al Gobierno.'],
    [
      'Comisión',
      'Un grupo de diputados que trabaja sobre una materia y prepara decisiones del Pleno.',
    ],
    [
      'Proposición de ley',
      'Una iniciativa legislativa presentada por quienes tienen esa facultad, como los grupos parlamentarios.',
    ],
    ['Proyecto de ley', 'Una iniciativa legislativa que presenta el Gobierno.'],
    [
      'Real decreto-ley',
      'Una norma del Gobierno para circunstancias de extraordinaria y urgente necesidad, sujeta a convalidación en el Congreso.',
    ],
    ['Abstención', 'El diputado participa en la votación sin votar a favor ni en contra.'],
    ['No vota', 'La fuente no registra voto; no permite concluir por sí sola la causa.'],
  ];
  return (
    <>
      <Intro title={title} />
      {section === 'glosario' ? (
        <dl
          className={
            '[&_div]:py-6 [&_div]:px-0 [&_div]:border-b [&_div]:border-b-border [&_dt]:text-20 [&_dt]:font-semibold [&_dd]:[margin:8px_0_0] [&_dd]:[max-width:70ch]'
          }
        >
          {terms.map(([term, definition]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{definition}</dd>
            </div>
          ))}
        </dl>
      ) : section === 'como-ley' ? (
        <>
          <ol
            className={
              'list-none p-0 [&_li]:pt-0 [&_li]:pr-0 [&_li]:pb-6 [&_li]:pl-6 [&_li]:border-l-2 [&_li]:border-l-border [&_h3]:[margin:8px_0] [&_h3]:text-lg'
            }
          >
            {[
              'Presentación y admisión a trámite',
              'Debate y enmiendas en el Congreso',
              'Aprobación y remisión al Senado',
              'Decisión final del Congreso cuando corresponde',
              'Sanción, promulgación y publicación en el BOE',
            ].map((step) => (
              <li key={step}>
                <h2>{step}</h2>
              </li>
            ))}
          </ol>
          <p>
            El recorrido varía según el tipo de iniciativa. Cada ficha enlaza su expediente para
            consultar el procedimiento completo.
          </p>
          <Source url="https://www.congreso.es/es/funciones">Funciones del Congreso</Source>
        </>
      ) : (
        <>
          <Section title="Datos públicos, con contexto">
            <p>
              Votaciones, Diarios de Sesiones, diputados, iniciativas, preguntas, agenda e intereses
              proceden del Congreso. Los nombramientos y ceses proceden del BOE; la geografía usa
              datos del INE. Cada ficha conserva enlaces a las fuentes.
            </p>
            <p>
              Los resúmenes, tonos, temas y agrupaciones se generan con IA y pueden contener
              errores. Las citas se contrastan con el texto extraído del Diario. La transcripción
              también puede contener errores: el PDF oficial es la referencia.
            </p>
            <p>
              El histórico importado conserva análisis de Escaño Abierto. Los nuevos análisis usan
              NaN y guardan el modelo, la versión del prompt y el hash de entrada.
            </p>
          </Section>
          <Section title="Puedes reutilizarlos">
            <p>
              La API es pública, tiene filtros y permite descargar los conjuntos originales. El
              código del recolector se ha adaptado de Escaño Abierto, con licencia MIT y su
              atribución.
            </p>
            <div className={'flex flex-wrap items-center gap-3'}>
              <ButtonLink href="/api/congreso" variant="sunset" size="xl">
                Consultar la API
              </ButtonLink>
              <ButtonLink href="/api/congreso/descarga" variant="outline" size="xl">
                Descargar el histórico
              </ButtonLink>
              <ButtonLink
                href="https://github.com/jorgegarcelan/escano-abierto"
                target="_blank"
                rel="noopener noreferrer"
                variant="ghost"
                size="xl"
              >
                Código de origen <Icon name="externo" size={16} />
                <span
                  className={
                    'sr-only absolute [width:1px] [height:1px] p-0 [margin:-1px] overflow-hidden [clip:rect(0,_0,_0,_0)] whitespace-nowrap border-0'
                  }
                >
                  {' '}
                  (se abre en otra pestaña)
                </span>
              </ButtonLink>
            </div>
          </Section>
        </>
      )}
    </>
  );
}

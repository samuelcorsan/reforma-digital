import { Card, CardContent } from '@reforma-digital/design/ui/card';

export function DataLoading() {
  return (
    <div role="status">
      <span
        className={
          'sr-only absolute [width:1px] [height:1px] p-0 [margin:-1px] overflow-hidden [clip:rect(0,_0,_0,_0)] whitespace-nowrap border-0'
        }
      >
        Cargando datos del Congreso…
      </span>
      <div
        className={
          'grid [grid-template-columns:repeat(3,_minmax(0,_1fr))] gap-5 [@media(max-width:_800px)]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] [@media(max-width:_560px)]:[grid-template-columns:1fr]'
        }
        aria-hidden="true"
      >
        {[0, 1, 2].map((card) => (
          <Card
            key={card}
            render={
              <div
                data-part="cg-card"
                className={
                  '[overflow-wrap:anywhere] [&_h2]:[font-size:28px] [&_h3]:text-lg [&_h3]:[line-height:1.3] [&_h3]:[margin:12px_0] [&_p]:[color:var(--text-secondary)] [&_p]:[margin:12px_0] [&_[data-part=cg-stats]]:gap-5 [&_[data-part=cg-stats]_dd]:[font-size:28px] [&_[data-part=cg-stats]_dt]:[max-width:14ch]'
                }
              />
            }
          >
            <CardContent>
              <div
                className={
                  'h-4 my-4 [border-radius:12px] [background:var(--muted)] [&:first-child]:[width:40%] [&:last-child]:[width:75%]'
                }
              />
              <div
                className={
                  'h-4 my-4 [border-radius:12px] [background:var(--muted)] [&:first-child]:[width:40%] [&:last-child]:[width:75%]'
                }
              />
              <div
                className={
                  'h-4 my-4 [border-radius:12px] [background:var(--muted)] [&:first-child]:[width:40%] [&:last-child]:[width:75%]'
                }
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

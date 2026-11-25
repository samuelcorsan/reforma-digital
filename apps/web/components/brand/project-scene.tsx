// Escena decorativa de la extensión, para los proyectos de la portada.
import { catalogo as cifras } from './catalogo';
import { Icon } from './icon';

const { resultadosRenta: resultados, total } = cifras;

function Navegador({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={
        'flex flex-col w-full overflow-hidden rounded-t-control rounded-b-none bg-background shadow-(--shadow-overlay) text-foreground'
      }
    >
      <div
        className={
          'flex items-center gap-1.5 shrink-0 h-10 py-0 px-3 border-b border-b-border [&_i]:[width:9px] [&_i]:[height:9px] [&_i]:rounded-full [&_i]:bg-(--disabled)'
        }
      >
        <i />
        <i />
        <i />
        <span
          className={
            'inline-flex [flex:1] items-center gap-1.5 [min-width:0] [height:26px] [margin-left:6px] py-0 px-2.5 overflow-hidden rounded-full bg-muted text-(--text-secondary) text-xs whitespace-nowrap font-mono tabular-nums tracking-normal'
          }
        >
          <Icon name="candado" size={12} />
          www2.agenciatributaria.gob.es
        </span>
      </div>
      <div className={'[flex:1] [min-height:0] overflow-hidden'}>{children}</div>
    </div>
  );
}

// El texto de su celda ya cuenta lo que muestra la escena. Ocupa el alto que le den y se recorta por abajo.
export function ProjectScene() {
  return (
    <div className="@container flex h-full items-stretch" aria-hidden="true">
      <Navegador>
        <div
          className={
            'flex flex-col gap-3 p-5 [@container(max-width:_420px)]:gap-2.5 [@container(max-width:_420px)]:p-4'
          }
        >
          <span
            data-part="t-etiqueta"
            className={
              'font-mono text-xs font-medium leading-1.3 tracking-etiqueta uppercase text-(--text-secondary)'
            }
          >
            Catálogo de servicios de asistencia
          </span>
          <span
            className={
              'flex items-center gap-2 min-h-12 py-0 px-4 rounded-full inset-ring-2 inset-ring-foreground text-base'
            }
          >
            <Icon name="buscar" size={16} />
            <span className={'[flex:1]'}>renta</span>
            <span
              className={'text-(--text-secondary) text-13 font-mono tabular-nums tracking-normal'}
            >
              {resultados.length} de {total}
            </span>
          </span>
          <span className={'flex flex-col'}>
            {resultados.map((s) => (
              <span
                key={s.id}
                data-part="rc-resultado"
                className={
                  'grid gap-0.5 py-2.5 px-3.5 rounded-12 [&_+_[data-part=rc-resultado]]:[margin-top:2px] [&[data-elegido]]:bg-(--resolved) [&[data-elegido]]:inset-ring [&[data-elegido]]:inset-ring-(--link)/24 [&[data-elegido]_[data-part=rc-resultado-cat]]:text-(--link) [@container(max-width:_420px)]:py-2 [@container(max-width:_420px)]:px-3'
                }
                data-elegido={s.name === 'Renta' ? '' : undefined}
              >
                <span
                  data-part="rc-resultado-cat"
                  className={
                    'text-(--text-secondary) text-xs [@container(max-width:_420px)]:hidden font-mono tabular-nums tracking-normal'
                  }
                >
                  {s.category}
                </span>
                <span className={'text-15 font-medium leading-1.35'}>{s.name}</span>
              </span>
            ))}
          </span>
          <span
            className={
              'inline-flex [align-self:flex-start] items-center gap-2 min-h-11 py-0 px-5 rounded-full bg-foreground text-background text-15 font-medium'
            }
          >
            <Icon name="calendario" size={16} /> Solicita asistencia y cita
          </span>
        </div>
      </Navegador>
    </div>
  );
}

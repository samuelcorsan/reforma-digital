// Escena decorativa de la extensión, para los proyectos de la portada.
import { catalogo as cifras } from './catalogo';
import { Icon } from './icon';

const { resultadosRenta: resultados, total } = cifras;

function Navegador({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={
        'rc-navegador flex flex-col w-full overflow-hidden [border-radius:16px_16px_0_0] [background:var(--background)] [box-shadow:var(--shadow-overlay)] text-foreground'
      }
    >
      <div
        className={
          'rc-navegador-barra flex items-center [gap:6px] shrink-0 h-10 [padding:0_12px] [border-bottom:1px_solid_var(--border)] [&_i]:[width:9px] [&_i]:[height:9px] [&_i]:[border-radius:50%] [&_i]:[background:var(--disabled)]'
        }
      >
        <i />
        <i />
        <i />
        <span
          className={
            'rc-url inline-flex [flex:1] items-center [gap:6px] [min-width:0] [height:26px] [margin-left:6px] [padding:0_10px] overflow-hidden [border-radius:999px] [background:var(--muted)] [color:var(--text-secondary)] text-xs whitespace-nowrap t-dato [font-family:var(--font-brand-mono)] [font-variant-numeric:tabular-nums] [letter-spacing:0]'
          }
        >
          <Icon name="candado" size={12} />
          www2.agenciatributaria.gob.es
        </span>
      </div>
      <div className={'rc-navegador-cuerpo [flex:1] [min-height:0] overflow-hidden'}>
        {children}
      </div>
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
            'rc-ordenada flex flex-col gap-3 p-5 [@container(max-width:_420px)]:[gap:10px] [@container(max-width:_420px)]:p-4'
          }
        >
          <span
            className={
              't-etiqueta [font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase rc-ordenada-etiqueta [color:var(--text-secondary)]'
            }
          >
            Catálogo de servicios de asistencia
          </span>
          <span
            className={
              'rc-buscador flex items-center gap-2 min-h-12 [padding:0_16px] [border-radius:999px] [box-shadow:inset_0_0_0_2px_var(--foreground)] text-base'
            }
          >
            <Icon name="buscar" size={16} />
            <span className={'rc-buscador-texto [flex:1]'}>renta</span>
            <span
              className={
                'rc-buscador-cuenta [color:var(--text-secondary)] [font-size:13px] t-dato [font-family:var(--font-brand-mono)] [font-variant-numeric:tabular-nums] [letter-spacing:0]'
              }
            >
              {resultados.length} de {total}
            </span>
          </span>
          <span className={'rc-resultados flex flex-col'}>
            {resultados.map((s) => (
              <span
                key={s.id}
                className={
                  'rc-resultado grid [gap:2px] [padding:10px_14px] [border-radius:12px] [&_+_.rc-resultado]:[margin-top:2px] [&[data-elegido]]:[background:var(--resolved)] [&[data-elegido]]:[box-shadow:inset_0_0_0_1px_rgba(35,_70,_232,_0.24)] [&[data-elegido]_.rc-resultado-cat]:[color:var(--link)] [@container(max-width:_420px)]:[padding:8px_12px]'
                }
                data-elegido={s.name === 'Renta' ? '' : undefined}
              >
                <span
                  className={
                    'rc-resultado-cat [color:var(--text-secondary)] text-xs [@container(max-width:_420px)]:hidden t-dato [font-family:var(--font-brand-mono)] [font-variant-numeric:tabular-nums] [letter-spacing:0]'
                  }
                >
                  {s.category}
                </span>
                <span
                  className={'rc-resultado-nombre [font-size:15px] font-medium [line-height:1.35]'}
                >
                  {s.name}
                </span>
              </span>
            ))}
          </span>
          <span
            className={
              'rc-solicitar inline-flex [align-self:flex-start] items-center gap-2 min-h-11 [padding:0_20px] [border-radius:999px] [background:var(--foreground)] [color:var(--background)] [font-size:15px] font-medium'
            }
          >
            <Icon name="calendario" size={16} /> Solicita asistencia y cita
          </span>
        </div>
      </Navegador>
    </div>
  );
}

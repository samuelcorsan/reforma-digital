'use client';

import { useRef, useState } from 'react';
import { cn } from '@reforma-digital/design/lib/utils';
import { Icon } from '../brand/icon';

/** Un logo de la píldora, con el color que toma al copiar. */
type Cliente = { name: string; d: string; tinte: string; viewBox?: string };

// Al copiar, los logos crecen uno tras otro sin salirse de la píldora y se tiñen de su color, el texto sube y deja paso a
// «¡Copiado!», y el icono de copiar gira hasta ser un ✓. Solo transform, opacidad y color.
// Claude, Cursor y OpenAI (Codex), de Lobe Icons (MIT). Decorativos: el texto del botón dice qué hace.
const agentes: Cliente[] = [
  {
    name: 'Claude',
    tinte:
      'group-data-copiado:border-transparent group-data-copiado:bg-[#d97757] group-data-copiado:text-background',
    d: 'M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z',
  },
  {
    name: 'Cursor',
    tinte:
      'group-data-copiado:border-transparent group-data-copiado:bg-foreground group-data-copiado:text-background',
    d: 'M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z',
  },
  {
    name: 'Codex',
    // Negro sobre blanco, con su borde.
    tinte: 'group-data-copiado:text-foreground',
    d: 'M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z',
  },
];

/**
 * La «I» del logotipo de Instinct (instinct.com/redesign/wordmark.svg), centrada en un cuadrado. Va
 * en su propio botón: Instinct no admite MCP y su prompt apunta a /developers/instinct.md.
 */
const instinct: Cliente[] = [
  {
    name: 'Instinct',
    viewBox: '-32.93 0 80 80',
    d: 'M3.39439 65.3899V14.7324C3.39439 9.29269 2.48906 5.55294 0 1.47363H14.1442C11.6548 5.66643 10.7495 9.293 10.7495 14.7327V65.3902C10.7495 70.8299 11.6548 74.5696 14.1442 78.6495H0C2.48906 74.4561 3.39439 70.8299 3.39439 65.3902V65.3899Z',
    // Como su avatar: la «I» negra sobre blanco.
    tinte: 'group-data-copiado:text-foreground',
  },
];
const retrasos = ['delay-0', 'delay-[60ms]', 'delay-[120ms]'];
const muelle = 'ease-muelle';

/** Copia el prompt para que un agente con terminal o ficheros (Claude Code, Cursor, Codex…) se configure solo. */
export function OnboardButton({
  prompt,
  className,
  label = 'Conecta tu agente',
  title = 'Copia un prompt para que tu agente añada el servidor a su configuración',
  clientes = agentes,
}: {
  prompt: string;
  className?: string;
  label?: string;
  title?: string;
  clientes?: Cliente[];
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copy() {
    // Sin permiso de portapapeles no hay nada que hacer: las órdenes siguen a la vista en la ficha.
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'NotAllowedError')) throw error;
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      data-copiado={copied || undefined}
      title={title}
      className={cn(
        // Mismo alto que los botones `xl` (36 px a la vista, 44 px de zona de clic).
        'group relative inline-flex h-9 items-center gap-2.5 rounded-full border border-border bg-background pr-3.5 pl-1 text-15 font-medium transition duration-150 after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-muted active:scale-[0.97] motion-reduce:transition-none',
        'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-foreground',
        className,
      )}
    >
      <span className="flex" aria-hidden="true">
        {clientes.map(({ name, d, tinte, viewBox = '0 0 24 24' }, i) => (
          <span
            key={name}
            className={cn(
              '-ml-1.5 grid size-7 place-items-center rounded-full border border-border bg-background text-muted-foreground transition duration-300 first:ml-0 group-data-copiado:scale-110 motion-reduce:transition-none motion-reduce:group-data-copiado:scale-100',
              muelle,
              tinte,
              retrasos[i],
            )}
          >
            <svg viewBox={viewBox} fill="currentColor" fillRule="evenodd" className="size-3.5">
              <path d={d} />
            </svg>
          </span>
        ))}
      </span>
      <span className="grid overflow-hidden py-0.5 text-left" aria-hidden="true">
        <span className="[grid-area:1/1] transition duration-300 ease-(--ease-brand) group-data-copiado:-translate-y-full group-data-copiado:opacity-0 motion-reduce:transition-none">
          {label}
        </span>
        <span className="[grid-area:1/1] translate-y-full opacity-0 transition duration-300 ease-(--ease-brand) group-data-copiado:translate-y-0 group-data-copiado:opacity-100 motion-reduce:transition-none">
          ¡Copiado!
        </span>
      </span>
      <span className="grid text-muted-foreground" aria-hidden="true">
        <span className="[grid-area:1/1] transition duration-200 group-data-copiado:scale-50 group-data-copiado:-rotate-90 group-data-copiado:opacity-0 motion-reduce:transition-none">
          <Icon name="copiar" size={16} />
        </span>
        <span
          className={cn(
            '[grid-area:1/1] scale-50 rotate-90 text-foreground opacity-0 transition duration-300 group-data-copiado:scale-100 group-data-copiado:rotate-0 group-data-copiado:opacity-100 motion-reduce:transition-none',
            muelle,
          )}
        >
          <Icon name="hecho" size={16} />
        </span>
      </span>
      <span className="sr-only">{label}</span>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Prompt copiado. Pégalo en tu agente.' : ''}
      </span>
    </button>
  );
}

/** La píldora para Instinct, que no admite MCP: copia `instinctPrompt()`. */
export function InstinctButton({ prompt, className }: { prompt: string; className?: string }) {
  return (
    <OnboardButton
      prompt={prompt}
      className={className}
      label="Para Instinct"
      title="Copia un prompt para que Instinct consulte los datos por URL, sin conectar nada"
      clientes={instinct}
    />
  );
}

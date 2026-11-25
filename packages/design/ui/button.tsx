import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const outline =
  'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50';
const ghost =
  'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        // El sol se dibuja en al menos 134 px para que en botones cortos siga siendo una franja.
        // Entra despacio y al salir se pone: baja primero y se apaga después, sin cortes.
        sunset:
          'relative isolate overflow-hidden bg-primary text-primary-foreground before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:bg-(image:--brand-sun) before:bg-size-[max(100%,134px)_100%] before:bg-position-[50%_0] before:bg-no-repeat before:opacity-0 before:translate-y-[55%] before:[transition:opacity_400ms_ease-in_160ms,translate_560ms_cubic-bezier(0.45,0,0.55,1)] hover:before:opacity-100 hover:before:translate-y-0 hover:before:[transition:opacity_280ms_var(--ease-brand),translate_420ms_var(--ease-brand)] motion-reduce:before:translate-y-0',
        outline,
        // Una opción entre varias: en tinta mientras `aria-pressed` es true.
        toggle: `${outline} aria-pressed:bg-foreground aria-pressed:text-background`,
        secondary:
          'bg-secondary/30 text-secondary-foreground hover:bg-secondary/40 hover:backdrop-blur-md aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost,
        // Un interruptor: apagado mientras no esté pulsado (`aria-pressed`).
        quiet: `${ghost} text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground`,
        // `ghost` sobre un fondo en tinta, como el de un bloque de código.
        // Escrita entera: los hover de `ghost` chocarían con estos donde no pasa por `cn`.
        inverse:
          'text-background/70 hover:bg-background/15 hover:text-background aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        // Acciones principales de la web y las que las acompañan: 36 px a la vista y 15 px de texto;
        // un ::after invisible lleva la zona de clic a 44 px. El icono se come 2 px de su lado para
        // quedar ópticamente centrado.
        xl: 'relative h-9 gap-2 px-4 text-[15px] after:absolute after:inset-x-0 after:-inset-y-1 [&>svg]:-mx-0.5',
        icon: 'size-8',
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-9',
      },
      // Después de `size`, que fija radios propios en los tamaños pequeños.
      shape: {
        default: '',
        pill: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      shape: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  shape = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, shape, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

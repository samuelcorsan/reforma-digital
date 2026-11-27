'use client';
import { useRender } from '@base-ui/react/use-render';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { buttonVariants } from './button';

// Un enlace con el aspecto de Button. No es de shadcn: `Button` con `render` le pondría
// `role="button"` a lo que navega. Al ser una primitiva, `shadcn/no-restyle` revisa sus usos.
function ButtonLink({
  className,
  variant = 'default',
  size = 'default',
  render,
  ...props
}: useRender.ComponentProps<'a'> & VariantProps<typeof buttonVariants>) {
  return useRender({
    defaultTagName: 'a',
    render,
    // Sale como `data-slot`, `data-variant` y `data-size`, que la web usa en sus selectores.
    state: { slot: 'button', variant, size },
    props: { ...props, className: cn(buttonVariants({ variant, size, className })) },
  });
}

export { ButtonLink };

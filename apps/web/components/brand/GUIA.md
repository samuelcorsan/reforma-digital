# UI compartida

La web, la extensión y los paneles de trámites usan shadcn/ui con Base UI (`base-nova`). La configuración del monorrepo está en `components.json` y las primitivas en `packages/design/ui`.

- Reutiliza `@reforma-digital/design/ui/<componente>` y `cn` de `@reforma-digital/design/lib/utils`.
- Para enlaces con apariencia de botón: `<Link className={cn(buttonVariants({variant: 'outline'}))}>…</Link>`.
- Conserva los estilos del preset en las primitivas y usa sus variantes. No añadas colores, radios o tamaños por costumbre.
- Usa Tailwind para la composición y `packages/design/styles/theme.css` para tokens compartidos. No añadas otra implementación de botones, campos o menús.
- Esta carpeta conserva fuentes, iconos y elementos de marca.
- En la extensión conserva el puente con el formulario original y sus controles de seguridad. Los portales de Base UI deben permanecer en el Shadow DOM.

La especificación visual y de accesibilidad está en [DESIGN.md](../../../../DESIGN.md).

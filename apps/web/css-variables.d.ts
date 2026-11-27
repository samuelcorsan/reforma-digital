import 'react';

// Los valores que se calculan al pintar pasan a las clases como variables (`w-(--w)`); React no
// tipa las propiedades personalizadas en `style`.
declare module 'react' {
  interface CSSProperties {
    [variable: `--${string}`]: string | number | undefined;
  }
}

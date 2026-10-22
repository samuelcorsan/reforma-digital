import { Geist, Geist_Mono, Host_Grotesk } from 'next/font/google';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
// Sin preload: solo la usan etiquetas y datos pequeños, y no todas las páginas los muestran.
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', preload: false });
// Solo Medium: los titulares no usan otro grosor, aunque pidan `font-normal`.
const hostGrotesk = Host_Grotesk({
  subsets: ['latin'],
  weight: '500',
  variable: '--font-host-grotesk',
});

// Se monta una sola vez en el layout raíz junto a `sol-raiz`.
export const fuentesSol = `${geist.variable} ${geistMono.variable} ${hostGrotesk.variable}`;

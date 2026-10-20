import { links } from '../../../lib/site';

/** La release de GitHub que publica .github/workflows/desktop-release.yml. */
const version = '0.1.0';
const archivo = (nombre: string) =>
  `${links.repo}/releases/download/escritorio-v${version}/${nombre}`;

export type Sistema = 'macos' | 'windows' | 'linux';

/** El primer archivo de cada sistema es el que se ofrece en el botón. */
export const plataformas: {
  id: Sistema;
  nombre: string;
  detalle: string;
  archivos: { etiqueta: string; url: string }[];
}[] = [
  {
    id: 'macos',
    nombre: 'macOS',
    detalle: 'Apple silicon e Intel',
    archivos: [
      { etiqueta: 'Apple silicon (.dmg)', url: archivo(`reforma-digital-${version}-arm64.dmg`) },
      { etiqueta: 'Intel (.dmg)', url: archivo(`reforma-digital-${version}-x64.dmg`) },
    ],
  },
  {
    id: 'windows',
    nombre: 'Windows',
    detalle: 'Windows 10 y 11',
    archivos: [
      { etiqueta: 'Instalador (.exe)', url: archivo(`reforma-digital-${version}-setup.exe`) },
    ],
  },
  {
    id: 'linux',
    nombre: 'Linux',
    detalle: 'x64',
    archivos: [
      { etiqueta: '.deb', url: archivo(`reforma-digital_${version}_amd64.deb`) },
      { etiqueta: '.AppImage', url: archivo(`reforma-digital-${version}-x86_64.AppImage`) },
    ],
  },
];

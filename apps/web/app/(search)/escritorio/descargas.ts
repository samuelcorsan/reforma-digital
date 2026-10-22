import { links } from '../../../lib/site';

/**
 * La release de GitHub que publica .github/workflows/desktop-release.yml. Es también la que reciben
 * las apps instaladas como actualización (api/escritorio/actualizaciones).
 */
export const version = '0.1.0';
export const archivo = (nombre: string, v = version) =>
  `${links.repo}/releases/download/escritorio-v${v}/${nombre}`;

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

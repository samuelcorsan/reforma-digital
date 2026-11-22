// Genera data/presupuestos.json, la foto de los Presupuestos Generales del Estado que sirve el
// servidor MCP. La SEPG no tiene API y su robots.txt prohíbe rastrear, así que no se consulta en
// cada llamada: se descargan a mano los dos ZIP oficiales y se lee su carpeta de CSV.
//
//   curl -O https://www.sepg.pap.hacienda.gob.es/Presup/PGE2023Ley/MaestroDocumentos.zip      (855 MB)
//   unzip MaestroDocumentos.zip 'PGE-ROM/doc/CSV/*' -d 2023
//   curl -O https://www.sepg.pap.hacienda.gob.es/Presup/PGE2025Prorroga/MaestroDocumentos.zip (200 MB)
//   unzip MaestroDocumentos.zip 'PGE-ROM/doc/CSV/*' -d 2026
//   pnpm --filter @reforma-digital/mcp datos:presupuestos $PWD/2023/PGE-ROM/doc/CSV $PWD/2026/PGE-ROM/doc/CSV
//
// La carpeta PGE2025Prorroga es la prórroga *para* 2026: la SEPG nombra cada prórroga por el año
// prorrogado.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir2023, dir2026] = process.argv.slice(2);
if (!dir2023 || !dir2026)
  throw new Error('Uso: node presupuestos.ts <CSV de 2023> <CSV de la prórroga para 2026>');

const decoder = new TextDecoder('windows-1252');
const rows = (dir: string, file: string) =>
  decoder
    .decode(readFileSync(join(dir, file)))
    .split(/\r?\n/)
    .map((line) => line.split(';').map((cell) => cell.trim()));

// «1.495.170,54» miles de euros, en euros: los decimales de los miles son euros exactos.
const amount = (cell: string) =>
  Math.round(Number(cell.replaceAll('.', '').replace(',', '.')) * 1000);
const isAmount = (cell: string | undefined) => !!cell && /^-?[\d.]+,\d+$/.test(cell);

/** «Sección: 14 MINISTERIO DE DEFENSA» → ['14', 'MINISTERIO DE DEFENSA']. */
function header(lines: string[][], label: string) {
  for (const line of lines) {
    const m = new RegExp(`^${label}: (\\S+) (.+)$`).exec(line[1] ?? '');
    if (m) return [m[1]!, m[2]!] as const;
  }
  throw new Error(`Sin «${label}»`);
}

type Gasto = [organica: string, programa: string, articulo: string, euros: number];

/**
 * Los «Resúmenes orgánico-económicos» de cada programa: una fila por artículo de gasto y una
 * columna por servicio u organismo. Son el detalle más fino que cubre todo el presupuesto sin
 * repetir importes.
 */
function gastos(dir: string, files: string[]) {
  const lineas: Gasto[] = [];
  const secciones: Record<string, string> = {};
  const programas: Record<string, string> = {};
  const economicas: Record<string, string> = {};
  for (const file of files) {
    const lines = rows(dir, file);
    const [seccion, nombreSeccion] = header(lines, 'Sección');
    const [programa, nombrePrograma] = header(lines, 'Programa');
    secciones[seccion] = nombreSeccion;
    programas[programa] = nombrePrograma;
    const head = lines.findIndex((l) => l[0] === 'Económica');
    const columnas = lines[head]!;
    let capitulo = 0;
    let articulos = 0;
    for (const line of lines.slice(head + 1)) {
      const [codigo, nombre] = line;
      if (!codigo || !/^\d{1,2}$/.test(codigo)) continue;
      economicas[codigo] = nombre!;
      const total = amount(line.at(-2)!);
      if (codigo.length === 1) {
        capitulo += total;
        continue;
      }
      articulos += total;
      columnas.forEach((organica, i) => {
        if (/^\d{2}\.\d{2,3}$/.test(organica) && isAmount(line[i]))
          lineas.push([organica, programa, codigo, amount(line[i]!)]);
      });
    }
    // Si un capítulo viniera sin sus artículos, faltaría dinero en silencio.
    if (capitulo !== articulos)
      throw new Error(`${file}: capítulos ${capitulo} y artículos ${articulos} no cuadran`);
  }
  return { lineas, secciones, programas, economicas };
}

/** Los nombres de servicios y organismos («14.01 MINISTERIO Y SUBSECRETARÍA»), de los informes por programa. */
function organicas(dir: string, files: string[]) {
  const nombres: Record<string, string> = {};
  for (const file of files)
    for (const [codigo, , nombre] of rows(dir, file))
      if (codigo && /^\d{2}\.\d{2,3}$/.test(codigo) && nombre) nombres[codigo] = nombre;
  return nombres;
}

// Los informes R_31 de cada programa: «_3» para el Estado, organismos y resto de entidades, «_O»
// para la Seguridad Social; «_2» y «_P» son los mismos datos por servicio, con sus nombres.
function presupuesto(dir: string) {
  const files = readdirSync(dir);
  const pick = (re: RegExp) => files.filter((f) => re.test(f));
  const datos = gastos(dir, pick(/_E_R_31_(1\d\d_1_1_1_\w+_3|2_1_G_1_1_\w+_O)\.CSV$/i));
  return {
    ...datos,
    organicas: organicas(dir, pick(/_E_R_31_(1\d\d_1_1_1_\w+_2|2_1_G_1_1_\w+_P)\.CSV$/i)),
  };
}

/** Las políticas de gasto (Pensiones, Defensa…), del resumen consolidado por políticas y secciones. */
function politicas(dir: string) {
  const nombres: Record<string, string> = {};
  let total = 0;
  for (const [codigo, nombre, ...cells] of rows(dir, 'N_23_E_R_6_2_R_3_1.CSV')) {
    if (codigo && /^\d{2}$/.test(codigo)) nombres[codigo] = nombre!;
    if (nombre === 'TOTAL') total = amount(cells.at(-2)!);
  }
  return { nombres, total };
}

type Ingreso = [agente: string, economica: string, euros: number];

/**
 * Las previsiones de ingresos de 2023: las del Estado por concepto (IRPF, IVA…) y las de los
 * organismos, el resto de entidades y la Seguridad Social por artículo.
 */
function ingresos(dir: string) {
  const lineas: Ingreso[] = [];
  const economicas: Record<string, string> = {};
  for (const [codigo, nombre, ...cells] of rows(dir, 'N_23_E_R_2_101_1_2_198_1_101_1.CSV')) {
    if (!codigo || !/^\d{1,3}$/.test(codigo)) continue;
    economicas[codigo] = nombre!;
    const value = cells.find(isAmount);
    if (codigo.length > 1 && value) lineas.push(['estado', codigo, amount(value)]);
  }
  const otros = { '102': 'organismos', '103': 'resto', '105': 'seguridad_social' };
  for (const [n, agente] of Object.entries(otros))
    for (const [codigo, nombre, ...cells] of rows(dir, `N_23_E_R_6_1_${n}_1_2.CSV`)) {
      if (!codigo || !/^\d{1,2}$/.test(codigo)) continue;
      economicas[codigo] = nombre!;
      if (codigo.length === 2) lineas.push([agente, codigo, amount(cells.at(-2)!)]);
    }
  return { lineas, economicas };
}

const ley = presupuesto(dir2023);
const prorroga = presupuesto(dir2026);
const consolidado = politicas(dir2023);

// La prórroga solo vuelve a publicar el sector público administrativo con presupuesto limitativo;
// la Seguridad Social sigue con el presupuesto de 2023, que es el prorrogado.
if (Object.keys(prorroga.secciones).includes('60'))
  throw new Error('La prórroga trae la Seguridad Social: quita la copia de 2023');
const seguridadSocial = ley.lineas.filter(([organica]) => organica.startsWith('60.'));
prorroga.lineas.push(...seguridadSocial);
prorroga.secciones['60'] = ley.secciones['60']!;
for (const [codigo, nombre] of Object.entries(ley.organicas))
  if (codigo.startsWith('60.')) prorroga.organicas[codigo] = nombre;
for (const [, programa, articulo] of seguridadSocial) {
  prorroga.programas[programa] = ley.programas[programa]!;
  prorroga.economicas[articulo] ??= ley.economicas[articulo]!;
  prorroga.economicas[articulo[0]!] ??= ley.economicas[articulo[0]!]!;
}

const sum = (lineas: Gasto[]) => lineas.reduce((total, [, , , euros]) => total + euros, 0);
// Los informes por programa no repiten las transferencias internas: su suma es el total
// consolidado oficial. Si dejara de serlo, el servidor daría totales que la SEPG no publica.
if (sum(ley.lineas) !== consolidado.total)
  throw new Error(`2023 suma ${sum(ley.lineas)} y el consolidado oficial es ${consolidado.total}`);

// El servidor da por hecho que cada código de una línea tiene nombre.
for (const [anio, p] of Object.entries({ 2023: ley, 2026: prorroga }))
  for (const [organica, programa, articulo] of p.lineas)
    if (
      !p.secciones[organica.slice(0, 2)] ||
      !p.organicas[organica] ||
      !p.programas[programa] ||
      !consolidado.nombres[programa.slice(0, 2)] ||
      !p.economicas[articulo] ||
      !p.economicas[articulo.slice(0, 1)]
    )
      throw new Error(
        `${anio}: falta el nombre de algún código en ${organica} ${programa} ${articulo}`,
      );

writeFileSync(
  new URL('../data/presupuestos.json', import.meta.url),
  JSON.stringify({
    politicas: consolidado.nombres,
    2023: { ...ley, ingresos: ingresos(dir2023) },
    2026: prorroga,
  }),
);
console.log(`2023: ${ley.lineas.length} líneas; 2026: ${prorroga.lineas.length} líneas.`);

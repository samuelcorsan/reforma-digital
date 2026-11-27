// Genera data/presupuestos/<año>.json, la foto de los Presupuestos Generales del Estado que sirve
// el servidor MCP. La SEPG y la IGAE no tienen API y su robots.txt prohíbe rastrear, así que no se
// consultan en cada llamada: se descargan a mano sus ficheros y este script los lee.
//
// 1. SEPG: por cada carpeta de PRESUPUESTOS, el ZIP con toda la documentación (100-900 MB), del que
//    solo hacen falta los CSV:
//      curl -O https://www.sepg.pap.hacienda.gob.es/Presup/PGE2023Ley/MaestroDocumentos.zip
//      unzip MaestroDocumentos.zip 'PGE-ROM/doc/CSV/*' && mv PGE-ROM/doc/CSV sepg/PGE2023Ley
// 2. IGAE: por cada año, el Anexo I de la liquidación del presupuesto del Estado (Contabilidad >
//    Ejecución presupuestaria) o, si aún no hay liquidación, el del último mes publicado, guardado
//    como igae/<año>.xlsx.
// 3. pnpm --filter @reforma-digital/mcp datos:presupuestos $PWD/sepg $PWD/igae
//
// Cada prórroga se publica con el nombre del año prorrogado: PGE2025Prorroga es la de 2026. Los
// presupuestos de 2016 y anteriores solo están en HTML, no en CSV.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const [sepg, igae] = process.argv.slice(2);
if (!sepg || !igae) throw new Error('Uso: node presupuestos.ts <carpeta SEPG> <carpeta IGAE>');

/** El presupuesto de cada año: su carpeta en la SEPG y la ley que rige (la misma, o la prorrogada). */
const PRESUPUESTOS = {
  2017: { carpeta: 'PGE2017Ley', ley: 2017 },
  2018: { carpeta: 'PGE2018Ley', ley: 2018 },
  2019: { carpeta: 'PGE2018Prorroga', ley: 2018 },
  2020: { carpeta: 'PGE2019Prorroga', ley: 2018 },
  2021: { carpeta: 'PGE2021Ley', ley: 2021 },
  2022: { carpeta: 'PGE2022Ley', ley: 2022 },
  2023: { carpeta: 'PGE2023Ley', ley: 2023 },
  2024: { carpeta: 'PGE2023Prorroga', ley: 2023 },
  2025: { carpeta: 'PGE2024Prorroga', ley: 2023 },
  2026: { carpeta: 'PGE2025Prorroga', ley: 2023 },
} as const;

type Rows = string[][];
const decoder = new TextDecoder('windows-1252');

// «1.495.170,54» miles de euros, en euros: los decimales de los miles son euros exactos.
const amount = (cell: string) =>
  Math.round(Number(cell.replaceAll('.', '').replace(',', '.')) * 1000);
const isAmount = (cell: string | undefined): cell is string =>
  !!cell && /^-?[\d.]+,\d+$/.test(cell);
// Los anexos de inversiones de las empresas van en miles de euros sin decimales: «1.617».
const miles = (cell: string | undefined) => (cell ? Number(cell.replaceAll('.', '')) * 1000 : 0);
const ORGANICA = /^\d{2}\.\d{2,3}$/;
const PROGRAMA = /^\d{2}[A-ZÑ0-9]{2}$/;

// Los anexos de inversiones de la Administración y de las empresas nombran distinto unos pocos
// territorios («VIZCAYA» y «BIZKAIA»). Se unifican, con los dos nombres cuando difieren, para que
// sumen juntos y la búsqueda encuentre cualquiera.
const TERRITORIOS: Record<string, string> = {
  ALAVA: 'ARABA/ALAVA',
  'ARABA/ALAVA': 'ARABA/ALAVA',
  GUIPUZCOA: 'GIPUZKOA/GUIPUZCOA',
  GIPUZKOA: 'GIPUZKOA/GUIPUZCOA',
  VIZCAYA: 'BIZKAIA/VIZCAYA',
  BIZKAIA: 'BIZKAIA/VIZCAYA',
  'A CORUÑA': 'A CORUÑA/LA CORUÑA',
  OURENSE: 'OURENSE/ORENSE',
  GIRONA: 'GIRONA/GERONA',
  LLEIDA: 'LLEIDA/LERIDA',
  'STA. CRUZ DE TENERIFE': 'SANTA CRUZ DE TENERIFE',
  'PRINCIPADO DE ASTURIAS': 'ASTURIAS',
  'COMUNIDAD VALENCIANA': 'COMUNITAT VALENCIANA',
  'COMUNIDAD FORAL DE NAVARRA': 'NAVARRA',
  BALEARS: 'ILLES BALEARS',
  'COMUNIDAD DE MADRID': 'MADRID',
};
const territorio = (nombre: string) => TERRITORIOS[nombre] ?? nombre;

/** Busca en la cabecera «Sección: 14 MINISTERIO DE DEFENSA» → ['14', 'MINISTERIO DE DEFENSA']. */
function header(lines: Rows, label: string) {
  for (const line of lines.slice(0, 14)) {
    const m = new RegExp(`^${label}: (\\S+) (.+)$`).exec(line[1] ?? '');
    if (m) return [m[1]!, m[2]!] as const;
  }
  return undefined;
}
function must<T>(value: T | undefined | null, what: string) {
  if (value === undefined || value === null) throw new Error(`Falta ${what}`);
  return value;
}

function sepgYear(anio: number, dir: string) {
  const files = readdirSync(dir);
  const rows = (file: string, trim = true): Rows =>
    decoder
      .decode(readFileSync(join(dir, file)))
      .split(/\r?\n/)
      .map((line) => line.split(';').map((cell) => (trim ? cell.trim() : cell)));
  const pick = (re: RegExp) => files.filter((f) => re.test(f));
  const one = (re: RegExp) => {
    const found = pick(re);
    return found.length === 1 ? found[0] : undefined;
  };

  const secciones: Record<string, string> = {};
  const organicas: Record<string, string> = {};
  const programas: Record<string, string> = {};
  const economicas: Record<string, string> = {};

  // Gasto: los «Resúmenes orgánico-económicos» de cada programa, una fila por artículo y una
  // columna por órgano. Son lo único que cubre todo el presupuesto sin repetir importes («_3» del
  // Estado, organismos y entidades; «_O» de la Seguridad Social).
  const gastos: [string, string, string, number][] = [];
  for (const file of pick(/_E_R_31_(1\d\d_1_1_1_\w+_3|2_1_G_1_1_\w+_O)\.CSV$/i)) {
    const lines = rows(file);
    const [seccion, nombreSeccion] = must(header(lines, 'Sección'), `sección en ${file}`);
    const [programa, nombrePrograma] = must(header(lines, 'Programa'), `programa en ${file}`);
    secciones[seccion] = nombreSeccion;
    programas[programa] = nombrePrograma;
    const head = lines.findIndex((l) => l[0] === 'Económica');
    const columnas = lines[head]!;
    let capitulos = 0;
    let articulos = 0;
    for (const line of lines.slice(head + 1)) {
      const [codigo, nombre] = line;
      if (!codigo || !/^\d{1,2}$/.test(codigo)) continue;
      economicas[codigo] = nombre!;
      const total = amount(line.at(-2)!);
      if (codigo.length === 1) {
        capitulos += total;
        continue;
      }
      articulos += total;
      columnas.forEach((organica, i) => {
        if (ORGANICA.test(organica) && isAmount(line[i]))
          gastos.push([organica, programa, codigo, amount(line[i])]);
      });
    }
    // Si un capítulo viniera sin sus artículos, faltaría dinero en silencio.
    if (capitulos !== articulos)
      throw new Error(`${file}: capítulos ${capitulos} y artículos ${articulos} no cuadran`);
  }

  // El detalle por concepto y subconcepto («_2» y «_P»): solo lo que la ley desglosa, así que no
  // suma el artículo entero. Cada fila tiene que caber en la que la contiene.
  const detalle: [string, string, string, number, string][] = [];
  for (const file of pick(/_E_R_31_(1\d\d_1_1_1_\w+_2|2_1_G_1_1_\w+_P)\.CSV$/i)) {
    const lines = rows(file);
    const [programa] = must(header(lines, 'Programa'), `programa en ${file}`);
    let organica: string | undefined;
    for (const [c0, codigo, nombre, ...cells] of lines) {
      if (c0 && ORGANICA.test(c0)) {
        organica = c0;
        organicas[c0] = nombre!;
        continue;
      }
      if (!organica || !codigo || !/^\d{3,5}$/.test(codigo)) continue;
      const cell = cells.find(isAmount);
      if (cell) detalle.push([organica, programa, codigo, amount(cell), nombre!]);
    }
  }
  const articulo = new Map<string, number>();
  for (const [o, p, a, euros] of gastos) articulo.set(`${o}|${p}|${a}`, euros);
  const fila = new Map(detalle.map(([o, p, c, euros]) => [`${o}|${p}|${c}`, euros]));
  const hijos = new Map<string, number>();
  for (const [o, p, c, euros] of detalle) {
    let padre: string | undefined;
    for (let n = c.length - 1; n >= 2 && !padre; n--) {
      const k = `${o}|${p}|${c.slice(0, n)}`;
      if (n === 2 ? articulo.has(k) : fila.has(k)) padre = k;
    }
    if (!padre) throw new Error(`${anio}: ${o} ${p} ${c} no tiene artículo`);
    hijos.set(padre, (hijos.get(padre) ?? 0) + euros);
  }
  for (const [padre, suma] of hijos) {
    const total = articulo.get(padre) ?? fila.get(padre)!;
    if (suma > total && total >= 0)
      throw new Error(`${anio}: el detalle de ${padre} suma ${suma}, más que ${total}`);
  }

  // Políticas de gasto, y el total consolidado oficial para comprobar la suma: solo en las leyes.
  const politicas: Record<string, string> = {};
  let consolidado: number | undefined;
  const resumen = one(/_E_R_6_2_R_3_1\.CSV$/);
  if (resumen)
    for (const [codigo, nombre, ...cells] of rows(resumen)) {
      if (codigo && /^\d{2}$/.test(codigo)) politicas[codigo] = nombre!;
      if (nombre === 'TOTAL') consolidado = amount(cells.at(-2)!);
    }

  // Ingresos de cada entidad (Estado, organismos, entidades y Seguridad Social), por artículo,
  // concepto y subconcepto. Las prórrogas no publican previsiones de ingresos.
  const ingresos: [string, string, number, string][] = [];
  const agentes: Record<string, string> = {};
  for (const file of pick(/_E_R_2_10[1-5]_1_2_1\d\d_1_\d+_1\.CSV$/)) {
    const lines = rows(file);
    const [seccion] = must(header(lines, 'Sección'), `sección en ${file}`);
    const unidad =
      header(lines, 'Servicio') ?? header(lines, 'Organismo') ?? header(lines, 'Entidad');
    // Sin servicio ni organismo es un resumen de la sección, que repite sus importes.
    if (!unidad) continue;
    const [entidad, nombre] = unidad;
    const organica = `${seccion}.${entidad}`;
    organicas[organica] = nombre;
    agentes[organica] = lines[1]![1]!;
    for (const [codigo, explicacion, ...cells] of lines) {
      if (!codigo || !/^\d{2,5}$/.test(codigo)) continue;
      const cell = cells.find(isAmount);
      if (cell) ingresos.push([organica, codigo, amount(cell), explicacion!]);
    }
  }
  // Cada agente tiene que sumar lo que dice su resumen oficial por capítulos.
  for (const n of ['101', '102', '103', '104', '105']) {
    const file = one(new RegExp(`_E_R_6_1_${n}_1_[45]_1\\.CSV$`));
    if (!file) continue;
    const lines = rows(file);
    const agente = lines[1]![1]!;
    const oficial = amount(
      must(
        lines.find((l) => l[1] === 'TOTAL'),
        `total en ${file}`,
      )[2]!,
    );
    const suma = ingresos
      .filter(([o, c]) => agentes[o] === agente && c.length === 2)
      .reduce((s, [, , euros]) => s + euros, 0);
    if (suma !== oficial) throw new Error(`${anio}: ingresos de ${agente} ${suma} ≠ ${oficial}`);
  }

  // Inversiones del sector público administrativo, por comunidad y provincia (serie verde,
  // «regionalización»): un proyecto que afecta a varias provincias sale una vez por provincia con
  // su parte. Cada artículo tiene que sumar sus proyectos.
  const territorios: Record<string, string> = {};
  const regional = one(/_E_V_2_O_1_201_1_0\.CSV$/);
  if (regional)
    for (const [codigo, nombre] of rows(regional, false))
      // Las comunidades van sin sangría y las provincias con ella; los códigos se repiten.
      if (codigo && /^\d{2}$/.test(codigo.trim()) && nombre)
        territorios[nombre.startsWith(' ') ? `p${codigo.trim()}` : codigo.trim()] = nombre.trim();
  const inversiones: [
    organica: string,
    programa: string,
    articulo: string,
    proyecto: string,
    nombre: string,
    comunidad: string,
    provincia: string,
    inicio: string,
    fin: string,
    coste: number,
    euros: number,
  ][] = [];
  for (const file of pick(/_E_V_2_R_1_2\d\d_1_1\d\d_1\.CSV$/)) {
    const lines = rows(file);
    const head = must(
      lines.find((l) => l[0] === 'Org.'),
      `cabecera en ${file}`,
    );
    const iCoste = head.indexOf('Coste total');
    const iAnio = head.findIndex((c) => c.endsWith(` ${anio}`) && !c.startsWith('Proyección'));
    if (iCoste < 0 || iAnio < 0) throw new Error(`${file}: columnas ${head.join('|')}`);
    let organica = '';
    let programa = '';
    let art: string | undefined;
    let esperado = 0;
    let suma = 0;
    const cierra = () => {
      if (art !== undefined && suma !== esperado)
        throw new Error(`${file}: ${organica} ${programa} ${art} suma ${suma} ≠ ${esperado}`);
      art = undefined;
      suma = 0;
    };
    for (const l of lines) {
      if (l[0] && /^\d{2}(\.\d{2,3})?$/.test(l[0])) {
        cierra();
        organica = l[0];
        if (l[0].includes('.')) organicas[l[0]] ??= l[4]!;
      } else if (l[1] && PROGRAMA.test(l[1])) {
        cierra();
        programa = l[1];
        // Algunos proyectos son de programas sin crédito inicial propio: el anexo da su nombre.
        programas[l[1]] ??= l[4]!;
      } else if (l[2] && /^\d{2}$/.test(l[2])) {
        cierra();
        art = l[2];
        esperado = amount(l[iAnio] || '0,00');
      } else if (l[3] && /^\d{4} \d{2}/.test(l[3])) {
        const euros = amount(l[iAnio] || '0,00');
        suma += euros;
        inversiones.push([
          organica,
          programa,
          must(art, `artículo en ${file}`),
          l[3],
          l[4]!,
          territorio(must(territorios[l[7]!], `comunidad ${l[7]} en ${file}`)),
          territorio(
            must(territorios[`p${l[8]}`] ?? territorios[l[8]!], `provincia ${l[8]} en ${file}`),
          ),
          l[5]!,
          l[6]!,
          amount(l[iCoste] || '0,00'),
          euros,
        ]);
      }
    }
    cierra();
  }

  // Inversiones del sector público empresarial y fundacional (Adif, AENA, Puertos…): otra tabla
  // por entidad, en miles sin decimales, con el total de cada provincia para comprobarla.
  const empresas: [
    entidad: string,
    proyecto: string,
    nombre: string,
    comunidad: string,
    provincia: string,
    inicio: string,
    fin: string,
    coste: number,
    euros: number,
  ][] = [];
  for (const file of pick(/_E_V_2_O_(2_0_\d+|3_CO\d+)_\w*\.CSV$/)) {
    const lines = rows(file);
    // La cabecera ocupa una fila (desde 2019) o varias (antes).
    const cabecera = lines.slice(0, 8).flat();
    // En 2018 un fichero trae «error» en lugar del nombre: se nombra por su código, sin inventar.
    const entidad =
      /^ENTIDAD: (.*)$/.exec(cabecera.find((c) => c.startsWith('ENTIDAD:')) ?? '')?.[1] ??
      `Entidad ${must(/_(\d+)_\w*ROOT/.exec(file), `código en ${file}`)[1]} (sin nombre en la fuente)`;
    const columnas = must(
      lines.find((l) => l.includes('COSTE TOTAL')),
      `columnas en ${file}`,
    );
    const iAnio = columnas.indexOf(`PRESUPUESTO ${anio}`);
    const iCoste = columnas.indexOf('COSTE TOTAL');
    if (iAnio < 0) throw new Error(`${file}: columnas ${columnas.join('|')}`);
    let comunidad = '';
    let provincia = '';
    let suma = 0;
    for (const l of lines) {
      const t = l[2] ?? '';
      let m: RegExpExecArray | null;
      if ((m = /^COMUNIDAD AUTÓNOMA: (.*)$/.exec(t))) comunidad = territorio(m[1]!);
      else if ((m = /^PROVINCIA: (.*)$/.exec(t))) {
        provincia = territorio(m[1]!);
        suma = 0;
      } else if (/^TOTAL PROVINCIA: /.test(t)) {
        if (miles(l[iAnio]) !== suma)
          throw new Error(`${file}: ${provincia} suma ${suma} ≠ ${miles(l[iAnio])}`);
      } else if (l[0] && /^\d{4}$/.test(l[0])) {
        suma += miles(l[iAnio]);
        empresas.push([
          entidad,
          l[0],
          t,
          comunidad,
          provincia,
          l[4]!,
          l[5]!,
          miles(l[iCoste]),
          miles(l[iAnio]),
        ]);
      }
    }
  }

  // Tras unificar, cada territorio de una empresa tiene que existir en el anexo de la
  // Administración: si no, sus proyectos sumarían aparte.
  const conocidos = new Set(inversiones.flatMap((r) => [r[5], r[6]]));
  for (const [entidad, , , comunidad, provincia] of empresas)
    for (const t of [comunidad, provincia])
      if (inversiones.length && !conocidos.has(t))
        throw new Error(`${anio}: «${t}» de ${entidad} no está entre los territorios del anexo`);

  // Anexo de personal: efectivos por órgano, colectivo y grupo, con el total de cada colectivo
  // para comprobarlos.
  const personal: [organica: string, colectivo: string, grupo: string, efectivos: number][] = [];
  for (const file of pick(/_E_V_3_1_/)) {
    const lines = rows(file);
    const seccion = header(lines, 'Sección');
    const entidad =
      header(lines, 'Servicio') ?? header(lines, 'Organismo') ?? header(lines, 'Entidad');
    // Los resúmenes por sección repiten las cifras de sus órganos.
    if (!seccion || !entidad) continue;
    const organica = `${seccion[0]}.${entidad[0]}`;
    organicas[organica] ??= entidad[1];
    let colectivo: string | undefined;
    let suma = 0;
    for (const [codigo, descripcion, total] of lines.slice(
      lines.findIndex((l) => l[0] === 'Código') + 1,
    )) {
      if (!codigo && descripcion && !total && !descripcion.startsWith('TOTAL')) {
        colectivo = descripcion;
        suma = 0;
      } else if (descripcion?.startsWith('TOTAL ') && colectivo) {
        if (Number((total || '0').replaceAll('.', '')) !== suma)
          throw new Error(`${file}: ${colectivo} suma ${suma} ≠ ${total}`);
      } else if (codigo && colectivo && total) {
        const n = Number(total.replaceAll('.', ''));
        suma += n;
        personal.push([organica, colectivo, `${codigo} ${descripcion}`, n]);
      }
    }
  }

  return {
    notas: [] as string[],
    secciones,
    organicas,
    programas,
    economicas,
    politicas,
    consolidado,
    gastos,
    detalle,
    ingresos,
    agentes,
    inversiones,
    empresas,
    personal,
  };
}

/** Lo justo de un .xlsx (un ZIP de XML) para leer las celdas de cada hoja, sin dependencias. */
function readXlsx(path: string) {
  const buf = readFileSync(path);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const files = new Map<string, () => string>();
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = buf.readUInt16LE(eocd + 10); i > 0; i--) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLength = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    files.set(buf.toString('utf8', p + 46, p + 46 + nameLength), () =>
      (method === 8 ? inflateRawSync(data) : data).toString('utf8'),
    );
    p += 46 + nameLength + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  const xml = (name: string) => must(files.get(name), name)();
  const entities: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };
  const text = (s: string) =>
    s.replace(/&(lt|gt|quot|apos|amp|#\d+);/g, (_, e: string) =>
      e.startsWith('#') ? String.fromCodePoint(Number(e.slice(1))) : entities[e]!,
    );
  const shared = [...xml('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    text([...m[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
  );
  const rels = xml('xl/_rels/workbook.xml.rels');
  const sheets = new Map<string, (string | number | undefined)[][]>();
  for (const [, name, id] of xml('xl/workbook.xml').matchAll(
    /<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g,
  )) {
    const rel = must(
      new RegExp(
        `<Relationship [^>]*?(?:Id="${id}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${id}")`,
      ).exec(rels),
      `hoja ${name}`,
    );
    const target = `xl/${(rel[1] ?? rel[2]!).replace(/^\/?(xl\/)?/, '')}`;
    const rows = [...xml(target).matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)].map(([, row]) => {
      const cells: (string | number | undefined)[] = [];
      for (const [, col, attrs, body = ''] of row!.matchAll(
        /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
      )) {
        const type = /t="(\w+)"/.exec(attrs!)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        const i = [...col!].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
        if (type === 's') cells[i] = shared[Number(v)];
        else if (type === 'inlineStr')
          cells[i] = text(/<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? '');
        else if (type === 'str') cells[i] = text(v ?? '');
        else if (v !== undefined) cells[i] = Number(v);
      }
      return cells;
    });
    sheets.set(text(name!), rows);
  }
  return sheets;
}

/**
 * La ejecución del presupuesto del Estado por aplicación (IGAE, Anexo I): créditos iniciales,
 * definitivos y obligaciones reconocidas. Solo el Estado: los organismos y la Seguridad Social
 * llevan su propia contabilidad.
 */
function igaeYear(path: string) {
  const sheets = readXlsx(path);
  const titulos = new Set<string>();
  const programas: Record<string, string> = {};
  const organicas: Record<string, string> = {};
  const lineas: [string, string, string, number, number, number, string][] = [];
  // Una celda con «-» es un cero.
  const cents = (v: string | number | undefined) =>
    typeof v === 'number' ? Math.round(v * 100) / 100 : 0;
  for (const [name, rows] of sheets) {
    // «S5» es el resumen. «S17  21» y similares son créditos de una estructura de ministerios
    // anterior que aún se ejecutan, y cuentan.
    if (/^S5(\s|$)/.test(name) || !/^S\d{2}/.test(name)) continue;
    // La primera línea del título es el nombre de la sección; el resto, qué es y hasta cuándo.
    titulos.add(String(rows[1]![0]).split(/\r?\n/).slice(1).join(' '));
    let programa: [string, number, number, number] | undefined;
    const sumas = [0, 0, 0];
    const cierra = () => {
      if (programa && programa.slice(1).some((v, i) => Math.abs(Number(v) - sumas[i]!) > 1))
        throw new Error(`${path} ${name}: el programa ${programa[0]} no suma sus aplicaciones`);
      sumas.fill(0);
    };
    for (const row of rows.slice(2)) {
      const texto = row[1];
      if (typeof texto !== 'string') continue;
      // «0301  911O   10000  -Retribuciones básicas». Algunas aplicaciones intercalan dos
      // caracteres de centro tras el servicio («120112141M», «1001DT923R»), uno de subprograma
      // tras el programa («121M2», «121MC») o un subconcepto de siete cifras pegado al guion
      // («2902706-»): centro y subprograma se suman a su servicio y su programa.
      const m =
        /^(\d{2})(\d{2})(?:[A-Z0-9]{2})?\s*(\d{2}[A-ZÑ0-9]{2})[A-Z0-9]?\s+(\d{2,7})\s*-\s*(.*)$/.exec(
          texto,
        );
      if (m) {
        const valores = [cents(row[2]), cents(row[3]), cents(row[4])] as const;
        valores.forEach((v, i) => (sumas[i]! += v));
        lineas.push([`${m[1]}.${m[2]}`, m[3]!, m[4]!, ...valores, m[5]!.trim()]);
        if (typeof row[0] === 'string') organicas[`${m[1]}.${m[2]}`] ??= row[0];
      } else if (/^\d{2}[A-ZÑ0-9]{2}-/.test(texto)) {
        cierra();
        programa = [texto.slice(0, 4), cents(row[2]), cents(row[3]), cents(row[4])];
        programas[texto.slice(0, 4)] ??= texto.slice(5).trim();
      } else if (!texto.startsWith('TOTAL')) throw new Error(`${path} ${name}: fila «${texto}»`);
    }
    cierra();
  }
  // Todas las hojas tienen que ser del mismo corte: si no, la fecha de la foto mentiría.
  if (titulos.size !== 1)
    throw new Error(`${path}: hojas de cortes distintos: ${[...titulos].join(' | ')}`);
  const [titulo] = [...titulos] as [string];
  return {
    hasta: must(/HASTA EL (.+)$/.exec(titulo), `fecha en ${path}`)[1]!.toLowerCase(),
    liquidacion: titulo.includes('LIQUIDACIÓN'),
    lineas,
    programas,
    organicas,
  };
}

const out = new URL('../data/presupuestos/', import.meta.url);
mkdirSync(out, { recursive: true });
const hechos = new Map<number, ReturnType<typeof sepgYear>>();
for (const [key, { carpeta, ley }] of Object.entries(PRESUPUESTOS)) {
  const anio = Number(key);
  const datos = sepgYear(anio, join(sepg, carpeta));
  if (ley === anio) {
    // Los informes por programa no repiten las transferencias internas: su suma es el total
    // consolidado oficial. Si dejara de serlo, el servidor daría totales que la SEPG no publica.
    const suma = datos.gastos.reduce((s, [, , , euros]) => s + euros, 0);
    if (suma !== datos.consolidado)
      throw new Error(`${anio}: gasto ${suma} ≠ consolidado oficial ${datos.consolidado}`);
  } else {
    const base = must(hechos.get(ley), `la ley de ${ley} antes que ${anio}`);
    // Las prórrogas pueden no republicar la Seguridad Social: sigue con la ley prorrogada.
    if (!datos.secciones['60']) {
      datos.notas.push(
        `La Seguridad Social es la de la ley de ${ley}: la prórroga no la vuelve a publicar.`,
      );
      const ss = ([o]: [string, ...unknown[]]) => o.startsWith('60.');
      datos.gastos.push(...base.gastos.filter(ss));
      datos.detalle.push(...base.detalle.filter(ss));
      datos.secciones['60'] = base.secciones['60']!;
      for (const [, p] of base.gastos.filter(ss)) datos.programas[p] = base.programas[p]!;
    }
    datos.politicas = { ...base.politicas, ...datos.politicas };
    for (const [c, n] of Object.entries(base.economicas)) datos.economicas[c] ??= n;
    for (const [c, n] of Object.entries(base.organicas)) datos.organicas[c] ??= n;
  }
  // El servidor da por hecho que cada código de una línea de gasto tiene nombre.
  for (const [o, p, a] of datos.gastos)
    if (
      !datos.secciones[o.slice(0, 2)] ||
      !datos.organicas[o] ||
      !datos.programas[p] ||
      !datos.politicas[p.slice(0, 2)] ||
      !datos.economicas[a] ||
      !datos.economicas[a.slice(0, 1)]
    )
      throw new Error(`${anio}: falta el nombre de algún código en ${o} ${p} ${a}`);
  hechos.set(anio, datos);

  // Todos los años tienen ejecución: si falta el fichero, mejor fallar que publicar el año sin ella.
  const { programas, organicas, ...ejecucion } = igaeYear(join(igae, `${anio}.xlsx`));
  // Los programas y órganos creados durante el año solo están en la ejecución.
  for (const [c, nombre] of Object.entries(programas)) datos.programas[c] ??= nombre;
  for (const [c, nombre] of Object.entries(organicas)) datos.organicas[c] ??= nombre;
  const { consolidado: _, ...publicado } = datos;
  writeFileSync(new URL(`${anio}.json`, out), JSON.stringify({ ...publicado, ejecucion }));
  console.log(
    `${anio}: ${datos.gastos.length} gastos, ${datos.detalle.length} detalle, ${datos.ingresos.length} ingresos, ${datos.inversiones.length} inversiones, ${datos.empresas.length} de empresas, ${datos.personal.length} de personal, ${ejecucion.lineas.length} de ejecución`,
  );
}

// @vitest-environment node
// Subvenciones (BDNS) sin red: respuestas con la forma de la API, recortadas de las reales.
import { describe, expect, it, vi } from 'vitest';
import { buscarConcesiones, buscarConvocatorias, verConvocatoria } from './subvenciones';

describe('Subvenciones (BDNS)', () => {
  // Con la forma de las respuestas reales, recortadas; nombres y NIF son inventados.
  const detalle = (numero: string, campos: Record<string, unknown> = {}) => ({
    id: 1,
    organo: { nivel1: 'AUTONOMICA', nivel2: 'PAÍS VASCO', nivel3: 'DEPARTAMENTO DE VIVIENDA' },
    sedeElectronica: null,
    codigoBDNS: numero,
    fechaRecepcion: '2026-11-20',
    instrumentos: [{ descripcion: 'SUBVENCIÓN Y ENTREGA DINERARIA SIN CONTRAPRESTACIÓN ' }],
    tipoConvocatoria: 'Concurrencia competitiva - canónica',
    presupuestoTotal: 320000,
    mrr: false,
    descripcion: `Convocatoria ${numero}`,
    descripcionLeng: null,
    tiposBeneficiarios: [
      { descripcion: 'PYME Y PERSONAS FÍSICAS QUE DESARROLLAN ACTIVIDAD ECONÓMICA' },
    ],
    sectores: [{ descripcion: 'Otra educación', codigo: '85.5' }],
    regiones: [{ descripcion: 'ES21 - PAIS VASCO' }],
    descripcionFinalidad: 'Cultura',
    descripcionBasesReguladoras: 'RESOLUCIÓN de 6 de octubre de 2026 (BOPV nº 209)',
    urlBasesReguladoras: 'https://www.euskadi.eus/bopv',
    sePublicaDiarioOficial: true,
    abierto: false,
    fechaInicioSolicitud: null,
    fechaFinSolicitud: null,
    textInicio: null,
    textFin: null,
    ayudaEstado: null,
    urlAyudaEstado: null,
    fondos: [],
    reglamento: null,
    objetivos: [],
    sectoresProductos: [],
    documentos: [
      {
        id: 1560730,
        nombreFic: 'RESOLUCION-Convocatoria.PDF',
        descripcion: 'Texto en castellano de la convocatoria',
        long: 263068,
        datMod: '2026-11-20',
        datPublicacion: '2026-11-20',
      },
    ],
    anuncios: [
      {
        numAnuncio: 225655,
        titulo: 'Extracto',
        url: 'https://www.euskadi.eus/bopv/2026004613',
        desDiarioOficial: 'BOPV. B.O. DEL PAÍS VASCO',
        datPublicacion: '2026-11-02',
      },
    ],
    ...campos,
  });
  const fila = (numero: string) => ({
    id: 1,
    mrr: false,
    numeroConvocatoria: numero,
    descripcion: `Convocatoria ${numero}`,
    descripcionLeng: null,
    fechaRecepcion: '2026-11-20',
    nivel1: 'LOCAL',
    nivel2: 'EIBAR',
    nivel3: 'AYUNTAMIENTO DE EIBAR',
    codigoInvente: null,
  });
  const pagina = (content: unknown[], totalElements = content.length) => ({
    content,
    totalElements,
    totalPages: Math.ceil(totalElements / 10),
  });
  const regiones = [
    {
      id: 1,
      descripcion: 'ES - ESPAÑA ',
      children: [
        {
          id: 12,
          descripcion: 'ES2 - NORESTE',
          children: [
            {
              id: 13,
              descripcion: 'ES21 - PAIS VASCO',
              children: [
                { id: 15, descripcion: 'ES212 - Gipuzkoa', children: [] },
                { id: 16, descripcion: 'ES213 - Bizkaia', children: [] },
              ],
            },
          ],
        },
        {
          id: 48,
          descripcion: 'ES5 - ESTE',
          children: [
            {
              id: 54,
              descripcion: 'ES52 - COMUNIDAD VALENCIANA',
              children: [{ id: 57, descripcion: 'ES523 - Valencia / València', children: [] }],
            },
          ],
        },
      ],
    },
  ];
  // Árbol de órganos locales: provincia › municipio › órgano. Solo las hojas filtran.
  const locales = [
    {
      id: 2,
      descripcion: 'GIPUZKOA',
      children: [
        {
          id: 4362,
          descripcion: 'IRUN',
          children: [{ id: 2697, descripcion: 'AYUNTAMIENTO DE IRUN' }],
        },
        {
          id: 4347,
          descripcion: 'EIBAR',
          children: [{ id: 2043, descripcion: 'AYUNTAMIENTO DE EIBAR' }],
        },
      ],
    },
    {
      id: 37,
      descripcion: 'NAFARROA / NAVARRA',
      children: [
        {
          id: 4500,
          descripcion: 'PAMPLONA/IRUÑA',
          children: [{ id: 3300, descripcion: 'AYUNTAMIENTO DE PAMPLONA/IRUÑA' }],
        },
      ],
    },
  ];

  /** Una API con estas respuestas por ruta; el detalle de cada convocatoria, por su número. */
  function bdns(busqueda: unknown, detalles: Record<string, unknown> = {}) {
    return vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const path = url.pathname.replace('/bdnstrans/api/', '');
      if (path === 'convocatorias') {
        const d = detalles[url.searchParams.get('numConv') ?? ''];
        return d ? Response.json(d) : new Response(null, { status: 204 });
      }
      const bodies: Record<string, unknown> = {
        'convocatorias/busqueda': busqueda,
        'concesiones/busqueda': busqueda,
        regiones,
        organos: url.searchParams.get('idAdmon') === 'L' ? locales : [{ id: 1, descripcion: 'X' }],
        finalidades: [
          { descripcion: 'ACCESO A LA VIVIENDA Y FOMENTO DE LA EDIFICACIÓN', id: 8 },
          { descripcion: 'CULTURA', id: 11 },
        ],
      };
      return Response.json(bodies[path]);
    });
  }
  const pedida = (fetchImpl: ReturnType<typeof bdns>) =>
    new URL(
      fetchImpl.mock.calls
        .map(([input]) => (input instanceof Request ? input.url : input.toString()))
        .find((url) => url.includes('/busqueda')) ?? '',
    ).searchParams;

  it('tells whether a call is open from its dates and today in Madrid', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 23:30 UTC del 30 de noviembre ya es 1 de diciembre en Madrid.
    vi.setSystemTime(new Date('2026-11-30T23:30:00Z'));
    const conPlazo = async (campos: Record<string, unknown>) =>
      (await verConvocatoria(bdns(pagina([]), { 1: detalle('1', campos) }), '1')).plazo;
    const estado = async (campos: Record<string, unknown>) => (await conPlazo(campos)).estado;
    expect(
      await estado({ fechaInicioSolicitud: '2026-11-03', fechaFinSolicitud: '2026-12-01' }),
    ).toBe('abierta');
    expect(
      await estado({ fechaInicioSolicitud: '2026-11-03', fechaFinSolicitud: '2026-11-30' }),
    ).toBe('cerrada');
    expect(
      await estado({ fechaInicioSolicitud: '2026-12-02', fechaFinSolicitud: '2026-12-20' }),
    ).toBe('aun_no_abierta');
    expect(await estado({ abierto: true })).toBe('indefinida');
    // Sin fechas, un texto no se interpreta: «desconocido», con el texto para el asistente.
    expect(
      await conPlazo({ textInicio: 'Desde el día siguiente a la publicación en el BOPV' }),
    ).toMatchObject({
      estado: 'desconocido',
      texto_inicio: 'Desde el día siguiente a la publicación en el BOPV',
    });
    expect(await estado({ fechaFinSolicitud: '2026-12-15' })).toBe('desconocido');
    // Indefinida según la BDNS, pero con un fin escrito a mano: no se da por abierta.
    expect(
      await estado({ abierto: true, fechaInicioSolicitud: '2026-06-08', textFin: '30.09.2026' }),
    ).toBe('desconocido');
    vi.useRealTimers();
  });

  it('sends every filter to the API and gives the plazo of each result', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-22T10:00:00Z'));
    const fetchImpl = bdns(pagina([fila('943839'), fila('943840')], 12), {
      943839: detalle('943839', {
        fechaInicioSolicitud: '2026-11-03',
        fechaFinSolicitud: '2026-12-02',
      }),
      943840: detalle('943840', { presupuestoTotal: 0, textInicio: 'Sin plazo' }),
    });
    const result = await buscarConvocatorias(fetchImpl, {
      texto: 'eficiencia energética',
      desde: '2026-01-01',
      hasta: '2026-11-22',
      administracion: 'local',
      organo: 'eibar',
      region: 'euskadi',
      beneficiario: 'pymes_y_autonomos',
      finalidad: 'vivienda',
    });
    expect(Object.fromEntries(pedida(fetchImpl))).toEqual({
      page: '0',
      pageSize: '10',
      order: 'fechaRecepcion',
      direccion: 'desc',
      descripcion: 'eficiencia energética',
      descripcionTipoBusqueda: '1',
      fechaDesde: '01/01/2026',
      fechaHasta: '22/11/2026',
      tipoAdministracion: 'L',
      organos: '2043',
      // Euskadi con sus provincias: la API solo filtra por la región exacta.
      regiones: '13,15,16',
      tiposBeneficiario: '3',
      finalidad: '8',
      vpd: 'GE',
    });
    expect(result).toMatchObject({
      total: 12,
      paginas: 2,
      hoy: '2026-11-22',
      filtros: {
        organos: { total: 1, ejemplos: ['GIPUZKOA · EIBAR · AYUNTAMIENTO DE EIBAR'] },
        regiones: ['ES21 - PAIS VASCO'],
        finalidad: 'ACCESO A LA VIVIENDA Y FOMENTO DE LA EDIFICACIÓN',
      },
      convocatorias: [
        {
          numero: '943839',
          organo: 'LOCAL · EIBAR · AYUNTAMIENTO DE EIBAR',
          presupuesto: 320000,
          plazo: { estado: 'abierta', inicio: '2026-11-03', fin: '2026-12-02' },
          enlace: 'https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/943839',
        },
        // Un presupuesto de 0 es que no lo dan.
        { numero: '943840', presupuesto: null, plazo: { estado: 'desconocido' } },
      ],
    });
    vi.useRealTimers();
  });

  it('keeps only the open calls of the page and says how many it checked', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-22T10:00:00Z'));
    const fetchImpl = bdns(pagina([fila('1'), fila('2'), fila('3'), fila('4')], 300), {
      1: detalle('1', { fechaInicioSolicitud: '2026-11-03', fechaFinSolicitud: '2026-12-02' }),
      2: detalle('2', { fechaInicioSolicitud: '2026-01-01', fechaFinSolicitud: '2026-03-31' }),
      3: detalle('3', { textInicio: 'Desde la publicación en el BOG' }),
      // Nominativa, como la 943832 (Pollença, RD 1016/2026): la entidad nombrada tiene un plazo
      // para pedirla. Se da con su estado y marcada, no como «sin solicitud».
      4: detalle('4', {
        tipoConvocatoria: 'Concesión directa - instrumental',
        fechaInicioSolicitud: '2026-11-21',
        fechaFinSolicitud: '2026-11-27',
      }),
    });
    const result = await buscarConvocatorias(fetchImpl, { abiertas: true, pagina: 2 });
    expect(pedida(fetchImpl).get('pageSize')).toBe('20');
    expect(pedida(fetchImpl).get('page')).toBe('1');
    expect(result.abiertas).toMatchObject({
      revisadas: 4,
      por_estado: { abierta: 2, cerrada: 1, desconocido: 1 },
    });
    expect(result.abiertas?.nota).toContain('página 3');
    expect(
      result.convocatorias.map((c) => [c.numero, c.plazo.solo_beneficiarios_nombrados]),
    ).toEqual([
      ['1', undefined],
      ['4', true],
    ]);
    vi.useRealTimers();
  });

  it('matches places by whole words and refuses filters that would not filter', async () => {
    const fetchImpl = bdns(pagina([]));
    // «Valencia» es la provincia, no también la «Comunidad Valenciana».
    await buscarConvocatorias(fetchImpl, { region: 'valencia' });
    expect(pedida(fetchImpl).get('regiones')).toBe('57');
    // «Irun» no es «Iruña».
    fetchImpl.mockClear();
    await buscarConvocatorias(fetchImpl, { organo: 'Irun' });
    expect(pedida(fetchImpl).get('organos')).toBe('2697');
    await expect(buscarConvocatorias(fetchImpl, { region: 'narnia' })).rejects.toThrow(
      'Ninguna región se llama «narnia»',
    );
    // Sin ninguna palabra, el filtro lo aceptaría todo.
    await expect(buscarConvocatorias(fetchImpl, { region: '!!' })).rejects.toThrow(
      '«!!» no tiene ninguna palabra que buscar',
    );
    // Sin resultados con «Pollença», se repite con «Pollen» y se dice.
    const pollensa = vi.fn<typeof fetch>(async () => Response.json(pagina([], 0)));
    await buscarConvocatorias(pollensa, { texto: 'Pollença' });
    expect(
      pollensa.mock.calls.map(([u]) =>
        new URL(u instanceof Request ? u.url : u).searchParams.get('descripcion'),
      ),
    ).toEqual(['Pollença', 'Pollen']);
    await expect(
      buscarConvocatorias(fetchImpl, { organo: 'eibar', administracion: 'estado' }),
    ).rejects.toThrow('Ningún órgano de la administración estado');
    await expect(buscarConvocatorias(fetchImpl, { finalidad: 'cohetes' })).rejects.toThrow(
      'Las finalidades: acceso a la vivienda',
    );
    await expect(
      buscarConvocatorias(fetchImpl, { desde: '2026-11-20', hasta: '2026-11-01' }),
    ).rejects.toThrow('`desde` es posterior a `hasta`');
  });

  it('turns a page past the end, an incomplete answer or a missing call into errors', async () => {
    await expect(buscarConvocatorias(bdns(pagina([], 40)), { pagina: 5 })).rejects.toThrow(
      'La búsqueda tiene 4 páginas (40 resultados)',
    );
    await expect(buscarConvocatorias(bdns({ advertencia: 'aviso legal' }), {})).rejects.toThrow(
      'respuesta incompleta',
    );
    // Un total sin páginas no deja saber dónde están los resultados.
    await expect(buscarConvocatorias(bdns({ content: [], totalElements: 20 }), {})).rejects.toThrow(
      'respuesta incompleta',
    );
    await expect(verConvocatoria(bdns(pagina([])), '999999999')).rejects.toThrow(
      'No hay ninguna convocatoria con el número BDNS 999999999',
    );
  });

  it('gives the detail of a call with its documents and bulletin links', async () => {
    const result = await verConvocatoria(
      bdns(pagina([]), { '943839': detalle('943839', { descripcionLeng: 'EUSKARA IKASTAROAK' }) }),
      '943839',
    );
    expect(result).toMatchObject({
      titulo_cooficial: 'EUSKARA IKASTAROAK',
      instrumentos: ['SUBVENCIÓN Y ENTREGA DINERARIA SIN CONTRAPRESTACIÓN'],
      sectores: ['85.5 Otra educación'],
      bases_reguladoras: { url: 'https://www.euskadi.eus/bopv' },
      anuncios: [{ diario: 'BOPV. B.O. DEL PAÍS VASCO', publicado: '2026-11-02' }],
      documentos: [
        {
          nombre: 'RESOLUCION-Convocatoria.PDF',
          url: 'https://www.infosubvenciones.es/bdnstrans/api/convocatorias/documentos?idDocumento=1560730',
        },
      ],
    });
  });

  it('retries once when the API limits the requests', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }))
      .mockResolvedValueOnce(Response.json(detalle('943839')));
    const pending = verConvocatoria(fetchImpl, '943839');
    await vi.advanceTimersByTimeAsync(2000);
    expect((await pending).numero).toBe('943839');
    fetchImpl.mockResolvedValue(new Response('Too Many Requests', { status: 429 }));
    const limited = expect(verConvocatoria(fetchImpl, '943839')).rejects.toThrow(
      'La BDNS limita las peticiones seguidas',
    );
    await vi.advanceTimersByTimeAsync(2000);
    await limited;
    vi.useRealTimers();
  });

  it('leaves out the names of natural persons in awards and does not search them', async () => {
    const fetchImpl = bdns(
      pagina([
        {
          numeroConvocatoria: '889098',
          convocatoria: 'Ayudas al comercio',
          nivel1: 'LOCAL',
          nivel2: 'CHIPIONA',
          nivel3: 'AYUNTAMIENTO DE CHIPIONA',
          fechaConcesion: '2026-11-20',
          beneficiario: 'B12345678 EJEMPLO HOSTELERÍA, S.L',
          instrumento: 'SUBVENCIÓN Y ENTREGA DINERARIA SIN CONTRAPRESTACIÓN ',
          importe: 9441.08,
          ayudaEquivalente: 9441.08,
        },
        {
          numeroConvocatoria: '889098',
          convocatoria: 'Ayudas al comercio',
          nivel1: 'LOCAL',
          nivel2: 'CHIPIONA',
          nivel3: 'AYUNTAMIENTO DE CHIPIONA',
          fechaConcesion: '2026-11-20',
          beneficiario: '***1234** NOMBRE APELLIDO APELLIDO',
          instrumento: 'SUBVENCIÓN Y ENTREGA DINERARIA SIN CONTRAPRESTACIÓN ',
          importe: 4043.86,
          ayudaEquivalente: 4043.86,
        },
      ]),
    );
    const result = await buscarConcesiones(fetchImpl, { convocatoria: '889098' });
    expect(result.concesiones).toMatchObject([
      { nif: 'B12345678', beneficiario: 'EJEMPLO HOSTELERÍA, S.L', importe: 9441.08 },
      { nombre_omitido: true, beneficiario: null, importe: 4043.86 },
    ]);
    expect(JSON.stringify(result)).not.toContain('NOMBRE');
    expect(pedida(fetchImpl).get('numeroConvocatoria')).toBe('889098');
    await expect(buscarConcesiones(fetchImpl, { nif: '12345678Z' })).rejects.toThrow(
      'no se buscan por DNI ni NIE',
    );
    await expect(buscarConcesiones(fetchImpl, {})).rejects.toThrow('Indica `convocatoria`');
    const vacia = bdns(pagina([]));
    expect(await buscarConcesiones(vacia, { nif: 'P2801900H' })).toMatchObject({
      total: 0,
      nota: expect.stringContaining('solo publica las concesiones de los últimos años'),
    });
    // Sin resultados, se repite con el CIF como lo guarda a veces la BDNS: con ceros delante.
    expect(
      vacia.mock.calls.map(([input]) =>
        new URL(input instanceof Request ? input.url : input.toString()).searchParams.get('nifCif'),
      ),
    ).toEqual(['P2801900H', '000P2801900H']);
  });

  it('reads padded CIFs and hides any beneficiary without one', async () => {
    const concesion = (beneficiario: string) => ({
      numeroConvocatoria: '700000',
      convocatoria: 'Cooperación internacional',
      nivel1: 'ESTADO',
      nivel2: 'MINISTERIO DE ASUNTOS EXTERIORES',
      nivel3: null,
      fechaConcesion: '2026-11-20',
      beneficiario,
      instrumento: null,
      importe: 1000,
      ayudaEquivalente: 1000,
    });
    const result = await buscarConcesiones(
      bdns(
        pagina([
          concesion('000A12345678 EJEMPLO, S.A.'),
          concesion('000900000065 ENTIDAD EXTRANJERA'),
        ]),
      ),
      { convocatoria: '700000' },
    );
    expect(result.concesiones).toMatchObject([
      { nif: 'A12345678', beneficiario: 'EJEMPLO, S.A.' },
      { nombre_omitido: true, beneficiario: null },
    ]);
    // Si el CIF está guardado de las dos formas, no se da una como si fuera el total.
    await expect(
      buscarConcesiones(bdns(pagina([concesion('A12345678 EJEMPLO, S.A.')], 3)), {
        nif: 'A12345678',
      }),
    ).rejects.toThrow('guardadas de dos formas');
  });

  it('turns a page rejected by the firewall or a too long query into errors', async () => {
    const rechazo = vi.fn<typeof fetch>(
      async () =>
        new Response('<html><title>Página Rechazada</title></html>', {
          headers: { 'content-type': 'text/html; charset=iso-8859-1' },
        }),
    );
    await expect(buscarConvocatorias(rechazo, { texto: 'ventanas' })).rejects.toThrow(
      'La BDNS ha rechazado la consulta',
    );
    const muchos = [
      {
        id: 41,
        descripcion: 'MADRID',
        children: Array.from({ length: 400 }, (_, i) => ({
          id: 4000 + i,
          descripcion: `PUEBLO ${i}`,
          children: [{ id: 5000 + i, descripcion: `AYUNTAMIENTO DE PUEBLO ${i}` }],
        })),
      },
    ];
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(muchos));
    await expect(
      buscarConvocatorias(fetchImpl, { organo: 'ayuntamiento', administracion: 'local' }),
    ).rejects.toThrow('demasiados órganos');
  });

  it('finds a regional government by its usual name', async () => {
    const autonomicas = [
      {
        id: 3,
        descripcion: 'GALICIA',
        children: [
          { id: 900, descripcion: 'PRESIDENCIA DE LA XUNTA' },
          { id: 901, descripcion: 'CONSELLERÍA DE ECONOMÍA' },
        ],
      },
      { id: 4, descripcion: 'ANDALUCÍA', children: [{ id: 933, descripcion: 'AGENCIA ANDALUZA' }] },
    ];
    const fetchImpl = vi.fn<typeof fetch>(async (input) =>
      Response.json(
        (input instanceof Request ? input.url : input.toString()).includes('/organos')
          ? autonomicas
          : pagina([]),
      ),
    );
    await buscarConvocatorias(fetchImpl, {
      organo: 'Xunta de Galicia',
      administracion: 'autonomica',
    });
    expect(pedida(fetchImpl).get('organos')).toBe('900,901');
    fetchImpl.mockClear();
    await buscarConvocatorias(fetchImpl, { organo: 'xunta', administracion: 'autonomica' });
    expect(pedida(fetchImpl).get('organos')).toBe('900,901');
    fetchImpl.mockClear();
    await buscarConvocatorias(fetchImpl, {
      organo: 'Junta de Andalucía',
      administracion: 'autonomica',
    });
    expect(pedida(fetchImpl).get('organos')).toBe('933');
  });
});

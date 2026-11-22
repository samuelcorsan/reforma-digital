// @vitest-environment node
// Radioterapia sin red. Los títulos son los de licitaciones reales (o con su misma forma): cada categoría tiene uno, y
// cada cosa que se parece a radioterapia sin serlo, también.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buscarEnPlacsp,
  buscarEnTed,
  clasificar,
  consultaTed,
  createRadioterapiaMcp,
} from './radioterapia';

describe('Radioterapia: qué es y qué compra', () => {
  it.each([
    [
      'Suministro de dos aceleradores lineales gemelos para radioterapia externa',
      [],
      ['aceleradores'],
    ],
    [
      'Servicio de mantenimiento y soporte del sistema de radioterapia guiada por superficie para el posicionamiento de pacientes',
      [],
      ['sgrt', 'mantenimiento'],
    ],
    [
      'Servicio de mantenimiento con actualización tecnológica de sistema de posicionamiento y monitorización de pacientes ExacTrac Dynamic',
      ['50421000'],
      ['sgrt', 'mantenimiento', 'actualizacion'],
    ],
    // Mantenimiento con actualización: el servicio puede traer equipos nuevos, y conviene leer el pliego.
    [
      'Servicio de mantenimiento y actualización de los aceleradores lineales del hospital',
      ['50421000'],
      ['aceleradores', 'mantenimiento', 'actualizacion'],
    ],
    [
      'Suministro de un TC de simulación de gran apertura para Oncología Radioterápica',
      [],
      ['simulacion'],
    ],
    [
      'Servicio de mantenimiento integral de los tomógrafos computerizados para la planificación de radioterapia',
      [],
      ['simulacion', 'planificacion', 'mantenimiento'],
    ],
    ['Suministro de semillas de yodo-125 para braquiterapia prostática', [], ['braquiterapia']],
    [
      'Servicio de mantenimiento del equipamiento utilizado para la realización de medidas de dosimetría y de control de calidad, en relación con los tratamientos de Radioterapia',
      [],
      ['dosimetria', 'mantenimiento'],
    ],
    [
      'Licencias del sistema de planificación de tratamientos de radioterapia',
      [],
      ['planificacion'],
    ],
    ['Suministro de máscaras termoplásticas para radioterapia', [], ['inmovilizacion']],
    [
      'Prestación de la asistencia sanitaria oncológica con radiaciones ionizantes, mediante radioterapia externa, en régimen ambulatorio',
      ['85121200'],
      ['concertada'],
    ],
    ['Suministro e instalación de un equipo de protonterapia', [], ['protones_radiocirugia']],
    [
      'Obras de construcción de dos búnkeres para aceleradores lineales',
      ['45215100'],
      ['aceleradores', 'obras'],
    ],
    // Una marca que no es palabra corriente basta para saber que es radioterapia.
    ['Mantenimiento del acelerador TrueBeam', [], ['aceleradores', 'mantenimiento']],
    // Las que solo dicen «radioterapia» o solo traen el CPV no tienen categoría.
    ['Transporte sanitario de pacientes a las sesiones de radioterapia', [], []],
    ['Suministro de material fungible', ['33151400'], []],
    // Una marca que también es palabra corriente solo clasifica lo que ya es radioterapia.
    [
      'Actualización del sistema Catalyst del servicio de radioterapia',
      [],
      ['sgrt', 'actualizacion'],
    ],
    // El TC de simulación es de radioterapia aunque el título no lo diga.
    ['TAC de simulación de 64 cortes con mesa plana', [], ['simulacion']],
    // Un sincrotrón también puede ser el acelerador de un equipo de protonterapia.
    [
      'Suministro de un sistema de protonterapia basado en sincrotrón',
      [],
      ['protones_radiocirugia'],
    ],
    // Las palabras corrientes no dan categoría por estar en un edificio de radioterapia.
    ['Detectores de humo para el edificio de radioterapia', [], []],
    ['Unidad de tratamiento de aguas del servicio de radioterapia', [], []],
    // Con guion o sin «de» sigue siendo el mismo equipo.
    ['Suministro de un TC-simulador', [], ['simulacion']],
    ['Suministro de un TAC simulación', [], ['simulacion']],
  ])('%s', (titulo, cpv, categorias) => {
    expect(clasificar(titulo, cpv)).toEqual(categorias);
  });

  it.each([
    // Medicina nuclear con el CPV de radioterapia, aunque diga «radioterapia».
    [
      'Suministro de microesferas de resina con Ytrio 90 para radioembolización hepática',
      ['33151000'],
    ],
    ['Microesferas de itrio-90 para radioterapia interna selectiva', []],
    // Un acelerador de investigación o un ciclotrón de radiofarmacia con el CPV de los aceleradores.
    ['Componentes del acelerador de IFMIF-DONES', ['31643100']],
    ['Suministro de un ciclotrón para la producción de radiofármacos', ['31643100']],
    ['Suministro de un ciclotrón para la unidad de radiofarmacia', ['31643100']],
    ['Ciclotrón para la síntesis de radiofármacos PET', ['31643100']],
    // La terapia metabólica es de medicina nuclear aunque se llame «radioterapia metabólica».
    ['Suministro de radiofármacos para radioterapia metabólica', []],
    ['Adecuación de la habitación de radioterapia metabólica', []],
    ['Equipamiento para una línea de luz del sincrotrón ALBA', ['31643100']],
    ['Componentes para una línea de luz del Laboratorio de Luz Sincrotrón', ['31643100']],
    ['Suministro de catalizadores Catalyst para el laboratorio', []],
    ['Suministro de fármacos oncológicos', []],
    // «linac» está dentro de «inclinación», «aria» dentro de «variante».
    ['Mantenimiento de los mecanismos de inclinación de las camas', ['50421000']],
    ['Proyecto de la variante de la carretera', []],
    // Así titula el SAS: sin el texto no se sabe qué compra, y no se adivina.
    ['Contrato de Servicios (CONTR 2025 0000595040)', ['50421000']],
  ])('no es radioterapia: %s', (titulo, cpv) => {
    expect(clasificar(titulo, cpv)).toBeNull();
  });

  it('writes the same rule in TED syntax, and adds the category to it', () => {
    const todo = consultaTed();
    expect(todo).toContain('FT~"radioterapia"');
    expect(todo).toContain(
      'classification-cpv=33151* OR classification-cpv=31643100 OR FT~"alignrt"',
    );
    expect(todo).toContain('AND NOT (FT~"radioembolizacion"');
    // El nombre del CPV 33150000 dice «radioterapia» en compras de rehabilitación: con él hace falta algo más.
    expect(todo).toContain(
      'AND NOT (classification-cpv=33150000 AND NOT (classification-cpv=33151* OR classification-cpv=31643100 OR FT~"acelerador lineal"',
    );
    expect(consultaTed('mantenimiento')).toBe(
      `${todo} AND (classification-cpv=5042* OR FT~"mantenimiento" OR FT~"reparacion" OR FT~"asistencia tecnica" OR FT~"servicio tecnico" OR FT~"soporte tecnico" OR FT~"postventa" OR FT~"postgarantia")`,
    );
  });
});

describe('Radioterapia: búsqueda', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const SIND = 'https://contrataciondelestado.es/sindicacion/';
  const entry = (
    id: string,
    updated: string,
    title: string,
    status: string,
    project: string,
    extra = '',
  ) =>
    `<entry><id>${SIND}licitacionesPerfilesContratanteCompleto3/${id}</id><link href="https://contrataciondelestado.es/wps/poc?id=${id}"/>
    <title>${title}</title><updated>${updated}</updated>
    <cac-place-ext:ContractFolderStatus><cbc:ContractFolderID>EXP-${id}</cbc:ContractFolderID>
    <cbc-place-ext:ContractFolderStatusCode languageID="es">${status}</cbc-place-ext:ContractFolderStatusCode>
    <cac-place-ext:LocatedContractingParty><cac:Party><cac:PartyName><cbc:Name>Servicio de Salud</cbc:Name></cac:PartyName></cac:Party></cac-place-ext:LocatedContractingParty>
    <cac:ProcurementProject><cbc:Name>${title}</cbc:Name><cbc:TypeCode listURI="x">2</cbc:TypeCode>${project}</cac:ProcurementProject>${extra}
    </cac-place-ext:ContractFolderStatus></entry>`;
  const cpv = (code: string) =>
    `<cac:RequiredCommodityClassification><cbc:ItemClassificationCode listURI="x">${code}</cbc:ItemClassificationCode></cac:RequiredCommodityClassification>`;
  const nuts = (code: string) =>
    `<cac:RealizedLocation><cbc:CountrySubentityCode listURI="x">${code}</cbc:CountrySubentityCode></cac:RealizedLocation>`;
  const lot = (name: string) =>
    `<cac:ProcurementProjectLot><cbc:ID schemeName="ID_LOTE">1</cbc:ID><cac:ProcurementProject><cbc:Name>${name}</cbc:Name>${cpv('50421000')}</cac:ProcurementProject></cac:ProcurementProjectLot>`;
  const feed = (body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom">${body}</feed>`;
  const placsp = feed(
    entry(
      '1001',
      '2026-11-21T10:00:00+01:00',
      'Mantenimiento de los aceleradores lineales del hospital',
      'PUB',
      cpv('50421000') + nuts('ES120'),
    ) +
      entry('1002', '2026-11-21T09:00:00+01:00', 'Suministro de papel', 'PUB', cpv('30197630')) +
      // Sigue «PUB» en la fuente con el plazo ya vencido; y su lugar es toda Andalucía.
      entry(
        '1004',
        '2026-11-19T09:00:00+01:00',
        'Suministro de máscaras termoplásticas para radioterapia',
        'PUB',
        cpv('33151400') + nuts('ES61'),
        '<cac:TenderingProcess><cac:TenderSubmissionDeadlinePeriod><cbc:EndDate>2025-01-10</cbc:EndDate></cac:TenderSubmissionDeadlinePeriod></cac:TenderingProcess>',
      ) +
      // Lo que compra solo se ve en el lote.
      entry(
        '1003',
        '2026-11-20T09:00:00+01:00',
        'Contrato de servicios de mantenimiento de equipos',
        'ADJ',
        cpv('50421000') + nuts('ES613'),
        lot('Sistema de radioterapia guiada por superficie'),
      ),
  );
  const fetchFeeds = () =>
    vi.fn<typeof fetch>(
      async (url) =>
        new Response(
          typeof url === 'string' && url.includes('sindicacion_643') ? placsp : feed(''),
        ),
    );

  it('classifies the recent PLACSP entries, lots included, and leaves out what is not radiotherapy', async () => {
    const r = await buscarEnPlacsp(fetchFeeds(), {}, 1, 20);
    expect(r.total).toBe(3);
    expect(r.licitaciones.map((l) => [l.id, l.categorias])).toEqual([
      ['1001', ['aceleradores', 'mantenimiento']],
      ['1003', ['sgrt', 'mantenimiento']],
      ['1004', ['inmovilizacion']],
    ]);
    expect(r.revisado).toHaveLength(2);
  });

  it('does not call open what is still PUB in the source after its deadline', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-22T10:00:00Z'), toFake: ['Date'] });
    const r = await buscarEnPlacsp(fetchFeeds(), { enPlazo: true }, 1, 20);
    expect(r.licitaciones.map((l) => l.id)).toEqual(['1001']);
  });

  it('counts what is radiotherapy but has a wider place than the one asked for', async () => {
    const r = await buscarEnPlacsp(fetchFeeds(), { lugar: 'ES618' }, 1, 20);
    expect(r).toMatchObject({ total: 0, lugar_mas_amplio: 1 });
  });

  it('filters by category, place and type of notice', async () => {
    expect(
      (await buscarEnPlacsp(fetchFeeds(), { categoria: 'sgrt' }, 1, 20)).licitaciones.map(
        (l) => l.id,
      ),
    ).toEqual(['1003']);
    expect(
      (await buscarEnPlacsp(fetchFeeds(), { lugar: 'ES12' }, 1, 20)).licitaciones.map((l) => l.id),
    ).toEqual(['1001']);
    expect(
      (await buscarEnPlacsp(fetchFeeds(), { tipo: 'adjudicacion' }, 1, 20)).licitaciones.map(
        (l) => l.id,
      ),
    ).toEqual(['1003']);
  });

  it('asks TED with the category in the query and labels each notice', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({
        notices: [
          {
            'publication-number': '583348-2026',
            'notice-type': 'cn-standard',
            'publication-date': '2026-09-03+02:00',
            'title-proc': {
              spa: 'Suministro de dos aceleradores lineales gemelos para radioterapia externa',
            },
            'classification-cpv': ['31643100'],
          },
        ],
        totalNoticeCount: 1,
        timedOut: false,
      }),
    );
    const r = await buscarEnTed(fetchImpl, { categoria: 'aceleradores' }, 1, 20);
    const body = fetchImpl.mock.calls[0]?.[1]?.body;
    expect(typeof body === 'string' && (JSON.parse(body) as { query: string }).query).toContain(
      'AND (classification-cpv=31643100 OR FT~"acelerador lineal"',
    );
    expect(r.avisos.map((a) => [a.aviso, a.categorias])).toEqual([
      ['583348-2026', ['aceleradores']],
    ]);
  });

  it('classifies TED notices on the whole description, and says when the API gives too little', async () => {
    const preambulo =
      'Contratación conforme a la Ley 9/2017 de Contratos del Sector Público. '.repeat(7);
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({
        notices: [
          {
            'publication-number': '87439-2026',
            'notice-type': 'cn-standard',
            'publication-date': '2026-02-06+01:00',
            'title-proc': { spa: 'Contrato de Servicios (CONTR 2025 0000595040)' },
            'description-proc': {
              spa: `${preambulo}Mantenimiento del sistema de radioterapia guiada por superficie.`,
            },
            'classification-cpv': ['50421000'],
          },
          {
            'publication-number': '100234-2019',
            'notice-type': 'can-standard',
            'publication-date': '2019-03-04+01:00',
            'notice-title': { spa: 'España-Majadahonda: Aparatos y material para radioterapia' },
            'classification-cpv': ['33151000'],
          },
        ],
        totalNoticeCount: 2,
        timedOut: false,
      }),
    );
    const [eforms, antiguo] = (await buscarEnTed(fetchImpl, { categoria: 'sgrt' }, 1, 20)).avisos;
    expect(eforms?.categorias).toEqual(['sgrt', 'mantenimiento']);
    expect(eforms?.descripcion).toHaveLength(400);
    // De un aviso anterior a eForms solo cuenta el CPV, y el 33151 no dice qué se compra: no se sabe.
    expect(antiguo?.categorias).toBeNull();
  });

  it('classifies notices before eForms by CPV alone, not by their generic title', async () => {
    const antiguo = (aviso: string, titulo: string, cpv: string) => ({
      'publication-number': aviso,
      'notice-type': 'cn-standard',
      'publication-date': '2022-05-10+02:00',
      'notice-title': { spa: titulo },
      'classification-cpv': [cpv],
    });
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({
        notices: [
          antiguo('1-2022', 'España-Madrid: Aceleradores lineales', '31643100'),
          // TED lo encontró por el texto del anuncio, que la API no da: no se puede clasificar.
          antiguo(
            '2-2022',
            'España-Sevilla: Servicios de reparación de equipos médicos',
            '50421000',
          ),
          // Con el título contaría como radioterapia: es el nombre del CPV de un aviso de rehabilitación.
          antiguo(
            '3-2022',
            'España-Vigo: Aparatos de radioterapia, mecanoterapia, electroterapia y fisioterapia',
            '33150000',
          ),
        ],
        totalNoticeCount: 3,
        timedOut: false,
      }),
    );
    const r = await buscarEnTed(fetchImpl, {}, 1, 20);
    expect(r.avisos.map((a) => a.categorias)).toEqual([['aceleradores'], null, null]);
  });

  describe('as an MCP server', () => {
    const llamar = async (fetchImpl: typeof fetch, name: string, args: unknown) => {
      const response = await createRadioterapiaMcp(fetchImpl).fetch(
        new Request('http://localhost/mcp', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            'mcp-protocol-version': '2025-06-18',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: args },
          }),
        }),
      );
      // El manejador contesta como un evento («event: message», «data: {…}»).
      const datos = /^data: (.*)$/m.exec(await response.text());
      if (!datos?.[1]) throw new Error('El servidor no devolvió ningún mensaje');
      return JSON.parse(datos[1]) as {
        result: { isError?: boolean; content: { text: string }[] };
      };
    };

    it('still answers with TED when the PLACSP fails, and says the PLACSP failed', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async (url) =>
        typeof url === 'string' && url.includes('sindicacion')
          ? new Response('', { status: 503 })
          : Response.json({ notices: [], totalNoticeCount: 0, timedOut: false }),
      );
      const { result } = await llamar(fetchImpl, 'buscar_licitaciones', {});
      expect(result.isError).toBeFalsy();
      expect(JSON.parse(result.content[0]!.text)).toMatchObject({
        placsp: { error: 'La fuente respondió 503.' },
        ted: { total: 0, avisos: [] },
      });
    });

    it('says why each source failed when both do', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response('', { status: 503 }));
      const { result } = await llamar(fetchImpl, 'buscar_licitaciones', {});
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toBe(
        'Plataforma de Contratación: La fuente respondió 503. TED: La fuente respondió 503.',
      );
    });

    it('refuses en plazo with awards instead of answering that there are none', async () => {
      const fetchImpl = vi.fn<typeof fetch>();
      const { result } = await llamar(fetchImpl, 'buscar_licitaciones', {
        en_plazo: true,
        tipo: 'adjudicacion',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('en_plazo solo vale para convocatorias');
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('does not read the PLACSP for a TED notice number', async () => {
      const fetchImpl = vi.fn<typeof fetch>();
      const { result } = await llamar(fetchImpl, 'ver_licitacion', {
        fuente: 'placsp',
        id: '583348-2026',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toContain('aviso de TED');
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });
});

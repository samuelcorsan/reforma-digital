// @vitest-environment node
// Licitaciones de la PLACSP sin red: feeds ATOM + CODICE con la forma de los reales (recortados) para
// lo que se puede romper al leerlos.
import { describe, expect, it, vi } from 'vitest';
import { buscarLicitaciones, verLicitacion } from './contratacion';

describe('Licitaciones', () => {
  const SIND = 'https://contrataciondelestado.es/sindicacion/sindicacion_1044/';
  const HEAD = `${SIND}PlataformasAgregadasSinMenores.atom`;
  const NEXT = `${SIND}PlataformasAgregadasSinMenores_20261121_030041.atom`;
  const feed = (next: string, body: string) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><feed xmlns="http://www.w3.org/2005/Atom"><link href="${next}" rel="next"/>${body}</feed>`;
  // Entradas reales de las agregadas del 21-11-2026, recortadas a lo que se lee.
  const entry = (
    id: string,
    updated: string,
    title: string,
    status: string,
    project: string,
    extra = '',
  ) => `<entry><id>https://contrataciondelestado.es/sindicacion/PlataformasAgregadasSinMenores/${id}</id>
    <link href="https://www.contratacion.euskadi.eus/anuncio/${id}/index.html?a=1&amp;b=2"/>
    <title>${title}</title><updated>${updated}</updated>
    <cac-place-ext:ContractFolderStatus><cbc:ContractFolderID>EXP-${id}</cbc:ContractFolderID>
    <cbc-place-ext:ContractFolderStatusCode languageID="es">${status}</cbc-place-ext:ContractFolderStatusCode>
    <cac-place-ext:LocatedContractingParty><cac:Party><cac:PartyName><cbc:Name>Sociedad Fomento de San Sebastián, S.A.-Presidente</cbc:Name></cac:PartyName>
    <cac:AgentParty><cac:PartyName><cbc:Name>Gobierno Vasco</cbc:Name></cac:PartyName></cac:AgentParty></cac:Party>
    <cac-place-ext:ParentLocatedParty><cac:PartyName><cbc:Name>Sociedad Fomento de San Sebastián</cbc:Name></cac:PartyName></cac-place-ext:ParentLocatedParty></cac-place-ext:LocatedContractingParty>
    <cac:ProcurementProject><cbc:Name>${title}</cbc:Name><cbc:TypeCode listURI="x">3</cbc:TypeCode>${project}</cac:ProcurementProject>${extra}
    <cac:TenderingProcess><cbc:ProcedureCode>1</cbc:ProcedureCode><cac:TenderSubmissionDeadlinePeriod><cbc:EndDate>2026-12-09</cbc:EndDate><cbc:EndTime>09:30:00</cbc:EndTime></cac:TenderSubmissionDeadlinePeriod></cac:TenderingProcess>
    </cac-place-ext:ContractFolderStatus></entry>`;
  const budget = (sin: string, con: string) =>
    `<cac:BudgetAmount><cbc:EstimatedOverallContractAmount currencyID="EUR">${sin}</cbc:EstimatedOverallContractAmount><cbc:TotalAmount currencyID="EUR">${con}</cbc:TotalAmount><cbc:TaxExclusiveAmount currencyID="EUR">${sin}</cbc:TaxExclusiveAmount></cac:BudgetAmount>`;
  const cpv = (code: string) =>
    `<cac:RequiredCommodityClassification><cbc:ItemClassificationCode listURI="x">${code}</cbc:ItemClassificationCode></cac:RequiredCommodityClassification>`;
  const nuts = (code: string) =>
    `<cac:RealizedLocation><cbc:CountrySubentityCode listURI="x">${code}</cbc:CountrySubentityCode></cac:RealizedLocation>`;
  const lot = (id: string, name: string, code: string) =>
    `<cac:ProcurementProjectLot><cbc:ID schemeName="ID_LOTE">${id}</cbc:ID><cac:ProcurementProject><cbc:Name>${name}&#xD;
</cbc:Name>${budget('1000', '1210')}${cpv(code)}${nuts('ES212')}</cac:ProcurementProject></cac:ProcurementProjectLot>`;
  const award = (lote: string, winner: string, nif = 'B00000000') =>
    `<cac:TenderResult><cbc:ResultCode listURI="x">8</cbc:ResultCode><cbc:AwardDate>2026-11-06</cbc:AwardDate><cbc:ReceivedTenderQuantity>3</cbc:ReceivedTenderQuantity>
    <cac:WinningParty><cac:PartyIdentification><cbc:ID schemeName="NIF">${nif}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>${winner}</cbc:Name></cac:PartyName></cac:WinningParty>
    <cac:AwardedTenderedProject><cbc:ProcurementProjectLotID>${lote}</cbc:ProcurementProjectLotID><cac:LegalMonetaryTotal><cbc:TaxExclusiveAmount currencyID="EUR">900</cbc:TaxExclusiveAmount><cbc:PayableAmount currencyID="EUR">1089</cbc:PayableAmount></cac:LegalMonetaryTotal></cac:AwardedTenderedProject></cac:TenderResult>`;

  const page1 = feed(
    NEXT,
    `<at:deleted-entry ref="https://contrataciondelestado.es/sindicacion/PlataformasAgregadasSinMenores/7721657" when="2026-11-22T00:02:10.506+01:00"><at:comment type="CERRADA"/></at:deleted-entry>` +
      entry(
        '20881482',
        '2026-11-21T09:11:21.918+01:00',
        'Renovación de la carpintería exterior del colegio',
        'ADJ',
        budget('2000', '2420'),
        lot('1', 'Ventanas de aluminio', '44221100') +
          lot('2', 'Puertas', '44221200') +
          award('1', 'CARPINTERÍA METÁLICA URUMEA, S.L.') +
          award('2', 'PUERTAS &amp; CIA, S.L.'),
      ) +
      entry(
        '20849627',
        '2026-11-21T09:11:21.987+01:00',
        'Servicio de atención presencial del Proyecto Talent House',
        'EV',
        budget('71992.28', '87110.66') + cpv('79342320') + nuts('ES212'),
      ) +
      entry(
        '20977272',
        '2026-11-21T19:11:11.194+01:00',
        'Carpintería de Kultur Birika',
        'PUB',
        cpv('45421000'),
      ),
  );
  // La página anterior trae una versión vieja de un expediente ya leído y uno borrado.
  const page2 = feed(
    'https://ejemplo.org/otra.atom',
    entry(
      '20849627',
      '2026-11-20T10:00:00.000+01:00',
      'Versión antigua',
      'PUB',
      budget('1', '1') + cpv('45421000') + nuts('ES212'),
    ) +
      entry(
        '7721657',
        '2026-11-20T09:00:00.000+01:00',
        'Carpintería borrada',
        'PUB',
        cpv('45421000') + nuts('ES212'),
      ) +
      entry(
        '20558211',
        '2026-11-19T15:12:18.251+01:00',
        'Sustitución de carpintería exterior en Ribabellosa',
        'EV',
        budget('135798.95', '164316.73') + cpv('45421130') + nuts('ES211'),
      ) +
      // Un lugar de ejecución más amplio que la provincia: todo el País Vasco.
      entry(
        '20500001',
        '2026-11-19T10:00:00.000+01:00',
        'Carpintería de las sedes de Euskadi',
        'ADJ',
        cpv('45421000') + nuts('ES21'),
      ),
  );
  const feeds = () =>
    vi.fn<typeof fetch>(async (url) => {
      if (url === HEAD) return new Response(page1);
      if (url === NEXT) return new Response(page2);
      return new Response('no', { status: 404 });
    });
  const base = { fuente: 'agregadas' as const, paginas: 2, limite: 20 };

  it('filters by province, CPV prefix and words without accents, newest version first', async () => {
    const fetchImpl = feeds();
    const result = await buscarLicitaciones(fetchImpl, {
      ...base,
      paginas: 3,
      provincia: 'Guipúzcoa',
      cpv: '45421000-4',
      texto: 'CARPINTERIA',
    });
    expect(result.provincia).toEqual({ nuts: 'ES212', nombre: 'Gipuzkoa' });
    // 20977272 no tiene lugar de ejecución: no se cuela, y se dice cuántas así había.
    expect(result.sin_lugar_de_ejecucion).toBe(1);
    // 20500001 es de todo el País Vasco: tampoco sale, pero se cuenta.
    expect(result.lugar_mas_amplio).toBe(1);
    expect(result.revisado).toEqual([
      expect.objectContaining({
        paginas: 2,
        licitaciones: 5,
        desde: '2026-11-19T10:00:00.000+01:00',
        hasta: '2026-11-21T19:11:11.194+01:00',
      }),
    ]);
    // La versión antigua de 20849627 cumpliría el filtro y la borrada también: ninguna sale.
    expect(result.total).toBe(0);
    // Ni se pide la página siguiente de otra web.
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const alava = await buscarLicitaciones(feeds(), { ...base, provincia: 'araba', cpv: '4542' });
    expect(alava.licitaciones).toEqual([
      expect.objectContaining({
        id: '20558211',
        plataforma: 'Gobierno Vasco',
        expediente: 'EXP-20558211',
        organo: 'Sociedad Fomento de San Sebastián, S.A.-Presidente',
        estado: 'Pendiente de adjudicación',
        tipo: 'Obras',
        procedimiento: 'Abierto',
        importe: { sin_iva: 135798.95, con_iva: 164316.73, valor_estimado: 135798.95 },
        lugar: { nuts: 'ES211', nombre: 'Araba/Álava' },
        plazo_presentacion: '2026-12-09 09:30:00',
      }),
    ]);
    // Los lotes cuentan para la provincia y el CPV, y el resumen trae los adjudicatarios.
    const ventanas = await buscarLicitaciones(feeds(), {
      ...base,
      provincia: 'ES21',
      cpv: '44221',
    });
    expect(ventanas.licitaciones).toEqual([
      expect.objectContaining({
        id: '20881482',
        estado: 'Adjudicada',
        cpv: ['44221100', '44221200'],
        lotes: 2,
        // Lo del contrato, no lo de sus lotes.
        lugar: undefined,
        importe: { sin_iva: 2000, con_iva: 2420, valor_estimado: 2000 },
        adjudicatarios: ['CARPINTERÍA METÁLICA URUMEA, S.L.', 'PUERTAS & CIA, S.L.'],
        enlace: 'https://www.contratacion.euskadi.eus/anuncio/20881482/index.html?a=1&b=2',
      }),
    ]);
  });

  it('sorts both pages newest first and filters by state', async () => {
    const all = await buscarLicitaciones(feeds(), base);
    expect(all.licitaciones.map((l) => l.id)).toEqual([
      '20977272',
      '20849627',
      '20881482',
      '20558211',
      '20500001',
    ]);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-11-22T12:00:00Z'));
      // La versión antigua de 20849627 estaba en plazo; la vigente, no.
      const enPlazo = await buscarLicitaciones(feeds(), { ...base, estado: 'en_plazo' });
      expect(enPlazo.licitaciones.map((l) => l.id)).toEqual(['20977272']);
      // La fuente la sigue dando «en plazo» después del 2026-12-09, pero ya no lo está.
      vi.setSystemTime(new Date('2026-12-10T12:00:00Z'));
      const cerrada = await buscarLicitaciones(feeds(), { ...base, estado: 'en_plazo' });
      expect(cerrada.total).toBe(0);
      // Y sin filtro sale con el plazo vencido, no «en plazo». A las 00:30 de Madrid ya es otro día.
      vi.setSystemTime(new Date('2026-12-09T23:30:00Z'));
      const todas = await buscarLicitaciones(feeds(), base);
      expect(todas.licitaciones.find((l) => l.id === '20977272')).toMatchObject({
        estado: 'Plazo vencido',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('takes a short CPV as a prefix as it is, and a whole one without its trailing zeros', async () => {
    // «45420» no es «4542»: 45421000 y 45421130 no empiezan por 45420.
    expect((await buscarLicitaciones(feeds(), { ...base, cpv: '45420' })).total).toBe(0);
    // El código entero 45420000 es la clase 4542: sus tres licitaciones vigentes.
    expect((await buscarLicitaciones(feeds(), { ...base, cpv: '45420000' })).total).toBe(3);
  });

  it('follows the next page whatever the order of its attributes', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (url) => {
      if (url === HEAD)
        return new Response(
          page1.replace(`<link href="${NEXT}" rel="next"/>`, `<link rel="next" href="${NEXT}" />`),
        );
      if (url === NEXT) return new Response(page2);
      return new Response('no', { status: 404 });
    });
    const result = await buscarLicitaciones(fetchImpl, base);
    expect(result.revisado).toEqual([expect.objectContaining({ paginas: 2 })]);
  });

  it('gives the lots and the award of each one', async () => {
    const result = await verLicitacion(feeds(), '20881482', 'agregadas', 2);
    expect(result.lotes[0]).toEqual({
      lote: '1',
      nombre: 'Ventanas de aluminio',
      importe: { sin_iva: 1000, con_iva: 1210, valor_estimado: 1000 },
      cpv: ['44221100'],
      lugar: { nuts: 'ES212', nombre: 'Gipuzkoa' },
    });
    expect(result.resultados[1]).toEqual({
      lote: '2',
      resultado: 'Adjudicado',
      fecha: '2026-11-06',
      ofertas_recibidas: 3,
      adjudicatarios: ['PUERTAS & CIA, S.L.'],
      importe: { sin_iva: 900, con_iva: 1089 },
    });
    expect(JSON.stringify(result)).not.toContain('B00000000');
  });

  it('does not name awardees who are natural persons', async () => {
    // Nombres y NIF inventados: un DNI, un NIE, uno que la PLACSP ya enmascara y una empresa.
    const personas = feed(
      NEXT,
      entry(
        '20000001',
        '2026-11-21T09:00:00.000+01:00',
        'Mantenimiento de jardines',
        'ADJ',
        budget('1000', '1210'),
        award('1', 'NOMBRE INVENTADO UNO', '00000000T') +
          award('2', 'NOMBRE INVENTADO DOS', 'Y0000000Z') +
          award('3', 'NOMBRE INVENTADO TRES', '***0000**') +
          award('4', 'JARDINES DE PRUEBA, S.L.'),
      ),
    );
    const result = await verLicitacion(
      vi.fn<typeof fetch>(async () => new Response(personas)),
      '20000001',
      'agregadas',
      1,
    );
    expect(result.resultados.map((r) => r.adjudicatarios)).toEqual([
      ['Persona física'],
      ['Persona física'],
      ['Persona física'],
      ['JARDINES DE PRUEBA, S.L.'],
    ]);
    expect(JSON.stringify(result)).not.toContain('INVENTADO');
  });

  it('stops reading at the tender, and says how far it read when it is not there', async () => {
    const fetchImpl = feeds();
    await verLicitacion(fetchImpl, '20849627', 'agregadas', 2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await expect(verLicitacion(feeds(), '123', 'agregadas', 2)).rejects.toThrow(
      'no está en lo leído de Plataformas autonómicas agregadas',
    );
    // Una retirada del feed no aparecerá leyendo más páginas.
    await expect(verLicitacion(feeds(), '7721657', 'agregadas', 2)).rejects.toThrow(
      'se retiró del feed como CERRADA el 2026-11-22T00:02:10.506+01:00',
    );
  });

  it('takes a single-province community whole, as entries carry ES300, ES30 or ES3', async () => {
    const madrid = await buscarLicitaciones(feeds(), { ...base, provincia: 'Madrid' });
    expect(madrid.provincia).toEqual({ nuts: 'ES3', nombre: 'Comunidad de Madrid' });
    const navarra = await buscarLicitaciones(feeds(), { ...base, provincia: 'ES220' });
    expect(navarra.provincia).toEqual({ nuts: 'ES22', nombre: 'Comunidad Foral de Navarra' });
  });

  it('refuses an unknown province before downloading, and a page that is not a feed', async () => {
    const fetchImpl = feeds();
    await expect(buscarLicitaciones(fetchImpl, { ...base, provincia: 'Narnia' })).rejects.toThrow(
      'No conozco «Narnia»',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(
      buscarLicitaciones(
        vi.fn<typeof fetch>(async () => new Response('<html>mantenimiento</html>')),
        base,
      ),
    ).rejects.toThrow('no devolvió un feed ATOM');
    // Cortado a media entrada, o sin el cierre del feed: incompleto, no una lista más corta.
    for (const cortado of [
      page1.slice(0, page1.lastIndexOf('</entry>')),
      page1.replace('</feed>', ''),
    ])
      await expect(
        buscarLicitaciones(
          vi.fn<typeof fetch>(async () => new Response(cortado)),
          { ...base, paginas: 1 },
        ),
      ).rejects.toThrow('devolvió un feed incompleto');
  });
});

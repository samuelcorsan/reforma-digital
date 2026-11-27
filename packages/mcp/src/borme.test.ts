// @vitest-environment node
// BORME sin red: sumarios y documentos con la forma de los reales (las empresas y las personas
// son inventadas) para lo que se puede romper al leerlos.
import { describe, expect, it, vi } from 'vitest';
import { actosProvincia, buscarEmpresa, inscripciones, sumarioBorme } from './borme';

describe('BORME', () => {
  // Con la forma de los documentos reales; las empresas y las personas son inventadas.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<documento>
  <metadatos><identificador>BORME-A-2026-223-20</identificador><titulo>GIPUZKOA</titulo></metadatos>
  <texto>
    <p class="articulo">500001 - TALLERES EJEMPLO &amp; HIJOS SL.</p>
    <p class="parrafo">Constitución. Comienzo de operaciones: 6.10.26. Objeto social: Asesoría. Constitución y gestión de sociedades. Domicilio: C/ MAYOR 1 (DONOSTIA). Capital: 3.000,00 Euros. Nombramientos. Adm. Unico: PERSONA UNO.  Datos registrales. S 8 , H SS 1, I/A 1 (10.11.26).</p>
    <p class="articulo">500002 - COMERCIAL PRUEBA SA.</p>
    <p class="parrafo">Cierre provisional hoja registral Art.485 TRLC. Insuficiencia de masa activa. Situación concursal. Procedimiento concursal 1/2026. Auto de declaración de concurso.- Ceses/Dimisiones. Consejero: PERSONA DOS Datos registrales. S 8 , H SS 2, I/A 9 (9.11.26).</p>
    <p class="articulo">500003 - NUEVA FORMA SL.</p>
    <p class="parrafo">Acto que aún no se conoce. Extinción.  Datos registrales. S 8 , H SS 3, I/A 4 (9.11.26).</p>
  </texto>
</documento>`;

  const item = (id: string, titulo: string) => ({
    identificador: id,
    titulo,
    url_html: `https://www.boe.es/diario_borme/txt.php?id=${id}`,
    url_xml: `https://www.boe.es/diario_borme/xml.php?id=${id}`,
    url_pdf: { texto: `https://www.boe.es/borme/dias/2026/11/20/pdfs/${id}.pdf` },
  });
  // Un solo documento llega como objeto y varios como lista, como en la API.
  const dia = {
    data: {
      sumario: {
        diario: [
          {
            numero: '223',
            sumario_diario: {
              identificador: 'BORME-S-2026-223',
              url_pdf: {
                texto: 'https://www.boe.es/borme/dias/2026/11/20/pdfs/BORME-S-2026-223.pdf',
              },
            },
            seccion: [
              {
                codigo: 'A',
                nombre: 'SECCIÓN PRIMERA. Empresarios. Actos inscritos',
                item: [
                  item('BORME-A-2026-223-01', 'ARABA/ÁLAVA'),
                  item('BORME-A-2026-223-20', 'GIPUZKOA'),
                ],
              },
              {
                codigo: 'C',
                nombre: 'SECCIÓN SEGUNDA. Anuncios y avisos legales',
                apartado: {
                  nombre: 'CONVOCATORIAS DE JUNTAS',
                  item: item('BORME-C-2026-1', 'TALLERES EJEMPLO & HIJOS, SOCIEDAD LIMITADA'),
                },
              },
            ],
          },
        ],
      },
    },
  };
  const ruta = (url: string | URL | Request) => (url instanceof Request ? url.url : url.toString());
  /** El BORME del 2026-11-20 con el documento de Gipuzkoa; los demás días, 404. */
  const borme = (status = 404) =>
    vi.fn<typeof fetch>(async (url) =>
      ruta(url).endsWith('/sumario/20261120')
        ? Response.json(dia)
        : ruta(url).includes('xml.php')
          ? new Response(xml)
          : new Response('', { status }),
    );

  it('splits each entry into its acts, with the registry data apart', () => {
    expect(inscripciones(xml)).toEqual([
      {
        numero: '500001',
        empresa: 'TALLERES EJEMPLO & HIJOS SL',
        actos: [
          {
            acto: 'Constitución',
            detalle:
              'Comienzo de operaciones: 6.10.26. Objeto social: Asesoría. Constitución y gestión de sociedades. Domicilio: C/ MAYOR 1 (DONOSTIA). Capital: 3.000,00 Euros',
          },
          { acto: 'Nombramientos', detalle: 'Adm. Unico: PERSONA UNO' },
        ],
        datos_registrales: 'S 8 , H SS 1, I/A 1 (10.11.26)',
      },
      {
        numero: '500002',
        empresa: 'COMERCIAL PRUEBA SA',
        actos: [
          {
            // El acto con su nombre de la lista; la variante del boletín, en el detalle.
            acto: 'Cierre provisional de la hoja registral',
            detalle: 'Cierre provisional hoja registral Art.485 TRLC. Insuficiencia de masa activa',
          },
          {
            acto: 'Situación concursal',
            detalle: 'Procedimiento concursal 1/2026. Auto de declaración de concurso',
          },
          { acto: 'Ceses/Dimisiones', detalle: 'Consejero: PERSONA DOS' },
        ],
        datos_registrales: 'S 8 , H SS 2, I/A 9 (9.11.26)',
      },
      {
        numero: '500003',
        empresa: 'NUEVA FORMA SL',
        // Un acto que no está en la lista no se pierde.
        actos: [
          { acto: 'Sin clasificar', detalle: 'Acto que aún no se conoce' },
          { acto: 'Extinción' },
        ],
        datos_registrales: 'S 8 , H SS 3, I/A 4 (9.11.26)',
      },
    ]);
  });

  it('reads the acts that older bulletins write without accents', () => {
    // Como en el BORME de 2009 a 2019.
    const antiguo = `<documento><texto>
    <p class="articulo">127044 - MONTAJES EJEMPLO SL.</p>
    <p class="parrafo">Ampliacion del objeto social. Montaje de instalaciones eléctricas. Pérdida del caracter de unipersonalidad. Adaptación de sociedad.  Datos registrales. T 2100 , F 1, S 8, H SS 1, I/A 5 (2.03.09).</p>
  </texto></documento>`;
    expect(inscripciones(antiguo)[0]?.actos).toEqual([
      { acto: 'Ampliación del objeto social', detalle: 'Montaje de instalaciones eléctricas' },
      { acto: 'Pérdida del carácter de unipersonalidad' },
      { acto: 'Adaptación', detalle: 'Adaptación de sociedad' },
    ]);
  });

  it('lists the documents of the day and says when there is no BORME', async () => {
    const fetchImpl = borme();
    const result = await sumarioBorme(fetchImpl, '2026-11-20');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.boe.es/datosabiertos/api/borme/sumario/20261120',
      expect.anything(),
    );
    expect(result.diarios[0]?.secciones.map((s) => s.documentos.map((d) => d.id))).toEqual([
      ['BORME-A-2026-223-01', 'BORME-A-2026-223-20'],
      ['BORME-C-2026-1'],
    ]);
    await expect(sumarioBorme(fetchImpl, '2026-11-21')).rejects.toThrow(
      'No hay BORME del 2026-11-21',
    );
    // Antes de 2009 la API no tiene el BORME, aunque se publicara.
    await expect(sumarioBorme(fetchImpl, '2008-01-02')).rejects.toThrow(
      'Los datos abiertos del BORME empiezan en 2009-01-01',
    );
  });

  it('gives the acts of a province by any of its names, filtered by type of act', async () => {
    const result = await actosProvincia(borme(), '2026-11-20', 'Guipúzcoa', {
      acto: 'concursal',
      pagina: 1,
      limite: 25,
    });
    expect(result).toMatchObject({ provincia: 'Gipuzkoa', id: 'BORME-A-2026-223-20', total: 1 });
    expect(result.inscripciones.map((i) => i.empresa)).toEqual(['COMERCIAL PRUEBA SA']);
    // El nombre de la lista encuentra el acto aunque el boletín escriba otra variante.
    expect(
      await actosProvincia(borme(), '2026-11-20', 'Gipuzkoa', {
        acto: 'Cierre provisional de la hoja registral',
        pagina: 1,
        limite: 25,
      }),
    ).toMatchObject({ total: 1 });
    // Un día con BORME pero sin documento de la provincia: cero, y dicho.
    expect(
      await actosProvincia(borme(), '2026-11-20', 'Soria', { pagina: 1, limite: 25 }),
    ).toMatchObject({
      total: 0,
      nota: 'El BORME del 2026-11-20 no publica actos inscritos de Soria.',
    });
  });

  it('refuses unknown provinces and types of act before asking the BOE', async () => {
    const fetchImpl = borme();
    const filtros = { pagina: 1, limite: 25 };
    await expect(actosProvincia(fetchImpl, '2026-11-20', 'Narnia', filtros)).rejects.toThrow(
      '«Narnia» no es una provincia',
    );
    await expect(
      actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', { ...filtros, acto: 'concurso' }),
    ).rejects.toThrow('«concurso» no es un tipo de acto');
    // «de» está en casi todos los actos: filtraría sin filtrar.
    await expect(
      actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', { ...filtros, acto: 'de' }),
    ).rejects.toThrow('El tipo de acto necesita al menos una palabra de tres letras');
    await expect(buscarEmpresa(fetchImpl, '. , .', 'Gipuzkoa', 3, '2026-11-20')).rejects.toThrow(
      'El nombre de la empresa necesita al menos una palabra',
    );
    await expect(buscarEmpresa(fetchImpl, 'talleres', 'Gipuzkoa', 3, '2999-01-01')).rejects.toThrow(
      'es una fecha futura',
    );
    // Un filtro dado pero en blanco no se ignora: la respuesta parecería filtrada.
    await expect(
      actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', { ...filtros, acto: '   ' }),
    ).rejects.toThrow('El tipo de acto necesita al menos una palabra');
    // Los días anteriores a 2009 saldrían como días sin BORME.
    await expect(buscarEmpresa(fetchImpl, 'talleres', 'Gipuzkoa', 5, '2009-01-03')).rejects.toThrow(
      'La API del BORME empieza el 2009-01-01',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('takes a type of act by its exact name before the ones that contain it', async () => {
    const cancelaciones = xml.replace(
      'Acto que aún no se conoce. Extinción.',
      'Cancelaciones de oficio de nombramientos. Adm. Unico: PERSONA TRES.',
    );
    const fetchImpl = vi.fn<typeof fetch>(async (url) =>
      ruta(url).includes('xml.php') ? new Response(cancelaciones) : Response.json(dia),
    );
    const filtros = { pagina: 1, limite: 25 };
    const nombramientos = await actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', {
      ...filtros,
      acto: 'nombramientos',
    });
    expect(nombramientos.inscripciones.map((i) => i.numero)).toEqual(['500001']);
    const canceladas = await actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', {
      ...filtros,
      acto: 'cancelaciones',
    });
    expect(canceladas.inscripciones.map((i) => i.numero)).toEqual(['500003']);
  });

  it('refuses a summary without the section of registered acts instead of reporting none', async () => {
    const sinA = structuredClone(dia);
    const diario = sinA.data.sumario.diario[0]!;
    diario.seccion = diario.seccion.filter((s) => s.codigo !== 'A');
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(sinA));
    await expect(
      actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', { pagina: 1, limite: 25 }),
    ).rejects.toThrow('El sumario del BORME no trae la sección de actos inscritos');
  });

  it('refuses a document whose entries cannot be read instead of reporting no acts', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (url) =>
      ruta(url).includes('xml.php')
        ? new Response('<documento><texto/></documento>')
        : Response.json(dia),
    );
    await expect(
      actosProvincia(fetchImpl, '2026-11-20', 'Gipuzkoa', { pagina: 1, limite: 25 }),
    ).rejects.toThrow('No se han podido leer las inscripciones de BORME-A-2026-223-20');
  });

  it('searches a company over the last days, telling which ones had no BORME', async () => {
    const result = await buscarEmpresa(
      borme(),
      'talleres ejemplo s.l.',
      'gipuzkoa',
      3,
      '2026-11-22',
    );
    expect(result).toMatchObject({
      desde: '2026-11-20',
      dias_con_borme: 1,
      dias_sin_borme: ['2026-11-22', '2026-11-21'],
      total_inscripciones: 1,
      inscripciones: [{ fecha: '2026-11-20', numero: '500001', id: 'BORME-A-2026-223-20' }],
      total_anuncios: 1,
      anuncios: [{ id: 'BORME-C-2026-1', apartado: 'CONVOCATORIAS DE JUNTAS' }],
    });
    // Si falla un día, la búsqueda falla entera: sin ese día no se sabe si hubo actos.
    await expect(
      buscarEmpresa(borme(503), 'talleres ejemplo', 'gipuzkoa', 3, '2026-11-22'),
    ).rejects.toThrow('La fuente respondió 503.');
  });
});

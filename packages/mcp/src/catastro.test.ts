// @vitest-environment node
// Catastro sin red: respuestas con la forma de la API (recortadas de las reales) para lo que se
// puede romper al leerlas y para los territorios forales, que el servicio no tiene.
import { describe, expect, it, vi } from 'vitest';
import {
  buscarCoordenadas,
  buscarDireccion,
  letrasControl,
  provinciaForal,
  verInmueble,
} from './catastro';

describe('Catastro', () => {
  // Respuestas del Catastro (recortadas de las reales) por operación, o según la consulta, y las
  // URL pedidas.
  const catastro = (respuestas: Record<string, unknown>) =>
    vi.fn<typeof fetch>(async (url) => {
      const u = new URL(url instanceof Request ? url.url : url);
      const operacion = u.pathname.split('/').at(-1)!;
      const r = respuestas[operacion];
      return Response.json({
        [`${operacion}Result`]: typeof r === 'function' ? r(u.searchParams) : r,
      });
    });
  const ninguna = {
    control: { cuerr: 1 },
    lerr: { err: [{ cod: '10', des: 'NO HAY COINCIDENCIAS EN LA BÚSQUEDA DE VÍAS' }] },
  };
  const pedida = (fetchImpl: ReturnType<typeof catastro>, operacion: string) =>
    fetchImpl.mock.calls
      .map(([u]) => new URL(u instanceof Request ? u.url : u))
      .find((u) => u.pathname.endsWith(operacion))!.searchParams;
  const dir: Record<string, string> = { cv: '2365', tv: 'CL', nv: 'FUENCARRAL', pnp: '83' };
  const unidad = (car: string, cc: string, pt: string, pu: string, luso: string) => ({
    rc: { pc1: '0555705', pc2: 'VK4705F', car, cc1: cc[0], cc2: cc[1] },
    dt: {
      np: 'MADRID',
      nm: 'MADRID',
      locs: { lous: { lourb: { dir, loint: { es: '1', pt, pu }, dp: '28004' } } },
    },
    debi: { luso, sfc: '77', cpt: '5,500000', ant: '1900' },
  });
  const bloque = {
    control: { cudnp: 3 },
    lrcdnp: {
      rcdnp: [
        unidad('0001', 'RB', '-1', 'DR', 'Comercial'),
        unidad('0004', 'UM', '01', 'DR', 'Residencial'),
        unidad('0005', 'IQ', '01', 'CN', 'Residencial'),
      ],
    },
  };
  const provincias = {
    control: { cuprov: 3 },
    provinciero: {
      prov: [
        { cpine: '03', np: 'ALACANT' },
        { cpine: '15', np: 'A CORUÑA' },
        { cpine: '28', np: 'MADRID' },
      ],
    },
  };

  it('reads a property with its constructions, and checks the control letters', async () => {
    const fetchImpl = catastro({
      Consulta_DNPRC: {
        control: { cudnp: 1, cucons: 2 },
        bico: {
          bi: {
            idbi: { cn: 'UR', rc: unidad('0004', 'UM', '01', 'DR', '').rc },
            dt: unidad('0004', 'UM', '01', 'DR', '').dt,
            ldt: 'CL FUENCARRAL 83 Es:1 Pl:01 Pt:DR 28004 MADRID (MADRID)',
            debi: { luso: 'Residencial', sfc: '77', cpt: '5,499900', ant: '1900' },
          },
          finca: {
            ltp: 'Parcela con varios inmuebles (division horizontal)',
            dff: { ss: '213' },
            infgraf: { igraf: 'https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?refcat=x' },
          },
          lcons: [
            {
              lcd: 'VIVIENDA',
              dt: { lourb: { loint: { es: '1', pt: '01', pu: 'DR' } } },
              dfcons: { stl: '70' },
              dvcons: { dtip: 'VIVIENDA COLECTIVA' },
            },
            { lcd: 'ELEMENTOS COMUNES', dfcons: { stl: '7' } },
          ],
        },
      },
    });
    const piso = await verInmueble(fetchImpl, '0555705 VK4705F 0004 um', { pagina: 1, limite: 50 });
    expect(pedida(fetchImpl, 'Consulta_DNPRC').get('RefCat')).toBe('0555705VK4705F0004UM');
    expect(piso).toMatchObject({
      referencia: '0555705VK4705F0004UM',
      clase: 'urbano',
      uso: 'Residencial',
      superficie_construida_m2: 77,
      coeficiente_participacion: 5.4999,
      año_construccion: 1900,
      planta: '01',
      parcela: { referencia: '0555705VK4705F', superficie_suelo_m2: 213 },
      construcciones: [
        { uso: 'VIVIENDA', planta: '01', puerta: 'DR', superficie_m2: 70 },
        { uso: 'ELEMENTOS COMUNES', superficie_m2: 7 },
      ],
    });
    // Letras de referencias reales, urbanas y rústica; las letras desde la O cuentan la Ñ.
    expect(letrasControl('9872023VH5797S0001WX')).toBe('WX');
    expect(letrasControl('18161A037000810000SD')).toBe('SD');
    expect(letrasControl('9653202VK3795D0316IQ')).toBe('IQ');
    await expect(
      verInmueble(fetchImpl, '0555705VK4705F0004UX', { pagina: 1, limite: 50 }),
    ).rejects.toThrow('no cuadran');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('pages the properties of a parcel and refuses a list cut short', async () => {
    const pagina2 = await verInmueble(catastro({ Consulta_DNPRC: bloque }), '0555705VK4705F', {
      pagina: 2,
      limite: 2,
    });
    expect(pagina2).toMatchObject({
      total: 3,
      pagina: 2,
      paginas: 2,
      inmuebles: [
        {
          referencia: '0555705VK4705F0005IQ',
          uso: 'Residencial',
          coeficiente_participacion: 5.5,
          direccion: 'CL FUENCARRAL 83',
          escalera: '1',
          planta: '01',
          puerta: 'CN',
        },
      ],
    });
    // En las listas el Catastro pone punto de millar en la superficie: 3.230 m² son 3230.
    const grande = {
      ...unidad('0002', 'AR', '00', 'PR', 'Comercial'),
      debi: { luso: 'Comercial', sfc: '3.230', cpt: '5,380000' },
    };
    const lista = await verInmueble(
      catastro({ Consulta_DNPRC: { control: { cudnp: 1 }, lrcdnp: { rcdnp: [grande] } } }),
      '9653202VK3795D',
      { pagina: 1, limite: 50 },
    );
    expect(lista).toMatchObject({
      inmuebles: [{ superficie_construida_m2: 3230, coeficiente_participacion: 5.38 }],
    });
    const cortada = { ...bloque, control: { cudnp: 18 } };
    await expect(
      verInmueble(catastro({ Consulta_DNPRC: cortada }), '0555705VK4705F', {
        pagina: 1,
        limite: 50,
      }),
    ).rejects.toThrow('incompleta');
  });

  it('sends foral territories to their own cadastre instead of an empty answer', async () => {
    const fetchImpl = catastro({});
    const pagina = { pagina: 1, limite: 50 };
    // Una rústica lleva la provincia delante: 20 es Gipuzkoa.
    await expect(verInmueble(fetchImpl, '20069A00100001', pagina)).rejects.toThrow(
      'Catastro de Gipuzkoa',
    );
    await expect(
      buscarDireccion(
        fetchImpl,
        { provincia: 'Vizcaya', municipio: 'Bilbao', via: 'Gran Vía', numero: 1 },
        pagina,
      ),
    ).rejects.toThrow('Catastro de Bizkaia');
    await expect(
      buscarDireccion(
        fetchImpl,
        { provincia: '31', municipio: 'Pamplona', via: 'Mayor', numero: 1 },
        pagina,
      ),
    ).rejects.toThrow('Riqueza Territorial de Navarra');
    expect(fetchImpl).not.toHaveBeenCalled();
    // El Catastro responde a una urbana de allí como a una que no existe.
    const noExiste = catastro({
      Consulta_DNPRC: {
        control: { cuerr: 1 },
        lerr: [{ cod: '5', des: 'NO EXISTE NINGÚN INMUEBLE CON LOS PARÁMETROS INDICADOS' }],
      },
    });
    await expect(verInmueble(noExiste, '9872023VH5797X', pagina)).rejects.toThrow(
      /No hay ningún inmueble.*catastro foral propio/,
    );
  });

  it('resolves names without accents and passes every filter of the address', async () => {
    const fetchImpl = catastro({
      ObtenerProvincias: provincias,
      ObtenerMunicipios: {
        control: { cumun: 2 },
        municipiero: { muni: [{ nm: 'ALICANTE/ALACANT' }, { nm: "SANT JOAN D'ALACANT" }] },
      },
      // El callejero busca sin tildes pero no sin la Ñ: «ESPANA» no sale y «ESPA» sí.
      ObtenerCallejero: (q: URLSearchParams) =>
        q.get('NomVia') === 'ESPA'
          ? {
              control: { cuca: 3 },
              callejero: {
                calle: [
                  { dir: { tv: 'AV', nv: 'CAPITAL DE ESPAÑA MADRID' } },
                  { dir: { tv: 'BO', nv: 'CHAMARTIN-NUEVA ESPAÑA' } },
                  { dir: { tv: 'PZ', nv: 'ESPAÑA' } },
                ],
              },
            }
          : ninguna,
      Consulta_DNPLOC: bloque,
    });
    const result = await buscarDireccion(
      fetchImpl,
      {
        provincia: 'Alicante',
        municipio: 'alicante',
        via: 'Plaza de Espana',
        numero: 10,
        escalera: '1',
        planta: '1',
      },
      { pagina: 1, limite: 50 },
    );
    expect(Object.fromEntries(pedida(fetchImpl, 'Consulta_DNPLOC'))).toEqual({
      Provincia: 'ALACANT',
      Municipio: 'ALICANTE/ALACANT',
      Sigla: 'PZ',
      Calle: 'ESPAÑA',
      Numero: '10',
      Bloque: '',
      Escalera: '1',
      Planta: '1',
      Puerta: '',
    });
    expect(result).toMatchObject({
      direccion: 'PZ ESPAÑA 10, ALICANTE/ALACANT (ALACANT)',
      total: 3,
    });
  });

  it('answers a wrong address with what does exist', async () => {
    const pagina = { pagina: 1, limite: 50 };
    const madrid = { provincia: 'madrid', municipio: 'Madrid', numero: 83 };
    const respuestas = (dnploc: unknown) =>
      catastro({
        ObtenerProvincias: provincias,
        ObtenerMunicipios: { control: { cumun: 1 }, municipiero: { muni: [{ nm: 'MADRID' }] } },
        ObtenerCallejero: {
          control: { cuca: 2 },
          callejero: {
            calle: [
              { dir: { tv: 'CL', nv: 'FUENCARRAL' } },
              { dir: { tv: 'CM', nv: 'FUENCARRAL' } },
            ],
          },
        },
        Consulta_DNPLOC: dnploc,
      });
    await expect(
      buscarDireccion(respuestas(bloque), { ...madrid, via: 'Fuencarral' }, pagina),
    ).rejects.toThrow('encaja con 2 vías en MADRID: CL FUENCARRAL; CM FUENCARRAL');
    await expect(
      buscarDireccion(respuestas(bloque), { ...madrid, via: 'Calle Fuencaral' }, pagina),
    ).rejects.toThrow('¿Es alguno de estos? CL FUENCARRAL; CM FUENCARRAL.');
    await expect(
      buscarDireccion(respuestas(bloque), { ...madrid, via: 'Avenida Fuencarral' }, pagina),
    ).rejects.toThrow('encaja con 2 vías');
    // Una vía que solo contiene las palabras no es la pedida: «Calle Real» no es CL CIUDAD REAL.
    const ciudadReal = catastro({
      ObtenerProvincias: provincias,
      ObtenerMunicipios: { control: { cumun: 1 }, municipiero: { muni: [{ nm: 'ALCORCON' }] } },
      ObtenerCallejero: {
        control: { cuca: 1 },
        callejero: { calle: [{ dir: { tv: 'CL', nv: 'CIUDAD REAL' } }] },
      },
      Consulta_DNPLOC: bloque,
    });
    await expect(
      buscarDireccion(ciudadReal, { ...madrid, municipio: 'Alcorcón', via: 'Calle Real' }, pagina),
    ).rejects.toThrow('¿Es alguno de estos? CL CIUDAD REAL.');
    expect(
      ciudadReal.mock.calls.some(([u]) =>
        String(u instanceof Request ? u.url : u).includes('DNPLOC'),
      ),
    ).toBe(false);
    // El número trae sus duplicados (83 y 83B): se avisa.
    const duplicado = {
      ...unidad('0006', 'OW', '00', 'A', 'Comercial'),
      rc: { ...unidad('0006', 'OW', '00', 'A', '').rc, pc1: '0555706' },
    };
    duplicado.dt.locs.lous.lourb.dir = { ...dir, plp: 'B' };
    const conDuplicado = {
      control: { cudnp: 4 },
      lrcdnp: { rcdnp: [...bloque.lrcdnp.rcdnp, duplicado] },
    };
    expect(
      await buscarDireccion(
        respuestas(conDuplicado),
        { ...madrid, via: 'Calle Fuencarral' },
        pagina,
      ),
    ).toMatchObject({ total: 4, aviso: expect.stringContaining('los números 83B') });
    const sinNumero = respuestas({
      control: { cunum: 2, cuerr: 1 },
      numerero: { nump: [{ num: { pnp: '81' } }, { num: { pnp: '85' } }, { num: { pnp: '85' } }] },
      lerr: [{ cod: '43', des: 'EL NUMERO NO EXISTE' }],
    });
    await expect(
      buscarDireccion(sinNumero, { ...madrid, via: 'Calle Fuencarral' }, pagina),
    ).rejects.toThrow('Números que sí existen: 81, 85.');
    const sinPiso = respuestas({
      control: { cuerr: 1 },
      lerr: [{ cod: '5', des: 'NO EXISTE NINGÚN INMUEBLE CON LOS PARÁMETROS INDICADOS' }],
    });
    await expect(
      buscarDireccion(sinPiso, { ...madrid, via: 'Calle Fuencarral', planta: '99' }, pagina),
    ).rejects.toThrow('no hay inmuebles con planta 99');
  });

  it('gives the parcel at a point, the nearby ones, and the foral cadastre when there is none', async () => {
    const cercanas = (lpcd?: unknown[]) =>
      catastro({
        Consulta_RCCOOR_Distancia: {
          control: { cucoor: 1 },
          coordenadas_distancias: { coordd: [{ geo: { srs: 'EPSG:4326' }, lpcd }] },
        },
      });
    const fetchImpl = cercanas([
      { pc: { pc1: '0555705', pc2: 'VK4705F' }, ldt: 'CL FUENCARRAL 83 MADRID (MADRID)', dis: '0' },
      { pc: { pc1: '0555706', pc2: 'VK4705F' }, ldt: 'CL PALMA 4 MADRID (MADRID)', dis: '1.11' },
    ]);
    expect(await buscarCoordenadas(fetchImpl, 40.4262, -3.7015)).toMatchObject({
      parcela: { referencia: '0555705VK4705F', distancia_m: 0 },
      cercanas: [{ referencia: '0555706VK4705F', distancia_m: 1.11 }],
    });
    expect(Object.fromEntries(pedida(fetchImpl, 'Consulta_RCCOOR_Distancia'))).toEqual({
      CoorX: '-3.7015',
      CoorY: '40.4262',
      SRS: 'EPSG:4326',
    });
    expect(
      await buscarCoordenadas(
        cercanas([
          { pc: { pc1: '5924026', pc2: 'TG3452S' }, ldt: 'CL FLORIDA (LA) 2', dis: '11.97' },
        ]),
        37.3891,
        -5.9845,
      ),
    ).toMatchObject({ parcela: null, cercanas: [{ distancia_m: 11.97 }] });
    // En Bizkaia junto al límite, las cercanas son de Cantabria: se dice.
    expect(
      await buscarCoordenadas(
        cercanas([
          { pc: { pc1: '39020A0', pc2: '1900041' }, ldt: 'Polígono 19 Parcela 41', dis: '13.38' },
        ]),
        43.3,
        -3.17,
      ),
    ).toMatchObject({ parcela: null, nota: expect.stringContaining('Catastro de Bizkaia') });
    // Donostia, Bilbao, Vitoria y Pamplona; el Condado de Treviño es de Burgos.
    await expect(buscarCoordenadas(cercanas(), 43.3224, -1.9846)).rejects.toThrow(
      'Catastro de Gipuzkoa',
    );
    expect([
      provinciaForal(43.263, -2.935),
      provinciaForal(42.8467, -2.6727),
      provinciaForal(42.8125, -1.6432),
      provinciaForal(42.7346, -2.7469),
    ]).toEqual(['48', '01', '31', undefined]);
    await expect(buscarCoordenadas(cercanas(), 48.85, 2.35)).rejects.toThrow(
      'No hay ninguna parcela del Catastro en ese punto',
    );
  });
});

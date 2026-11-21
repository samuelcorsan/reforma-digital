/**
 * Dominios de las administraciones públicas españolas, por sufijo de host. Marcan qué webs son
 * oficiales: el resto sale como «sin verificar», no queda como fuente citable al leerlo en el
 * navegador y la lectura oculta no lo sigue. No convierten una página en evidencia: eso lo decide
 * `sources` con sus hosts exactos.
 *
 * Lista adaptada de SpainAssist (https://github.com/MeLlamoPablo/SpainAssist,
 * packages/shared/src/official.ts), licencia MIT, © 2026 Pablo Rodríguez Caballero.
 */
const officialSuffixes = [
  // Estatales
  'gob.es boe.es agenciatributaria.es seg-social.es sepe.es dgt.es policia.es dnielectronico.es',
  'citapreviadnie.es fnmt.es guardiacivil.es mjusticia.es justicia.es catastro.minhap.es',
  'redsara.es correos.es ine.es imserso.es',
  // Autonómicas
  'juntadeandalucia.es aragon.es asturias.es caib.es gobiernodecanarias.org cantabria.es jcyl.es',
  'castillalamancha.es gencat.cat aoc.cat gva.es juntaex.es xunta.gal madrid.org comunidad.madrid',
  'carm.es navarra.es euskadi.eus larioja.org ceuta.es melilla.es',
  // Locales
  'madrid.es barcelona.cat bcn.cat valencia.es zaragoza.es sevilla.org malaga.eu murcia.es',
  'palma.cat palma.es laspalmasgc.es alicante.es bilbao.eus cordoba.es valladolid.es vigo.org',
  'l-h.cat gijon.es vitoria-gasteiz.org coruna.gal lacoruna.es elche.es granada.org terrassa.cat',
  'badalona.cat sabadell.cat oviedo.es cartagena.es mostoles.es jerez.es aytojerez.es',
  'santacruzdetenerife.es pamplona.es almeriaciudad.es aytoalmeria.es ayto-alcaladehenares.es',
  'leganes.org getafe.es ayto-fuenlabrada.es fuenlabrada.es donostia.eus castello.es aytoburgos.es',
  'ayto-alcorcon.es santander.es albacete.es aytolalaguna.es marbella.es logrono.es aytobadajoz.es',
  'paeria.cat aytosalamanca.es tarragona.cat ayto-torrejon.es huelva.es doshermanas.es',
  'ayuntamientoparla.es mataro.cat algeciras.es gramenet.cat aytoleon.es alcobendas.org',
  'aytojaen.es reus.cat aytoroquetas.org roquetasdemar.es cadiz.es girona.cat ourense.gal telde.es',
  'rivasciudad.es barakaldo.eus santiagodecompostela.gal concellodelugo.gal lugo.gal lugo.es',
  'ayto-caceres.es caceres.es guadalajara.es toledo.es pontevedra.gal aytopalencia.es',
  'ciudadreal.es merida.es zamora.es avila.es huesca.es cuenca.es segovia.es soria.es teruel.es',
  'dipalme.org dipucadiz.es dipucordoba.es eprinsa.es dipgra.es diphuelva.es dipujaen.es malaga.es',
  'prpmalaga.es dipusevilla.es sedeelectronicadipusevilla.es opaef.es dip-badajoz.es',
  'dip-caceres.es diputacionalicante.es dipcas.es dival.es dipualba.es dipucr.es dipucuenca.es',
  'dguadalajara.es diputoledo.es diputacionavila.es burgos.es diputaciondeburgos.es dipuleon.es',
  'diputaciondepalencia.es dip-palencia.es lasalina.es dipsegovia.es dipsoria.es',
  'diputaciondevalladolid.es diputaciondezamora.es dphuesca.es dpteruel.es dpz.es diba.cat',
  'ddgi.cat diputaciolleida.cat dipta.cat dacoruna.gal deputacionlugo.gal deputacionlugo.org',
  'depourense.gal depourense.es depo.gal araba.eus bizkaia.eus bizkaia.net ebizkaia.eus',
  'gipuzkoa.eus gipuzkoa.net sede.grancanaria.com tenerife.es cabildodelanzarote.com',
  'cabildofuer.es cabildodelapalma.es lagomera.es elhierro.es conselldemallorca.es',
  'conselldemallorca.cat conselldemallorca.net secimallorca.net cime.es www.carpetaciutadana.org',
  'conselldeivissa.es conselldeivissa.cat conselldeformentera.cat consellinsulardeformentera.cat',
  'consellformentera.com sedipualba.es seu-e.cat seu.cat sedelectronica.es sedelectronica.gal',
  'eadministracio.cat egoitzaelektronikoa.eus',
  // Europeas
  'europa.eu',
]
  .join(' ')
  .split(' ');

/** Si la URL es HTTPS y de una administración pública española o europea. */
export function isOfficial(url: string): boolean {
  if (!URL.canParse(url)) return false;
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  // Sufijo con límite de etiqueta: «sede.agenciatributaria.gob.es» encaja en «gob.es»; «evilgob.es» no.
  return officialSuffixes.some((s) => host === s || host.endsWith('.' + s));
}

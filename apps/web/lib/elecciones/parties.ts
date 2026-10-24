// El nombre corto de cada candidatura, para rótulos: las siglas cambian de una elección a otra
// (PSC, PSdeG-PSOE, AP-PDP, JxCAT-JUNTS, ERC-CATSÍ…) y se reconocen por su comienzo. Si no se
// reconoce, las siglas tal cual.
const shorts: [RegExp, string][] = [
  [/SUMAR/, 'Sumar'],
  [/^(EN COMU|ECP)/, 'En Comú'],
  [/^EN MAREA/, 'En Marea'],
  [/^(PODEMOS|UNIDAS PODEMOS|UNIDOS PODEMOS|UP\b)/, 'Podemos'],
  [/^(IU|I\.U\.|IC-V|ICV)/, 'IU'],
  [/^PCE|^PSUC/, 'PCE'],
  [/^(MAS PAIS|MES COMPROM)/, 'Más País'],
  [/^COMPROMIS/, 'Compromís'],
  [/^PSC/, 'PSC'],
  [/PSOE|^P\.S\.O\.E/, 'PSOE'],
  [/^AP\b|^AP-/, 'AP'],
  [/^CD\b/, 'CD'],
  [/^P\.?P\b|^PP/, 'PP'],
  [/^VOX/, 'Vox'],
  [/^C['´`’]S\b|^CS\b/, 'Cs'],
  [/^(ERC|ESQUERRA|EC-FED|ERFN)/, 'ERC'],
  [/^(JXCAT|JUNTS)/, 'Junts'],
  [/^CIU/, 'CiU'],
  [/^CDC/, 'CDC'],
  [/^DL\b/, 'DL'],
  [/^PDPC/, 'PDPC'],
  [/^EH BILDU/, 'Bildu'],
  [/^AMAIUR/, 'Amaiur'],
  [/^HB\b/, 'HB'],
  [/PNV/, 'PNV'],
  [/^(BNG|B\.N\.G)/, 'BNG'],
  [/^(CC|CCA)\b|^CC-|^CCA-/, 'CC'],
  [/^UCD/, 'UCD'],
  [/^(CDS|C\.D\.S)/, 'CDS'],
  [/^UPN-PP/, 'UPN-PP'],
  [/^(UPN|U\.P\.N)/, 'UPN'],
  [/^NA\+/, 'Navarra Suma'],
  [/^(¡?TERUEL)/, 'Teruel Existe'],
  [/^EXISTE/, 'Existe'],
  [/^EA\b/, 'EA'],
  [/^UPYD/, 'UPyD'],
];
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
export const shortParty = (siglas: string) =>
  shorts.find(([re]) => re.test(plain(siglas)))?.[1] ?? siglas;

// Para contar quién gana dónde, cada marca con su partido de siempre: el PSC con el PSOE, UPN-PP con
// el PP y las confluencias con Podemos.
const brands: Record<string, string> = {
  PSC: 'PSOE',
  'UPN-PP': 'PP',
  'En Comú': 'Podemos',
  'En Marea': 'Podemos',
};
export const brand = (short: string) => brands[short] ?? short;

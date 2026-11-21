/**
 * Catálogo de servicios de asistencia de la Agencia Tributaria, tal y como lo publica
 * www2.agenciatributaria.gob.es/wlpl/TOCP-MUTE/ServiciosAsocCat (fixture del 27/09/2026,
 * sites/hacienda/fixtures/catalogo.html). Mismo orden que la web oficial.
 */
export interface Servicio {
  id: string;
  name: string;
  description: string;
  category: string;
  channels: string[];
}

export const servicios: Servicio[] = [
  {
    id: 'A296',
    name: 'Registro en Cl@ve',
    description:
      'Sistema de identificación que permite realizar un gran número de trámites con las Administraciones a través de Internet',
    category: 'Identificación electrónica',
    channels: ['Asistente Virtual', 'Videollamada', 'Atención en Oficina'],
  },
  {
    id: 'A297',
    name: 'Certificado electrónico FNMT para personas físicas',
    description:
      'Obtención del certificado electrónico que le permite identificarse para la realización de trámites a través de Internet Para obtener el certificado de la FNMT para personas físicas y evitar desplazamientos a las oficinas, se informa que la Sede electrónica de la FNMT ofrece la posibilidad de obtener el certificado con video identificación (servicio con coste)',
    category: 'Identificación electrónica',
    channels: ['Videollamada', 'Atención en Oficina'],
  },
  {
    id: 'A298',
    name: 'Certificado electrónico FNMT para personas jurídicas',
    description:
      'Obtención del certificado electrónico que le permite identificarse para la realización de trámites a través de Internet',
    category: 'Identificación electrónica',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'A299',
    name: 'Apoderamiento para personas físicas',
    description:
      'Otorgamiento de poder a un tercero para actuar a través de representante por Internet',
    category: 'Identificación electrónica',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'A300',
    name: 'Apoderamiento para personas jurídicas',
    description:
      'Otorgamiento de poder a un tercero para actuar a través de representante por Internet',
    category: 'Identificación electrónica',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'B349',
    name: 'Mutualistas',
    description:
      'Información sobre cómo solicitar la devolución derivada de la aplicación de la Disposición Transitoria segunda (DT 2) de la Ley del IRPF para Mutualistas. Asistencia para la presentación del formulario de solicitud de devolución e información sobre el estado de tramitación y sobre cartas recibidas en esta materia.',
    category: 'Trámites destacados',
    channels: ['Asistente Virtual', 'Atención en Oficina'],
  },
  {
    id: 'B305',
    name: 'Censos, IAE, NIF y domicilio fiscal',
    description:
      "Información sobre cómo darte de alta, variaciones y baja de los censos y demás registros tributarios (modelo 030, 035 y 036), del Impuesto sobre Actividades Económicas, del Número de Identificación Fiscal y asistencia sobre cartas recibidas en estas materias. Para obtener NIF solicite cita en el servicio <a href='https://www2.agenciatributaria.gob.es/wlpl/TOCP-ADMI/Asistente?tipoEntrada=Z&servicio=120'>Obtención de NIF</a>",
    category: 'Trámites destacados',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'B398',
    name: 'Obtención de NIF',
    description:
      'Servicio de información y asistencia para la obtención de NIF por personas físicas, personas jurídicas y otras entidades',
    category: 'Trámites destacados',
    channels: ['Asistente Virtual', 'Atención en Oficina'],
  },
  {
    id: 'B304',
    name: 'Certificados tributarios',
    description:
      'Información sobre certificados de tu situación censal, de declaraciones o situaciones tributarias, de contratistas y subcontratistas... y asistencia para su obtención',
    category: 'Trámites destacados',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'B308',
    name: 'Recursos de Gestión Tributaria',
    description:
      'Información sobre la tramitación de los recursos de reposición contra actos de Gestión Tributaria, de las rectificaciones de autoliquidación de Gestión Tributaria, y asistencia sobre cartas recibidas en estas materias.',
    category: 'Trámites destacados',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'B402',
    name: 'Deducción por maternidad y familiares (Familia Numerosa y Discapacidad)',
    description:
      'Información sobre la Deducción por maternidad, por familia numerosa y por personas con discapacidad a cargo, la solicitud de su abono anticipado y asistencia sobre cartas recibidas en estas materias.',
    category: 'Trámites destacados',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'B408',
    name: 'Información Ayudas a empresas y autónomos de la ciudad de Ceuta',
    description:
      'Información sobre las ayudas directas de apoyo económico a empresas, profesionales y entidades sin personalidad jurídica de la ciudad de Ceuta',
    category: 'Trámites destacados',
    channels: ['Te llamamos'],
  },
  {
    id: 'B404',
    name: 'Información Ayudas a empresas y profesionales afectados por daños meteorológicos',
    description:
      'Información sobre las ayudas directas a empresas, profesionales y entidades sin personalidad jurídica especialmente afectados por los efectos meteorológicos adversos en Andalucía y Extremadura',
    category: 'Trámites destacados',
    channels: ['Te llamamos'],
  },
  {
    id: 'B382',
    name: 'Información afectados DANA',
    description: 'Información sobre las medidas tributarias dirigidos a los afectados por la DANA',
    category: 'Trámites destacados',
    channels: ['Te llamamos', 'Llámanos'],
  },
  {
    id: 'C310',
    name: 'Pagar y consultar deudas',
    description:
      'Información de deudas, plazos de ingreso, obtención de documentos de ingreso y pagos.',
    category: 'Pagar, aplazar y consultar deudas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'C323',
    name: 'Embargos',
    description:
      'Información y tramitación de embargos, obtención de cartas de pago, ingresos, levantamiento y asistencia en el cumplimiento.',
    category: 'Pagar, aplazar y consultar deudas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'C324',
    name: 'Aplazamientos',
    description:
      'Información y tramitación de aplazamientos y fraccionamientos. Solicitud y obtención de documentos de ingreso y pagos.',
    category: 'Pagar, aplazar y consultar deudas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'C325',
    name: 'Recursos Recaudación',
    description:
      'Información sobre la presentación y el estado de la tramitación de cualquier recurso de Recaudación.',
    category: 'Pagar, aplazar y consultar deudas',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'C347',
    name: 'Pagos desde el extranjero',
    description:
      'Atención y asistencia en materia de pago de deudas tributarias desde el extranjero.',
    category: 'Pagar, aplazar y consultar deudas',
    channels: ['Te llamamos', 'Chat'],
  },
  {
    id: 'C326',
    name: 'Otros trámites de Recaudación',
    description:
      'Información y gestión sobre cualquier otro trámite recaudatorio (compensaciones, certificados de estar al corriente de deudas, derivaciones de responsabilidad y sucesores, medidas cautelares...)',
    category: 'Pagar, aplazar y consultar deudas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'D311',
    name: 'Presentación de documentos en registro',
    description:
      'Presentación de documentación, realización de alegaciones y contestación a los requerimientos si has recibido una comunicación de la Agencia Tributaria.',
    category: 'Registro y notificaciones',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'D312',
    name: 'Recogida de notificaciones',
    description: 'Acceso a notificaciones de la Agencia Tributaria',
    category: 'Registro y notificaciones',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'E314',
    name: 'IRPF',
    description:
      'Información del Impuesto sobre la Renta, de las declaraciones presentadas, del estado de la devolución, retenciones, pagos fraccionados, otras obligaciones relacionadas con el impuesto y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas o de no declarantes del Impuesto.',
    category: 'Impuestos y Tasas',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'E315',
    name: 'IVA',
    description:
      'Información del IVA, declaraciones presentadas, estado de la devolución, regímenes especiales, VERI*FACTU, otras obligaciones y gestiones relacionadas con el impuesto y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas con devengo trimestral o de no declarantes del Impuesto.',
    category: 'Impuestos y Tasas',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'E399',
    name: 'SII',
    description:
      'Información general y técnica sobre los Sistemas Informáticos de Facturación y asistencia sobre cartas recibidas en esta materia.',
    category: 'Impuestos y Tasas',
    channels: ['Asistente Virtual', 'Te llamamos'],
  },
  {
    id: 'E313',
    name: 'Matriculación de Vehículos',
    description:
      'Información del Impuesto Especial sobre Determinados Medios de Transporte (modelo 576) para matricular vehículos y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas o de no declarantes del Impuesto.',
    category: 'Impuestos y Tasas',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'E318',
    name: 'Impuesto sobre Sociedades',
    description:
      'Información del Impuesto, declaraciones presentadas, estado de la devolución, retenciones, pagos fraccionados, otras obligaciones y gestiones relacionadas con el impuesto y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas por este impuesto.',
    category: 'Impuestos y Tasas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'E316',
    name: 'Módulos',
    description:
      'Información sobre las obligaciones tributarias de los contribuyentes que tributan por Módulos y asistencia sobre cartas recibidas de comprobación en esta materia.',
    category: 'Impuestos y Tasas',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'E403',
    name: 'Tasa judicial. Impuesto sobre el juego. Canon de superficie de minas',
    description:
      'Información sobre tasas fiscales (sobre el juego, gestión de residuos, tasa judicial, canon de superficie de minas, canon de superficie de hidrocarburos...) y asistencia sobre cartas recibidas en estas materias.',
    category: 'Impuestos y Tasas',
    channels: ['Te llamamos'],
  },
  {
    id: 'E317',
    name: 'Transmisiones Patrimoniales e I.Sucesiones (Ceuta y Melilla)',
    description:
      'Información sobre operaciones sujetas a estos Impuestos en Ceuta y Melilla (inmuebles situados en Ceuta y Melilla, fallecidos o donantes residentes en Ceuta o Melilla...), y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas o de no declarantes de los impuestos.',
    category: 'Impuestos y Tasas',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'E319',
    name: 'Declaraciones informativas (modelo 180, 184, 190, 720...)',
    description:
      'Información sobre las declaraciones informativas (modelo 180, 184, 190, 720...), formas y plazos de presentación, su modificación y asistencia sobre cartas recibidas en esta materia.',
    category: 'Impuestos y Tasas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'F267',
    name: 'Información comercio exterior (aduanas)',
    description:
      'Información sobre cómo importar o exportar mercancías y demás cuestiones aduaneras.',
    category: 'Aduanas',
    channels: ['Te llamamos', 'Chat', 'Atención en Oficina'],
  },
  {
    id: 'F268',
    name: 'Entrega/recogida de documentos (firma de certificados de origen, CITES, etc.)',
    description: 'Firma y diligenciado de documentos necesarios para el tráfico aduanero.',
    category: 'Aduanas',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'F270',
    name: 'Garantías y facilidades de pago',
    description:
      'Derechos arancelarios por importar o exportar mercancías y constitución de garantías.',
    category: 'Aduanas',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'F273',
    name: 'Autorizaciones aduaneras (OEA, establecimientos y regímenes)',
    description:
      'Autorizaciones de operadores económicos autorizados, establecimientos aduaneros y regímenes especiales.',
    category: 'Aduanas',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'F275',
    name: 'Comercio electrónico',
    description:
      'Información sobre envíos de compras por internet y de paquetes entre particulares.',
    category: 'Aduanas',
    channels: ['Te llamamos', 'Chat'],
  },
  {
    id: 'F277',
    name: 'INTRASTAT',
    description:
      'Ayuda sobre la declaración mensual Intrastat: obligación, plazos de presentación, etc.',
    category: 'Aduanas',
    channels: ['Te llamamos', 'Chat', 'Atención en Oficina'],
  },
  {
    id: 'F271',
    name: 'DUA vehículos de particulares',
    description: 'Cumplimentación y presentación DUA de importación de vehículos por particulares',
    category: 'Aduanas',
    channels: ['Te llamamos'],
  },
  {
    id: 'F276',
    name: 'Devolución IVA viajeros (Canarias, Ceuta y Melilla)',
    description: 'Reembolso del IVA soportado en compras de viajeros en Península y Baleares.',
    category: 'Aduanas',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'G335',
    name: 'Información general de Impuestos Especiales (hidrocarburos, alcohol, tabaco, etc...)',
    description: 'Impuestos sobre el alcohol, hidrocarburos, tabaco, electricidad y carbón.',
    category: 'Impuestos especiales y medioambientales',
    channels: ['Te llamamos', 'Chat', 'Atención en Oficina'],
  },
  {
    id: 'G288',
    name: 'Información medioambientales (plástico, fluorados, valor producción, etc...)',
    description:
      'Envases de plástico no reutilizable, gases fluorados, residuos, valor producción energ­a eléctrica, extracción de gas y combustible nuclear.',
    category: 'Impuestos especiales y medioambientales',
    channels: ['Asistente Virtual', 'Te llamamos', 'Chat', 'Atención en Oficina'],
  },
  {
    id: 'G383',
    name: 'Impuesto Líquidos Cigarrillos Electrónicos',
    description:
      'Información sobre autoliquidación, informativas, base imponible,...del impuesto sobre los líquidos para cigarrillos electrónicos',
    category: 'Impuestos especiales y medioambientales',
    channels: ['Te llamamos', 'Chat'],
  },
  {
    id: 'G281',
    name: 'Impuesto Hidrocarburos (Gasóleo Agrícola y Profesional)',
    description:
      'Devolución parcial del impuesto por gasóleo de uso profesional y agrícola y otros temas relacionados con este impuesto.',
    category: 'Impuestos especiales y medioambientales',
    channels: ['Te llamamos', 'Chat', 'Atención en Oficina'],
  },
  {
    id: 'G322',
    name: 'Impuestos sobre Alcoholes y destilador artesanal. Impuesto tabaco',
    description:
      'Impuestos sobre cerveza, vino, productos intermedios, alcohol y bebidas derivadas, así­ como Impuesto sobre labores de tabaco.',
    category: 'Impuestos especiales y medioambientales',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'G282',
    name: 'Marcas fiscales',
    description:
      'Precintas adheridas a envases de bebidas derivadas, cigarrillos y picadura para liar.',
    category: 'Impuestos especiales y medioambientales',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'G283',
    name: 'Censos y garantías',
    description: 'Inscripción en los Registros Territoriales y previa constitución de garantías.',
    category: 'Impuestos especiales y medioambientales',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'G285',
    name: 'Impuesto de la Electricidad (modelo 560)',
    description:
      'Información sobre autoliquidación, exenciones, reducciones, informativas..., del impuesto de la electricidad.',
    category: 'Impuestos especiales y medioambientales',
    channels: ['Te llamamos', 'Chat', 'Atención en Oficina'],
  },
  {
    id: 'H290',
    name: 'Impuesto sobre la Renta de No Residentes',
    description:
      'Información del Impuesto, retención por la adquisición de inmuebles a no residentes, gravamen sobre bienes inmuebles de entidades no residentes y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas por este impuesto o de no declarantes del Impuesto. Información del Impuesto sobre el Patrimonio de no residentes (modelo 714).',
    category: 'No Residentes',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'H292',
    name: 'Información del Impuesto sobre Sucesiones y Donaciones No Residentes',
    description:
      'Información del Impuesto sobre Sucesiones y Donaciones de No Residentes (herencias o donaciones donde el fallecido/heredero o donatario sean no residentes), del ITP cuando el sujeto pasivo/contribuyente no sea residente o de AJD referido a Títulos Nobiliarios (transmisiones o rehabilitaciones) y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas o de no declarantes del Impuesto.',
    category: 'No Residentes',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'H293',
    name: 'Presentación y Diligenciado ISD No Residentes',
    description:
      'Presentación y diligenciado de los modelos 650, 651 y 655 del Impuesto sobre Sucesiones y Donaciones de No Residentes. Presentación de las autoliquidaciones 600 y 620 del ITP de No Residentes y AJD (Títulos nobiliarios).',
    category: 'No Residentes',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'H291',
    name: 'IVA de No establecidos',
    description:
      'Información sobre las devoluciones del IVA a empresarios o profesionales No establecidos y sobre el reconocimiento del derecho a la exención IVA en el marco diplomático o consular, regímenes de ventanilla única en el comercio electrónico y asistencia sobre cartas recibidas en estas materias.',
    category: 'No Residentes',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: 'L388',
    name: 'Información de subastas',
    description:
      'Información y asistencia para licitadores, adjudicatarios y otros interesados en los procedimientos que la AEAT celebra en el Portal de Subastas del BOE.',
    category: 'Información de subastas',
    channels: ['Te llamamos'],
  },
  {
    id: 'I294',
    name: 'Acreditación FNMT',
    description: 'FNMT Representante, NEO DCGC',
    category: 'DCGC',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'J295',
    name: 'Contribuyentes adscritos a UGGES',
    description:
      'En caso de que desee solicitar cita para un procedimiento de comprobación o de revisión o no existan citas disponibles para trámites no relacionados con un procedimiento de comprobación',
    category: 'UGGE',
    channels: ['Atención en Oficina'],
  },
  {
    id: 'K380',
    name: 'Soporte a cuestiones informáticas',
    description:
      'Solicita asistencia sobre incidencias informáticas o sobre soporte a cuestiones técnicas sobre el funcionamiento de todos los servicios y trámites existentes en la Sede electrónica de la Agencia Tributaria.',
    category: 'Consultas informáticas',
    channels: ['Te llamamos', 'Chat'],
  },
  {
    id: '107',
    name: 'Impuesto complementario',
    description:
      'Asistencia sobre cartas informativas del "Impuesto Complementario" establecido a las entidades de grupos mercantiles de gran magnitud (modelos 240, 241 y 242)',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos'],
  },
  {
    id: '110',
    name: 'Información afectados DANA',
    description:
      'Información y asistencia sobre las cartas recibidas para verificar el cumplimiento de los requisitos para la obtención de las ayudas directas a los trabajadores autónomos y empresas solicitadas',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos', 'Llámanos'],
  },
  {
    id: '111',
    name: 'Ayudas a empresas y prof. afectados daños meteorológicos',
    description:
      'Información sobre las ayudas directas a empresas, profesionales y entidades sin personalidad jurídica especialmente afectados por los efectos meteorológicos adversos en Andalucía y Extremadura',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos'],
  },
  {
    id: '113',
    name: 'Impuesto sobre Sociedades',
    description:
      'Información del Impuesto, declaraciones presentadas, estado de la devolución, retenciones, pagos fraccionados, otras obligaciones y gestiones relacionadas con el impuesto, y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas por este impuesto.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '114',
    name: 'IVA',
    description:
      'Información del IVA, declaraciones presentadas, estado de la devolución, regímenes especiales, VERI*FACTU, otras obligaciones y gestiones relacionadas con el impuesto, y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas con devengo trimestral o de no declarantes del Impuesto.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '118',
    name: 'Contribuyentes adscritos a la DCGC',
    description:
      'Asistencia sobre cartas informativas del "Impuesto Complementario" establecido a las entidades de grupos mercantiles de gran magnitud (modelos 240,241 y 242) para contribuyentes adscritos a DCGC',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Atención en Oficina'],
  },
  {
    id: '121',
    name: 'Censos, IAE, NIF y domicilio fiscal',
    description:
      'Información sobre cómo darte de alta, variaciones y baja de los censos y demás registros tributarios (modelo 030, 035 y 036), del Impuesto sobre Actividades Económicas, del Número de Identificación Fiscal y asistencia sobre cartas recibidas de comprobación en estas materias. Para obtener NIF solicite cita en el servicio Obtención de NIF',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '123',
    name: 'Registro de Operadores Intracomunitarios',
    description:
      'Información sobre cuestiones relacionadas con el Registro de Operadores Intracomunitarios (alta, baja, obtención NIF-IVA) y asistencia sobre cartas recibidas en esta materia.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Atención en Oficina'],
  },
  {
    id: '125',
    name: 'Apoderamiento Personas Físicas',
    description:
      'Gestiones de personas físicas relativas a: - Apoderamientos para recibir certificaciones electrónicas. - Identificación para poder descargar el certificado de FNMT (Aporte el código de solicitud obtenida en la página WEB de la FNMT) - Notificaciones electrónicas obligatorias',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Atención en Oficina'],
  },
  {
    id: '127',
    name: 'Apoderamientos y acreditación FNMT personas jurídicas',
    description:
      'Gestiones de personas jurídicas y de entidades sin personalidad jurídica (comunidades de bienes y propietarios, herencias yacentes, etc...) relativas a: - Apoderamientos para recibir certificaciones electrónicas. - Identificación para poder descargar el certificado de FNMT (Aporte el código de solicitud obtenida en la página WEB de la FNMT). - Notificaciones electrónicas obligatorias',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Atención en Oficina'],
  },
  {
    id: '132',
    name: 'Recursos Gestión Tributaria',
    description:
      'Información sobre la tramitación de los recursos de reposición contra actos de Gestión Tributaria, de las solicitudes de rectificación de autoliquidación de Gestión Tributaria, y asistencia sobre cartas recibidas en estas materias.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '134',
    name: 'Transmisiones Patrimoniales e I.Sucesiones (Ceuta y Melilla)',
    description:
      'Información sobre operaciones sujetas a estos Impuestos en Ceuta y Melilla (inmuebles situados en Ceuta y Melilla, fallecidos o donantes residentes en Ceuta o Melilla...), y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas o de no declarantes de los impuestos.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Atención en Oficina'],
  },
  {
    id: '135',
    name: 'Matriculación de vehículos',
    description:
      'Información del Impuesto Especial sobre Determinados Medios de Transporte (modelo 576) para matricular vehículos y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas o de no declarantes del Impuesto.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '136',
    name: 'Impuesto sobre la Renta de no Residentes',
    description:
      'Información del Impuesto, retención por la adquisición de inmuebles a no residentes, gravamen sobre bienes inmuebles de entidades no residentes y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas por este impuesto o de no declarantes del Impuesto. Información del Impuesto sobre el Patrimonio de no residentes (modelo 714)',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '139',
    name: 'Tasa judicial. Impuesto sobre el juego. Canon de superficie de minas',
    description:
      'Información sobre tasas fiscales (sobre el juego, gestión de residuos, tasa judicial, canon de superficie de minas, canon de superficie de hidrocarburos...) y asistencia sobre cartas recibidas en estas materias.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos'],
  },
  {
    id: '140',
    name: 'Deducción por maternidad y familiares (Familia Numerosa y Discapacidad)',
    description:
      'Información sobre la Deducción por maternidad, por familia numerosa y por personas con discapacidad a cargo, la solicitud de su abono anticipado y asistencia sobre cartas recibidas en estas materias.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '142',
    name: 'Módulos',
    description:
      'Información sobre las obligaciones tributarias de los contribuyentes que tributan por Módulos y asistencia sobre cartas recibidas de comprobación en esta materia.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '143',
    name: 'Sanciones y recargos',
    description:
      'Información y asistencia sobre cartas referidas a un procedimiento sancionador de gestión tributaria, a un recargo de gestión tributaria por presentar una declaración fuera de plazo o exigencia de sus reducciones',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '145',
    name: 'IVA de no establecidos',
    description:
      'Información sobre las devoluciones del IVA a empresarios o profesionales No establecidos y sobre el reconocimiento del derecho a la exención IVA en el marco diplomático o consular, regímenes de ventanilla única en el comercio electrónico y asistencia sobre cartas recibidas en estas materias.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '146',
    name: 'Información del Impuesto sobre Sucesiones y Donaciones No Residentes',
    description:
      'Información del Impuesto sobre Sucesiones y Donaciones de No Residentes (herencias o donaciones donde el fallecido/heredero o donatario sean no residentes), del ITP cuando el sujeto pasivo/contribuyente no sea residente o de AJD referido a Títulos Nobiliarios (transmisiones o rehabilitaciones) y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas o de no declarantes del Impuesto.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos'],
  },
  {
    id: '150',
    name: 'Asistencia cartas grandes empresas',
    description:
      'Información y asistencia sobre cartas recibidas de comprobación del censo de grandes empresas',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos'],
  },
  {
    id: '151',
    name: 'Declaraciones Informativas (modelo 180, 184, 190, 720...)',
    description:
      'Información sobre las declaraciones informativas (modelo 180, 184, 190, 720...), formas y plazos de presentación, su modificación y asistencia sobre cartas recibidas en esta materia.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '161',
    name: 'Pagar y consultar deudas',
    description: 'Pagar y consultar deudas',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '162',
    name: 'Embargos',
    description: 'Embargos',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '163',
    name: 'Aplazamientos (solicitud)',
    description: 'Aplazamientos',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '165',
    name: 'Otros trámites de Recaudación',
    description: 'Otros trámites de Recaudación',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '167',
    name: 'Pagos desde el extranjero',
    description: 'Pagos desde el extranjero',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos', 'Chat'],
  },
  {
    id: '170',
    name: 'Renta',
    description:
      'Información del Impuesto sobre la Renta, de las declaraciones presentadas, del estado de la devolución, retenciones, pagos fraccionados, otras obligaciones relacionadas con el impuesto y asistencia sobre cartas recibidas de comprobación de declaraciones presentadas o de no declarantes del Impuesto.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Asistente Virtual', 'Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '171',
    name: 'Comprobación retenciones',
    description:
      'Información y asistencia sobre cartas recibidas de comprobación de las retenciones e ingresos a cuenta practicadas.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '176',
    name: 'SII',
    description:
      'Información general y técnica sobre los Sistemas Informáticos de Facturación y asistencia sobre cartas recibidas en esta materia.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Asistente Virtual', 'Te llamamos'],
  },
  {
    id: '177',
    name: 'IVA mensual',
    description:
      'Información y asistencia sobre cartas recibidas de comprobación de declaraciones de IVA presentadas con devengo mensual o de no declarantes del Impuesto',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Te llamamos', 'Atención en Oficina'],
  },
  {
    id: '179',
    name: 'Contribuyentes adscritos a UGGES',
    description:
      'No se facilitarán citas para proporcionar información tributaria de carácter general, las citas son para tratar expedientes y trámites concretos que se gestionen en la Unidad. Es IMPRESCINDIBLE que los comparecientes acrediten documentalmente en la visita su representación y capacidad de actuar en nombre del contribuyente afectado.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Atención en Oficina'],
  },
  {
    id: '205',
    name: 'Reintegro segunda ayuda de 200 euros',
    description:
      'Información y asistencia sobre cartas recibidas para el reintegro de la segunda ayuda de 200 euros cobrada.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Atención en Oficina'],
  },
  {
    id: '207',
    name: 'Mutualistas',
    description:
      'Información sobre cómo solicitar la devolución derivada de la aplicación de la Disposición Transitoria segunda (DT 2) de la Ley del IRPF para Mutualistas. Asistencia para la presentación del formulario de solicitud de devolución e información sobre el estado de tramitación y sobre cartas recibidas en esta materia.',
    category: 'Asistencia sobre cartas recibidas',
    channels: ['Asistente Virtual', 'Atención en Oficina'],
  },
];

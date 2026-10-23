import type { Metadata } from 'next';
import { InfoPage } from '../../../components/brand/info-page';
import { JsonLd } from '../../../components/json-ld';
import { breadcrumbs, pageMetadata, webPage } from '../../../lib/seo';

const title = 'Privacidad · Reforma Digital';
const description =
  'Sin cuenta y sin cookies. Qué datos tratan la web, la extensión y la app de escritorio de Reforma Digital, quién los recibe y cuánto tiempo se guardan.';

export const metadata: Metadata = pageMetadata({
  title,
  description,
  path: '/privacy',
  og: 'privacidad',
});

const graph = [
  webPage({ name: title, description, path: '/privacy' }),
  breadcrumbs('Privacidad', '/privacy'),
];

export default function Privacy() {
  return (
    <InfoPage narrow>
      <JsonLd graph={graph} />
      <span
        className={
          't-etiqueta [font-family:var(--font-brand-mono)] text-xs font-medium [line-height:1.3] [letter-spacing:0.08em] uppercase info-etiqueta block mb-4 [color:var(--text-secondary)]'
        }
      >
        TUS DATOS, CON CUIDADO
      </span>
      <h1>Navega sin identificarte.</h1>
      <p
        className={
          'info-entradilla [max-width:65ch] mb-10 [color:var(--text-secondary)] text-lg [line-height:1.6]'
        }
      >
        No necesitas una cuenta y no usamos cookies. Aquí explicamos qué datos tratan la web, la
        extensión y la app de escritorio, quién los recibe y cuánto tiempo se guardan.
      </p>

      <h2>La web</h2>
      <p>Esta web no te pide datos personales ni permisos de localización, y no instala cookies.</p>
      <ul>
        <li>
          <strong>Alojamiento.</strong> La sirve Vercel, que, como cualquier servidor, recibe tu IP
          y los datos técnicos de tu navegador en cada visita, y guarda registros técnicos durante
          poco tiempo. Vercel está en EE. UU. y está certificada en el Marco de Privacidad de Datos
          UE‑EE. UU.
        </li>
        <li>
          <strong>Estadísticas de visitas.</strong> Usamos Vercel Web Analytics, que no usa cookies
          y solo nos muestra datos agregados: páginas vistas, país, navegador y de qué web llegas.
          Identifica la visita con un resumen irreversible que se descarta a las 24 horas, sin
          guardar tu IP.
        </li>
        <li>
          <strong>Estadísticas de uso.</strong> Contamos las páginas vistas y las descargas de la
          app en PostHog, en la UE. Le llegan desde nuestro servidor, sin tu IP, con la ruta de la
          página y un identificador aleatorio que solo vive en la pestaña y se pierde al recargarla.
        </li>
        <li>
          <strong>Fotos del equipo.</strong> Vienen de GitHub, pero nuestro servidor las descarga y
          las optimiza: tu navegador no se conecta con GitHub para verlas.
        </li>
      </ul>

      <h2>La extensión</h2>
      <p>
        Funciona dentro de tu navegador y no envía nada a nadie: no tiene servidor ni analítica y no
        lee cookies. Solo guarda en el navegador si la tienes activada en cada web. Lo que escribes
        en un formulario va de tu navegador a la web oficial, como sin ella.
      </p>

      <h2>La app de escritorio</h2>
      <p>
        «Mis datos», tus conversaciones y tus trámites se guardan cifrados en tu ordenador. Antes de
        enviar algo al asistente de IA, la app cambia tus datos personales por marcadores como{' '}
        {'{{nombre}}'}: el dato real solo lo escribe en la web del trámite. Esto es lo que sale del
        ordenador:
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Quién lo recibe</th>
            <th scope="col">Qué recibe</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Nuestro servidor (Vercel)</td>
            <td>
              La conversación con el asistente, con marcadores en lugar de tus datos, y las
              búsquedas. No las guarda: las pasa al modelo y al buscador.
            </td>
          </tr>
          <tr>
            <td>NaN Builders, el modelo de IA</td>
            <td>
              La conversación con marcadores. Según su web, procesa en la UE, no registra las
              peticiones ni las respuestas y no entrena con ellas.
            </td>
          </tr>
          <tr>
            <td>Exa, el buscador (EE. UU.)</td>
            <td>Las búsquedas del asistente, sin tus datos.</td>
          </tr>
          <tr>
            <td>PostHog, las estadísticas de uso (UE)</td>
            <td>
              Qué acciones haces (abrir la app, crear un trámite, enviar un mensaje…), sin lo que
              escribes ni tus datos, con la versión, el sistema y un identificador aleatorio que
              cambia cada vez que abres la app. Le llega desde nuestro servidor, sin tu IP. Lo
              puedes desactivar en Ajustes.
            </td>
          </tr>
          <tr>
            <td>Google</td>
            <td>
              La dirección de cada web consultada (por ejemplo, sede.policia.gob.es), para mostrar
              su icono. La pide nuestro servidor, así que Google no sabe quién la consulta.
            </td>
          </tr>
          <tr>
            <td>BOE</td>
            <td>Las palabras del título de la ley que busca el asistente.</td>
          </tr>
          <tr>
            <td>Las webs de tus trámites</td>
            <td>
              Lo que la app escribe en ellas. Tus datos reales, solo en webs oficiales o en otras en
              las que hayas dicho que confías.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Para limitar el gasto, el servidor cuenta cuánto usa cada instalación y cada IP en el día.
        No guarda ni la IP ni el identificador de la instalación tal cual, solo un resumen
        irreversible, y borra esos contadores al día siguiente.
      </p>
      <p>
        <strong>Lo que la protección no garantiza.</strong> El detector busca identificadores
        (nombres completos, DNI, direcciones, teléfonos, correos, IBAN…), pero no lo encuentra todo.
        Un nombre de pila suelto o lo que cuentes de tu situación (por ejemplo, de tu salud o de tu
        trabajo) puede llegar al modelo de IA. Para que la IA también vea algo de contexto, le
        llegan tu municipio, tu provincia, tu nacionalidad, tu edad y datos parecidos de «Mis
        datos». No escribas en la conversación lo que no haga falta para el trámite.
      </p>
      <p>
        Si en Ajustes eliges otro proveedor de IA, la conversación le llega con las mismas
        protecciones, pero con sus condiciones, que no controlamos.
      </p>

      <h2>Por qué los tratamos</h2>
      <ul>
        <li>
          <strong>Para darte el servicio que pides</strong> (art. 6.1.b del RGPD): enviar tus
          consultas al modelo de IA y al buscador.
        </li>
        <li>
          <strong>Por interés legítimo</strong> (art. 6.1.f del RGPD): mantener la web segura,
          evitar abusos del servidor y saber qué páginas se visitan y qué partes de la app se usan,
          sin identificarte.
        </li>
      </ul>
      <p>No vendemos datos, no hacemos publicidad y no creamos perfiles de nadie.</p>

      <h2>Cuánto tiempo</h2>
      <ul>
        <li>
          Lo que guarda la app de escritorio, hasta que lo borres. En Ajustes, «Borrar todo»
          destruye la clave de cifrado y las sesiones de las webs.
        </li>
        <li>Los contadores de gasto, hasta el día siguiente.</li>
        <li>Las conversaciones y las búsquedas: nuestro servidor no las guarda.</li>
        <li>El identificador de cada visita en las estadísticas, 24 horas.</li>
        <li>
          Las estadísticas de uso en PostHog, el plazo de su plan, sin nada que te identifique.
        </li>
      </ul>

      <h2>Tus derechos</h2>
      <p>
        Puedes pedir acceso a tus datos, rectificarlos, suprimirlos, oponerte a su tratamiento,
        limitarlo y pedir su portabilidad. Casi todo está solo en tu ordenador, así que lo consultas
        y lo borras tú desde la app. En nuestro servidor no queda nada que te identifique. Si crees
        que no tratamos bien tus datos, puedes reclamar ante la{' '}
        <a href="https://www.aepd.es">Agencia Española de Protección de Datos</a>.
      </p>
      <p>Última actualización: 22 de octubre de 2026.</p>
    </InfoPage>
  );
}

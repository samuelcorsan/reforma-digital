import type { Metadata } from 'next';
import { InfoPage } from '../../../components/brand/info-page';
import { JsonLd } from '../../../components/json-ld';
import { breadcrumbs, pageMetadata, webPage } from '../../../lib/seo';

const title = 'Privacidad · Reforma Digital';
const description =
  'Sin cuenta y sin cookies. Qué datos tratan la web y la extensión de Reforma Digital, quién los recibe y cuánto tiempo se guardan.';

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
        No necesitas una cuenta y no usamos cookies. Aquí explicamos qué datos tratan la web y la
        extensión, quién los recibe y cuánto tiempo se guardan.
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
          <strong>Estadísticas de uso.</strong> Contamos las páginas vistas en PostHog, en la UE. Le
          llegan desde nuestro servidor, sin tu IP, con la ruta de la página y un identificador
          aleatorio que solo vive en la pestaña y se pierde al recargarla.
        </li>
        <li>
          <strong>Fotos del equipo.</strong> Vienen de GitHub, pero nuestro servidor las descarga y
          las optimiza: tu navegador no se conecta con GitHub para verlas.
        </li>
        <li>
          <strong>Vídeos de las entrevistas.</strong> En «Las entrevistas» de Elecciones, el vídeo
          de YouTube solo se carga si pulsas «Cargar el vídeo». Desde ese momento, tu navegador se
          conecta con YouTube (Google, EE. UU.) a través de youtube-nocookie.com, que recibe tu IP y
          puede guardar datos en tu navegador según su propia política. Si no lo pulsas, no se
          conecta.
        </li>
      </ul>

      <h2>La extensión</h2>
      <p>
        Funciona dentro de tu navegador y no envía nada a nadie: no tiene servidor ni analítica y no
        lee cookies. Solo guarda en el navegador si la tienes activada en cada web. Lo que escribes
        en un formulario va de tu navegador a la web oficial, como sin ella.
      </p>

      <h2>Por qué los tratamos</h2>
      <p>
        <strong>Por interés legítimo</strong> (art. 6.1.f del RGPD): mantener la web segura y saber
        qué páginas se visitan, sin identificarte.
      </p>
      <p>No vendemos datos, no hacemos publicidad y no creamos perfiles de nadie.</p>

      <h2>Cuánto tiempo</h2>
      <ul>
        <li>El identificador de cada visita en las estadísticas, 24 horas.</li>
        <li>
          Las estadísticas de uso en PostHog, el plazo de su plan, sin nada que te identifique.
        </li>
      </ul>

      <h2>Tus derechos</h2>
      <p>
        Puedes pedir acceso a tus datos, rectificarlos, suprimirlos, oponerte a su tratamiento,
        limitarlo y pedir su portabilidad. En nuestro servidor no queda nada que te identifique. Si
        crees que no tratamos bien tus datos, puedes reclamar ante la{' '}
        <a href="https://www.aepd.es">Agencia Española de Protección de Datos</a>.
      </p>
      <p>Última actualización: 21 de noviembre de 2026.</p>
    </InfoPage>
  );
}

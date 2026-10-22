import { archivo, version } from '../../../../(search)/escritorio/descargas';

/**
 * Las actualizaciones de la app de escritorio (`publish` en apps/desktop/electron-builder.json):
 * redirige a la release de GitHub. Los latest*.yml son los de la versión que ofrece /escritorio; el
 * resto de archivos llevan su versión en el nombre, también los .blockmap de la versión instalada.
 */
const nombres = /^(?:latest(?:-mac|-linux)?\.yml|reforma-digital[-_](\d+\.\d+\.\d+)[\w.-]*)$/;

export async function GET(_request: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const m = nombres.exec((await params).nombre);
  if (!m) return new Response('No encontrado', { status: 404 });
  return Response.redirect(archivo(m[0], m[1] ?? version), 302);
}

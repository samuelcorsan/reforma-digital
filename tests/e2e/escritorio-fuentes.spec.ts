import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

const raiz = path.resolve(import.meta.dirname, '../../apps/desktop');
test.skip(
  !process.env.RD_ESCRITORIO &&
    (!existsSync(path.join(raiz, 'node_modules/electron/dist')) ||
      !existsSync(path.join(raiz, 'out/modelos/rampart-edge'))),
  'Falta Electron o la app compilada con el modelo del detector.',
);
// Fuentes y páginas sintéticas: no se consulta el contenido de ninguna sede real.
const fuentes = Array.from({ length: 6 }, (_, n) => ({
  url: n === 0 ? 'https://www.boe.es/prueba-fuentes' : `https://example.com/fuente-${n + 1}`,
  titulo: `Fuente de prueba ${n + 1}${n === 5 ? ' · Información pública' : ''}`,
  extracto: 'Información sintética para comprobar la lista de fuentes.',
}));

test('muestra todas las fuentes desde la actividad, sin botón bajo la respuesta', async ({}, info) => {
  test.setTimeout(120_000);
  const servidor = createServer((req, res) => {
    if (req.url?.startsWith('/api/escritorio/icono')) {
      res.writeHead(404);
      return res.end();
    }
    let cuerpo = '';
    req.on('data', (c: Buffer) => (cuerpo += c.toString('utf8')));
    req.on('end', () => {
      const entrada = JSON.parse(cuerpo) as {
        consulta?: string;
        messages?: { role: string; content: string; tool_call_id?: string }[];
      };
      if (req.url === '/api/escritorio/buscar') {
        res.setHeader('content-type', 'application/json');
        return res.end(
          JSON.stringify({
            resultados: entrada.consulta === 'revisita' ? fuentes.slice(0, 1) : fuentes,
            costeUsd: 0,
          }),
        );
      }
      const mensajes = entrada.messages ?? [];
      const inicio = mensajes.map((m) => m.role).lastIndexOf('user');
      const usuario = mensajes[inicio]?.content ?? '';
      const ultima = mensajes
        .slice(inicio + 1)
        .reverse()
        .find((m) => m.role === 'tool')?.tool_call_id;
      const llamadas: {
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }[] = [];
      const llamar = (id: string, name: string, argumentos: object) =>
        llamadas.push({
          id,
          type: 'function',
          function: { name, arguments: JSON.stringify(argumentos) },
        });
      const esperar = usuario.includes('Espera');
      if (!usuario.includes('Sin buscar')) {
        if (!ultima) {
          llamar('busqueda', 'buscar', {
            consulta: usuario.includes('Revisa') ? 'revisita' : 'fuentes',
          });
          if (!usuario.includes('Revisa') && !esperar)
            llamar('busqueda-repetida', 'buscar', { consulta: 'fuentes repetidas' });
        } else if (esperar && ultima === 'busqueda') {
          llamar('pregunta', 'preguntar', {
            titulo: 'Consulta de prueba',
            accion: 'Pedir la cita',
            campos: [{ clave: 'municipio', etiqueta: 'Municipio', tipo: 'texto' }],
          });
        } else if (!usuario.includes('Revisa')) {
          if (ultima.startsWith('busqueda')) llamar('abrir', 'abrir', { url: fuentes[0]!.url });
          else if (ultima === 'abrir') llamar('leer', 'leer_texto', {});
        }
      }
      res.setHeader('content-type', 'text/event-stream');
      const trozo = (delta: object, fin: string | null) =>
        `data: ${JSON.stringify({
          id: 'fuentes',
          object: 'chat.completion.chunk',
          created: 0,
          model: 'guion',
          choices: [{ index: 0, delta, finish_reason: fin }],
        })}\n\n`;
      if (llamadas[0]?.id === 'pregunta')
        res.write(trozo({ role: 'assistant', content: 'Respuesta previa a la tarjeta.' }, null));
      res.write(
        trozo(
          llamadas.length
            ? { role: 'assistant', tool_calls: llamadas.map((l, index) => ({ index, ...l })) }
            : { role: 'assistant', content: 'Respuesta de prueba terminada.' },
          null,
        ),
      );
      res.write(trozo({}, llamadas.length ? 'tool_calls' : 'stop'));
      res.end('data: [DONE]\n\n');
    });
  });
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
  const perfil = mkdtempSync(path.join(tmpdir(), 'rd-fuentes-'));
  const env = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
  );
  env.RD_SERVIDOR_LOCAL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  delete env.ELECTRON_RUN_AS_NODE;
  const lanzar = () =>
    electron.launch({
      executablePath: createRequire(path.join(raiz, 'package.json'))('electron') as string,
      args: [raiz, `--user-data-dir=${perfil}`, '--use-mock-keychain'],
      env,
    });
  let app = await lanzar();
  try {
    // Solo las sesiones del navegador del trámite reciben la página sintética.
    await app.evaluate(({ app, session }) => {
      app.on('web-contents-created', (_e, contenido) => {
        if (contenido.session !== session.defaultSession)
          contenido.session.protocol.handle(
            'https',
            () =>
              new Response(
                '<html><head><title>Fuente de prueba 1</title></head><body><main>Información pública sintética del trámite.</main></body></html>',
                { headers: { 'content-type': 'text/html' } },
              ),
          );
      });
    });
    let ventana = await app.firstWindow();
    const errores: string[] = [];
    ventana.on('pageerror', (e) => errores.push(e.message));
    await ventana.getByRole('button', { name: 'Continuar', exact: true }).click();
    await ventana.getByRole('button', { name: 'Continuar', exact: true }).click();
    await ventana.getByRole('button', { name: 'Empezar', exact: true }).click();
    await ventana.getByPlaceholder(/quiero pedir cita/).fill('Investiga las fuentes de prueba');
    await ventana.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect(ventana.getByText('Respuesta de prueba terminada.', { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await expect(ventana.getByRole('button', { name: /^Fuentes ·/ })).toHaveCount(0);
    expect(ventana.url()).toBe('app://bundle/index.html');
    await expect(ventana).toHaveTitle('Reforma Digital');
    const navegadorVisible = () =>
      app.evaluate(({ BrowserWindow, WebContentsView }) => {
        const ventana = BrowserWindow.getAllWindows()[0]!;
        return ventana.contentView.children.some(
          (v) =>
            v instanceof WebContentsView &&
            v.webContents.id !== ventana.webContents.id &&
            v.getVisible(),
        );
      });
    await expect.poll(navegadorVisible).toBe(true);

    await ventana.getByRole('button', { name: /Ha trabajado/ }).click();
    const mas = ventana.getByRole('button', { name: 'Ver las 6 fuentes', exact: true });
    await ventana.screenshot({
      path: info.outputPath('boton-todas-las-fuentes.png'),
      animations: 'disabled',
    });
    await mas.click();
    let panel = ventana.getByRole('dialog', { name: 'Fuentes' });
    await expect(panel).toHaveCSS('width', '520px');
    await expect(panel.getByRole('listitem')).toHaveCount(6);
    await expect(
      panel.getByRole('region', { name: 'Páginas leídas · 1', exact: true }).getByRole('listitem'),
    ).toHaveCount(1);
    await expect(
      panel
        .getByRole('region', { name: 'Resultados encontrados · 5', exact: true })
        .getByRole('listitem'),
    ).toHaveCount(5);
    await expect(panel.getByText('Sin verificar', { exact: true })).toHaveCount(5);
    await expect.poll(navegadorVisible).toBe(false);
    await expect(panel).toHaveCSS('opacity', '1');
    await ventana.screenshot({ path: info.outputPath('fuentes-busqueda.png') });
    const buscar = panel.getByRole('searchbox', { name: 'Buscar fuentes por título o web' });
    await expect(panel.getByText('Esta búsqueda · 6 fuentes', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Leídas 1', exact: true }).focus();
    await ventana.keyboard.press('Space');
    await expect(panel.getByRole('button', { name: 'Leídas 1', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(panel.getByRole('listitem')).toHaveCount(1);
    await expect(panel.getByRole('listitem')).toContainText('Fuente de prueba 1');
    await panel.getByRole('button', { name: 'Encontradas 5', exact: true }).click();
    await expect(panel.getByRole('listitem')).toHaveCount(5);
    await buscar.fill('INFORMACION PUBLICA');
    await expect(panel.getByRole('listitem')).toHaveCount(1);
    await expect(panel.getByRole('listitem')).toContainText('Fuente de prueba 6');
    await panel.getByRole('button', { name: 'Limpiar búsqueda', exact: true }).click();
    await expect(buscar).toBeFocused();
    await buscar.fill('EXAMPLE.COM');
    await expect(panel.getByRole('listitem')).toHaveCount(5);
    await panel.getByRole('button', { name: 'Leídas 1', exact: true }).click();
    await expect(panel.getByRole('listitem')).toHaveCount(0);
    await expect(panel.getByText('No hay fuentes que coincidan.', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Ver todas las fuentes', exact: true }).click();
    await expect(panel.getByRole('listitem')).toHaveCount(6);
    await expect(buscar).toHaveValue('');
    // Cerrar con una búsqueda y un filtro activos no los arrastra a la siguiente apertura.
    await panel.getByRole('button', { name: 'Encontradas 5', exact: true }).click();
    await buscar.fill('Fuente de prueba 6');
    await ventana.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
    await expect(mas).toBeFocused();
    await expect.poll(navegadorVisible).toBe(true);
    await mas.click();
    await expect(panel.getByRole('listitem')).toHaveCount(6);
    await expect(buscar).toHaveValue('');
    await panel.getByRole('button', { name: /^Fuente de prueba 6/ }).click();
    await expect(panel).not.toBeVisible();
    await expect(mas).toBeFocused();
    await expect(
      ventana
        .getByRole('complementary', { name: 'Navegador del trámite' })
        .getByText('example.com', { exact: true }),
    ).toBeVisible();
    await expect.poll(navegadorVisible).toBe(true);

    await ventana
      .getByRole('textbox', { name: 'Mensaje para el asistente' })
      .fill('Revisa las fuentes de prueba');
    await ventana.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect(ventana.getByText('Respuesta de prueba terminada.', { exact: true })).toHaveCount(
      2,
    );
    await ventana
      .getByRole('button', { name: /Ha trabajado/ })
      .last()
      .click();
    await expect(
      ventana.getByRole('button', { name: 'Fuente de prueba 1', exact: true }),
    ).toHaveCount(2);
    // La búsqueda nueva no sustituye las fuentes de la actividad anterior.
    await expect(mas).toHaveCount(1);
    await expect(ventana.getByRole('button', { name: /^Fuentes ·/ })).toHaveCount(0);

    await ventana
      .getByRole('textbox', { name: 'Mensaje para el asistente' })
      .fill('Sin buscar, responde brevemente');
    await ventana.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect(ventana.getByText('Respuesta de prueba terminada.', { exact: true })).toHaveCount(
      3,
    );
    await expect(ventana.getByRole('button', { name: /^Fuentes ·/ })).toHaveCount(0);
    expect(errores).toEqual([]);

    await app.close();
    app = await lanzar();
    ventana = await app.firstWindow();
    await ventana.getByRole('button', { name: /^Investiga las fuentes de prueba/ }).click();
    await ventana.emulateMedia({ reducedMotion: 'reduce' });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(960, 720));
    await ventana
      .getByRole('button', { name: /Ha trabajado/ })
      .first()
      .click();
    await ventana.getByRole('button', { name: 'Ver las 6 fuentes', exact: true }).click();
    panel = ventana.getByRole('dialog', { name: 'Fuentes' });
    await expect(panel.getByRole('listitem')).toHaveCount(6);
    await expect(panel.getByRole('button', { name: 'Leídas 1', exact: true })).toBeVisible();
    await expect(panel).toHaveCSS('transition-property', 'none');
    await ventana.screenshot({ path: info.outputPath('fuentes-compacto.png') });
    await panel.getByRole('button', { name: 'Cerrar fuentes' }).click();
    await expect(panel).not.toBeVisible();

    await ventana
      .getByRole('textbox', { name: 'Mensaje para el asistente' })
      .fill('Espera mi decisión después de consultar fuentes');
    await ventana.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect(
      ventana.getByRole('button', { name: 'Pedir la cita por mí', exact: true }),
    ).toBeVisible();
    await expect(ventana.getByRole('button', { name: /^Fuentes ·/ })).toHaveCount(0);
    await ventana
      .getByRole('button', { name: /Ha trabajado/ })
      .last()
      .click();
    await ventana.getByRole('button', { name: 'Ver las 6 fuentes', exact: true }).last().click();
    panel = ventana.getByRole('dialog', { name: 'Fuentes' });
    await expect(panel.getByRole('listitem')).toHaveCount(6);
    await expect(
      panel
        .getByRole('region', { name: 'Resultados encontrados · 5', exact: true })
        .getByRole('listitem'),
    ).toHaveCount(5);
    await ventana.screenshot({ path: info.outputPath('fuentes-tarjeta-pendiente.png') });
    await panel.getByRole('button', { name: 'Cerrar fuentes' }).click();
    await app.close();
    app = await lanzar();
    ventana = await app.firstWindow();
    await ventana.getByRole('button', { name: /^Investiga las fuentes de prueba/ }).click();
    await expect(
      ventana.getByRole('button', { name: 'Pedir la cita por mí', exact: true }),
    ).toBeVisible();
    await expect(ventana.getByRole('button', { name: /^Fuentes ·/ })).toHaveCount(0);
    await ventana.getByRole('button', { name: 'Detener al asistente', exact: true }).click();
    await expect(ventana.getByText('Has detenido al asistente.', { exact: true })).toBeVisible();
    await ventana
      .getByRole('button', { name: /Ha trabajado/ })
      .last()
      .click();
    await ventana.getByRole('button', { name: 'Ver las 6 fuentes', exact: true }).click();
    await expect(
      ventana.getByRole('dialog', { name: 'Fuentes' }).getByRole('listitem'),
    ).toHaveCount(6);
  } finally {
    await app.close();
    await new Promise<void>((r) => servidor.close(() => r()));
    rmSync(perfil, { recursive: true, force: true });
  }
});

// /developers en Markdown, para agentes: /developers/api.md, /developers/mcp.md y
// /developers/mcp/<id>.md. Sale de los mismos datos que las páginas, así no se desincronizan.
import * as api from './api';
import { servers, type McpServer } from '../mcp/catalog';
import { categories } from '../mcp/categorias';
import { endpoint, fichaPath, markdownUrl } from '../mcp/rutas';
import { siteUrl } from '../site';

const page = (path: string) => new URL(path, siteUrl).href;
const fence = (lang: string, code: string) => `\`\`\`${lang}\n${code}\n\`\`\``;
const lines = (...parts: (string | false | undefined)[]) =>
  parts.filter((part) => part !== false && part !== undefined).join('\n\n');

export function apiMarkdown() {
  return lines(
    `# ${api.title}`,
    api.intro,
    `URL base: ${api.apiBase}`,
    '## Autenticación',
    api.auth,
    '## Paginación',
    api.pagination.text,
    fence('json', api.pagination.example),
    api.pagination.after,
    '## Endpoints',
    ...api.endpoints.map((e) =>
      lines(
        `### ${e.title}`,
        `\`GET /api/congreso${e.path}\``,
        e.text,
        e.params &&
          [
            '| Parámetro | Tipo | Descripción | Por defecto |',
            '| --- | --- | --- | --- |',
            ...e.params.map(
              ([name, type, text, value]) =>
                `| \`${name}\` | ${type} | ${text} | ${value ? `\`${value}\`` : '—'} |`,
            ),
          ].join('\n'),
        fence('bash', api.curl(e)),
        e.response && fence('json', e.response),
      ),
    ),
    '## Errores',
    api.errors.text,
    [
      '| Código | Descripción |',
      '| --- | --- |',
      ...api.errors.codes.map(([code, text]) => `| \`${code}\` | ${text} |`),
    ].join('\n'),
    '## Caché',
    api.cache.text,
    fence('bash', api.cache.example),
    '## Licencia y atribución',
    api.license,
    `Página: ${page('/developers/api')}`,
  );
}

/**
 * La guía para que un agente se conecte solo, con las prácticas de vercel.com/get-started.md:
 * hace los pasos él mismo, una vía por cliente, combina la configuración sin pisar nada, para
 * solo para pedir permiso, anota lo que falla y sigue, comprueba y cuenta solo lo comprobado.
 */
function guide(list: McpServer[]) {
  const one = list.length === 1;
  const each = (pick: (id: string, url: string) => string) =>
    list.map(({ id }) => pick(id, endpoint(id))).join('\n');
  const json = (key: string, value: (id: string, url: string) => object) =>
    fence(
      'json',
      JSON.stringify(
        { [key]: Object.fromEntries(list.map(({ id }) => [id, value(id, endpoint(id))])) },
        null,
        2,
      ),
    );
  // Para comprobar, una herramienta de solo lectura sin parámetros obligatorios si la hay.
  const check = list
    .map(({ id, tools }) => {
      const tool = tools.find((t) => t.params.every((p) => !p.required)) ?? tools[0];
      return tool ? `\`${tool.name}\` en \`${id}\`` : undefined;
    })
    .filter(Boolean)
    .join(', ');
  return lines(
    '## Cómo seguir esta guía',
    [
      '- Si tienes terminal o acceso a ficheros, haz tú los pasos: no te limites a devolver las órdenes para que la persona las copie.',
      '- Averigua en qué cliente estás y usa solo su vía.',
      '- Antes de editar un fichero de configuración, léelo y añade las entradas sin borrar ni cambiar las que ya tiene.',
      `- Usa exactamente ${one ? 'la URL de esta guía, que empieza' : 'las URL de esta guía, que empiezan'} por \`${new URL('/mcp/', siteUrl).href}\`.`,
      '- Para solo para pedir permiso a la persona antes de cambiar su configuración o reiniciar el cliente, o si hace falta algo que no puedes hacer tú.',
      '- Si un paso falla, anota por qué y sigue con el resto.',
    ].join('\n'),
    '## 1. Conecta ' + (one ? 'el servidor' : 'los servidores'),
    `${one ? 'Es un servidor MCP remoto' : 'Son servidores MCP remotos'} de solo lectura, por Streamable HTTP y sin clave: no hay que iniciar sesión.`,
    '### Claude Code',
    fence(
      'bash',
      each((id, url) => `claude mcp add --transport http ${id} ${url}`),
    ),
    '### Codex',
    fence(
      'bash',
      each((id, url) => `codex mcp add ${id} --url ${url}`),
    ),
    '### Cursor',
    'En `mcpServers` de `~/.cursor/mcp.json`:',
    json('mcpServers', (_, url) => ({ url })),
    '### VS Code',
    'En `servers` de `.vscode/mcp.json`:',
    json('servers', (_, url) => ({ type: 'http', url })),
    '### Otros clientes',
    'Si el cliente admite servidores remotos, añade la URL como servidor HTTP. Si solo admite servidores locales (stdio), usa `mcp-remote` como puente:',
    json('mcpServers', (_, url) => ({ command: 'npx', args: ['-y', 'mcp-remote', url] })),
    '### Claude.ai y ChatGPT',
    `No se configuran desde el chat: la persona tiene que añadir ${one ? 'la URL' : 'cada URL'} como conector personalizado, sin autenticación. Díselo y dale ${one ? 'la URL' : 'las URL'}.`,
    // Por Instinct, que no admite conectores MCP y no edita su configuración por lo que diga una web.
    '### Agentes sin MCP',
    `Si el cliente no admite servidores MCP, no hace falta conectar nada: cada herramienta también se lee con un GET a \`<URL del servidor>/<herramienta>?parámetro=valor\`, que responde el mismo texto que la herramienta. ${one ? 'La URL de cada herramienta está en su sección.' : 'La URL de cada herramienta está en la ficha de su servidor.'}`,
    '## 2. Comprueba que funciona',
    [
      '1. Recarga la lista de servidores del cliente; si no aparecen, pide permiso para reiniciarlo.',
      `2. Lista las herramientas ${one ? 'del servidor' : 'de cada servidor'}.`,
      `3. Llama a una de solo lectura: ${check}.`,
    ].join('\n'),
    '## Al terminar',
    'Cuenta solo lo que hayas comprobado, así:',
    fence(
      'text',
      [
        'Reforma Digital conectado.',
        ...list.map(({ id }) => `- ${id}: conectado / bloqueado (motivo)`),
        'Comprobado con: <herramienta>',
      ].join('\n'),
    ),
  );
}

function tools(server: McpServer) {
  return server.tools
    .map((tool) =>
      lines(
        `### ${tool.title} (\`${tool.name}\`)`,
        tool.description,
        `Sin MCP: \`GET ${endpoint(server.id)}/${tool.name}${tool.params
          .filter((p) => p.required)
          .map((p, i) => `${i === 0 ? '?' : '&'}${p.name}=<${p.name}>`)
          .join('')}\``,
        tool.params.length > 0 &&
          tool.params
            .map(
              (p) =>
                `- \`${p.name}\` (${p.type}${p.required ? ', obligatorio' : ''})${p.description ? `: ${p.description}` : ''}${p.default ? ` Por defecto \`${p.default}\`.` : ''}`,
            )
            .join('\n'),
      ),
    )
    .join('\n\n');
}

const frontmatter = (fields: Record<string, string>) =>
  ['---', ...Object.entries(fields).map(([k, v]) => `${k}: ${JSON.stringify(v)}`), '---'].join(
    '\n',
  );

export async function mcpMarkdown() {
  const all = await servers();
  return lines(
    frontmatter({
      name: 'reforma-digital-mcp',
      title: 'Conecta tu agente a Reforma Digital',
      description: 'Conecta el agente actual a los servidores MCP de Reforma Digital.',
      url: markdownUrl('/developers/mcp'),
    }),
    '# Conecta tu agente a Reforma Digital',
    'Usa esta guía para conectar el agente actual a los servidores MCP de Reforma Digital, que consultan datos públicos de España. Son de solo lectura y no necesitan cuenta ni clave.',
    '## Servidores',
    all
      .map(
        (s) =>
          `- **${s.name}** (\`${s.id}\`, ${categories[s.category].name.toLowerCase()}): ${s.summary} URL: ${endpoint(s.id)}. Herramientas: ${markdownUrl(fichaPath(s.id))}`,
      )
      .join('\n'),
    guide(all),
    '## Más',
    [
      `- La API REST de los mismos datos: ${markdownUrl('/developers/api')}`,
      `- La biblioteca en la web: ${page('/developers/mcp')}`,
    ].join('\n'),
  );
}

export async function serverMarkdown(id: string) {
  const server = (await servers()).find((s) => s.id === id);
  if (!server) return undefined;
  return lines(
    frontmatter({
      name: `reforma-digital-mcp-${server.id}`,
      title: `Conecta tu agente a ${server.name}`,
      description: server.summary,
      url: markdownUrl(fichaPath(server.id)),
    }),
    `# Conecta tu agente a ${server.name}`,
    `Usa esta guía para conectar el agente actual al servidor MCP \`${server.id}\` de Reforma Digital. ${server.summary}`,
    `URL: ${endpoint(server.id)}`,
    guide([server]),
    '## Herramientas',
    tools(server),
    server.examples.length > 0 &&
      lines('## Prueba a preguntar', server.examples.map((e) => `- ${e}`).join('\n')),
    '## Más',
    [
      `- Todos los servidores: ${markdownUrl('/developers/mcp')}`,
      `- Esta ficha en la web: ${page(fichaPath(server.id))}`,
    ].join('\n'),
  );
}

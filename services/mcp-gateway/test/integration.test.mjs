import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const randomPort = async () => {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
};

const upstream = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ path: url.pathname, query: Object.fromEntries(url.searchParams) }));
});

const close = server => new Promise(resolve => server.close(resolve));

const waitFor = async (port, process) => {
  for (let i = 0; i < 60; i++) {
    if (process.exitCode !== null) throw new Error('El proceso del gateway terminó antes de iniciar');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(200) });
      if (response.ok) return await response.json();
    } catch { /* Wait for listen(). */ }
    await sleep(100);
  }
  throw new Error('El gateway no empezó a escuchar en 6 segundos');
};

test('handshake SSE MCP, 26 herramientas, esquema y consulta upstream', { timeout: 20_000 }, async () => {
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamPort = upstream.address().port;
  const gatewayPort = await randomPort();
  const child = spawn(process.execPath, ['dist/server.js'], {
    env: {
      ...process.env,
      PORT: String(gatewayPort),
      HOST: '127.0.0.1',
      UPSTREAM_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
      UPSTREAM_RETRIES: '0',
      SSE_HEARTBEAT_MS: '1000',
      GATEWAY_TOKEN: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  let client;
  try {
    const health = await waitFor(gatewayPort, child);
    assert.equal(health.tools, 26);
    assert.equal(health.modules, 7);

    client = new Client({ name: 'gateway-integration-test', version: '1.0.0' }, { capabilities: {} });
    await client.connect(new SSEClientTransport(new URL(`http://127.0.0.1:${gatewayPort}/sse`)));
    const tools = (await client.listTools()).tools;
    assert.equal(tools.length, 26);
    for (const prefix of ['renfe_', 'carburantes_', 'ine_', 'boe_', 'alsa_', 'congreso_', 'eustat_']) {
      assert.ok(tools.some(tool => tool.name.startsWith(prefix)), `Prefijo ${prefix}`);
    }

    const trains = await client.callTool({
      name: 'renfe_search_trains',
      arguments: { origin: 'Madrid', destination: 'Sevilla', date: 'tomorrow', include_fares: true }
    });
    assert.equal(trains.isError, undefined);
    const trainsBody = JSON.parse(trains.content[0].text);
    assert.equal(trainsBody.path, '/renfe/search_trains');
    assert.equal(trainsBody.query.origin, 'Madrid');
    assert.equal(trainsBody.query.include_fares, 'true');

    const data = await client.callTool({
      name: 'eustat_datos_tabla',
      arguments: { tabla: 'tabla.px', filtros: { 'territorio histórico': 'gipuzkoa' }, ultimos: 3 }
    });
    const dataBody = JSON.parse(data.content[0].text);
    assert.deepEqual(JSON.parse(dataBody.query.filtros), { 'territorio histórico': 'gipuzkoa' });

    const invalid = await client.callTool({
      name: 'carburantes_gasolineras_baratas',
      arguments: { carburante: 'diesel' }
    });
    assert.equal(invalid.isError, true);
  } finally {
    if (client) await client.close().catch(() => undefined);
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise(resolve => child.once('exit', resolve));
    }
    await close(upstream);
    assert.equal(stderr, '', `Errores inesperados de gateway: ${stderr}`);
  }
});

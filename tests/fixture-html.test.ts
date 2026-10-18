// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { fixtureHtml } from '../scripts/lib/live.mjs';

it('saves fixtures without tokens, typed text or embedded content, keeping what adapters read', () => {
  const doc = new DOMParser().parseFromString(
    `<html><head><meta name="csrf-token" content="SECRET1"><meta name="viewport" content="width=device-width"></head>
    <body data-session-id="SECRET2">
      <form action="/enviar;jsessionid=SECRET3?p_auth=SECRET4&amp;paso=2#access_token=SECRET5">
        <input type="hidden" name="_csrf" value="SECRET6">
        <input id="q" value="busqueda">
        <textarea>texto escrito</textarea>
        <input id="prov" readonly value="Madrid">
        <input type="submit" value="Buscar">
        <button id="b" onclick="javascript:enviar('a')">Enviar</button>
      </form>
      <a href="https://idp.example/sso?SAMLRequest=SECRET7&amp;RelayState=SECRET8&amp;code=SECRET9">Entrar</a>
      <object data="x.swf"></object><embed src="x.swf">
      <template><div data-csrf="SECRET10"><a href="/x?ticket=SECRET11">x</a></div><!-- SECRET12 --><script>SECRET13</script></template>
    </body></html>`,
    'text/html',
  );
  const html = fixtureHtml(doc);
  expect(html).not.toMatch(/SECRET|busqueda|texto escrito|<object|<embed|<script/);
  expect(html).toContain('content="width=device-width"');
  expect(html).toContain('paso=2');
  expect(html).toContain('value="Madrid"');
  expect(html).toContain('value="Buscar"');
  expect(html).toContain(`onclick="javascript:enviar('a')"`);
});

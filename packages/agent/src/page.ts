/**
 * Lectura y manejo de páginas con el mismo código en la app (WebContentsView de Electron, en un
 * mundo aislado) y en las evaluaciones (Playwright). El script se inyecta como texto: no depende
 * del bundler ni de helpers que añada el compilador.
 */

/** Lo mínimo que tiene que ofrecer un navegador para que el agente lo use. */
export interface Navegador {
  url(): string;
  abrir(url: string): Promise<void>;
  atras(): Promise<void>;
  /** Evalúa una expresión JavaScript en la página y devuelve su resultado serializable. */
  evaluar<T>(expresion: string): Promise<T>;
  /** Clic real (evento de confianza) en coordenadas CSS del viewport. */
  clic(x: number, y: number): Promise<void>;
  /** Inserta texto en el elemento con el foco, como lo haría el teclado. */
  insertarTexto(texto: string): Promise<void>;
  tecla(
    tecla: 'Enter' | 'Tab' | 'Escape' | 'ArrowDown' | 'ArrowUp' | 'Backspace' | 'Space',
  ): Promise<void>;
  /** Espera a que termine la navegación o la actividad que haya provocado la última acción. */
  esperar(ms?: number): Promise<void>;
  /** Archivos descargados desde la última llamada (nombre con el que se han guardado). */
  descargas?(): string[];
  /** El diálogo propio de la web (alert, confirm, prompt) que espera respuesta, si hay uno. */
  dialogo?(): Dialogo | null;
  responderDialogo?(aceptar: boolean, texto?: string): Promise<void>;
}

export type Dialogo = {
  /** Distinto para cada diálogo que abre la web. */
  id: number;
  tipo: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
  mensaje: string;
  porDefecto?: string;
  /** El origen del marco que lo ha abierto, si se sabe (puede ser de otra web que la página). */
  origen?: string;
};

export type Instantanea = {
  url: string;
  titulo: string;
  /** Los valores de los campos de texto van aparte, como `⟦n⟧`: la app decide qué se ve de ellos. */
  texto: string;
  valores: string[];
  captcha: boolean;
  contrasenas: number;
};

export type InfoElemento = {
  tag: string;
  rol: string;
  nombre: string;
  /** Destino absoluto de un enlace; vacío en lo demás. */
  href: string;
  contrasena: boolean;
  desactivado: boolean;
  marcado: boolean | null;
  valor: string;
  /** La página parece un resumen o una confirmación final. */
  paginaConfirmacion: boolean;
  /** Intro o Espacio irían a algo que no se ve (un marco de otra web, un shadow DOM cerrado): se trata como vinculante. */
  incierto?: boolean;
};

const SCRIPT = String.raw`(function () {
  if (window.__rd) return;
  var ids = new WeakMap();
  var refs = new Map();
  var valores = [];
  var siguiente = 1;
  var OMITIR = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, SVG: 1, HEAD: 1, META: 1, LINK: 1, OBJECT: 1, EMBED: 1 };
  var CONTROLES = { link: 1, button: 1, select: 1, textbox: 1, checkbox: 1, radio: 1, file: 1, combobox: 1, tab: 1, menuitem: 1, option: 1, switch: 1, searchbox: 1 };
  function limpio(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function corto(s, n) { s = limpio(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function ref(el) {
    var id = ids.get(el);
    if (!id) { id = siguiente++; ids.set(el, id); }
    refs.set(id, el);
    return id;
  }
  function estilo(el) { try { return el.ownerDocument.defaultView.getComputedStyle(el); } catch (e) { return null; } }
  // aria-hidden no esconde nada a la vista (suele ser la versión visual de un texto que se repite
  // para los lectores de pantalla): lo que cuenta es lo que ve una persona.
  function visible(el, s) {
    if (el.hidden) return false;
    if (!s) return true;
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
    if (s.display === 'contents') return true;
    return el.getClientRects().length > 0;
  }
  /** Medida de un recorte ("10px" o "50%") en píxeles, sobre el tamaño de la caja. */
  function medida(v, total) { var n = parseFloat(v); return /%$/.test(v) ? (n / 100) * total : n; }
  /**
   * Lo que está en la página pero una persona no ve: recortado hasta no dejar nada a la vista, de
   * 1 px con lo que sobra escondido o colocado fuera de la página. Es como se esconde el texto solo
   * para lectores de pantalla, y como una web puede esconder órdenes para un asistente. Lo
   * transparente no cuenta: muchas webs lo muestran al bajar por la página.
   */
  function oculto(el, s) {
    if (!s || s.display === 'contents') return false;
    var r = el.getBoundingClientRect(), w = el.ownerDocument.defaultView;
    if ((r.width <= 1 || r.height <= 1) && /hidden|clip/.test(s.overflowX + ' ' + s.overflowY)) return true;
    if (r.right + w.scrollX < 0 || r.bottom + w.scrollY < 0) return true;
    var clip = /^rect\((.*)\)$/.exec(s.clip || '');
    if (clip && (s.position === 'absolute' || s.position === 'fixed')) {
      // rect(arriba, derecha, abajo, izquierda), en coordenadas de la caja.
      var c = clip[1].split(/[\s,]+/).map(parseFloat);
      if (c.length === 4 && c.every(isFinite) && (c[1] - c[3] <= 1 || c[2] - c[0] <= 1)) return true;
    }
    var ins = /^inset\(([^)]*)\)/.exec(s.clipPath || '');
    if (ins) {
      // inset(arriba derecha abajo izquierda), con los valores que falten repetidos como en CSS.
      var v = ins[1].split(/\s+round\s+/)[0].trim().split(/\s+/);
      var arriba = v[0], derecha = v[1] || arriba, abajo = v[2] || arriba, izquierda = v[3] || derecha;
      if (r.width - medida(izquierda, r.width) - medida(derecha, r.width) <= 1) return true;
      if (r.height - medida(arriba, r.height) - medida(abajo, r.height) <= 1) return true;
    }
    return false;
  }
  /** Un control escondido cuya etiqueta sí se ve (las casillas con estilo propio) se usa pulsando la etiqueta. */
  function etiquetaALaVista(el) {
    var por = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(function (id) { return id && el.ownerDocument.getElementById(id); });
    return Array.prototype.concat.call(Array.prototype.slice.call(el.labels || []), por).some(function (l) { if (!l) return false; var s = estilo(l); return visible(l, s) && !oculto(l, s); });
  }
  function rol(el) {
    var r = el.getAttribute('role');
    if (r) return r;
    var t = el.tagName;
    if (t === 'A') return el.hasAttribute('href') || el.hasAttribute('onclick') ? 'link' : '';
    if (t === 'BUTTON' || t === 'SUMMARY') return 'button';
    if (t === 'SELECT') return 'select';
    if (t === 'TEXTAREA') return 'textbox';
    if (t === 'INPUT') {
      var ty = (el.type || 'text').toLowerCase();
      if (ty === 'hidden') return '';
      if (ty === 'button' || ty === 'submit' || ty === 'reset' || ty === 'image') return 'button';
      if (ty === 'checkbox') return 'checkbox';
      if (ty === 'radio') return 'radio';
      if (ty === 'file') return 'file';
      return 'textbox';
    }
    if (el.isContentEditable && el.hasAttribute('contenteditable')) return 'textbox';
    if (el.hasAttribute('onclick')) return 'button';
    return '';
  }
  function textoDe(el) { return limpio(el.innerText || el.textContent || ''); }
  function etiquetaCercana(el) {
    var td = el.closest && el.closest('td,th');
    if (td && td.previousElementSibling) { var t = textoDe(td.previousElementSibling); if (t && t.length < 80) return t; }
    var p = el.previousSibling, partes = [];
    while (p && partes.join(' ').length < 60) {
      if (p.nodeType === 3) partes.unshift(p.nodeValue);
      else if (p.nodeType === 1) { if (rol(p)) break; partes.unshift(p.innerText || ''); }
      p = p.previousSibling;
    }
    return corto(partes.join(' '), 80);
  }
  function nombre(el) {
    var by = el.getAttribute('aria-labelledby');
    if (by) {
      var t = by.split(/\s+/).map(function (id) { var x = el.ownerDocument.getElementById(id); return x ? textoDe(x) : ''; }).join(' ');
      if (limpio(t)) return corto(t, 120);
    }
    var al = el.getAttribute('aria-label');
    if (limpio(al)) return corto(al, 120);
    if (el.labels && el.labels.length) {
      var l = Array.prototype.map.call(el.labels, textoDe).join(' ');
      if (limpio(l)) return corto(l, 120);
    }
    var t2 = el.tagName;
    if (t2 === 'INPUT' && /^(button|submit|reset)$/i.test(el.type)) return corto(el.value || el.type, 120);
    if (t2 === 'INPUT' && el.type === 'image') return corto(el.alt || el.value || 'imagen', 120);
    if (t2 === 'IMG') return corto(el.alt || '', 120);
    // Lo que hay escrito en un campo no es su nombre: sería su valor, y el valor va aparte.
    if (t2 !== 'INPUT' && t2 !== 'SELECT' && t2 !== 'TEXTAREA' && !/^(textbox|searchbox|combobox)$/.test(rol(el))) {
      var txt = textoDe(el);
      if (txt) return corto(txt, 120);
      var img = el.querySelector && el.querySelector('img[alt]');
      if (img && img.alt) return corto(img.alt, 120);
    }
    return corto(el.getAttribute('title') || etiquetaCercana(el) || el.getAttribute('placeholder') || el.getAttribute('name') || el.id || '', 120);
  }
  function destino(el) {
    var h = el.getAttribute('href') || '';
    if (!h || /^javascript:/i.test(h) || h === '#') return '';
    try {
      // Sin los parámetros: pueden llevar datos de la persona y para seguir el enlace basta su número.
      var u = new URL(h, el.ownerDocument.baseURI);
      return (u.origin === location.origin ? '' : u.origin) + u.pathname + (u.search ? '?…' : '');
    } catch (e) { return ''; }
  }
  function describir(el, r) {
    var id = ref(el), n = nombre(el), extra = '';
    var dis = el.disabled || el.getAttribute('aria-disabled') === 'true' ? ' (desactivado)' : '';
    var req = el.required || el.getAttribute('aria-required') === 'true' ? ' (obligatorio)' : '';
    var inv = el.getAttribute('aria-invalid') === 'true' ? ' (con error)' : '';
    if (r === 'link') { var d = destino(el); return '[' + id + '] enlace "' + n + '"' + (d ? ' → ' + corto(d, 100) : '') + dis; }
    if (r === 'button' || r === 'tab' || r === 'menuitem' || r === 'option') return '[' + id + '] ' + (r === 'button' ? 'botón' : r === 'tab' ? 'pestaña' : 'opción') + ' "' + n + '"' + dis;
    if (r === 'checkbox' || r === 'switch') return '[' + id + '] casilla "' + n + '" ' + (el.checked || el.getAttribute('aria-checked') === 'true' ? '[x]' : '[ ]') + req + dis;
    if (r === 'radio') return '[' + id + '] opción "' + n + '" ' + (el.checked || el.getAttribute('aria-checked') === 'true' ? '(•)' : '( )') + (el.name ? ' grupo ' + el.name : '') + req + dis;
    if (r === 'file') return '[' + id + '] archivo "' + n + '"' + req + ' (lo adjunta la persona)';
    if (r === 'select' && el.tagName === 'SELECT') {
      var ops = Array.prototype.filter.call(el.options, function (o) { return !o.hidden; });
      var sel = el.selectedIndex >= 0 ? limpio(el.options[el.selectedIndex].text) : '';
      var lista = ops.slice(0, 40).map(function (o) { return corto(o.text, 60); }).join(' | ');
      extra = ' = "' + sel + '" opciones: ' + lista + (ops.length > 40 ? ' | … (' + ops.length + ' en total)' : '');
      return '[' + id + '] desplegable "' + n + '"' + extra + req + dis + inv;
    }
    if (el.tagName === 'INPUT' && el.type === 'password') return '[' + id + '] campo de contraseña "' + n + '"' + (el.value ? ' (escrita)' : '') + ' (la escribe la persona)';
    var valor = el.isContentEditable ? textoDe(el) : el.value || '';
    var ph = el.getAttribute('placeholder');
    var tipo = el.tagName === 'INPUT' && el.type && el.type !== 'text' ? ' ' + el.type : '';
    var max = el.maxLength > 0 && el.maxLength < 1000 ? ' (máx. ' + el.maxLength + ')' : '';
    if (valor) valores.push(corto(valor, 200));
    return '[' + id + '] campo' + tipo + ' "' + n + '" = "' + (valor ? '⟦' + (valores.length - 1) + '⟧' : '') + '"' + (ph && !valor ? ' ejemplo: "' + corto(ph, 60) + '"' : '') + req + max + dis + inv;
  }
  function esAviso(el) {
    var r = el.getAttribute('role');
    if (r === 'alert' || r === 'alertdialog' || el.getAttribute('aria-live') === 'assertive') return true;
    return /(^|[\s_-])(error|errores|alert|alerta|aviso|warning|invalid|mensaje-error)([\s_-]|$)/i.test(el.className && el.className.baseVal === undefined ? el.className : '');
  }
  function captcha(doc) {
    return !!doc.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], .g-recaptcha, .h-captcha, .cf-turnstile, img[src*="captcha" i], img[id*="captcha" i], img[alt*="captcha" i], input[name*="captcha" i], input[id*="captcha" i]');
  }
  function instantanea(max) {
    var lineas = [], linea = '', aviso = 0, contrasenas = 0, hayCaptcha = captcha(document);
    function cerrar() { var t = limpio(linea).replace(/^\|\s*/, '').replace(/\s*\|$/, ''); if (t && !/^[|\s]*$/.test(t)) lineas.push({ t: (aviso ? '⚠ ' : '') + t, c: 0 }); linea = ''; }
    function emitir(t, c) {
      cerrar();
      var previa = lineas[lineas.length - 1];
      // En las tablas la etiqueta va en otra celda: si ya es el nombre del control, sobra.
      if (c && previa && !previa.c && t.indexOf('"' + previa.t + '"') >= 0) lineas.pop();
      lineas.push({ t: (aviso && !c ? '⚠ ' : '') + t, c: c });
    }
    function controlesDentro(padre) {
      for (var h = padre.firstElementChild; h; h = h.nextElementSibling) {
        var rh = rol(h);
        if (rh && CONTROLES[rh]) recorrer(h); else controlesDentro(h);
      }
    }
    function recorrer(nodo) {
      if (nodo.nodeType === 3) { linea += nodo.nodeValue; return; }
      if (nodo.nodeType !== 1) return;
      var el = nodo, tag = el.tagName;
      if (OMITIR[tag]) return;
      var s = estilo(el);
      if (!visible(el, s)) return;
      if (oculto(el, s)) {
        var r0 = rol(el);
        if (!(r0 && CONTROLES[r0] && etiquetaALaVista(el))) return;
      }
      if (tag === 'IFRAME' || tag === 'FRAME') {
        var doc = null;
        try { doc = el.contentDocument; } catch (e) { doc = null; }
        if (doc && doc.body) { if (captcha(doc)) hayCaptcha = true; emitir('[marco: ' + (nombre(el) || 'contenido') + ']', 1); recorrer(doc.body); emitir('[fin del marco]', 1); }
        else { var host = ''; try { host = new URL(el.src).host; } catch (e) {} emitir('[marco de otra web' + (host ? ': ' + host : '') + ']', 1); }
        return;
      }
      // La etiqueta de un control ya va en su nombre. Si lo envuelve, de ella solo cuentan los
      // controles que lleva dentro: el suyo y, por ejemplo, el enlace a las condiciones.
      if (tag === 'LABEL' && el.control && rol(el.control)) {
        if (el.contains(el.control)) controlesDentro(el);
        return;
      }
      var r = rol(el);
      if (r && CONTROLES[r]) {
        if (tag === 'INPUT' && el.type === 'password') contrasenas++;
        emitir(describir(el, r), 1);
        return;
      }
      var d = s ? s.display : 'block';
      var bloque = d !== 'inline' && d !== 'inline-block' && d !== 'contents' && d !== 'table-cell';
      var av = esAviso(el);
      if (bloque || av) cerrar();
      if (av) aviso++;
      if (/^H[1-6]$/.test(tag)) linea += new Array(Number(tag[1]) + 1).join('#') + ' ';
      if (tag === 'LI') linea += '- ';
      if (tag === 'TD' || tag === 'TH') linea += ' | ';
      if (tag === 'IMG' && el.alt && !/captcha/i.test(el.alt + el.src)) linea += ' [imagen: ' + corto(el.alt, 80) + '] ';
      if (tag === 'BR') linea += '\n';
      for (var c = el.firstChild; c; c = c.nextSibling) recorrer(c);
      if (el.shadowRoot) for (var c2 = el.shadowRoot.firstChild; c2; c2 = c2.nextSibling) recorrer(c2);
      if (av) { cerrar(); aviso--; }
      if (bloque) cerrar();
    }
    refs.clear();
    valores = [];
    if (document.body) recorrer(document.body);
    cerrar();
    var total = 0, texto = 0, salida = [], omitidas = 0;
    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i];
      var importante = l.c || /^(#|⚠)/.test(l.t);
      if (!importante && texto > max * 0.55) { omitidas++; continue; }
      if (total + l.t.length > max) { salida.push('… (página recortada; usa leer_texto para el resto)'); break; }
      salida.push(l.t);
      total += l.t.length + 1;
      if (!importante) texto += l.t.length;
    }
    if (omitidas) salida.push('(' + omitidas + ' párrafos omitidos; usa leer_texto si necesitas el texto completo)');
    return { url: location.href, titulo: document.title, texto: salida.join('\n'), valores: valores, captcha: hayCaptcha, contrasenas: contrasenas };
  }
  function elemento(id) {
    var el = refs.get(id);
    return el && el.isConnected ? el : null;
  }
  function desplazamientoMarco(el) {
    var x = 0, y = 0, w = el.ownerDocument.defaultView;
    while (w && w !== window && w.frameElement) {
      var r = w.frameElement.getBoundingClientRect();
      x += r.left; y += r.top; w = w.parent;
    }
    return { x: x, y: y };
  }
  function punto(id) {
    var el = elemento(id);
    if (!el) return null;
    var objetivo = el;
    var r = el.getBoundingClientRect();
    if ((r.width < 2 || r.height < 2) && el.labels && el.labels.length) objetivo = el.labels[0];
    objetivo.scrollIntoView({ block: 'center', inline: 'center' });
    r = objetivo.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return { x: 0, y: 0, tapado: false, invisible: true };
    var o = desplazamientoMarco(objetivo);
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    var arriba = objetivo.ownerDocument.elementFromPoint(x, y);
    var tapado = !!arriba && arriba !== objetivo && !objetivo.contains(arriba) && !arriba.contains(objetivo) && !(arriba.tagName === 'LABEL' && arriba.control === el);
    return { x: x + o.x, y: y + o.y, tapado: tapado, invisible: false };
  }
  function paginaDeConfirmacion() {
    var t = document.title + ' ' + Array.prototype.map.call(document.querySelectorAll('h1, h2, h3, legend'), textoDe).join(' ');
    return /confirm|resumen|revis[ae] (los|sus|tus) datos|compruebe|verifique/i.test(t);
  }
  function infoDe(el) {
    var r = rol(el);
    return {
      tag: el.tagName.toLowerCase(), rol: r, nombre: nombre(el),
      href: r === 'link' && el.href ? String(el.href) : '',
      contrasena: el.tagName === 'INPUT' && el.type === 'password',
      desactivado: !!el.disabled, marcado: r === 'checkbox' || r === 'radio' ? !!el.checked : null,
      valor: el.tagName === 'SELECT' ? (el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : '') : el.isContentEditable ? textoDe(el) : String(el.value || ''),
      paginaConfirmacion: paginaDeConfirmacion()
    };
  }
  function info(id) {
    var el = elemento(id);
    return el ? infoDe(el) : null;
  }
  /** Lo que activaría Intro o Espacio: el botón con el foco o el botón de envío de su formulario. */
  function destinoDeTecla() {
    // El foco de verdad puede estar dentro de un marco o de un shadow DOM: se baja hasta él.
    var el = document.activeElement, doc;
    while (el) {
      if (el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
      else if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') {
        try { doc = el.contentDocument; } catch (e) { doc = null; }
        if (!doc || !doc.activeElement) return incierto(el);
        el = doc.activeElement;
      } else break;
    }
    if (!el || el === el.ownerDocument.body) return null;
    var r = rol(el);
    // Un elemento que no puede tener el foco solo lo tiene si lo de dentro es un shadow DOM cerrado.
    if (!r && el.tabIndex < 0 && !el.hasAttribute('tabindex')) return incierto(el);
    if (r !== 'textbox' && r !== 'select' && r !== 'checkbox' && r !== 'radio') return infoDe(el);
    var form = el.form || (el.closest && el.closest('form'));
    var envio = form && form.querySelector('button:not([type=button]):not([type=reset]), input[type=submit], input[type=image]');
    return envio ? infoDe(envio) : null;
  }
  /** Lo que tiene el foco no se ve (un marco de otra web, un shadow DOM cerrado): pide el código. */
  function incierto(el) {
    var i = infoDe(el);
    i.nombre = i.nombre || 'lo que tiene el foco';
    i.incierto = true;
    return i;
  }
  function enfocar(id) {
    var el = elemento(id);
    if (!el) return false;
    el.focus();
    if (typeof el.select === 'function' && el.tagName !== 'SELECT') el.select();
    return true;
  }
  function sinTildes(s) { return limpio(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function elegir(id, opcion) {
    var el = elemento(id);
    if (!el || el.tagName !== 'SELECT') return { ok: false, error: 'No es un desplegable.' };
    var ops = Array.prototype.slice.call(el.options);
    var q = sinTildes(opcion);
    var o = ops.find(function (x) { return limpio(x.text) === limpio(opcion) || x.value === opcion; })
      || ops.find(function (x) { return sinTildes(x.text) === q; })
      || ops.find(function (x) { return sinTildes(x.text).indexOf(q) === 0; })
      || ops.find(function (x) { return q.length > 2 && sinTildes(x.text).indexOf(q) >= 0; });
    if (!o) return { ok: false, error: 'No hay ninguna opción "' + opcion + '".' };
    el.focus();
    var setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (setter && setter.set) setter.set.call(el, o.value); else el.value = o.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, elegida: limpio(o.text) };
  }
  /** El texto que ve una persona, con un salto de línea entre bloques (como innerText, sin lo oculto). */
  function textoVisible(nodo, partes) {
    if (nodo.nodeType === 3) { partes.push(nodo.nodeValue); return; }
    if (nodo.nodeType !== 1 || OMITIR[nodo.tagName]) return;
    var s = estilo(nodo);
    if (!visible(nodo, s) || oculto(nodo, s)) return;
    var d = s ? s.display : 'block';
    var bloque = d !== 'inline' && d !== 'inline-block' && d !== 'contents';
    if (bloque || nodo.tagName === 'BR') partes.push('\n');
    for (var c = nodo.firstChild; c; c = c.nextSibling) textoVisible(c, partes);
    if (nodo.shadowRoot) for (var c2 = nodo.shadowRoot.firstChild; c2; c2 = c2.nextSibling) textoVisible(c2, partes);
    if (bloque) partes.push('\n');
  }
  function leerTexto(desde, max) {
    var partes = [];
    if (document.body) textoVisible(document.body, partes);
    var t = limpio(partes.join('').trim().replace(/\n+/g, ' ¶ ')).replace(/ ¶ /g, '\n');
    return { texto: t.slice(desde, desde + max), total: t.length, titulo: document.title };
  }
  Object.defineProperty(window, '__rd', { value: { instantanea: instantanea, punto: punto, info: info, destinoDeTecla: destinoDeTecla, enfocar: enfocar, elegir: elegir, leerTexto: leerTexto } });
})();`;

/** Expresión que instala el script (si hace falta) y llama a una de sus funciones. */
export const llamar = (funcion: string, ...args: unknown[]) =>
  `${SCRIPT}\nwindow.__rd.${funcion}(${args.map((a) => JSON.stringify(a)).join(', ')})`;

export const instantanea = (n: Navegador, max = 14000) =>
  n.evaluar<Instantanea>(llamar('instantanea', max));
export const infoElemento = (n: Navegador, ref: number) =>
  n.evaluar<InfoElemento | null>(llamar('info', ref));
export const puntoElemento = (n: Navegador, ref: number) =>
  n.evaluar<{ x: number; y: number; tapado: boolean; invisible: boolean } | null>(
    llamar('punto', ref),
  );
export const enfocarElemento = (n: Navegador, ref: number) =>
  n.evaluar<boolean>(llamar('enfocar', ref));
export const elegirOpcion = (n: Navegador, ref: number, opcion: string) =>
  n.evaluar<{ ok: boolean; elegida?: string; error?: string }>(llamar('elegir', ref, opcion));
export const leerTextoPagina = (n: Navegador, desde: number, max: number) =>
  n.evaluar<{ texto: string; total: number; titulo: string }>(llamar('leerTexto', desde, max));

export const destinoDeTecla = (n: Navegador) =>
  n.evaluar<InfoElemento | null>(llamar('destinoDeTecla'));

/** Verbos que comprometen siempre: enviar, presentar, firmar, pagar, reservar, anular una cita… */
const FUERTES =
  /\b(confirm(ar|o|e)|enviar|env[ií]o|presentar|firmar|pagar|abonar|registrar|reservar|finalizar|grabar|tramitar|anular|dar(se)?\s+de\s+baja|(cancelar|eliminar|borrar)\s+(la\s+|mi\s+|su\s+|tu\s+)?(cita|solicitud|reserva|inscripci[oó]n|tr[aá]mite|expediente))\b/i;
/** Verbos que solo comprometen en la pantalla final («Aceptar» en el resumen de la cita). */
const DEBILES = /\b(aceptar|solicitar|continuar|siguiente|guardar|validar)\b/i;
/** Etiquetas que, solas, nunca envían nada. */
const INOFENSIVO =
  /^\s*(volver|atr[aá]s|cancelar|cerrar|buscar|filtrar|ver|mostrar|imprimir|descargar|ayuda|limpiar|modificar|corregir)\s*$/i;
const CLICABLES = new Set(['button', 'link', 'menuitem', 'tab', 'option']);

export const pareceIrreversible = (
  i: Pick<InfoElemento, 'nombre' | 'rol' | 'paginaConfirmacion' | 'incierto'>,
) =>
  i.incierto ||
  (CLICABLES.has(i.rol) &&
    !INOFENSIVO.test(i.nombre) &&
    (FUERTES.test(i.nombre) || (i.paginaConfirmacion && DEBILES.test(i.nombre))));

# Seguridad y privacidad

La extensión modifica la interfaz dentro de la página. No termina TLS, no actúa como proxy y no reproduce las solicitudes del portal. El navegador y el portal siguen gestionando las conexiones HTTPS, la sesión y los envíos originales.

Esto no hace inocua cualquier modificación del DOM. Una extensión tiene acceso a los valores que conecta. Un error en una interfaz puede cambiar qué se envía, impedir una validación o mostrar información equivocada. No afirmamos una equivalencia de seguridad auditada con el portal original.

## Medidas implementadas

- Scripts empaquetados en Manifest V3, en el mundo aislado de Chrome.
- Coincidencia de dominios HTTPS exactos y prefijos de ruta por portal.
- Un único permiso de API, `storage`, utilizado para preferencias de activación. Los datos de los formularios no se guardan.
- Sin servidor propio, código remoto, analítica, lectura de cookies ni APIs de peticiones en el código de la extensión.
- Los controles originales conservan sus formularios, campos ocultos y listeners. Las acciones se delegan al elemento original.
- Los controles de seguridad se conservan originales. No se falsifica `isTrusted`.
- Restauración manual, ante cambios de identidad o desaparición de controles, navegación y validación nativa.
- Mensajes del popup aceptados solo desde la URL empaquetada del popup. No existe un puente de órdenes mediante `window.postMessage`.
- Un content script por portal, inyectado solo en sus rutas exactas. Una ruta no puede cubrir un dominio entero.
- Las acciones sobre elementos no nativos (`custom` en `DomBridge`) se declaran una a una tras revisarlas.
- Las herramientas de la web real (`site:live`, `site:record`) recorren una vez páginas públicas, sin datos personales, y no eluden comprobaciones anti‑bot. Los fixtures se guardan sin scripts, contenido incrustado (`iframe`, `frame`, `object`, `embed`), comentarios HTML, tokens anti‑CSRF o de sesión (en campos ocultos, `<meta>`, atributos y `<template>`), texto rellenado en campos editables ni parámetros de sesión en las URL (`jsessionid`, `token`, `state`, `nonce`, `code`, `p_auth`, `csrf`, `sid`, `ticket`, `SAMLRequest`, `RelayState`, `access_token`…); conservan los manejadores en línea (`onclick`, `javascript:`) porque los adaptadores los leen. Las grabaciones quedan en `.cache/`, fuera de git.

El Shadow DOM aísla estilos; no es una barrera de seguridad frente a la página. El aislamiento de JavaScript tampoco oculta el DOM a los scripts del portal.

## Qué se comprueba

Las pruebas automatizadas usan datos ficticios. El lint prohíbe en el código que se empaqueta en la extensión las APIs de red, persistencia y código dinámico (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `Image`, `sendBeacon`, `document.cookie`, Web Storage, IndexedDB, Cache Storage, `RTCPeerConnection`, `eval`, `Function`, `window.open`) y el acceso a `globalThis` y `self`. El chequeo del bundle busca esos nombres en los archivos generados, dependencias incluidas, y revisa el manifest. Son controles estáticos limitados, no una auditoría de seguridad: no detectan cualquier acceso indirecto, como una propiedad calculada de `window`. La CSP `connect-src 'none'` del manifest solo cubre el popup; los content scripts funcionan bajo la CSP del portal.

La compatibilidad con validaciones personalizadas, restricciones del navegador, certificados, firmas, iframes y estados autenticados requiere pruebas del portal concreto. Los cambios programáticos no tienen idéntico comportamiento a la escritura física para todas las restricciones nativas o frameworks. Mantén el control original cuando no puedas demostrar equivalencia.

No incluyas sesiones, documentos personales, tokens reales o datos identificativos en issues, fixtures, logs ni capturas. Para un fallo de seguridad, utiliza el canal privado de reporte del repositorio cuando esté habilitado; evita publicar detalles que expongan datos de usuarios.

La app de escritorio (`apps/desktop`) tiene su propio protocolo: qué datos guarda, qué llega al proveedor de IA, las capas que lo impiden, lo que queda fuera y qué comprobar antes de cambiarlo. Consulta [apps/desktop/security-protocol.md](apps/desktop/security-protocol.md).

Referencias técnicas consultadas:

- [Content scripts y aislamiento de Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Permisos de extensiones](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Restricciones de código remoto](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)
- [Eventos e isTrusted](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted)

# Publicar una versión de la app de escritorio

Una versión se publica con una etiqueta `escritorio-v<versión>`. [`desktop-release.yml`](../../.github/workflows/desktop-release.yml) empaqueta los tres sistemas y crea la release en GitHub. Las apps instaladas no la reciben hasta que la web anuncia esa versión.

## Cómo se actualizan las apps

1. Al abrirse, la app empaquetada pide a `https://reforma-digital.es/api/escritorio/actualizaciones/` el archivo de su sistema: `latest-mac.yml`, `latest.yml` (Windows) o `latest-linux.yml`.
2. La ruta ([`route.ts`](../web/app/api/escritorio/actualizaciones/[nombre]/route.ts)) redirige a la release de la `version` de [`descargas.ts`](<../web/app/(search)/escritorio/descargas.ts>), la misma que ofrece `/escritorio`. Los instaladores y los `.blockmap` van a la release de la versión que llevan en el nombre.
3. Si esa versión es más nueva, la app la descarga en segundo plano y avisa con «Actualización lista».
4. Se instala al cerrar la app. En macOS, Squirrel.Mac solo la acepta si la firma el mismo Developer ID que la versión instalada.

Las peticiones `GET` de `/api/escritorio/actualizaciones/` pasan la Bot Protection de Vercel gracias a la regla «Permitir API del escritorio» del firewall del proyecto. Si las apps no se actualizan y esa ruta responde `429` con `x-vercel-mitigated: challenge`, revisa esa regla.

## Pasos

### 1. Preparar la versión

En una PR:

- Sube `version` en [`apps/desktop/package.json`](package.json), por ejemplo a `0.2.0`.
- Reescribe [`.github/desktop-release-notes.md`](../../.github/desktop-release-notes.md): es el texto de la release.

Fusiónala en `main`.

### 2. Crear la etiqueta

Desde el commit de `main` que se publica:

```sh
git fetch origin && git tag escritorio-v0.2.0 origin/main && git push origin escritorio-v0.2.0
```

La etiqueta tiene que coincidir con `version` de `package.json`. En el workflow, macOS 26 empaqueta, firma con el Developer ID del equipo `4P7D7N2DZN` y notariza, mientras Windows y Ubuntu empaquetan sus instaladores. Al final, un último job crea la release. No hay que firmar nada a mano: el workflow usa el certificado y la clave de notarización de los secretos del repositorio, así que puede publicar cualquiera con permiso para subir etiquetas. Se sigue con `gh run watch`.

### 3. Comprobar la release

```sh
gh release view escritorio-v0.2.0 --json assets -q '.assets[].name'
```

Tiene que haber, con la versión en el nombre:

- `reforma-digital-0.2.0-arm64.dmg` y `-x64.dmg`
- `reforma-digital-0.2.0-arm64.zip` y `-x64.zip`
- `reforma-digital-0.2.0-setup.exe`
- `reforma-digital_0.2.0_amd64.deb` y `reforma-digital-0.2.0-x86_64.AppImage`
- sus `.blockmap`
- `latest-mac.yml`, `latest.yml` y `latest-linux.yml`

En un Mac, abre el `.dmg` y comprueba que Gatekeeper acepta la app:

```sh
spctl -a -vvv -t exec "/Volumes/Reforma Digital 0.2.0-arm64/Reforma Digital.app"
# accepted · source=Notarized Developer ID
```

### 4. Anunciar la versión

Cuando la release está completa, sube `version` en [`descargas.ts`](<../web/app/(search)/escritorio/descargas.ts>) en otra PR y fusiónala. Al desplegarse la web, `/escritorio` enlaza los instaladores nuevos y las apps instaladas se actualizan la próxima vez que se abren. Para comprobarlo:

```sh
curl -s -o /dev/null -A electron-builder -w '%{http_code} %{redirect_url}\n' https://reforma-digital.es/api/escritorio/actualizaciones/latest-mac.yml
# 302 https://github.com/samuelcorsan/reforma-digital/releases/download/escritorio-v0.2.0/latest-mac.yml
```

Usa `GET`, como la app: el firewall solo deja pasar `GET` en esta ruta y un `curl -I` (`HEAD`) da `429`.

No lo hagas antes de que exista la release: hasta entonces, las descargas y las actualizaciones darían 404.

## Si algo falla

- **El workflow falla al firmar.** Con `forceCodeSigning`, la release no sale sin firma. Revisa los secretos `CSC_LINK` (el `.p12` en base64) y `CSC_KEY_PASSWORD`.
- **Falla la notarización.** Revisa `APPLE_API_KEY_P8`, `APPLE_API_KEY_ID` y `APPLE_API_ISSUER`. El log de `notarytool` dice el motivo.
- **Hay que repetir la release.** Borra la release y la etiqueta (`gh release delete escritorio-v0.2.0 --cleanup-tag`), corrige el problema y vuelve a crear la etiqueta.
- **Una versión publicada tiene un error.** Bajar `version` en `descargas.ts` no baja la versión de las apps que ya se han actualizado: publica una versión nueva con la corrección.

## Firma de macOS

La release se firma con «Developer ID Application: Leonardo Ollero lOPEZ (4P7D7N2DZN)», el nombre que muestra Gatekeeper. El certificado caduca el 21 de noviembre de 2027. Antes de esa fecha:

1. El Account Holder del equipo crea otro certificado Developer ID Application.
2. Exporta el certificado como `.p12`, con su clave privada, y actualiza los secretos `CSC_LINK` y `CSC_KEY_PASSWORD`.

Si cambia el equipo, cambia también `-c.mac.identity` en el workflow. Las apps firmadas por otro equipo no aceptarán la actualización: habrá que instalarla a mano una vez.

La clave de notarización (App Store Connect API, rol Developer) no caduca, pero se puede revocar. Si se revoca, crea otra y actualiza los tres secretos `APPLE_API_*`.

## Límites

- Las apps 0.1.0 no tienen actualizador: hay que instalar a mano la primera versión que lo lleva.
- Las actualizaciones en Windows y Linux no se han probado. En Linux solo se actualiza sola el `.AppImage`.
- Windows sigue sin firmar: SmartScreen avisa al instalar, pero las actualizaciones funcionan.

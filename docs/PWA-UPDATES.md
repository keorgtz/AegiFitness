# Actualizaciones de la PWA

Cada compilación del frontend genera un identificador propio en `version.json` y en el service worker. No es necesario cambiar manualmente la versión de `package.json`.

## Comportamiento

- Comprueba actualizaciones al iniciar, al volver a primer plano, al recuperar conexión y cada cinco minutos mientras está visible.
- El service worker se consulta sin reutilizar su caché HTTP. La interfaz espera a que la nueva versión esté activa antes de recargar.
- Al iniciar, sin interacción del usuario, la actualización se aplica automáticamente.
- Si ya se empezó a interactuar o está abierto el modo entrenamiento, aparece un aviso con el botón **Actualizar**. Se deben guardar los formularios antes de pulsarlo.
- La activación se comunica también a las demás pestañas abiertas. Cada una protege su interacción antes de recargar.
- No se borran tokens, preferencias, IndexedDB ni borradores de entrenamiento. Workbox administra los recursos precacheados obsoletos.
- Sin conexión continúa disponible la versión instalada y se vuelve a comprobar al recuperar conexión.
- Las recargas tienen una protección temporal contra bucles si un intermediario devuelve una versión antigua.

## Despliegue con Docker y Cloudflare

Reconstruir y desplegar el contenedor web es necesario para publicar un frontend nuevo; reiniciar una imagen antigua no genera una versión nueva. Se debe incluir el `nginx.conf` actualizado.

Nginx impide cachear `index.html`, `sw.js`, `sw-version.js` y `version.json`. Los archivos con hash de `/assets/` mantienen caché larga. El HTML del service worker sigue disponible offline; esto es independiente de la caché HTTP.

Si existe una regla explícita en Cloudflare que fuerza caché sobre todo el sitio, excluir HTML y los endpoints anteriores, y purgar una vez las respuestas antiguas de esos endpoints. Este cambio de código no modifica la configuración de la cuenta Cloudflare.

Una instalación que todavía ejecuta el JavaScript antiguo incorporará este mecanismo cuando su service worker detecte este primer despliegue. Puede requerir cerrar y volver a abrir la PWA con conexión; no es necesario borrar los datos del dispositivo. Las siguientes versiones usan el flujo nuevo.

## Comprobación en el servidor

1. Publicar una compilación y abrirla en navegador y PWA instalada.
2. Publicar otra compilación con un cambio visible. Reabrir la app: debe actualizarse automáticamente.
3. Mantener una pestaña editando y otra en modo entrenamiento durante un despliegue: deben ofrecer **Actualizar** sin interrumpir la edición.
4. Guardar y actualizar: verificar sesión iniciada y recuperación de los borradores.
5. Abrir sin conexión y después reconectar: debe conservar el uso offline y recuperar la comprobación.
6. Revisar que `/version.json` devuelve JSON nuevo y que HTML y scripts del worker llevan `Cache-Control: no-store` o equivalente.

La implementación se revisó estáticamente; no se ejecutaron compilaciones ni pruebas locales, por indicación del usuario.

Referencia: [ciclo de actualizaciones periódicas de Vite PWA](https://vite-pwa-org.netlify.app/guide/periodic-sw-updates).

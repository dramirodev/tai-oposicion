# Despliegue automático (GitHub → Firebase)

Actualizado el 23 de octubre de 2026. El repositorio ya tiene un flujo en
[.github/workflows/deploy.yml](.github/workflows/deploy.yml); no hace falta inicializar Git ni crear otro flujo.

## Comportamiento actual

Cada push a `main`, o ejecución manual del flujo desde Actions:

1. Prepara Node.js 24 e instala con `npm ci`.
2. Ejecuta `npm test` (incluye validación de las tarjetas).
3. Compila con `npm run build` y valida de nuevo las tarjetas.
4. Publica Firebase Hosting en el proyecto `tai-oposicion`.
5. Intenta publicar las reglas de Firestore.

Si fallan las pruebas, la compilación o la validación, no se publica el hosting. **El fallo de publicación
de reglas se convierte en un aviso y no hace fallar el flujo**: comprobar ese paso por separado.
La configuración del flujo no acredita que la última ejecución haya terminado correctamente.

Sitio: [tai-oposicion.web.app](https://tai-oposicion.web.app).
Para instalar y usar el acceso con Google, el README indica utilizar
[tai-oposicion.firebaseapp.com](https://tai-oposicion.firebaseapp.com).

## Configuración necesaria en GitHub y Firebase

- Secreto del repositorio: `FIREBASE_SERVICE_ACCOUNT_TAI_OPOSICION`, con el JSON de la cuenta de servicio.
- Permisos de la cuenta para desplegar Hosting; para publicar reglas, rol **Firebase Rules Admin**.
- Authentication con Google habilitado, Firestore creado y configuración web en `public/firebase-config.json`.
- Las reglas actuales restringen el acceso a la cuenta autorizada en `firestore.rules`; adaptarlas si cambia el usuario.

Si hay que reconstruir la integración, se puede usar `firebase init hosting:github` para configurar la cuenta
y el secreto. Revisar los archivos generados y conservar el flujo existente sin añadir despliegues duplicados.

## Uso diario

Desde la carpeta del proyecto:

```sh
cd /Volumes/SSD/develop/PWA_TAI
npm ci
npm test
npm run build
```

Revisar los cambios, crear el commit y hacer push a `main` cuando se quiera publicar (también puede hacerse
con GitHub Desktop). Después comprobar Actions, incluido el paso de reglas, y probar la app publicada.
El tiempo del despliegue depende de la ejecución del flujo.

## Despliegue manual

Con la CLI de Firebase instalada y una sesión con permisos:

```sh
npm ci
npm test
npm run build
firebase deploy --only firestore:rules,hosting --project tai-oposicion
```

La compilación es necesaria: `public/app.js`, `public/chunks/` y `public/version.json` no se versionan.
La versión procede de `package.json`; la compilación añade el commit. Si se modifica el service worker,
incrementar también `tai-vN` en `public/sw.js`. Los cambios solo de documentación no lo requieren.

## Verificación tras publicar

- Confirmar versión en Ajustes y comportamiento de «Actualizar ahora».
- Probar login con la cuenta autorizada y sincronización, incluidas tarjetas.
- Descargar el banco en Ajustes y comprobar preguntas y tarjetas sin conexión.
- Si se cambiaron reglas, comprobar que se publicaron; un hosting actualizado no garantiza reglas actualizadas.

El progreso vive en el navegador y en Firestore, no en Git. `public/firebase-config.json` contiene
configuración del cliente web; la autorización depende de Authentication y de las reglas de Firestore.

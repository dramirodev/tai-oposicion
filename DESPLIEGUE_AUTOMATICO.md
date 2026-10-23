# Despliegue automático (GitHub → Firebase)

Cada vez que se sube un cambio a la rama `main`, GitHub ejecuta los tests, compila la app y la publica en
https://tai-oposicion.web.app. Si un test falla, no se publica nada.

## Configuración (una sola vez, en la Terminal del Mac)

1. Entra en la carpeta, coloca el flujo de trabajo (el sistema no me deja escribir en `.github`, así que lo muevo tú) e inicia el repositorio:

   cd "/Volumes/SSD/Google Drive/TEMARIO_OPOSICION/PWA_TAI"
   mkdir -p .github/workflows && mv DEPLOY_WORKFLOW.yml .github/workflows/deploy.yml
   git init -b main
   git add .
   git commit -m "Preparación TAI"

2. Crea el repositorio PRIVADO en GitHub y sube el código (necesitas la herramienta `gh`: `brew install gh`, y `gh auth login`):

   gh repo create tai-oposicion --private --source=. --push

3. Crea la cuenta de servicio y el secreto. Lo hace Firebase por ti:

   firebase login
   firebase init hosting:github

   Responde: repositorio `TU_USUARIO/tai-oposicion` · ¿ejecutar un script de compilación? **No** ·
   ¿desplegar al fusionar? **No** (ya lo hace nuestro flujo) · si te pregunta por sobrescribir ficheros, **no**.
   Al terminar crea el secreto `FIREBASE_SERVICE_ACCOUNT_TAI_OPOSICION` en tu repositorio.
   Si te deja ficheros `.github/workflows/firebase-hosting-*.yml`, bórralos (ya tenemos `deploy.yml`).

4. (Opcional pero recomendable) Para que también se desplieguen las reglas de Firestore, en
   Google Cloud → IAM, busca la cuenta de servicio `github-action-…@tai-oposicion.iam.gserviceaccount.com`
   y añádele el rol **Firebase Rules Admin**. Sin ese rol, solo se despliega el hosting.

5. Sube los cambios y comprueba la pestaña **Actions** del repositorio:

   git add -A && git commit -m "Despliegue automático" && git push

## Uso diario

Claude copia los cambios a la carpeta. Cuando quieras publicarlos:

   git add -A && git commit -m "Descripción" && git push

(o en GitHub Desktop: «Commit» y «Push»). En ~2 minutos está en la web.
Para volver a una versión anterior: `git revert HEAD && git push`.

## Notas
- El repositorio debe ser privado. `public/firebase-config.json` es configuración web pública de Firebase, pero no hace falta exponerla.
- El progreso de estudio vive en tu navegador y en Firestore, no en el repositorio.

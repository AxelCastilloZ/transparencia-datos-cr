# Verificación del Pipeline de Deployment

**Proyecto:** Transparencia Datos CR  
**Ítem:** 6.1 — Deployment  
**Responsable:** Compañero 4

## 1. Objetivo

Verificar la configuración del pipeline de deployment, la construcción de imágenes Docker y el mecanismo de publicación en GitHub Container Registry (GHCR), mediante GitHub Actions.

## 2. Configuración del pipeline

El proyecto dispone del archivo `.github/workflows/deploy.yml`, denominado `Deploy to Staging`.

El workflow está configurado para activarse mediante eventos `push` sobre la rama `main` y utiliza permisos `contents: read` y `packages: write`.

**Evidencia 01 — Configuración general**

![Configuración del workflow](evidencias/deployment/01-configuracion-workflow.png)

## 3. Construcción y publicación de imágenes

El pipeline utiliza Docker Buildx y `docker/build-push-action@v6` para construir las imágenes del backend y frontend.

La publicación se encuentra configurada mediante `push: true`, utilizando etiquetas basadas en el identificador del commit y `latest`.

**Evidencia 02 — Configuración de publicación**

![Publicación en GHCR](evidencias/deployment/02-configuracion-ghcr.png)

## 4. Verificación de construcción

En la ejecución #16 de `CI & DevSecOps Pipeline` se verificó que las imágenes Docker del backend y frontend se construyeron correctamente.

Este resultado confirma el funcionamiento de las construcciones en CI, pero no una publicación efectiva en GHCR.

**Evidencia 03 — Construcciones exitosas**

![Construcción de imágenes](evidencias/deployment/03-build-imagenes.png)

## 5. Verificación de GHCR

**Estado:** Pendiente de confirmar una publicación exitosa.

La configuración del pipeline permite publicar imágenes en GHCR. Sin embargo, el workflow de deployment todavía no cuenta con una ejecución verificada desde la rama principal.

**Evidencia 04 — Consulta de Packages**

![Consulta de Packages](evidencias/deployment/04-ghcr-packages.png)

Completar esta sección con el resultado de la consulta y, si corresponde, los nombres, etiquetas y fechas de las imágenes publicadas.

## 6. Despliegue al entorno staging

El job `deploy-staging` depende de `build-and-push` y utiliza el entorno `staging`.

Actualmente incluye un paso de notificación que muestra las referencias de las imágenes e instrucciones de ejecución manual.

No se identificó una instrucción que despliegue automáticamente las imágenes en un servidor.

**Evidencia 05 — Configuración de staging**

![Configuración de staging](evidencias/deployment/05-deploy-staging.png)

## 7. Observaciones técnicas

- El workflow de deployment todavía no se encuentra integrado en `main`.
- Debe verificarse que los nombres de las imágenes cumplan el formato en minúsculas requerido por Docker.
- La publicación real en GHCR permanece pendiente de validación.
- El job de staging actualmente genera una notificación, pero no realiza un despliegue automático.
- Las vulnerabilidades identificadas por Trivy en el backend requieren seguimiento antes de una publicación.

## 8. Conclusión

Se verificó la existencia y configuración del pipeline de deployment del proyecto Transparencia Datos CR.

Las construcciones Docker del backend y frontend fueron comprobadas mediante GitHub Actions.

El mecanismo de autenticación y publicación en GHCR está configurado, pero requiere una ejecución exitosa para confirmar su funcionamiento.

Se documentaron las evidencias disponibles, las limitaciones identificadas y las verificaciones pendientes para completar el proceso de deployment.
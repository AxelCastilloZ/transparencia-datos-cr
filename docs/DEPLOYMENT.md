# Verificación del pipeline de deployment

Ítem 6.1 · Transparencia Datos CR · Compañero 4

## Activación y publicación

El [workflow Deploy to Staging](../.github/workflows/deploy.yml) está integrado en `development`. Se activa con un push a `main`. El job `build-and-push` también comprueba que la referencia sea `refs/heads/main`.

1. GitHub Actions obtiene el código con permiso `contents: read`.
2. `docker/login-action@v3` autentica en `ghcr.io` con `github.actor` y `secrets.GITHUB_TOKEN`. El workflow solicita `packages: write`.
3. `docker/setup-buildx-action@v3` inicializa Buildx. `docker/build-push-action@v6` usa el contexto raíz y los Dockerfiles de backend y frontend con caché de GitHub Actions.
4. `push: true` configura la publicación de cada imagen con dos etiquetas, `latest` y el SHA completo del commit. Usar la etiqueta SHA y registrar el digest para identificar qué artefacto se valida.

Ambas referencias en el YAML están en minúsculas:

- `ghcr.io/axelcastilloz/transparencia-datos-cr/backend`
- `ghcr.io/axelcastilloz/transparencia-datos-cr/frontend`

## Estado de la publicación y staging

La [ejecución #38 de CI](https://github.com/AxelCastilloZ/transparencia-datos-cr/actions/runs/42916226001/job/130179585817#step:4:1) confirma que ambos Dockerfiles construyen las imágenes en CI. Esos pasos usan `push: false`. El workflow de deployment aún no estaba presente en la referencia remota `main` consultada. La publicación efectiva sigue pendiente de verificar con una ejecución de `Deploy to Staging` desde `main` y la comprobación de las dos etiquetas y sus digests en [Packages](https://github.com/AxelCastilloZ/transparencia-datos-cr/packages).

`deploy-staging` depende de `build-and-push` mediante `needs` y usa el entorno `staging`. Su único paso emite una notificación con las referencias y un ejemplo de Docker Compose. No hay conexión ni aplicación automática de cambios a un servidor de staging. Para un despliegue manual, el operador debe confirmar que su archivo Compose usa las imágenes de GHCR y las etiquetas previstas, y que tiene acceso a los paquetes. El equipo debe revisar los hallazgos del [escaneo de imágenes](CONTAINER_SCANNING.md) antes de autorizar una publicación.

## Evidencias

| Evidencia | Fuente |
| --- | --- |
| Activación, permisos y referencias | [Configuración](https://github.com/AxelCastilloZ/transparencia-datos-cr/blob/development/.github/workflows/deploy.yml#L1-L16) |
| Autenticación y publicación configurada | [Job build-and-push](https://github.com/AxelCastilloZ/transparencia-datos-cr/blob/development/.github/workflows/deploy.yml#L17-L57) |
| Builds backend y frontend | [Backend](https://github.com/AxelCastilloZ/transparencia-datos-cr/actions/runs/42916226001/job/130179585817#step:4:1) · [Frontend](https://github.com/AxelCastilloZ/transparencia-datos-cr/actions/runs/42916226001/job/130179585817#step:5:1) |
| Publicación de etiquetas y digests | Pendiente de verificar en Packages |
| Notificación de staging | [Job deploy-staging](https://github.com/AxelCastilloZ/transparencia-datos-cr/blob/development/.github/workflows/deploy.yml#L58-L73) |

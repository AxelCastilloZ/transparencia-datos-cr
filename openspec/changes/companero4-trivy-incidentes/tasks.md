# Tareas de entrega del Compañero 4

- [x] Inspeccionar los jobs de CI y deployment en `development`. Verificar contra `.github/workflows/ci.yml` y `.github/workflows/deploy.yml`.
- [x] Consultar los logs del job de contenedores #38 y registrar builds, totales y CVE por imagen. Verificar contra `docs/CONTAINER_SCANNING.md` y el enlace al job.
- [x] Documentar impacto, versiones corregidas, prioridad y estado. Verificar la tabla de remediación de `docs/CONTAINER_SCANNING.md`.
- [x] Registrar enlaces a la ejecución y los pasos. Verificar `docs/evidencias/container-scanning/README.md`.
- [x] Incorporar capturas PNG auténticas de los builds y escaneos. Verificar los archivos en el directorio de evidencias y en Word.
- [x] Documentar autenticación, etiquetas, nombres de imágenes y alcance de staging. Verificar `docs/DEPLOYMENT.md`.
- [ ] Verificar publicación efectiva desde `main` con una ejecución y etiquetas y digests de GHCR.
- [x] Crear el playbook y la plantilla de registro. Verificar `docs/INCIDENT_RESPONSE.md`.
- [x] Completar validaciones locales. Instalación congelada, dos linters, 69 pruebas de backend, 13 de frontend y compilación con salida 0.
- [x] Validar la change con OpenSpec 1.16.1 en modo estricto.
- [ ] Abrir el PR a `development` y verificar los jobs de CI de su ejecución.

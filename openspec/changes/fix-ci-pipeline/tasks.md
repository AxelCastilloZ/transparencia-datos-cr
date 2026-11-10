# Tareas — Reparar el pipeline de CI/CD

## Corrección de acciones (ítems 3.2 / 3.3 / 3.5)

- [x] OSV-Scanner anclado a `v2.7.0` por SHA.
      Verificable: job "Análisis SCA (Dependencias)" en verde.
- [x] Trivy anclado a `v0.36.0` por SHA en ambos escaneos (backend y frontend).
      Verificable: job "Build & Scan Contenedores" en verde.

## SBOM (ítem 5.1)

- [x] SBOM generado con `anchore/sbom-action` (CycloneDX) y subido como artefacto.
      Verificable: artefacto `sbom.cyclonedx.json` en el run de Actions.

## Build de la imagen frontend (ítem 3.3)

- [x] Copiar `radar.types.ts` al build stage del `frontend/Dockerfile`.
      Verificable: build de la imagen del frontend exitoso en CI.

## Verificación (ítem 3.6)

- [x] PR #8 con 4/5 jobs en verde (E2E pendiente de mocks del PR de Compañero 2).
      Verificable: run de GitHub Actions del PR #8.

## Pendiente (seguimiento)

- [ ] Endurecer los gates a bloqueante (quitar `continue-on-error` / `exit-code 0`)
      una vez revisados los hallazgos (ítems 3.2 / 3.6).
- [ ] Evaluar un paquete de tipos compartido backend↔frontend (deuda técnica).

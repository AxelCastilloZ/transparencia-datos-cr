# Hallazgos de Seguridad (SAST, SCA, SBOM y Contenedores)

Este documento registra los resultados de los análisis de seguridad automatizados del proyecto, los problemas encontrados en el propio pipeline y las remediaciones propuestas.

- **Responsable:** Compañero 3
- **Ítems SSDLC:** 3.2 (SAST + SCA en CI), 5.1 (Dockerfiles + SBOM), ítem adicional (análisis de findings y remediaciones)
- **Fecha de los escaneos:** 2026-11-10
- **Rama:** `feature/companero3-devsecops`
- **Evidencia cruda:** `docs/evidencias/scans-2026-11-10/`

## 1. Resumen

| Herramienta | Tipo | Alcance | Resultado |
| :--- | :--- | :--- | :--- |
| Gitleaks | Secret scanning | Historial Git completo | Sin secretos detectados (job `security-sast` en verde) |
| Semgrep 1.184.0 (`p/ci`) | SAST | 123 archivos, 35 reglas | 28 hallazgos, todos de configuración; 0 en código TypeScript |
| OSV-Scanner 2.7.0 | SCA | `pnpm-lock.yaml` (578 paquetes) | 64 vulnerabilidades en 16 paquetes |
| `pnpm audit` | SCA (contraste) | `pnpm-lock.yaml` | 64 avisos (2 críticos, 26 altos, 27 moderados, 9 bajos); 14 en producción |
| `pnpm sbom` | SBOM CycloneDX 1.6 | Dependencias de producción | Backend: 185 componentes; Frontend: 45 componentes |
| `docker compose build` | Build de imágenes | `backend/Dockerfile`, `frontend/Dockerfile` | Ambas imágenes construyen (tras corregir el frontend) |

## 2. Problemas encontrados en el pipeline

Antes de analizar resultados hubo que lograr que las herramientas corrieran. El job `security-sca` nunca había ejecutado OSV-Scanner ni generado el SBOM.

### P1 — El paso de SBOM no funcionaba con pnpm

- **Síntoma:** `npx @cyclonedx/cyclonedx-npm --package-lock-only` fallaba con `ERROR | No evidence: no package lock file nor npm shrinkwrap file`.
- **Causa:** `cyclonedx-npm` solo lee `package-lock.json`; el proyecto usa pnpm y no tiene ese archivo.
- **Corrección (commit `fdb090f`):** se usa el comando nativo `pnpm sbom` (pnpm 11.2.2), sin dependencias nuevas:

  ```bash
  pnpm --filter ./backend sbom --sbom-format cyclonedx --sbom-spec-version 1.6 --sbom-type application --prod > sbom-backend.json
  pnpm --filter ./frontend sbom --sbom-format cyclonedx --sbom-spec-version 1.6 --sbom-type application --prod > sbom-frontend.json
  ```

### P2 — La acción de OSV-Scanner apuntaba a un tag inexistente

- **Síntoma:** el job `security-sca` fallaba en ~2 s, en "Set up job", sin ejecutar ningún paso (CI #20).
- **Causa:** `google/osv-scanner-action/osv-scanner-action@v1` — el repositorio no publica el tag flotante `v1` (solo `v1.x.y` y `v2.x.y`).
- **Corrección (commit `c5f35f9`):** se fija la acción al commit de `v2.7.0` (`b1d267aea5211fa648d9d442fa64b90dbdcbdd36`). Fijar por SHA evita además que un tag sea reapuntado (ver S1).

### P3 — La imagen del frontend no compilaba

- **Síntoma:** `docker compose build` fallaba con `TS2307: Cannot find module '../../backend/src/radar/radar.types'`.
- **Causa:** `frontend/src/api.ts` importa los tipos del radar desde el backend, pero `frontend/Dockerfile` solo copiaba `frontend/`.
- **Impacto:** el job `container-scan` no podía llegar al escaneo de Trivy.
- **Corrección (commit `107622d`):** se copia `backend/src/radar/radar.types.ts` en la etapa de build. Resultado: backend 553 MB, frontend 93.7 MB.

## 3. SAST — Semgrep

Configuración `p/ci`, la misma del job `security-sast`. No hubo hallazgos en el código de la aplicación (backend NestJS ni frontend React).

| ID | Regla | Severidad | Cantidad | Ubicación |
| :--- | :--- | :--- | :--- | :--- |
| S1 | `github-actions-mutable-action-tag` | WARNING | 25 | `ci.yml` (20), `deploy.yml` (5) |
| S2 | `pnpm-minimum-release-age` | MEDIUM | 1 | `pnpm-workspace.yaml` |
| S3 | `pnpm-trust-policy` | MEDIUM | 1 | `pnpm-workspace.yaml` |
| S4 | `pnpm-block-exotic-sub-dependencies` | MEDIUM | 1 | `pnpm-workspace.yaml` |

- **S1:** las acciones se referencian por tags (`@v4`, `@v3`…) que el dueño puede reapuntar. Es el vector de los ataques de cadena de suministro contra `trivy-action`, y en este proyecto ya causó fallos reales (P2 y el tag `trivy-action@0.28.0`, que dejó de existir).
- **S2–S4:** pnpm no está configurado para esperar antes de instalar versiones recién publicadas, impedir degradaciones de confianza ni bloquear sub-dependencias de orígenes no estándar.

**Observación:** el job `security-sast` del CI termina en verde aunque localmente hay 28 hallazgos con las mismas reglas. Usa `semgrep/semgrep-action@v1`, que está deprecada; conviene reemplazarla por la imagen oficial `semgrep/semgrep` con `semgrep ci` (ver R6).

**Errores de parseo (no bloqueantes):** Semgrep no pudo interpretar el `HEALTHCHECK` multilínea de ambos Dockerfiles ni la línea 68 de `deploy.yml`; el resto de esos archivos sí se analizó.

## 4. SCA — Dependencias

OSV-Scanner y `pnpm audit` coinciden: 64 vulnerabilidades en los mismos 16 paquetes. La mayoría proviene de herramientas de desarrollo que no llegan a las imágenes de producción.

### 4.1 Dependencias de producción (backend)

Se revisó el código para determinar si cada vulnerabilidad es alcanzable.

| Paquete | Versión | CVSS máx. | Vulnerabilidades | Llega por | ¿Explotable aquí? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `xlsx` | 0.18.5 | 7.8 | Prototype pollution (GHSA-4r6h-8v6p-xvw6), ReDoS (GHSA-5pgg-2g8v-p4x9) | Dependencia directa | **Sí.** `datos-abiertos.services.ts:76` descarga un Excel de datos.go.cr y lo procesa con `XLSX.read`: entrada externa |
| `proxy-addr` | 2.0.7 | 9.1 | IP spoofing con IPv4 mapeada en IPv6 (GHSA-jqcg-44mw-7w3h) | `@nestjs/platform-express` → Express | No: solo aplica con `trust proxy`, que `main.ts` no configura |
| `follow-redirects` | 1.16.0 | 8.2 | Fuga de cabeceras de credenciales en redirecciones (3 avisos) | `axios` | Bajo: axios solo consulta APIs públicas sin credenciales |
| `body-parser` | 2.3.0 | 7.5 | DoS con bytes extra tras cuerpo comprimido (GHSA-27r3-jxmh-p828) | Express | Posible: hay 4 endpoints `POST /sync` (judicial, sicop, tse, datos-abiertos) que procesan cuerpos de petición; una petición comprimida maliciosa podría causar denegación de servicio |
| `multer` | 2.2.0 | 7.5 | 6 avisos de DoS y bypass de límite de tamaño | `@nestjs/platform-express` | No: no hay endpoints de subida de archivos |
| `qs` | 6.16.0 | 6.3 | TypeError en `qs.stringify` (GHSA-6pq8-jhm2-2vcw) | Express | No: el proyecto no usa `stringify` con `arrayFormat: 'comma'` |

### 4.2 Dependencias de desarrollo

No se incluyen en las imágenes de producción (`--prod` / multi-stage), pero se ejecutan en máquinas de desarrollo y en el CI.

| Paquete | CVSS máx. | Vulnerabilidades | Llega por |
| :--- | :--- | :--- | :--- |
| `shell-quote` 1.9.0 | 9.2 | 1 | `concurrently` (raíz) |
| `source-map-js` 1.2.1 | 8.7 | 1 | `vite` / `vitest` |
| `undici` 6.20.1 y 8.10.2 | 7.5 | 29 | `@nestjs/cli`, `vitest` |
| `tmp` 0.0.33 | 7.7 | 2 | `@nestjs/cli` |
| `brace-expansion` 5.0.9 | 7.5 | 3 | `@nestjs/cli` |
| `vite` 8.2.2 | 7.5 | 6 | `vitest`, `vite-tsconfig-paths` |
| `minimatch` 10.2.6 | 6.9 | 1 | `@nestjs/cli` |
| `fast-uri` 3.1.7 | 6.1 | 5 | `@nestjs/cli` (ajv) |
| `@vitest/mocker` 4.1.11 | 5.9 | 2 | `vitest` |

## 5. SBOM

- **Formato:** CycloneDX 1.6 (JSON), generado con `pnpm sbom`.
- **Contenido:** solo dependencias de producción (`--prod`); componentes con `purl` (`pkg:npm/...`).
- **Tamaño:** backend 185 componentes, frontend 45 componentes.
- **En CI:** se genera en el job `security-sca` y se publica como artefacto `sbom` (retención 90 días).
- **Dependencias críticas del backend:** `@nestjs/*`, Express (vía `@nestjs/platform-express`), `typeorm`, `pg`, `axios`, `xlsx`. Del frontend: `react`, `react-dom`, `recharts`.

## 6. Remediaciones propuestas

Ordenadas por prioridad. Cada una debe validarse con `pnpm test`, `pnpm build` y un nuevo escaneo.

| ID | Prioridad | Acción | Resuelve |
| :--- | :--- | :--- | :--- |
| R1 | Alta | Actualizar `xlsx` a 0.20.3 o posterior desde el CDN oficial de SheetJS (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), ya que SheetJS dejó de publicar en npm. Alternativa: migrar a `exceljs`. | `xlsx` (entrada externa) |
| R2 | Alta | Actualizar `@nestjs/core` y `@nestjs/platform-express`; si la versión no trae los parches, fijar con `overrides` en `pnpm-workspace.yaml`: `proxy-addr >=2.0.8`, `multer >=2.5.0`, `body-parser >=2.4.0`, `qs >=6.16.1`. | `proxy-addr`, `multer`, `body-parser`, `qs` |
| R3 | Media | Actualizar `axios` a una versión que incluya `follow-redirects >=1.16.2`, o fijarla con `overrides`. | `follow-redirects` |
| R4 | Media | Fijar todas las acciones de `ci.yml` y `deploy.yml` por SHA de commit, con el tag como comentario. | S1 (25 hallazgos) |
| R5 | Media | Agregar a `pnpm-workspace.yaml`: `minimumReleaseAge: 10080`, `trustPolicy: no-downgrade`, `blockExoticSubdeps: true`. | S2–S4 |
| R6 | Media | Reemplazar `semgrep/semgrep-action@v1` (deprecada) por un paso con la imagen `semgrep/semgrep` y `semgrep ci --config p/ci`, para que los hallazgos se reporten igual que en local. | Observación del §3 |
| R7 | Baja | Actualizar dependencias de desarrollo (`concurrently`, `vitest`, `vite`, `@nestjs/cli`). | Tabla §4.2 |
| R8 | Baja | En los Dockerfiles, reemplazar `corepack prepare pnpm@latest` por la versión de `packageManager` (11.2.2) para builds reproducibles. | Reproducibilidad del build |

## 7. Cómo reproducir

Requiere Docker Desktop encendido y ejecutar desde la raíz del repo.

```bash
# SAST
docker run --rm -v "$PWD:/src" -w /src semgrep/semgrep semgrep scan --config p/ci --metrics=off

# SCA
docker run --rm -v "$PWD:/src:ro" -w /src ghcr.io/google/osv-scanner-action:v2.7.0 --lockfile=pnpm-lock.yaml --format=table
pnpm audit --prod

# SBOM
pnpm --filter ./backend sbom --sbom-format cyclonedx --sbom-spec-version 1.6 --sbom-type application --prod > sbom-backend.json

# Imágenes
docker compose build
```

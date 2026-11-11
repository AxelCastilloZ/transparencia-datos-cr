# Modelo de Amenazas y Seguridad (STRIDE)

Este documento identifica los flujos críticos del proyecto, los riesgos asociados mediante la metodología STRIDE y las medidas de mitigación implementadas.

## 1. Mapas de Acceso y Permisos

| Rol / Actor | Recurso | Acción | Condición de Acceso |
| :--- | :--- | :--- | :--- |
| Anónimo / Usuario | `/api/cantones` | GET | Público |
| Anónimo / Usuario | `/api/radar/canton/:codigo` | GET | Público (Solo datos agregados) |
| Anónimo / Usuario | `/api/health` | GET | Público |
| Sistema / Cron | `/api/judicial/sync` | POST | Tarea programada / Administración interna |
| Sistema / Cron | `/api/tse/sync` | POST | Tarea programada / Descarga batch |

## 2. Flujos Críticos y Riesgos Priorizados (STRIDE)

### Flujo 1: Ingesta y Procesamiento del Padrón Electoral (TSE)
- **Amenaza (Information Disclosure):** Exposición de datos de identificación personal (PII) de ciudadanos al descargar el archivo ZIP/TXT del TSE.
- **Medida Implementada:** Procesamiento de `PADRON.TXT` mediante streaming en memoria con `unzipper`. No se escriben nombres ni cédulas en base de datos. El archivo ZIP temporal se elimina inmediatamente en el bloque `finally`.
- **Comprobación:** Inspección de la entidad `TseElector` en TypeORM comprobando que solo existen campos agregados (`cantonCodigo`, `distritoCodigo`, `totalElectores`).

### Flujo 2: Agregación de Transacciones SICOP (Multimoneda)
- **Amenaza (Tampering / Data Inconsistency):** Suma errónea de contrataciones en colones (CRC) y dólares (USD), produciendo distorsión de cifras en los reportes cantonales.
- **Medida Implementada:** Normalización y separación de montos agrupando estrictamente por tipo de moneda. No se realiza conversión implícita.
- **Comprobación:** Pruebas unitarias en `radar.math.ts` verificando respuestas divididas por arreglo de monedas.

### Flujo 3: Denegación de Servicio en Consultas OIJ / Radar
- **Amenaza (Denial of Service):** Consultas masivas sobre tablas con más de 100,000 registros policiales que saturen la base de datos de Supabase/Railway.
- **Medida Implementada:** Índices en base de datos por `canton_codigo` y rangos de fechas `desde`/`hasta`, junto con paginación explícita en backend.
- **Comprobación:** Endpoint `/api/radar/canton/:codigo` devuelve respuestas optimizadas en menos de 200ms.

## 3. Matriz de Controles de Seguridad

| ID | Categoría STRIDE | Amenaza | Control implementado | Evidencia | Estado |
| :- | :--------------- | :------ | :------------------- | :-------- | :----- |
| C1 | Information Disclosure | PII del padrón TSE expuesta en BD | Streaming en memoria, solo campos agregados en entidad | `tse.ingestion.spec.ts`, entidades `tse-padron-*.entity.ts` | Mitigado |
| C2 | Information Disclosure | Secretos en repositorio | Gitleaks en pre-commit + CI | `.pre-commit-config.yaml`, job `security-sast` | Mitigado |
| C3 | Tampering | Mezcla de monedas CRC/USD | Separación estricta por moneda en `radar.math.ts` | `radar.service.spec.ts`, `sicop.parsers.spec.ts` | Mitigado |
| C4 | Tampering | Dependencias con vulnerabilidades | OSV-Scanner en CI + SBOM con CycloneDX | Job `security-sca`, artefacto SBOM | Mitigado |
| C5 | Denial of Service | Consultas masivas sobre +100K registros | Índices por cantón + paginación + query params validados | Endpoint `/api/radar/canton/:codigo` con filtros `desde`/`hasta` | Mitigado |
| C6 | Denial of Service | Imágenes Docker con CVEs críticos | Trivy escanea imágenes en CI, falla en CRITICAL/HIGH | Job `container-scan` | Mitigado |
| C7 | Spoofing | Código malicioso inyectado en PRs | CI obligatorio en `development`, review requerido en `main` | `.github/workflows/ci.yml`, branch protection | Parcial |
| C8 | Elevation of Privilege | Acceso a endpoints de sync sin autorización | Endpoints de sync solo invocados por cron interno | `@Cron()` decorador en NestJS | Mitigado |

## 4. Pipeline de Seguridad (DevSecOps)

```
Commit → Pre-commit (Gitleaks) → Push → CI Pipeline
                                          │
                    ┌─────────────┬────────┼─────────┬──────────────┐
                    ▼             ▼        ▼         ▼              ▼
              build-and-test  security  security   e2e-tests   container
              (lint+test+    -sast     -sca       (Playwright)  -scan
               build)        (Gitleaks  (OSV+                  (Trivy)
                              Semgrep)   SBOM)
```

## 5. Herramientas de Seguridad

| Herramienta | Etapa SSDLC | Qué detecta | Integración |
| :---------- | :---------- | :---------- | :---------- |
| Gitleaks | 2 (local) + 3 (CI) | Secretos en código/historial | Pre-commit hook + GitHub Action |
| Semgrep CE | 3 (CI) | Vulnerabilidades SAST (inyección, XSS, etc.) | GitHub Action con config `p/ci` |
| OSV-Scanner | 3 (CI) | CVEs en dependencias (SCA) | GitHub Action sobre `pnpm-lock.yaml` |
| CycloneDX | 3 (CI) | Genera SBOM de dependencias | npx en CI, artefacto descargable |
| Trivy | 3 (CI) | CVEs en imágenes Docker | GitHub Action, falla en CRITICAL/HIGH |
| Playwright | 4 (CI) | Regresiones funcionales E2E | GitHub Action, reporte como artefacto |
| Vitest | 4 (CI) | Regresiones unitarias | 82 tests (69 backend + 13 frontend) |
| OxLint | 3 (CI) | Errores de código y estilo | Ejecutado en lint de backend y frontend |

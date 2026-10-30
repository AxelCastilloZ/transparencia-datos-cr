# Checklist DevSecOps — SSDLC del Proyecto

Mapeo de los 12 ítems implementados del ciclo de vida de desarrollo seguro
(NIST NCCoE), con evidencia y responsable propuesto.

---

## Etapa 1 — Requisitos y Diseño de Seguridad

### 1.1 Criterios de aceptación BDD (Given/When/Then)
- **Archivo:** `docs/ACCEPTANCE_CRITERIA.md`
- **Contenido:** 10 criterios verificables para 3 flujos críticos:
  Radar cantonal, ingesta TSE (PII), agregación SICOP multimoneda.
- **Responsable sugerido:** Axel

### 1.3 Modelo de amenazas STRIDE
- **Archivo:** `docs/THREAT_MODEL.md`
- **Contenido:** 3 flujos analizados con STRIDE, medidas de mitigación
  implementadas y comprobaciones automatizadas.
- **Responsable sugerido:** Axel

---

## Etapa 2 — Entorno de Desarrollo Seguro

### 2.2 Comandos reproducibles de calidad
- **Evidencia:** Scripts en `package.json` raíz (`pnpm build`, `pnpm test`),
  linters configurados (`oxlint` en backend y frontend), documentado en
  README.md y AGENTS.md.
- **Responsable sugerido:** Axel

### 2.3 Herramientas de seguridad locales (pre-commit)
- **Archivo:** `.pre-commit-config.yaml`
- **Contenido:** Gitleaks (secret scanning) + Semgrep (SAST) ejecutados
  automáticamente antes de cada commit local.
- **Instalación:** `pip install pre-commit && pre-commit install`
- **Responsable sugerido:** Compañero 2

---

## Etapa 3 — Pipeline CI/CD con Seguridad

### 3.1 Pipeline de CI automatizado
- **Archivo:** `.github/workflows/ci.yml`
- **Jobs:** `build-and-test` (lint, unit tests backend+frontend, build)
- **Trigger:** Push/PR a `main` y `development`
- **Responsable sugerido:** Axel

### 3.2 SAST + Secret scanning + SCA en CI
- **Archivo:** `.github/workflows/ci.yml` — jobs `security-sast` y `security-sca`
- **Herramientas:**
  - Gitleaks → detección de secretos en historial Git
  - Semgrep CE (config `p/ci`) → análisis estático de código
  - OSV-Scanner → vulnerabilidades en dependencias (lockfile)
  - CycloneDX → generación de SBOM (Software Bill of Materials)
- **Responsable sugerido:** Compañero 3

### 3.3 Container scanning (Trivy)
- **Archivo:** `.github/workflows/ci.yml` — job `container-scan`
- **Contenido:** Build de imágenes Docker + escaneo con Trivy
  (severity CRITICAL,HIGH).
- **Responsable sugerido:** Compañero 4

---

## Etapa 4 — Pruebas de Seguridad

### 4.2 Pruebas unitarias consolidadas
- **Evidencia:** 69 tests backend + 13 tests frontend (82 total),
  ejecutados en CI. Cubren: entidades, parsers, ingesta TSE,
  matemáticas del radar, SICOP, componentes React.
- **Responsable sugerido:** Axel

### 4.4 Pruebas E2E con Playwright
- **Archivos:** `frontend/playwright.config.ts`, `frontend/e2e/radar.spec.ts`
- **Contenido:** 5 tests E2E para el flujo principal del radar cantonal:
  carga inicial, selector de cantón, ficha, contexto nacional, filtros.
- **Ejecución:** `pnpm --dir frontend test:e2e`
- **Responsable sugerido:** Compañero 2

---

## Etapa 5 — Release y Registro

### 5.1 Dockerfiles + SBOM + container registry
- **Archivos:** `backend/Dockerfile`, `frontend/Dockerfile`,
  `frontend/nginx.conf`, `docker-compose.yml`
- **Contenido:** Multi-stage builds optimizados, HEALTHCHECK integrado,
  nginx como reverse proxy para frontend→backend.
- **SBOM:** Generado en CI con CycloneDX y subido como artefacto.
- **Registry:** GitHub Container Registry (GHCR) via deploy workflow.
- **Responsable sugerido:** Compañero 3

---

## Etapa 6 — Despliegue Automatizado

### 6.1 Pipeline de deployment
- **Archivo:** `.github/workflows/deploy.yml`
- **Contenido:** Build + push de imágenes a GHCR con tag de SHA y latest.
  Environment `staging` con protección.
- **Trigger:** Push a `main` solamente.
- **Responsable sugerido:** Compañero 4

---

## Etapa 7 — Operaciones y Monitoreo

### 7.1 Health checks y observabilidad básica
- **Endpoint:** `GET /api/health` → `{ status, timestamp, uptime }`
- **Docker:** HEALTHCHECK integrado en ambos Dockerfiles.
- **Responsable sugerido:** Axel

---

## Distribución por integrante (propuesta)

| Integrante   | Ítems                    | Total |
| :----------- | :----------------------- | :---: |
| Axel         | 1.1, 1.3, 3.1, 4.2, 7.1 | 5     |
| Compañero 2  | 2.3, 4.4                 | 2 (+1 pendiente) |
| Compañero 3  | 3.2, 5.1                 | 2 (+1 pendiente) |
| Compañero 4  | 3.3, 6.1                 | 2 (+1 pendiente) |

> **Nota:** Cada compañero necesita al mínimo 3 ítems. Los faltantes
> pueden completarse documentando su contribución (explicar el ítem
> durante la exposición) o tomando ítems adicionales como OpenSpec
> workspace, ZAP DAST, o tests de resiliencia.

# DevSecOps SSDLC — Especificación de Seguridad

## Resumen

Aplicación del ciclo de vida de desarrollo seguro (SSDLC) basado en el modelo
NIST NCCoE al proyecto Transparencia Datos CR. Mínimo 12 ítems cubiertos entre
4 integrantes, al menos 1 ítem por cada una de las 7 etapas.

## Etapas y Ítems Implementados

### Etapa 1 — Requisitos y Diseño
- **1.1** Criterios de aceptación BDD → `docs/ACCEPTANCE_CRITERIA.md`
- **1.3** Modelo de amenazas STRIDE → `docs/THREAT_MODEL.md`

### Etapa 2 — Entorno de Desarrollo
- **2.2** Comandos reproducibles → `package.json` raíz (build, test, lint)
- **2.3** Pre-commit hooks → `.pre-commit-config.yaml` (Gitleaks)

### Etapa 3 — Pipeline CI/CD
- **3.1** GitHub Actions CI → `.github/workflows/ci.yml`
- **3.2** SAST + Secrets + SCA → Semgrep, Gitleaks, OSV-Scanner (`v2.7.0`),
  SBOM CycloneDX con `anchore/sbom-action` (Syft, compatible con pnpm)
- **3.3** Container scanning → Trivy (`v0.36.0`) en job `container-scan`
- **3.5** Acciones de terceros ancladas por SHA (OSV-Scanner, Trivy, Syft)

> Correcciones de pipeline registradas en `changes/fix-ci-pipeline`.

### Etapa 4 — Pruebas
- **4.2** Tests unitarios → 69 backend + 13 frontend (82 total)
- **4.4** Tests E2E → `frontend/e2e/radar.spec.ts` (Playwright)

### Etapa 5 — Release
- **5.1** Dockerfiles + SBOM → `backend/Dockerfile`, `frontend/Dockerfile`
  (el build del frontend incluye los tipos compartidos del backend)

### Etapa 6 — Deployment
- **6.1** Pipeline de deploy → `.github/workflows/deploy.yml` (GHCR)

### Etapa 7 — Operaciones
- **7.1** Health check → `GET /api/health` + Docker HEALTHCHECK

## Estrategia de Ramas

- `main` — Producción. Requiere PR aprobado + CI verde.
- `development` — Integración. Requiere CI verde.
- `feature/nombre-tarea` — Ramas individuales por integrante.

## Distribución por Integrante

Cada integrante DEBE cubrir al menos 3 ítems y al menos 1 por etapa distinta.
Ver `docs/DEVSECOPS_CHECKLIST.md` para la propuesta de asignación.

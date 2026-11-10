# Entrega — Proyecto final de Desarrollo Seguro de Software (SSDLC)

**Curso:** Desarrollo Seguro de Software
**Proyecto base:** Transparencia Datos CR — Radar cantonal de señales públicas
**Repositorio público:** <https://github.com/AxelCastilloZ/transparencia-datos-cr>
**Rama de integración:** `development`
**Fecha de entrega:** 13 de noviembre de 2026

---

## 1. Resumen

Se aplicó un ciclo de vida de desarrollo seguro (SSDLC) basado en el modelo
NIST NCCoE sobre la aplicación Transparencia Datos CR (NestJS + React, monorepo
pnpm). El equipo cubrió **las 7 etapas** del modelo con **más de 12 ítems**
(mínimo exigido para un equipo de 4), al menos uno por etapa, integrados en un
mismo proyecto con CI/CD, análisis de seguridad automatizado y uso de IA /
programación agéntica.

El seguimiento spec-driven se mantiene con **OpenSpec** en `openspec/`
(specs, changes y configuración), y las convenciones para el agente de IA en
[`AGENTS.md`](../AGENTS.md).

---

## 2. Alcance por integrante

Cada integrante es responsable principal de sus ítems y los defiende en la
exposición. Las revisiones se realizaron vía Pull Request antes de integrar a
`development`.

### Axel (@AxelCastilloZ)
| Ítem | Qué | Evidencia |
| :--- | :--- | :--- |
| 1.1 | Criterios de aceptación BDD (Given/When/Then) | [`docs/ACCEPTANCE_CRITERIA.md`](ACCEPTANCE_CRITERIA.md) |
| 1.3 | Modelo de amenazas STRIDE | [`docs/THREAT_MODEL.md`](THREAT_MODEL.md) |
| 2.2 | Comandos reproducibles (build/test/lint) | `package.json` raíz, README |
| 3.1 | Pipeline de CI automatizado | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| 3.5 | Acciones de terceros ancladas por SHA | `ci.yml` (OSV, Trivy, Syft) |
| 4.2 | Pruebas unitarias (82: 69 backend + 13 frontend) | CI job "Lint, Build & Test" |
| 7.1 | Health check + HEALTHCHECK Docker | `GET /api/health` |

PRs: [#8](https://github.com/AxelCastilloZ/transparencia-datos-cr/pull/8) (reparación del pipeline), [#9](https://github.com/AxelCastilloZ/transparencia-datos-cr/pull/9) (registro OpenSpec `fix-ci-pipeline`).

### Brenda (@BrendaObando) — Compañero 2
| Ítem | Qué | Evidencia |
| :--- | :--- | :--- |
| 2.3 | Pre-commit hooks (Gitleaks) | [`.pre-commit-config.yaml`](../.pre-commit-config.yaml), sección "Seguridad local" en README |
| 4.4 | Pruebas E2E con Playwright (13 tests) | `frontend/e2e/`, CI job "Pruebas E2E" |
| Adicional | E2E de SICOP, TSE y recuperación ante errores | `frontend/e2e/modulos.spec.ts` |

PR: [#4](https://github.com/AxelCastilloZ/transparencia-datos-cr/pull/4) (incluye capturas de Gitleaks y Playwright 13/13).

### Jose (@Jroman07) — Compañero 3
| Ítem | Qué | Evidencia |
| :--- | :--- | :--- |
| 3.2 | SAST + Secrets + SCA en CI y análisis de hallazgos | [`docs/SECURITY_FINDINGS.md`](SECURITY_FINDINGS.md), [`docs/evidencias/`](evidencias/) |
| 5.1 | SBOM (CycloneDX) | CI job "Análisis SCA", artefacto `sbom` |
| Adicional | Remediación de dependencias vulnerables | `osv-scanner.toml`, bumps en `package.json` (xlsx 0.20.3, etc.) |

PR: [#6](https://github.com/AxelCastilloZ/transparencia-datos-cr/pull/6) (incluye evidencias de escaneos pre/post remediación).

### saMujbo — Compañero 4
| Ítem | Qué | Evidencia |
| :--- | :--- | :--- |
| 3.3 | Container scanning con Trivy | [`docs/CONTAINER_SCANNING.md`](CONTAINER_SCANNING.md), CI job "Build & Scan Contenedores" |
| 6.1 | Pipeline de deployment a GHCR | [`docs/DEPLOYMENT.md`](DEPLOYMENT.md), [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) |
| Adicional | Corrección de nombres de imagen GHCR + setup Copilot | `deploy.yml`, `.github/workflows/copilot-setup-steps.yml` |

PR: [#7](https://github.com/AxelCastilloZ/transparencia-datos-cr/pull/7).

> **Revisores:** cada PR fue revisado por otro integrante antes de integrarse a
> `development`. _(El equipo confirma aquí el revisor de cada ítem.)_

---

## 3. Cobertura por etapa (NIST NCCoE)

| Etapa | Ítems cubiertos |
| :--- | :--- |
| 1 — Planificación | 1.1, 1.3 |
| 2 — Desarrollo | 2.2, 2.3 |
| 3 — Construcción e integración | 3.1, 3.2, 3.3, 3.5 |
| 4 — Pruebas | 4.2, 4.4 |
| 5 — Preparación de la versión | 5.1 |
| 6 — Despliegue | 6.1 |
| 7 — Operación y mejora continua | 7.1 |

---

## 4. Artefactos y evidencias

- **Pipeline CI/CD:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — jobs: Lint/Build/Test, SAST & Secrets (Semgrep + Gitleaks), SCA (OSV-Scanner + SBOM CycloneDX con Syft), E2E (Playwright) y Build & Scan Contenedores (Trivy).
- **Deploy:** [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — build y push de imágenes a GHCR.
- **Modelo de amenazas:** [`docs/THREAT_MODEL.md`](THREAT_MODEL.md).
- **Criterios de aceptación:** [`docs/ACCEPTANCE_CRITERIA.md`](ACCEPTANCE_CRITERIA.md).
- **Hallazgos de seguridad:** [`docs/SECURITY_FINDINGS.md`](SECURITY_FINDINGS.md) + [`docs/evidencias/`](evidencias/).
- **Container scanning:** [`docs/CONTAINER_SCANNING.md`](CONTAINER_SCANNING.md).
- **Deployment:** [`docs/DEPLOYMENT.md`](DEPLOYMENT.md).
- **Mapeo de ítems:** [`docs/DEVSECOPS_CHECKLIST.md`](DEVSECOPS_CHECKLIST.md).
- **OpenSpec:** `openspec/specs/devsecops-ssdlc.md`, `openspec/changes/`.
- **Historial de integración:** PRs [#4](https://github.com/AxelCastilloZ/transparencia-datos-cr/pull/4), [#6](https://github.com/AxelCastilloZ/transparencia-datos-cr/pull/6), [#7](https://github.com/AxelCastilloZ/transparencia-datos-cr/pull/7), [#8](https://github.com/AxelCastilloZ/transparencia-datos-cr/pull/8), [#9](https://github.com/AxelCastilloZ/transparencia-datos-cr/pull/9).

### Capturas a adjuntar en la exposición
- Run de GitHub Actions con los 5 jobs en verde.
- Gitleaks bloqueando / pasando (pre-commit y CI).
- Reporte de Playwright (13/13).
- Reporte de Trivy y artefacto SBOM descargado.
- OSV-Scanner / pnpm-audit antes y después de la remediación.
- Lista de PRs mergeados (flujo de revisión).

---

## 5. Limitaciones conocidas

- **Escáneres en modo report-only:** Trivy (`exit-code: 0`) y OSV
  (`continue-on-error`) reportan hallazgos sin bloquear la integración. Se
  documenta cómo endurecer el gate en `openspec/changes/fix-ci-pipeline`.
- **E2E con API simulada:** los tests E2E usan mocks; prueban el frontend, no la
  integración real contra la base de datos.
- **Acoplamiento frontend→backend:** el frontend importa tipos del backend; se
  registra como deuda técnica (posible paquete de tipos compartido).
- **Deploy:** el workflow publica imágenes a GHCR; el despliegue a un ambiente
  real no es obligatorio para esta entrega.

---

## 6. Cómo correr y verificar

```bash
pnpm install        # desde la raíz (monorepo pnpm)
pnpm test           # 82 pruebas unitarias
pnpm build          # compila backend y frontend
pnpm --dir frontend test:e2e   # E2E Playwright
```

El pipeline completo se ejecuta automáticamente en cada PR hacia `development`
y `main`. Ver detalles de ejecución local y variables de entorno en el
[`README.md`](../README.md).

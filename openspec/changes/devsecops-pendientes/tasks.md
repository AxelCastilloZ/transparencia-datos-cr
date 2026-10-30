# Tareas — DevSecOps pendientes

## Setup (todos los compañeros)

- [ ] Clonar el repo: `git clone git@github.com:AxelCastilloZ/transparencia-datos-cr.git`
- [ ] Cambiar a development: `git checkout development`
- [ ] Crear rama personal: `git checkout -b feature/TUNOMBRE-devsecops`
- [ ] Instalar dependencias: `pnpm install`
- [ ] Copiar `.env` del backend (pedir a Axel la variable `DATABASE_URL`)
- [ ] Verificar que todo funcione: `pnpm test`

---

## Compañero 2 — Pre-commit y E2E

### Tarea 2.1: Documentar pre-commit hooks (ítem 2.3)
- [ ] Instalar pre-commit: `pip install pre-commit && pre-commit install`
- [ ] Correr los hooks manualmente: `pre-commit run --all-files`
- [ ] Capturar screenshot de Gitleaks pasando
- [ ] Agregar sección en README sobre "Seguridad local"

### Tarea 2.2: Ejecutar y verificar E2E (ítem 4.4)
- [ ] Instalar browsers de Playwright: `pnpm --dir frontend exec playwright install chromium`
- [ ] Correr tests E2E: `pnpm --dir frontend test:e2e`
- [ ] Capturar screenshot/reporte de Playwright
- [ ] Agregar al menos 1 test E2E nuevo para un flujo diferente

### Tarea 2.3: Ítem adicional
- [ ] Agregar test E2E para el panel TSE o SICOP
- [ ] Documentar cobertura E2E en `docs/DEVSECOPS_CHECKLIST.md`

---

## Compañero 3 — SAST/SCA y Release

### Tarea 3.1: Documentar SAST + SCA en CI (ítem 3.2)
- [ ] Ir a Actions en GitHub y verificar que `security-sast` y `security-sca` corren
- [ ] Capturar screenshots de Semgrep, Gitleaks y OSV-Scanner ejecutándose en CI
- [ ] Documentar los hallazgos (findings) en un nuevo `docs/SECURITY_FINDINGS.md`

### Tarea 3.2: Documentar Dockerfiles y SBOM (ítem 5.1)
- [ ] Build local de las imágenes: `docker compose build`
- [ ] Capturar screenshots del build exitoso
- [ ] Descargar el SBOM del artefacto de CI y documentar dependencias críticas

### Tarea 3.3: Ítem adicional
- [ ] Analizar findings de OSV-Scanner y proponer remediaciones
- [ ] Agregar al `docs/SECURITY_FINDINGS.md`

---

## Compañero 4 — Container scanning y Deployment

### Tarea 4.1: Documentar container scanning (ítem 3.3)
- [ ] Verificar que el job `container-scan` corre en CI
- [ ] Capturar screenshots de Trivy escaneando las imágenes
- [ ] Documentar vulnerabilidades encontradas (si las hay) y remediaciones

### Tarea 4.2: Verificar pipeline de deployment (ítem 6.1)
- [ ] Revisar `.github/workflows/deploy.yml`
- [ ] Verificar que se construyen y publican las imágenes en GHCR
- [ ] Documentar el flujo de deployment en `docs/DEPLOYMENT.md`

### Tarea 4.3: Ítem adicional (elegir uno)
- [ ] Opción A: Configurar OWASP ZAP como DAST básico en CI
- [ ] Opción B: Agregar tests de resiliencia con timeout/retry en endpoints
- [ ] Opción C: Documentar respuesta a incidentes (playbook básico)

---

## Entrega final (todos)

- [ ] Abrir PR de tu rama a `development`
- [ ] Verificar que CI pasa (lint, test, SAST, SCA)
- [ ] Agregar screenshots de tu trabajo al PR description
- [ ] Presentar tus 3+ ítems en la exposición del 13 de noviembre

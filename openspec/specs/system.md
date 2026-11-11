# Transparencia Datos CR — Especificación del Sistema

## Resumen

Sistema web monorepo que integra cuatro fuentes de datos públicos de Costa Rica,
indexados por cantón, en un "Radar Cantonal de Señales Públicas".

## Arquitectura

- **Backend:** NestJS + TypeORM + PostgreSQL (Supabase)
- **Frontend:** React + Vite + TypeScript + Tailwind CSS v4 + Recharts
- **Monorepo:** pnpm workspaces (`backend/`, `frontend/`)
- **CI/CD:** GitHub Actions (lint, test, SAST, SCA, container scan)

## Módulos de Fuentes

### OIJ (Judicial) — Responsable: Axel
- **Estado:** Completado
- **Fuente:** CSVs de estadísticas policiales del Poder Judicial
- **Endpoints:** `/api/judicial/canton/:codigo`, `/api/judicial/resumen`,
  `/api/judicial/mensual`, `/api/judicial/status`, `POST /api/judicial/sync`

### SICOP (Contratación) — Responsable: Compañero A
- **Estado:** Completado (módulo base)
- **Fuente:** API de órdenes de compra de SICOP
- **Restricción:** Montos DEBEN separarse estrictamente por moneda (CRC/USD)

### TSE (Electorado) — Responsable: Compañero B
- **Estado:** Completado (módulo base)
- **Fuente:** Padrón electoral del TSE (PADRON.TXT)
- **Restricción:** NUNCA persistir datos personales (nombre, cédula)

### Datos Abiertos (PRONAE) — Responsable: Compañero C
- **Estado:** Completado (módulo base)
- **Fuente:** Datos abiertos del gobierno (datosabiertos.presidencia.go.cr)

### Radar (Integración)
- **Estado:** Completado
- **Función:** Integra las 4 fuentes en una ficha cantonal unificada
- **Endpoint principal:** `/api/radar/canton/:codigo`

## Variables de Entorno

| Variable       | Descripción                          | Obligatoria |
| :------------- | :----------------------------------- | :---------: |
| `DATABASE_URL` | URL de conexión PostgreSQL (Supabase)| Sí          |
| `PORT`         | Puerto del backend (default: 3000)   | No          |

## Comandos Esenciales

```bash
pnpm install          # Instalar dependencias
pnpm build            # Compilar backend + frontend
pnpm test             # Correr todos los tests
pnpm dev              # Dev server (backend + frontend en paralelo)
```

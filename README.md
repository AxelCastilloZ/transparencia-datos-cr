# 🇨🇷 Transparencia CR

Explorador de Transparencia por Cantón — sistema web que cruza seguridad,
contratación pública, participación electoral y datos abiertos de Costa Rica,
indexados por cantón.

Proyecto universitario · 4 integrantes · Curso 2026

## Problema que resuelve

Los datos públicos de Costa Rica están dispersos en múltiples portales
(Poder Judicial, SICOP, TSE, Datos Abiertos). Este sistema los integra en
un solo lugar, permitiendo que cualquier persona seleccione un cantón y vea
las cuatro dimensiones a la vez: seguridad, contratación, participación
electoral y datos abiertos generales.

No es un enlace ni un iframe a otra web — el backend descarga, procesa y
expone los datos como API propia.

## Fuentes OSINT y responsables

| # | Fuente | Responsable | Estado |
|---|--------|-------------|--------|
| 1 | **Poder Judicial / OIJ** — Estadísticas Policiales | Axel ([@AxelCastilloZ](https://github.com/AxelCastilloZ)) | ✅ Completo |
| 2 | **SICOP** — Contratación Pública | Brenda Obando ([@BrendaObando](https://github.com/BrendaObando)) | ✅ Completo |
| 3 | **TSE** — Padrón Electoral | Persona 3 | ⏳ Pendiente |
| 4 | **Portal Nacional de Datos Abiertos** | Persona 4 | ⏳ Pendiente |

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React + Vite + Tailwind + Recharts)      │
│  Selector de cantón → Dashboard con 4 secciones     │
└──────────────────────┬──────────────────────────────┘
                       │ fetch /api/*
┌──────────────────────▼──────────────────────────────┐
│  Backend (NestJS)                                    │
│  ┌───────────┐ ┌───────────┐ ┌──────┐ ┌──────────┐ │
│  │ judicial/  │ │  sicop/   │ │ tse/ │ │datos-ab/ │ │
│  │ (OIJ) ✅  │ │  ✅      │ │      │ │          │ │
│  └─────┬─────┘ └─────┬─────┘ └──┬───┘ └────┬─────┘ │
│        └──────────────┴──────────┴──────────┘       │
│                       │ TypeORM                      │
└───────────────────────┬─────────────────────────────┘
                        │ SQL (Session pooler IPv4)
┌───────────────────────▼─────────────────────────────┐
│  PostgreSQL (Supabase)                               │
│  cantones | estadisticas_policiales |                │
│  sicop_ordenes_pedido | ...                          │
└─────────────────────────────────────────────────────┘

Cron jobs (por módulo) descargan datos periódicamente.
Si la fuente externa cae, el backend sirve el último dato cacheado.
```

## Cómo correr el proyecto localmente

### Requisitos previos

- Node.js 18+
- pnpm (`npm install -g pnpm`)

### Instalación

```bash
# Clonar el repo
git clone https://github.com/AxelCastilloZ/transparencia-datos-cr.git
cd transparencia-datos-cr

# Instalar dependencias (siempre con pnpm, nunca npm/yarn)
pnpm install
```

### Configurar variables de entorno

```bash
# Copiar la plantilla
cp backend/.env.example backend/.env

# Editar backend/.env y pegar el DATABASE_URL
# (se comparte por el canal privado del equipo)
```

### Arrancar en desarrollo

```bash
# Opción 1: ambos a la vez desde la raíz (usa concurrently)
pnpm run dev

# Opción 2: por separado
cd backend && pnpm run start:dev   # API en http://localhost:3000
cd frontend && pnpm run dev        # App en http://localhost:5173
```

Si un arranque anterior quedó colgado y ves `EADDRINUSE :::3000`, liberá los
puertos: `npx kill-port 3000 5173`.

### Nota sobre la versión de Node

El CLI de NestJS falla con `ERR_REQUIRE_CYCLE_MODULE` en Node ≥ 20.19 / 23
porque `@angular-devkit/schematics` hace `require()` de `ora` (que ahora es
ESM). El repo fija `ora` a su última versión CommonJS vía `overrides` en
`pnpm-workspace.yaml`, así que basta con `pnpm install`. Lo ideal igual es
usar **Node 20 LTS**.

### Primera carga de datos (OIJ)

La primera vez que arranques el backend, la tabla de cantones se llena
automáticamente (82 cantones). Para cargar los datos del OIJ:

```bash
curl -X POST http://localhost:3000/api/judicial/sync
```

Esto descarga ~100,000+ registros de estadísticas policiales (2024–2026).
Tarda ~1 minuto. Después se refresca automáticamente cada semana vía cron.

### Primera carga de datos (SICOP)

```bash
# Carga los últimos 6 meses de órdenes de pedido de SICOP
curl -X POST http://localhost:3000/api/sicop/sync

# O meses puntuales (más rápido para una demo)
curl -X POST "http://localhost:3000/api/sicop/sync?meses=202608,202607,202606"
```

Descarga los ZIP mensuales del Observatorio de Compra Pública, extrae las
órdenes de pedido y les resuelve la institución/cantón. ~80.000 órdenes en
6 meses, tarda 2–4 minutos. Se refresca a diario vía cron.

## Endpoints disponibles

### Cantones (compartido)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/cantones` | Lista los 82 cantones agrupables por provincia |
| GET | `/api/cantones/:codigo` | Detalle de un cantón (ej: `101` = San José) |

### Judicial / OIJ ✅

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/judicial/canton/:codigo` | Registros policiales del cantón (query: `desde`, `hasta`, `limit`, `offset`) |
| GET | `/api/judicial/canton/:codigo/resumen` | Conteo de delitos agrupado por tipo |
| GET | `/api/judicial/canton/:codigo/mensual` | Incidentes agregados por mes (para timeline) |
| GET | `/api/judicial/status` | Total de registros en la base |
| POST | `/api/judicial/sync` | Dispara sincronización manual |

**Ejemplo de request/response:**

```bash
# Resumen de delitos para San José (código 101)
curl http://localhost:3000/api/judicial/canton/101/resumen
```

```json
[
  { "delito": "HURTO — CARTERISTA", "total": 5842 },
  { "delito": "HURTO — POR DESCUIDO", "total": 2103 },
  { "delito": "ASALTO — ARMA BLANCA", "total": 1876 }
]
```

```bash
# Incidentes mensuales para San José
curl http://localhost:3000/api/judicial/canton/101/mensual
```

```json
[
  { "mes": "2024-01", "casos": 696 },
  { "mes": "2024-02", "casos": 689 },
  { "mes": "2024-03", "casos": 814 }
]
```

### SICOP — Contratación Pública ✅

Órdenes de pedido de instituciones públicas (compras ejecutadas). Detalle
del módulo y diccionario de datos: `backend/src/sicop/README.md` y `DATOS.md`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/sicop/status` | Total de órdenes + cuántas con cantón resuelto |
| GET | `/api/sicop/proveedores` | Ranking de proveedores por monto (query: `q`, `desde`, `hasta`, `limit`, `canton`) |
| GET | `/api/sicop/instituciones` | Ranking de instituciones compradoras (query: `desde`, `hasta`, `limit`, `canton`) |
| GET | `/api/sicop/mensual` | Gasto agregado por mes (query: `desde`, `hasta`, `canton`) |
| GET | `/api/sicop/canton/:codigo` | Órdenes de instituciones de un cantón |
| GET | `/api/sicop/canton/:codigo/instituciones` | Instituciones compradoras del cantón |
| GET | `/api/sicop/canton/:codigo/mensual` | Gasto por mes del cantón |
| POST | `/api/sicop/sync` | Ingesta manual (query: `meses=202608,202607`) |

**Ejemplo de request/response:**

```bash
# Top proveedores por monto contratado
curl "http://localhost:3000/api/sicop/proveedores?limit=3"
```

```json
[
  { "proveedor": "CORPORACION GONZALEZ Y ASOCIADOS INTERNACIONAL SOCIEDAD ANONIMA", "total": 46980134314.0, "ordenes": 141 },
  { "proveedor": "INS RED DE SERVICIOS DE SALUD SOCIEDAD ANONIMA", "total": 31384355659.0, "ordenes": 14 },
  { "proveedor": "INSTITUTO NACIONAL DE SEGUROS", "total": 10077026556.0, "ordenes": 225 }
]
```

```bash
# Gasto mensual en órdenes de pedido para un cantón (ej: 701 = Limón)
curl "http://localhost:3000/api/sicop/canton/701/mensual"
```

```json
[
  { "mes": "2026-04", "monto": 2314500000.0, "ordenes": 210 },
  { "mes": "2026-05", "monto": 1980300000.0, "ordenes": 231 }
]
```

### TSE ⏳ · Datos Abiertos ⏳

Pendientes — cada integrante expondrá sus endpoints siguiendo el mismo
patrón (`/api/<fuente>/canton/:codigo`).

## Fuentes de datos

| Fuente | URL | Formato | Frecuencia |
|--------|-----|---------|------------|
| OIJ — Estadísticas Policiales | [datosabiertospj.poder-judicial.go.cr](https://datosabiertospj.poder-judicial.go.cr/dataset/estadisticas-policiales) | CSV (sin headers, 11 columnas) | Mensual |
| SICOP — Contratación Pública | Fuente: [SICOP](https://www.sicop.go.cr/moduloPcont/pcont/rp/CE_MOD_DATOSABIERTOSVIEW.jsp) · Vía de acceso: [Observatorio de Compra Pública](https://www.observatoriocomprapublica.go.cr/descargas-sicop/) (`.../Zip/AAAAMM.zip`) | ZIP mensual de CSV (`;`, UTF-8) | Diaria 08:00 (~24 h desfase) |
| TSE — Padrón Electoral | [tse.go.cr/descarga_padron.html](https://www.tse.go.cr/descarga_padron.html) | ZIP (TXT Latin-1) | Mensual |
| Datos Abiertos CR | [datosabiertos.gob.go.cr](https://datosabiertos.gob.go.cr/) | Varía por dataset | Varía |

## Para compañeros: cómo agregar tu módulo

1. Leé `AGENTS.md` — ahí está todo el contexto del proyecto.
2. Pedí el `DATABASE_URL` por el canal privado y ponelo en `backend/.env`.
3. Creá tu carpeta en `backend/src/<tu-fuente>/` siguiendo el patrón de
   `backend/src/judicial/` (entity → service → controller → module).
4. Registrá tu módulo en `backend/src/app.module.ts`.
5. Creá tu componente en `frontend/src/components/` y agregalo al dashboard.
6. Trabajá en tu rama (`feature/sicop`, `feature/tse`, `feature/datos-abiertos`)
   y hacé PR a `main`.

La tabla `cantones` ya existe y se llena automáticamente — solo referenciala
con FK desde tu entity. TypeORM crea tus tablas nuevas automáticamente al
arrancar el backend (`synchronize: true` en desarrollo).

## Notas de seguridad

- ✅ No hay tokens, credenciales ni API keys en el repositorio.
- ✅ `.env` está en `.gitignore`.
- ✅ El módulo de TSE **nunca debe guardar datos personales** (nombre, cédula).
  Solo conteos agregados por cantón/sexo/grupo etario.

# Módulo: sicop — Datos Abiertos de Contratación Pública

Fuente OSINT #2 (`AGENTS.md` §6.2). Responsable: **Brenda Obando**.

- **Avance y checklist:** `PROGRESO.md`
- **Diccionario de datos y decisiones de la fuente:** `DATOS.md`
- **Guion de exposición:** `EXPOSICION.md`

## Qué hace

Descarga las **órdenes de pedido** de SICOP (compras públicas ejecutadas) desde
la zona de descarga masiva del Observatorio de Compra Pública (ZIP mensual de
CSV que replica SICOP), las normaliza, **les resuelve la institución compradora
y su cantón**, y las expone como API propia.

```
Observatorio (ZIP/AAAAMM.zip) → axios → fflate (unzip)
   ├─ OrdenPedido.csv                → hechos (proveedor, monto, fecha)
   └─ Instituciones + Sistemas/Carteles/Contratos → cruce NRO_SICOP → cantón
   → papaparse (;) → normalización → tabla sicop_ordenes_pedido (TypeORM)
   → /api/sicop/*
```

Cron diario a las 4 a.m. Si el ZIP no está disponible, se conserva el último
dato cacheado. El cruce por cantón cubre ~31 % de las órdenes (ver `DATOS.md` §3).

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/sicop/status` | Total de órdenes + cuántas con cantón resuelto |
| GET | `/api/sicop/proveedores` | Ranking de proveedores por monto. Query: `q`, `desde`, `hasta`, `limit`, `canton` |
| GET | `/api/sicop/instituciones` | Ranking de instituciones compradoras. Query: `desde`, `hasta`, `limit`, `canton` |
| GET | `/api/sicop/mensual` | Gasto agregado por mes. Query: `desde`, `hasta`, `canton` |
| GET | `/api/sicop/canton/:codigo` | Órdenes de instituciones de un cantón |
| GET | `/api/sicop/canton/:codigo/mensual` | Gasto por mes del cantón |
| GET | `/api/sicop/canton/:codigo/instituciones` | Instituciones compradoras del cantón |
| POST | `/api/sicop/sync` | Ingesta manual. Query: `meses=202601,202512` (opcional) |

## Primera carga (para la demo)

```bash
# Cargar meses puntuales
curl -X POST "http://localhost:3000/api/sicop/sync?meses=202601,202512,202511"

# O dejar que cargue los últimos 6 meses
curl -X POST http://localhost:3000/api/sicop/sync
```

```bash
curl "http://localhost:3000/api/sicop/proveedores?limit=10"
curl "http://localhost:3000/api/sicop/mensual"
```

## Estructura

| Archivo | Qué es |
|---|---|
| `sicop.service.ts` | descarga ZIP, parseo, normalización, cruce por cantón, cron |
| `sicop.parsers.ts` | funciones puras de parseo (montos, fechas, zona geográfica) |
| `sicop.parsers.spec.ts` | tests de las funciones de parseo |
| `contratacion.entity.ts` | entidad `sicop_ordenes_pedido` (FK a `cantones`) |
| `sicop.controller.ts` | endpoints REST de solo lectura |

## Pendiente

Solo queda abrir el PR `feature/sicop` → repo del equipo. Ver `PROGRESO.md` §5.

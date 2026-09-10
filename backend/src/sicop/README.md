# Módulo: sicop — Datos Abiertos de Contratación Pública

Fuente OSINT del proyecto (AGENTS.md §6.2). Responsable: persona 2.

## Estado

Esqueleto listo siguiendo el patrón de AGENTS.md §5 (entity + service +
controller + module + cron). **Falta la parte de investigación**: definir de
dónde y cómo se descargan los datos, y completar el parser.

| Pieza | Archivo | Estado |
|-------|---------|--------|
| Entidad | `contratacion.entity.ts` | ✅ definida (revisar columnas al conocer la fuente) |
| Service | `sicop.service.ts` | ⏳ falta `SICOP_SOURCE_URL` y `parsearReporte()` |
| Controller | `sicop.controller.ts` | ✅ endpoints listos |
| Module | `sicop.module.ts` | ✅ registrado en `app.module.ts` |
| Cron | `sicop.service.ts` `@Cron(EVERY_DAY_AT_4AM)` | ✅ (diario, la fuente desfasa ~24 h) |

Endpoints ya mapeados (devuelven vacío hasta cargar datos):

- `GET  /api/sicop/status`
- `GET  /api/sicop/canton/:codigo` — `?desde&hasta&limit&offset`
- `GET  /api/sicop/canton/:codigo/resumen` — monto por institución
- `GET  /api/sicop/canton/:codigo/mensual` — monto por mes
- `POST /api/sicop/sync` — dispara la ingesta manual

## Checklist de investigación

1. **Elegir el reporte.** Portal:
   <https://www.sicop.go.cr/moduloPcont/pcont/rp/CE_MOD_DATOSABIERTOSVIEW.jsp>
   (módulo nuevo: <https://www.sicop.go.cr/app/module/pcont/public/ce-open-data>).
   Reportes disponibles: solicitudes de contratación, pliegos, aclaraciones,
   recursos, ofertas, **adjudicaciones**, **contratos**, órdenes de pedido,
   instituciones compradoras, proveedores, catálogo de bienes/servicios.
   Para el cruce por cantón conviene uno con institución + monto + fecha.

2. **Capturar la descarga.** Abrir DevTools → pestaña Network, aplicar filtros
   (fecha / institución / provincia) y pulsar "Exportar" en JSON. Anotar:
   URL real, método, parámetros (querystring o body), headers necesarios.
   Preferir **JSON** sobre Excel. Pegar ese endpoint en `SICOP_SOURCE_URL`.

3. **Alternativa a evaluar:** el Observatorio de Compra Pública republica los
   datos de SICOP como ZIP mensual de CSV:
   `https://dlsaobservatorioprod.blob.core.windows.net/fs-synapse-observatorio-produccion/Zip/AAAAMM.zip`
   (<https://www.observatoriocomprapublica.go.cr/descargas-sicop/>). Si se usa,
   citar SICOP como fuente primaria y el Observatorio como vía de acceso.

4. **Mapear columnas → `Contratacion`** y completar `parsearReporte()`.
   Resolver el cantón: si la fuente da provincia+cantón en texto, usar el mapa
   `construirMapaCantones()` (ya normaliza tildes/mayúsculas); si solo da
   provincia, dejar `cantonCodigo = null` y el registro sigue sirviendo para
   totales nacionales/por institución.

5. **Probar la ingesta:** `curl -X POST http://localhost:3000/api/sicop/sync`
   y luego `GET /api/sicop/status`.

6. **Documentar en el README raíz** (§ "Fuentes de datos" y "Endpoints"):
   endpoint/archivo usado, formato, frecuencia de publicación, y los caveats
   de SICOP (réplica con ~24 h de desfase; proveedores excluye los últimos 7
   días).

## Notas

- Sin login ni token: descarga pública.
- No inventar convenciones nuevas: seguir `backend/src/judicial/` como molde.
- El frontend consume solo `/api/sicop/*`, nunca SICOP directamente.

# Modelo de Amenazas y Seguridad (STRIDE)

Este documento identifica los flujos críticos del proyecto, los riesgos asociados mediante la metodología STRIDE y las medidas de mitigación implementadas.

## 1. Mapas de Acceso y Permisos
| Rol / Actor | Recurso | Acción | Condición de Acceso |
| :--- | :--- | :--- | :--- |
| Anónimo / Usuario | `/api/cantones` | GET | Público |
| Anónimo / Usuario | `/api/radar/canton/:codigo` | GET | Público (Solo datos agregados) |
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

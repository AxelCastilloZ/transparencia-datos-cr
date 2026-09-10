# SICOP — Diccionario de datos y decisiones de la fuente

> Investigación de Brenda Obando · Fuente OSINT #2 · 2026-09-09

## 1. Fuente y vía de acceso

| | |
|---|---|
| Fuente primaria | **SICOP** — Sistema Integrado de Compras Públicas (`AGENTS.md` §6.2) |
| Vía de acceso usada | **Zona de descarga masiva del Observatorio de Compra Pública** (Ministerio de Hacienda), que replica los datos de SICOP |
| Por qué esta vía | El módulo oficial `sicop.go.cr/moduloPcont/.../CE_MOD_DATOSABIERTOSVIEW.jsp` devuelve error 500 y su exportación no es una URL estable / automatizable. El Observatorio publica los mismos datos con una URL predecible. |
| Sin login / token | Sí, descarga pública. Licencia CC-BY. |
| URL programable | `https://dlsaobservatorioprod.blob.core.windows.net/fs-synapse-observatorio-produccion/Zip/AAAAMM.zip` |
| Formato | ZIP con ~25 CSV. Separador `;`, **UTF-8**, campos de texto entre comillas dobles. |
| Frecuencia | El ZIP del mes en curso se regenera **a diario a las 08:00**. Histórico desde 2010. |
| Tamaño | 2–60 MB por ZIP (enero 2026 = 13 MB comprimido, ~75 MB los 25 CSV). |
| Caveats (documentar en README) | 1) Réplica con hasta 24 h de desfase. 2) Cada ZIP trae solo lo publicado ese mes; el histórico se arma bajando varios meses. 3) El reporte de proveedores excluye registros de los últimos 7 días. |

## 2. CSV que se consume: `OrdenPedido.csv`

Una **orden de pedido** = compra concreta que una institución ejecuta contra un
contrato. Es el nivel con monto real ejecutado + proveedor + fecha + descripción.

Enero 2026: **44.475 filas** (a nivel de línea) → **11.248 órdenes únicas** por
`NRO_ORDEN` tras deduplicar.

| Columna CSV | Campo entidad | Tipo | Nota |
|---|---|---|---|
| `NRO_ORDEN` | `nroOrden` (PK) | varchar | Identificador natural de la orden |
| `NRO_SICOP` | `nroSicop` | varchar | Nº del procedimiento en SICOP |
| `NUMERO_PROCEDIMIENTO` | `numeroProcedimiento` | varchar | e.g. `2025LD-000013-0023300001` |
| `CONTRACT_NO` / `NRO_CONTRATO` | `nroContrato` | varchar | e.g. `CE202601000513` — clave para el cruce con institución |
| `DESC_PROCEDIMIENTO` | `descripcion` | text | Qué se compró (texto libre) |
| `CEDULAPROVEEDOR` | `proveedorCedula` | varchar | Cédula jurídica/física |
| `NOMBRE_PROVEEDOR` | `proveedor` | varchar | |
| `TOTAL_ORDEN` | `montoOrden` | numeric | Monto en la moneda de la orden |
| `TOTALESTIMADO` | `montoEstimado` | numeric | Estimación del procedimiento |
| `USD_MONT` | `montoUsd` | numeric | Monto en USD (lo da la fuente) |
| `MONEDA_ORDEN` | `moneda` | varchar(3) | `CRC`, `USD`, … |
| `ESTADO_ORDEN` | `estado` | varchar | e.g. "Orden de Pedido Tramitada" |
| `FECHA_ELABORACION_ORDEN` | `fechaElaboracion` | date | Se recorta `YYYY-MM-DD` del timestamp |
| `FECHA_NOTIFICACION_ORDEN` | `fechaNotificacion` | date | |

Normalización aplicada (`sicop.service.ts`):
- Montos: se quitan comas, `""`/`0` → `null`, se guardan con 2 decimales.
- Fechas: `2026-01-05 17:39:03.0000000` → `2026-01-05`; inválidas → `null`.
- Dedupe: si una orden aparece en dos ZIP mensuales (porque cambió), gana la última.

## 3. Cruce por cantón — implementado (Fase 6)

`OrdenPedido.csv` **no trae la institución compradora ni su ubicación**. Se
resuelve con este cruce, hecho en memoria durante la ingesta:

```
OrdenPedido.NRO_SICOP
   ─→ (Sistemas.csv | DetalleCarteles.csv | Contratos.csv).CEDULA_INSTITUCION
   ─→ InstitucionesRegistradas.CEDULA
   ─→ InstitucionesRegistradas.ZONA_GEO_INST  ("distrito, cantón, provincia", sin tildes)
   ─→ tabla `cantones`  (match nombre+provincia, normalizando tildes/mayúsculas)
```

Se guardan `institucionCedula`, `institucion` (nombre), `provincia` y
`cantonCodigo` (FK) en cada fila de `sicop_ordenes_pedido`.

**Cobertura medida (6 meses, abr–sep 2026):** ~**31 %** de las órdenes quedan
con cantón resuelto (24.803 de 79.052). El resto sigue disponible a nivel
nacional / por proveedor. La cobertura es parcial porque los CSV puente solo
cubren procedimientos con actividad en la ventana descargada; una orden puede
referenciar un procedimiento de hace 2–3 años.

**Limitación a documentar:** la ubicación es la de la **sede** de la institución
compradora, no la del lugar de entrega. Por eso San José concentra el gasto de
las instituciones nacionales (CCSS, ICE, AyA, BCCR…).

Formas de mejorar la cobertura más adelante: descargar más meses de los CSV
puente (son chicos: Contratos 780 KB, DetalleCarteles 230 KB), o persistir un
diccionario acumulativo `NRO_SICOP → institución`.

## 4. Otros CSV del ZIP (referencia, no se usan aún)

| CSV | Filas ene-2026 | Contenido |
|---|---|---|
| `Proveedores.csv` | 54.721 | Registro de proveedores: cédula, nombre, tipo, **tamaño** (Pequeña/Mediana/Grande), `zona_geo_prov` |
| `Contratos.csv` | 2.692 | Contratos: procedimiento, institución, proveedor, fechas, moneda (sin monto) |
| `InstitucionesRegistradas.csv` | 593 | Instituciones: cédula, nombre, `ZONA_GEO_INST` |
| `AdjudicacionesFirme.csv` | 3.547 | Actos de adjudicación en firme (claves de cruce) |
| `DetalleCarteles.csv` | 717 | Carteles/pliegos: institución, tipo, `MONTO_EST`, fechas |
| `Sistemas.csv` | 4.375 | Líneas de cartel: descripción del bien/servicio + institución |
| `LineasRecibidas.csv` | 5.132 | Recepciones de bienes/servicios |
| `Garantias.csv`, `RecursosObjecion.csv`, `SancionProveedores.csv`, `Remates.csv`, … | varias | Temas específicos |
| `ProcedimientoAdjudicacion.csv` | ~0 | Traería institución+monto+proveedor en un solo archivo, pero **llega vacío** en los ZIP mensuales recientes — no se puede usar. |

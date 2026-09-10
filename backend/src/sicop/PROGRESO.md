# Módulo SICOP — Registro de avance

> Fuente OSINT #2 del proyecto · Responsable: **Brenda Obando**
> Rama: `feature/sicop` · Última actualización: 2026-09-09

Control de lo hecho, lo pendiente y la verificación contra la rúbrica
(`AGENTS.md` §2 y §6.2, README del enunciado). Diccionario de datos: `DATOS.md`.

---

## 1. Estado por fase

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 | Entorno + esqueleto del módulo | ✅ Hecho |
| 1 | Investigación de la fuente | ✅ Hecho (ver `DATOS.md`) |
| 2 | Modelo de datos (entidad `Contratacion` = orden de pedido) | ✅ Hecho |
| 3 | Ingesta: descarga ZIP + parseo + `sync` | ✅ Hecho y probado (6 meses cargados) |
| 4 | API de consulta | ✅ Endpoints funcionando con datos reales |
| 5 | Frontend (componente + dashboard) | ✅ Hecho — `SicopPanel.tsx` |
| 6 | Cruce por cantón ("scope completo") | ✅ Hecho — cobertura ~31 % |
| 7 | Documentación final + guion de exposición + tests | ✅ Hecho (falta el PR) |

Leyenda: ✅ hecho · 🟡 en curso · ⏳ pendiente

---

## 2. Bitácora

### 2026-09-09
- **Fase 0:** entorno arreglado (Node 23 / `ora`), `package.json` raíz con
  `pnpm run dev`, backend conectado a Supabase, esqueleto del módulo. Commit
  `5ebd4ea` en `feature/sicop` (fork `BrendaObando/transparencia-datos-cr`).
- **Fase 1 — investigación (cerrada):**
  - `sicop.go.cr` datos abiertos → error 500, no automatizable.
  - Portal Nacional CKAN → solo XLSX de ~90 MB, estáticos, y **es la fuente de
    la persona 4** → descartado.
  - **Decisión D1: Observatorio de Compra Pública** (ZIP mensual de CSV). Se
    cita SICOP como fuente primaria y el Observatorio como vía de acceso.
  - Bajada la muestra `202601.zip` (13 MB, 25 CSV). Documentadas columnas y
    rutas de cruce en `DATOS.md`.
  - **Decisión D2: se consume `OrdenPedido.csv`** (compras ejecutadas: monto,
    proveedor, fecha, descripción).
- **Fase 2:** entidad `Contratacion` → tabla `sicop_ordenes_pedido` reescrita
  con las columnas reales de `OrdenPedido.csv`.
- **Fase 3:** `sicop.service.ts` implementado:
  - Descarga los últimos 6 meses (`ultimosMeses`) o meses puntuales.
  - `axios` (arraybuffer) → `fflate.unzipSync` (solo `OrdenPedido.csv`) →
    `papaparse` (delimiter `;`) → normalización (montos, fechas) → dedupe por
    `NRO_ORDEN` → full refresh en lotes de 500.
  - Cron diario `@Cron(EVERY_DAY_AT_4AM)`; si el ZIP falla, se conserva la
    caché (manejo de errores de `AGENTS.md` §5).
  - Nuevas dependencias backend: `fflate`, `papaparse`, `@types/papaparse`.
  - **Prueba real:** `POST /api/sicop/sync?meses=202601` → leídas 44.475 filas,
    insertadas **11.248 órdenes** únicas.
- **Fase 4:** endpoints probados con datos reales:
  - `GET /api/sicop/status` → `{ registros: 11248 }`
  - `GET /api/sicop/proveedores?limit=8` → ranking por monto (top: INS Red de
    Servicios de Salud ₡6.306.787.770).
  - `GET /api/sicop/mensual` → enero 2026 = ₡49.434.205.487 en 11.248 órdenes.
- Verificado: `tsc` OK, `oxlint` OK, tests 5/5.

### 2026-09-10
- **Fase 5 — Frontend (cerrada):**
  - `frontend/src/api.ts`: tipos `SicopStatus` / `ProveedorRanking` / `GastoMensual`
    y funciones `api.sicop.status/proveedores/mensual`.
  - `frontend/src/components/SicopPanel.tsx`: panel de contratación pública con
    - 4 stat cards (órdenes, monto total del período, órdenes del período, período),
    - **buscador de proveedores** (form → `?q=`),
    - **ranking de proveedores por monto** (barras horizontales + tabla, ₡ formateado),
    - **evolución mensual del gasto** (área).
    Maneja estados loading / vacío / error.
  - `frontend/src/App.tsx`: nueva `<section>` "Contratación pública — SICOP"
    (datos nacionales, siempre visible). Subtítulo del header actualizado.
  - De paso: arreglados 2 errores de tipos pre-existentes de Recharts en
    `DelitosChart.tsx` / `TimelineChart.tsx` (bloqueaban `pnpm run build`), y un
    test de `App.test.tsx` que fallaba por el separador de miles según locale.
  - **Datos cargados para la demo:** `POST /api/sicop/sync` → 6 meses
    (abr–sep 2026), 286.242 filas → **79.052 órdenes**, ₡388.100 millones.
  - Verificado: `pnpm run build` OK (backend + frontend), tests 5/5 + 2/2,
    panel renderizando datos reales en el navegador.
- **Fase 6 — Cruce por cantón (cerrada):**
  - `sicop.service.ts`: la ingesta ahora también extrae `InstitucionesRegistradas.csv`
    + `Sistemas.csv` + `DetalleCarteles.csv` + `Contratos.csv` de cada ZIP,
    construye `NRO_SICOP → cédula institución` y `cédula → ZONA_GEO_INST → cantón`,
    y completa `institucionCedula` / `institucion` / `provincia` / `cantonCodigo`.
  - `contratacion.entity.ts`: nueva columna `institucion_cedula`.
  - Endpoints nuevos: `GET /api/sicop/instituciones`,
    `GET /api/sicop/canton/:codigo/instituciones`; `/status` ahora informa
    `conCanton`; `proveedores` y `mensual` aceptan `?canton=`.
  - `SicopPanel.tsx`: ahora recibe `canton` — al seleccionar un cantón el panel
    se acota a ese cantón (stat cards, ranking de proveedores, instituciones
    compradoras, evolución). `CantonSelector` pasa también el nombre.
  - **Prueba:** `sync` 6 meses → 79.052 órdenes, **24.803 con cantón (31,4 %)**.
    Ej.: Pococí → Municipalidad del Cantón de Pococí, 58 órdenes, ₡6.346 M.
  - Limitación documentada (ver `DATOS.md` §3): ubicación = sede de la
    institución, no lugar de entrega; cobertura parcial por la ventana de meses.
  - Verificado: `pnpm run build` OK, tests 5/5 + 2/2, panel por cantón OK.
- **Fase 7 — Documentación + tests (cerrada):**
  - `README.md` raíz: fila de SICOP en "Fuentes OSINT" (responsable = Brenda) y
    en "Fuentes de datos"; sección de endpoints SICOP con ejemplos
    request/response; primera carga de datos de SICOP; diagrama actualizado.
  - `backend/src/sicop/EXPOSICION.md`: guion de la exposición (problema, fuente,
    qué obtiene, procesamiento, demo paso a paso, retos y límites).
  - Refactor: funciones puras de parseo movidas a `sicop.parsers.ts`.
  - `sicop.parsers.spec.ts`: **15 tests** de `parseMonto`, `parseFecha`, `texto`,
    `normalizarTexto`, `partirZonaGeo`, `ultimosMeses`. Backend: **20 tests**.
  - Verificado: `pnpm run build` OK, tests 20/20 (back) + 2/2 (front), lint OK.

---

## 3. Decisiones

### Tomadas
| # | Decisión | Resultado |
|---|----------|-----------|
| D1 | Fuente / vía de acceso | Observatorio de Compra Pública (ZIP CSV mensual) |
| D2 | Qué se consume | `OrdenPedido.csv` (órdenes de pedido = gasto ejecutado) |
| D5 | Volumen inicial | Últimos 6 meses en el cron; carga puntual por `?meses=` |

### Pendientes
| # | Decisión | Opciones | Estado |
|---|----------|----------|--------|
| D3 | Cruce por cantón | Implementar el join `OrdenPedido→Contratos→Instituciones→ZONA_GEO_INST` (Fase 6) · o dejar panel nacional/por proveedor | A decidir según tiempo. El panel ya funciona sin esto. |
| D4 | Capacidad visible principal para la demo | (a) Buscador + ranking de proveedores + evolución del gasto · (b) + compras por institución/cantón | Recomiendo (a) para cerrar Fase 5 ya, y (b) si se hace Fase 6 |

---

## 4. Verificación contra la rúbrica

| Lo que se pide (`AGENTS.md` §2 / §6.2) | Estado | Evidencia |
|---|---|---|
| Fuente OSINT distinta, integrada por una persona | ✅ | SICOP, módulo `backend/src/sicop/` |
| Consumo **real** (API / archivo / descarga automatizable) | ✅ | Descarga ZIP del Observatorio + extracción CSV, probado con ene-2026 |
| **Transformación / normalización** | ✅ | Parseo CSV, normalización de montos/fechas, dedupe, mapeo a entidad |
| Capacidad **visible y demostrable** en el sistema | ✅ | `SicopPanel`: buscador + ranking de proveedores + evolución del gasto |
| Filtrable por cantón (opcional) y por fecha | ✅ | Filtro por fecha y por cantón (cobertura del cruce ~31 %) |
| Cron de refresco | ✅ | `@Cron(EVERY_DAY_AT_4AM)` |
| Manejo de errores → sirve último dato cacheado | ✅ | `try/catch` por mes y a nivel de refresco |
| Procedencia documentada (endpoint, formato, fecha) | ✅ | `DATOS.md` (falta trasladar al README raíz — Fase 7) |
| Sin tokens/credenciales en el repo | ✅ | SICOP/Observatorio no requieren login |
| README raíz: fila de fuente + endpoints + responsable | ✅ | Actualizado |
| Exposición técnica / guion de demo | ✅ | `EXPOSICION.md` |

**Conclusión:** las 7 fases están hechas y probadas. Todos los ítems de la
rúbrica que dependen de este módulo están cubiertos. Solo queda abrir el PR y,
opcionalmente, afinar detalles para la demo.

---

## 5. Pendientes concretos

1. **Abrir el PR** `feature/sicop` → repo del equipo (`AxelCastilloZ:main`).
2. Opcional para la demo:
   - decidir la carga histórica definitiva (ahora: 6 meses);
   - subir la cobertura del cruce por cantón descargando más meses de los
     CSV puente (`Contratos`/`DetalleCarteles`/`Sistemas` son chicos);
   - coordinar con Axel si se quiere una vista nacional de OIJ para que la
     pantalla inicial quede simétrica con la de SICOP.

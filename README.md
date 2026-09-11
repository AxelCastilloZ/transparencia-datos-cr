# 🇨🇷 Radar cantonal de señales públicas — Transparencia CR

Radar de señales verificables por cantón — sistema web que reúne seguridad,
contratación pública, padrón electoral y datos abiertos de Costa Rica,
con indicadores cantonales y contexto nacional PRONAE separado.

Proyecto universitario · 4 integrantes · Curso 2026

## Problema que resuelve

La ciudadanía necesita identificar qué señales públicas ameritan investigar en su cantón, con evidencia y límites claros. Los datos de Costa Rica provienen de múltiples portales
(Poder Judicial, SICOP, TSE, Datos Abiertos). Este sistema los integra en
un solo lugar, permitiendo que cualquier persona seleccione un cantón y vea
la ficha integrada, señales explicables y detalles de seguridad, contratación, padrón
electoral, además de contexto nacional de empleo y apoyo social.

No es un enlace ni un iframe a otra web — el backend descarga, procesa y
expone los datos como API propia.

## Fuentes OSINT y responsables

| # | Fuente | Responsable | Estado |
|---|--------|-------------|--------|
| 1 | **Poder Judicial / OIJ** — Estadísticas Policiales | Axel ([@AxelCastilloZ](https://github.com/AxelCastilloZ)) | ✅ Completo |
| 2 | **SICOP** — Contratación Pública | Brenda Obando ([@BrendaObando](https://github.com/BrendaObando)) | ✅ Completo |
| 3 | **TSE** — Padrón Electoral | Jose Daniel R ([@Jroman07](https://github.com/Jroman07)) | ✅ ZIP/TXT, snapshots y panel implementados |
| 4 | **Portal Nacional de Datos Abiertos** — PRONAE (MTSS) | Persona 4 | ✅ Implementado |

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
│  │ (OIJ) ✅  │ │  ✅      │ │  ✅  │ │ PRONAE ✅│ │
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
automáticamente (84 cantones). Para cargar los datos del OIJ:

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
| GET | `/api/cantones` | Lista los 84 cantones agrupables por provincia |
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

### TSE — Padrón electoral

Responsable: **Jose Daniel R (@Jroman07)**. Backend: axios descarga el ZIP
nacional oficial a una carpeta temporal; unzipper lee TXT por streaming,
valida integridad y agrega electores por cantón y distrito usando DISTELEC.TXT.
No guarda nombres, apellidos, cédulas, juntas ni caducidades. El ZIP temporal
se elimina en finally. Las claves incluyen fecha de corte y la transacción
con upsert conserva snapshots anteriores. Cron mensual: día 10 a las 04:00 CR.

Primera sincronización (espera a terminar; puede tardar varios minutos):

```bash
curl -X POST http://localhost:3000/api/tse/sync
```

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/tse/status` | Corte, snapshots y estado de ingesta |
| GET | `/api/tse/resumen` | Total nacional territorial |
| GET | `/api/tse/canton/:codigo` | Electores y porcentaje nacional |
| GET | `/api/tse/canton/:codigo/historico` | Snapshots disponibles |
| GET | `/api/tse/canton/:codigo/distritos` | Distritos electorales del último corte |
| POST | `/api/tse/sync` | Primera carga o actualización manual |

Ejemplo **sintético**, no cifras reales:

```bash
curl http://localhost:3000/api/tse/canton/612
```

```json
{"fuente":"https://www.tse.go.cr/descarga_padron.html","fechaCorte":"2026-08-31","cantonCodigo":"612","total":100,"totalNacional":1000,"porcentajeNacional":10,"alcance":"Electores inscritos en los 84 cantones; excluye electores en el extranjero."}
```

Sin carga previa: fechaCorte null y conteos cero; históricos y distritos vacíos.
Si falla la fuente, se conservan snapshots y sync devuelve 503 genérico.
La fecha de corte viene del portal oficial, no del día de ingesta. El ZIP
actual no permite reconstruir meses anteriores: la historia se acumula.
Si el portal devuelve CAPTCHA a axios, configurar juntos TSE_FECHA_CORTE y
TSE_ZIP_SHA256 en backend/.env tras verificar el corte y hash del ZIP oficial;
ver el procedimiento en la documentación TSE. Un cambio de ZIP hace fallar
la carga hasta actualizar esa configuración, conservando los snapshots.

**PADRON.TXT no contiene sexo, nacimiento ni edad.** La integración del reporte
estadístico agregado por sexo queda para una segunda fase; no se simula.
Padrón significa electores inscritos, no participación, abstencionismo ni votos.
El porcentaje nacional excluye electores en el extranjero. Los distritos son
electorales, no necesariamente administrativos. Más detalles en
[documentación TSE](backend/src/tse/README.md) y [diccionario](backend/src/tse/DATOS.md).

### Datos Abiertos — PRONAE (MTSS) ✅

Ya implementado: descarga XLSX oficial, transforma beneficiarios por modalidad
y año (2021–2024), persiste y sirve un panel nacional independiente del cantón.
Cron mensual. Primera carga: `POST /api/datos-abiertos/sync`.
Consultas: `GET /api/datos-abiertos/status`, `/api/datos-abiertos/pronae?anio=2024`,
`/api/datos-abiertos/pronae/anual` y `/api/datos-abiertos/pronae/resumen`.

## Fuentes de datos

| Fuente | URL | Formato | Frecuencia |
|--------|-----|---------|------------|
| OIJ — Estadísticas Policiales | [datosabiertospj.poder-judicial.go.cr](https://datosabiertospj.poder-judicial.go.cr/dataset/estadisticas-policiales) | CSV (sin headers, 11 columnas) | Mensual |
| SICOP — Contratación Pública | Fuente: [SICOP](https://www.sicop.go.cr/moduloPcont/pcont/rp/CE_MOD_DATOSABIERTOSVIEW.jsp) · Vía de acceso: [Observatorio de Compra Pública](https://www.observatoriocomprapublica.go.cr/descargas-sicop/) (`.../Zip/AAAAMM.zip`) | ZIP mensual de CSV (`;`, UTF-8) | Diaria 08:00 (~24 h desfase) |
| TSE — Padrón Electoral | [tse.go.cr/descarga_padron.html](https://www.tse.go.cr/descarga_padron.html) | ZIP (TXT Latin-1) | Mensual |
| Datos Abiertos CR — PRONAE (MTSS) | [datosabiertos.gob.go.cr](https://datosabiertos.gob.go.cr/) | XLSX, beneficiarios por modalidad y año (2021–2024) | Cron mensual |

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
  Solo conteos agregados por cantón y distrito electoral.

## Radar cantonal de señales públicas

### Propósito y usuarios

La pregunta central es: **¿Qué señales públicas presenta este cantón y cuáles
merecen una investigación más profunda?** El objetivo general es reunir evidencia
verificable para periodistas, organizaciones comunales, estudiantes, investigadores
y ciudadanía, con procedencia, cobertura y límites visibles. No clasifica cantones
como peligrosos, corruptos, buenos o malos ni emite acusaciones.

### Arquitectura y flujo

`React → GET /api/radar/canton/:codigo → RadarService → PostgreSQL existente`.
El nuevo módulo `backend/src/radar/` no tiene cron, descargas, tablas ni ingestas.
Consulta agregados OIJ y SICOP, el último snapshot TSE y el cuadro nacional PRONAE.
Las consultas de cada dimensión fallan de forma independiente: una falla devuelve
esa dimensión no disponible y conserva las demás. No envía detalles de errores SQL.
Los cron e integraciones originales continúan siendo responsables de la caché.

Seleccionar cantón → elegir período → ficha integrada → señales con evidencia y
acordeón de metodología → comparación descriptiva → detalles desplegables OIJ,
SICOP y TSE → contexto nacional PRONAE → metodología y referencias oficiales.
Los detalles OIJ/SICOP reciben el período efectivo. TSE usa siempre el último corte.
Los enlaces de procedencia no reemplazan la integración: el frontend consume solo
la API propia. No hay puntuación única de riesgo.

### Período y cobertura

Por defecto se toman seis meses completos terminando en el último mes cerrado
observado en OIJ (SICOP si OIJ no tiene fechas). El mes terminal se excluye si la
fecha máxima no alcanza su último día; el mes calendario actual nunca participa
en variaciones. Sin fechas en ambas fuentes se presenta una ventana de seis meses
calendario cerrados con indicadores no disponibles. `desde` y `hasta` son inclusivos,
independientes y opcionales; una fecha omitida usa el valor por defecto. Rangos
explícitos pueden contener meses parciales: sus registros se muestran, pero esos
meses no se usan en la comparación mensual. Fechas imposibles, formatos distintos
de YYYY-MM-DD, fechas fuera de 1900–2100 o rangos inversos devuelven 400; cantón
bien formado pero inexistente, 404.

**Límite de cobertura actual:** OIJ y SICOP no persisten manifiestos de ingesta ni
fechas de sincronización. El radar usa un criterio observable: mínimo anterior o
igual al inicio solicitado, máximo posterior o igual al final, y al menos un
registro nacional en cada mes del intervalo. Esto no certifica integridad de la
fuente ni cobertura uniforme por cantón. Se informa como aproximación y las fechas
de sincronización desconocidas son `null`, nunca la fecha de consulta.

No se inventan ceros cuando una fuente está vacía o falló. OIJ sin registros del
cantón devuelve `null`; un mes vacío dentro de una serie cantonal observada y con
cobertura nacional se interpreta como cero **registros en caché**, sujeto a ese
límite. SICOP puede devolver cero órdenes territorialmente identificadas si hay
órdenes nacionales en el período: no significa cero contratación del cantón.
El conteo parcial OIJ puede mostrarse, pero su razón y comparación se suprimen si
el período no está cubierto. El último snapshot TSE puede no coincidir con las
fechas analizadas; el corte se muestra expresamente.

### Fórmulas y comparaciones

- Razón de incidentes por cada 1.000 electores = incidentes del período / electores
  inscritos del último corte × 1.000. Denominador ausente, cero o negativo: `null`.
  No es tasa poblacional, riesgo individual ni probabilidad de ser víctima.
- Variación mensual = (último mes completo − mes completo anterior) / anterior ×
  100. Solo meses consecutivos cubiertos; anterior cero o historia insuficiente:
  `null` y explicación.
- Mediana OIJ: mínimo cinco cantones con registros observados, denominador positivo
  y cobertura temporal del período. Cantones sin registros observados se excluyen,
  no se imputan como cero. Mediana par: media de los dos valores centrales.
  Percentil empírico = porcentaje de razones comparables menores o iguales a la
  del cantón. Es descriptivo, no un ranking de peligrosidad.
- Cobertura SICOP = órdenes nacionales del período con cantón identificado /
  órdenes nacionales del período × 100. Es una cobertura **nacional**; no se conoce
  el denominador de órdenes que realmente corresponden a cada cantón.
- Medianas SICOP por moneda: mínimo cinco cantones con órdenes en esa moneda,
  monto conocido no negativo en todas ellas, cobertura temporal y cobertura
  territorial nacional de al menos 80%. No se incorporan ceros de cantones ausentes.
- Concentración: monto del proveedor principal o de los cinco principales / monto
  comparable × 100, por moneda. Requiere monto y proveedor identificado en todas
  las órdenes de esa moneda. Identidad por identificador de proveedor, con nombre
  como respaldo; las identidades no se exponen en la ficha radar.

### Monedas: corrección del defecto anterior

La auditoría detectó `SUM(monto_orden)` de distintas monedas presentado como CRC.
El radar ahora agrupa `montoOrden` por `moneda` normalizada, sin convertir ni sumar
monedas. `montoUsd` no se usa: no se presume cobertura suficiente de esa conversión.
Montos nulos o negativos no se suman; una suma parcial se acompaña de su conteo de
órdenes con monto. Moneda ausente queda fuera de indicadores monetarios. La
concentración y las medianas no usan sumas monetarias incompletas.

Los endpoints existentes de rankings y gasto mensual SICOP mantienen sus rutas y
campos, pero **ahora incluyen exclusivamente CRC con monto conocido no negativo**.
Esta corrección cambia el significado de sus conteos a órdenes elegibles en CRC;
los listados de órdenes y `/status` mantienen su alcance original. El detalle
visual lo indica explícitamente y muestra las otras monedas por separado en el
radar. Los ejemplos monetarios anteriores deben interpretarse como CRC; las cifras
ilustrativas no son un snapshot validado de la base actual.

### Señales reproducibles

Los umbrales exploratorios están centralizados en `radar.math.ts` (`REGLAS`); no son
umbrales oficiales ni evidencia de irregularidades. Se muestran al abrir cada
señal, junto con sus fuentes, límites y pregunta sugerida.

| Señal | Regla publicada |
|---|---|
| Aumento de incidentes | Dos meses completos consecutivos; anterior ≥20, aumento absoluto ≥20 y relativo ≥25% |
| Razón sobre mediana | Razón mayor que mediana de al menos cinco cantones comparables; nivel informativo |
| Concentración de proveedores | Al menos 20 órdenes por moneda; principal ≥50% o top cinco ≥80% con al menos seis proveedores; montos e identidades completos |
| Cambio mensual atípico de órdenes | Al menos seis meses previos completos y consecutivos; último > mediana + 3 × 1,4826 × MAD, aumento absoluto ≥20 órdenes; MAD cero no activa señal |
| Concentración electoral | Tres principales distritos ≥60% del padrón; al menos cuatro distritos y suma distrital igual al total cantonal; informativa |
| Cobertura SICOP insuficiente | Cobertura temporal insuficiente, desconocida o menos de 80% de órdenes nacionales geolocalizadas; informativa |

MAD es la mediana de las distancias absolutas respecto de la mediana histórica.
El cambio atípico se aplica a **órdenes**, no a gasto mezclado. La ventana por
defecto de seis meses no permite esta señal: se necesita elegir al menos siete
meses completos con datos. No se infiere una anomalía cuando falta historia.
La concentración describe solo contratación observada aunque la geolocalización
sea parcial; se presenta junto con la señal de cobertura, sin extrapolarla.

### Relación y limitaciones de las cuatro fuentes

OIJ y TSE participan en una razón descriptiva cantonal; SICOP aporta contratación
localizable por **sede de la institución compradora**, no necesariamente lugar de
entrega. PRONAE queda en «Contexto nacional de empleo y apoyo social», con evolución
anual, total oficial más reciente y modalidad principal; no se suma el total con
las modalidades. Celdas desconocidas permanecen nulas.

- OIJ contiene incidentes registrados, no todos los delitos ocurridos.
- TSE representa electores inscritos, no población total, votos ni participación.
  Los distritos electorales no siempre equivalen a distritos administrativos.
- SICOP tiene geolocalización parcial y hasta 24 h de desfase; el reporte de
  proveedores puede excluir registros de los últimos siete días.
- PRONAE es nacional y corresponde a 2021–2024. No se atribuyen beneficiarios al
  cantón ni se alinea artificialmente con 2026.
- Correlación o coincidencia temporal no implica causalidad. PRONAE no participa
  en razones, comparaciones ni señales cantonales.
- La ficha lee la caché existente aun cuando los portales externos no respondan.
  Una base de datos totalmente inaccesible impide resolver el cantón. El radar no
  subsana las limitaciones de integridad de las ingestas originales.

### API del radar

```bash
curl 'http://localhost:3000/api/radar/canton/101?desde=2026-03-01&hasta=2026-08-31'
```

Respuesta **abreviada y sintética** (no cifras reales):

```json
{
  "canton": { "codigo": "101", "nombre": "San José", "provincia": "San José" },
  "periodo": { "desde": "2026-03-01", "hasta": "2026-08-31", "mesesCompletos": 6 },
  "seguridad": { "incidentes": 50, "incidentesPorMilElectores": 5, "variacionMensualPorcentaje": null, "coberturaSuficiente": true },
  "electorado": { "fechaCorte": "2026-08-31", "electores": 10000 },
  "contratacion": { "ordenes": 30, "montosPorMoneda": [ { "moneda": "CRC", "monto": 100, "ordenes": 20, "ordenesConMonto": 20, "principal": 50, "topCinco": 100 }, { "moneda": "USD", "monto": 500, "ordenes": 10, "ordenesConMonto": 10, "principal": 100, "topCinco": 100 } ], "coberturaGeografica": 40, "coberturaSuficiente": false },
  "comparacion": { "cantonesComparables": 4, "medianaIncidentesPorMilElectores": null, "posicionRelativaIncidentes": null, "medianasSicopPorMoneda": [] },
  "contextoNacional": { "pronae": { "anioMasReciente": 2024, "totalBeneficiarios": 100, "modalidadPrincipal": "Obra comunal", "evolucion": [ { "anio": 2024, "total": 100 } ] } },
  "senales": [],
  "metadatos": { "fuentes": [], "advertencias": [] }
}
```

El contrato completo está en `backend/src/radar/radar.types.ts`, compartido por
importación de tipos con el frontend. La respuesta real siempre incluye cuatro
fuentes con estado, referencia, alcance, corte, sincronización (cuando existe),
cantidad usada y advertencias; cada señal lleva evidencia, metodología, límites y
pregunta sugerida. No se añadió endpoint separado de comparación: las medianas
vienen en la ficha para usar exactamente el mismo período y conjunto consultado.

### Verificación local

```bash
pnpm install --frozen-lockfile  # solo si faltan dependencias
pnpm --dir backend test
pnpm --dir frontend test --maxWorkers=1
pnpm build
pnpm --dir backend lint
pnpm --dir frontend lint
```

Las pruebas del radar usan datos sintéticos y consultas mockeadas: no necesitan
credenciales, no disparan ingestas ni modifican Supabase. Cubren fórmulas, fechas,
meses incompletos, monedas, señales y no señales, denominadores inválidos, datos
vacíos, respuestas parciales, cambios de selección, metodología y estados de UI.
El linter puede reportar advertencias preexistentes en OIJ y el panel PRONAE;
Vite puede advertir por el tamaño del paquete de gráficas.

### Guion corto de demostración

1. Seleccionar un cantón y explicar qué período eligió el preset y por qué.
2. Leer incidentes, corte TSE y razón por electores; distinguir electores de población.
3. Contrastar montos CRC/USD y explicar cobertura territorial SICOP nacional.
4. Abrir una señal y leer evidencia, fórmula y pregunta de seguimiento. Si no
   aparece, explicar qué requisito falta; no simular señales para la demo.
5. Comparar con la mediana, abrir detalles de fuente y cambiar el período.
6. Mostrar PRONAE nacional 2021–2024 y cerrar con las limitaciones de cobertura y
   la advertencia de que coincidencia temporal no implica causalidad.

Segunda fase posible: manifiestos transaccionales de ingesta por período/cantón,
con fechas de sincronización y cobertura verificable; luego historial suficiente
para comparaciones más robustas y paginación/caché de agregados si crece el volumen.

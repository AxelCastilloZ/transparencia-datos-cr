# AGENTS.md — Transparencia CR

Este archivo es la fuente de verdad del proyecto. Cualquier agente de IA (Claude
Code, u otro) que trabaje en cualquier parte de este repo debe leer esto primero.
No inventes convenciones nuevas si ya están definidas aquí.

## 1. Qué es este proyecto

Trabajo en equipo (4 integrantes) para un curso universitario, vale 5% de la
nota final. Consiste en un sistema web que consume, procesa y presenta datos
reales de fuentes OSINT públicas de Costa Rica — no basta con enlazar o
embeber otra página, tiene que haber integración real (API, web service,
CSV/Excel/ZIP parseado) del lado del backend.

**Regla de oro, no negociable:** cero "integración de pantalla". Nada de
iframes, nada de links a otra web, nada de scraping visual. El backend
descarga/consulta la fuente, la transforma, y expone su propia API. El
frontend consume ÚNICAMENTE esa API propia, nunca las fuentes externas
directamente.

**Tema del proyecto:** Explorador de Transparencia por Cantón — cruza
seguridad, contratación pública, padrón electoral y datos abiertos
generales de Costa Rica, todos indexados por cantón, para que un usuario
pueda seleccionar un cantón y ver las cuatro dimensiones a la vez.

## 2. Cómo se evalúa (para que cualquier agente entienda qué se premia)

- 2.0% — integración y consumo real de fuentes OSINT, evaluado individualmente
  por integrante (cada quien es dueño de su fuente y debe poder explicarla).
- 1.5% — sistema web funcional e interfaz gráfica.
- 1.0% — exposición técnica y demo en vivo.
- 0.5% — calidad técnica, arquitectura, GitHub y README.

Regla de equipo: 4 integrantes = 4 fuentes distintas, cada una integrada
funcionalmente por una persona distinta.

## 3. Stack y estructura del monorepo

- **Gestor de paquetes:** pnpm (workspaces). No usar npm ni yarn dentro de
  este repo — mezclar lockfiles rompe el workspace.
- **Backend:** NestJS + TypeORM + PostgreSQL (Supabase).
- **Frontend:** React + Vite + TypeScript + Tailwind CSS.
- **Base de datos:** un único proyecto Supabase compartido llamado
  `transparencia-cr` (Postgres). No cada integrante con su propia base — se
  explica el porqué en la sección 5.

```
/
├── AGENTS.md              # este archivo
├── CLAUDE.md               # importa AGENTS.md, para Claude Code
├── README.md                # documentación pública del proyecto (rúbrica)
├── pnpm-workspace.yaml
├── package.json              # scripts raíz (dev, build, etc.)
├── .env.example
├── .gitignore
├── backend/                   # NestJS
│   └── src/
│       ├── judicial/           # fuente: Poder Judicial / OIJ
│       ├── sicop/                # fuente: SICOP
│       ├── tse/                   # fuente: TSE - Padrón Electoral
│       ├── datos-abiertos/         # fuente: Portal Nacional de Datos Abiertos
│       └── cantones/                # tabla/dimensión compartida
└── frontend/                          # React + Vite
    └── src/
```

## 4. Base de datos — decisiones y por qué

- **Un solo proyecto Supabase compartido**, no uno por integrante. Con bases
  separadas no se pueden hacer JOINs entre fuentes (perdemos el cruce por
  cantón, que es el corazón del proyecto), y si la base de un integrante se
  pausa (Supabase free tier pausa proyectos tras 1 semana sin actividad), se
  cae el sistema completo para toda la demo.
- Conexión vía **Session pooler** de Supabase (IPv4), no "Direct connection"
  (IPv6) — la mayoría de redes de desarrollo son IPv4 y la conexión directa
  falla en silencio.
- La connection string vive en `DATABASE_URL` dentro de `.env`, nunca en el
  repo. Se comparte por canal privado del equipo.
- Cada fuente tiene su(s) propia(s) tabla(s), más una tabla compartida
  `cantones` (código de provincia/cantón + nombre) que todas las demás tablas
  referencian por clave foránea. Esa tabla es la que permite el cruce.
  **La tabla `cantones` ya está implementada** — se llena automáticamente con
  84 cantones al arrancar el backend
  (`backend/src/cantones/`). No hay que crearla ni llenarla manualmente.
- **Privacidad — importante para el módulo de TSE:** el padrón electoral
  crudo contiene datos personales por elector (nombre, cédula). Nunca se
  almacenan filas a nivel de persona en nuestra base. El proceso de
  ingesta debe agregar (contar electores por cantón y distrito electoral) y
  descartar el detalle individual antes de guardar.

## 5. Patrón que sigue cada módulo de fuente (para las 4 personas)

Todos los módulos de `backend/src/<fuente>/` siguen la misma receta, así
cualquier agente sabe qué generar sin que se lo repitan:

1. **`*.service.ts`** — descarga el archivo/consulta la API externa, la
   parsea/normaliza, y guarda en las tablas propias vía TypeORM.
2. **`*.entity.ts`** — una o más entidades TypeORM, con relación a `Canton`
   donde aplique.
3. **`*.controller.ts`** — expone endpoints REST de solo lectura para el
   frontend, filtrables al menos por `canton` y opcionalmente por rango de
   fechas.
4. **Cron job** con `@nestjs/schedule` — refresca los datos periódicamente.
   La frecuencia depende de qué tan seguido publica la fuente (ver detalle
   por fuente abajo); no hace falta tiempo real en ninguna de las cuatro.
5. **Manejo de errores:** si la fuente externa falla o no responde, el
   endpoint debe seguir sirviendo el último dato cacheado en la base, no
   caerse. Esto es justo lo que el enunciado pide al recomendar arquitectura
   backend/worker: evita depender de que la fuente externa esté viva en el
   momento de la demo.

## 6. Las cuatro fuentes

### 6.1 Poder Judicial / OIJ — Estadísticas Policiales ✅ COMPLETADO

- **Responsable:** Axel (@AxelCastilloZ).
- **Estado:** implementado y funcionando. ~103,000 registros (2024–2026).
- **Sin login ni token.** Descarga pública directa.
- Portal oficial: `https://datosabiertospj.poder-judicial.go.cr/dataset/`
  (buscar "Estadísticas Policiales", formatos CSV/XLSX/XML).
- CSVs reales descargados de:
  `https://pjcrdatosabiertos.blob.core.windows.net/datosabiertos/PJCROD_POLICIALES_V1/PJCROD_POLICIALES_V1-{año}.csv`
- Formato: CSV sin headers, 11 columnas (delito, subdelito, fecha,
  tipoVictima, subTipoVictima, grupoEdad, sexo, nacionalidad, provincia,
  cantón, distrito). Se parsea directamente con split, sin necesidad de `xlsx`.
- Normalizado a: tipo de delito (delito + subdelito), fecha, provincia,
  cantón (FK a tabla cantones), distrito, sexo/nacionalidad/edad de víctima.
- Cron: semanal (`@Cron(CronExpression.EVERY_WEEK)`).
- Endpoints: `/api/judicial/canton/:codigo`, `.../resumen`, `.../mensual`,
  `/api/judicial/status`, `POST /api/judicial/sync`.

### 6.2 SICOP — Contratación Pública

- **Responsable:** persona 2.
- **Sin login.** Módulo de descarga: 
  `https://www.sicop.go.cr/moduloPcont/pcont/rp/CE_MOD_DATOSABIERTOSVIEW.jsp`
- Permite filtrar por fecha, número de procedimiento, institución,
  provincia/cantón, y exportar directo en **JSON** (preferido — evita tener
  que parsear Excel), CSV o Excel.
- Caveat a documentar en el README: los datos tienen hasta 24h de desfase
  respecto al sistema en vivo, y el reporte de proveedores no incluye a los
  registrados en los últimos 7 días.
- Normalizar a: número de procedimiento, institución, proveedor, monto,
  provincia/cantón, fecha, estado.
- Frecuencia de cron sugerida: diaria.

### 6.3 TSE — Padrón Electoral

- **Responsable:** Jose Daniel R (@Jroman07).
- **Sin login.** Descarga: `https://www.tse.go.cr/descarga_padron.html`
- ZIP mensual con `PADRON.TXT` (un elector por fila — **contiene datos
  personales, ver sección 4**), `DISTELEC.TXT` (distritos electorales) y
  `LEAME.TXT` (documentación del formato). Descargable completo, por
  provincia, o por cantón.
- Codificación verificada: Windows-1252/Latin-1, no UTF-8.
- Normalizar a: conteo de electores agregado por cantón y distrito electoral. **Nunca guardar nombre ni cédula.**
- Frecuencia de cron sugerida: mensual (coincide con la publicación).
- Primera fase implementada en `backend/src/tse/`: conteos por cantón y distrito,
  streaming ZIP/TXT y snapshots con fecha de corte. PADRON.TXT no contiene sexo
  ni edad. Reportes estadísticos agregados por sexo: segunda fase, sin inferencias.

### 6.4 Portal Nacional de Datos Abiertos

- **Estado: implementado.** Dataset MTSS: personas beneficiarias del PRONAE
  por modalidad, 2021–2024. Descarga XLSX, API propia y panel nacional sin cantón.
  Cron mensual. Las pistas siguientes documentan la selección inicial.

- **Responsable:** persona 4.
- **Sin login** para consumir datasets públicos. Portal CKAN:
  `https://datosabiertos.gob.go.cr/`
- Importante: el portal es disparejo — algunas categorías tienen muy pocos
  datasets o datos viejos. Antes de programar nada, entrar al portal y
  elegir un dataset específico verificando: formato CSV/XLSX/JSON (no
  PDF/HTML), fecha de "última actualización" reciente, y descarga que sí
  funcione y traiga columnas reales.
- Pistas de datasets candidatos ya identificados: la sección PIDA
  (`datosabiertos.gob.go.cr/pages/pida`, catálogo curado de datos de
  transparencia/anticorrupción — encaja bien temáticamente con SICOP y
  OIJ), o el listado mensual de PyMEs activas del MEIC.
- Ideal si el dataset elegido tiene columna de provincia/cantón (así se
  conecta al mismo cruce geográfico); si no la tiene, funciona igual como
  panel independiente — no es un requisito, solo un plus.
- Frecuencia de cron: según la periodicidad de publicación del dataset
  elegido (documentarla en el README).

## 7. Frontend

- Consume exclusivamente los endpoints propios del backend NestJS. Jamás
  llama a las fuentes externas directamente (evita CORS y hace el sistema
  resiliente a caídas externas).
- Eje central de navegación: **selector de cantón**, que trae datos de las
  cuatro fuentes a la vez para ese cantón.
- Gráficas con Recharts (series de tiempo, comparativas).

## 8. Flujo de Git

- Monorepo con pnpm workspaces, un solo repositorio.
- Una rama por fuente/persona: `feature/oij`, `feature/sicop`, `feature/tse`,
  `feature/datos-abiertos`.
- Pull Request a `main` antes de mergear, aunque sea autoaprobado en un
  proyecto de 4 personas — deja rastro de quién hizo qué (relevante para el
  2% individualizado).
- `.env` nunca se commitea. `.env.example` sí, vacío, como plantilla.

## 9. Checklist del README final (lo que pide la rúbrica)

- [x] Explicación del problema y el tema elegido.
- [x] Lista de las 4 fuentes OSINT y qué integrante hizo cada una.
- [x] Diagrama o descripción de la arquitectura (backend/worker + API +
      frontend).
- [x] Cómo correr el proyecto localmente (pnpm install, variables de entorno
      necesarias, comandos de arranque).
- [x] Cómo consumir cada endpoint (ejemplos de request/response).
- [x] Confirmar que no hay tokens/credenciales reales subidas al repo.

> **Nota:** el README ya cubre estos puntos para el módulo OIJ. Cada
> integrante debe agregar sus endpoints y ejemplos cuando complete su módulo.

## 10. Radar cantonal — convenciones metodológicas permanentes

- `backend/src/radar/` agrega tablas existentes, sin nuevas ingestas ni copias de
  registros. Su contrato tipado se comparte con el frontend. El radar es la
  experiencia principal; los paneles de fuente quedan como detalle.
- PRONAE es exclusivamente contexto nacional 2021–2024: no tiene cantón ni
  participa en razones, comparaciones o señales cantonales. Esto precisa el
  alcance del tema descrito en la sección 1.
- Electores inscritos no son población total. La razón OIJ/TSE se llama «razón
  de incidentes por cada 1.000 electores», nunca tasa poblacional o riesgo.
- SICOP: no mezclar monedas. Radar agrupa por moneda original; los rankings y
  series monetarias heredados se limitan a CRC con monto conocido no negativo.
- Señales deterministas con evidencia, metodología, procedencia y límites;
  reglas centralizadas en `radar.math.ts`. No hay puntuación única de riesgo.
- Fechas desconocidas e indicadores sin cobertura usan null. La cobertura
  temporal observada es un proxy, no certifica integridad de ingesta. Meses
  incompletos no participan en variaciones mensuales.
- Cambios metodológicos requieren pruebas y actualización del README. El radar
  no atribuye causalidad, corrupción ni peligrosidad a ningún cantón.

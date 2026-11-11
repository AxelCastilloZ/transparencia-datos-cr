# AGENTS.md — Transparencia CR

Este archivo es la fuente de verdad del proyecto. Cualquier agente de IA (Claude Code, Cursor u otro) o desarrollador que trabaje en este repo debe leer esto primero. No inventes convenciones nuevas si ya están definidas aquí.

---

## 1. Qué es este proyecto
Trabajo en equipo (4 integrantes) para un curso universitario. Consiste en un sistema web que consume, procesa y presenta datos reales de fuentes OSINT públicas de Costa Rica — no basta con enlazar o embeber otra página, tiene que haber integración real (API, web service, CSV/Excel/ZIP parseado) del lado del backend.

**Regla de oro, no negociable:** Cero "integración de pantalla". Nada de iframes, nada de links a otra web, nada de scraping visual. El backend descarga/consulta la fuente, la transforma, la persiste y expone su propia API. El frontend consume ÚNICAMENTE esa API propia, nunca las fuentes externas directamente.

**Tema del proyecto:** Explorador de Transparencia y Radar Cantonal — cruza seguridad, contratación pública, padrón electoral y datos abiertos generales de Costa Rica, todos indexados por cantón, para que un usuario pueda seleccionar un cantón y ver las cuatro dimensiones a la vez.

---

## 2. Reglas Estrictas de Seguridad, Cumplimiento y Privacidad
- 🚫 **PROHIBIDO DATOS SENSIBLES DEL TSE:** En el módulo `tse/`, bajo NINGUNA circunstancia se deben procesar o guardar nombres, apellidos, números de cédula ni direcciones exactas de personas. Únicamente se persisten y sirven conteos agregados por cantón y distrito electoral. El archivo ZIP/TXT temporal procesado en memoria debe eliminarse en el bloque `finally`.
- 🚫 **NO HARDCODE:** Nunca incluir tokens, contraseñas, URLs de BD con credenciales (`DATABASE_URL`) ni llaves en el código fuente. La connection string vive en `DATABASE_URL` dentro de `.env`, nunca en el repo. Se comparte por canal privado del equipo.
- 💰 **MANEJO DE MONEDAS EN SICOP:** SICOP maneja órdenes en CRC y USD. Queda strictly prohibido sumar o promediar montos en monedas distintas. Cada moneda debe procesarse y mostrarse por separado.
- ⚠️ **PRIVACIDAD Y SEÑALES OSINT:** No construir buscadores ni perfiles individuales de personas. Respetar la Ley de Protección de la Persona frente al Tratamiento de sus Datos Personales (Ley 8968). Las señales del Radar son deterministas y descriptivas; no asignan puntuaciones únicas de riesgo ni acusan a ningún cantón de corrupción o peligrosidad.

---

## 3. Stack Tecnológico, Monorepo y Comandos

- **Gestor de paquetes:** `pnpm` (workspaces). No usar `npm` ni `yarn` dentro de este repo — mezclar lockfiles rompe el workspace.
- **Backend:** NestJS + TypeORM + PostgreSQL (Supabase).
- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Recharts.
- **Base de datos:** Un único proyecto Supabase compartido llamado `transparencia-cr` (Postgres).

### Estructura del Monorepo
```text
/
├── agents.md               # Este archivo (fuente de verdad)
├── CLAUDE.md               # Importa agents.md, para Claude Code
├── README.md               # Documentación pública y rúbrica del proyecto
├── pnpm-workspace.yaml
├── package.json            # Scripts raíz (dev, build, etc.)
├── .env.example
├── .gitignore
├── backend/                # NestJS
│   └── src/
│       ├── judicial/       # OIJ (Axel)
│       ├── sicop/          # SICOP (Brenda)
│       ├── tse/            # TSE (Jose Daniel)
│       ├── datos-abiertos/ # PRONAE / MTSS (Persona 4)
│       ├── cantones/       # Tabla/dimensión compartida (84 cantones)
│       └── radar/          # Módulo de agregación y señales
└── frontend/               # React + Vite
    └── src/
Comandos de Verificación y Calidad (Ejecutar antes de confirmar PR)
Bash
# Instalación de dependencias
pnpm install

# Compilación y Linter
pnpm --dir backend lint
pnpm --dir frontend lint
pnpm build

# Pruebas Unitarias
pnpm --dir backend test
pnpm --dir frontend test --maxWorkers=1
4. Base de Datos — Decisiones Técnicas y Razonamiento
Un solo proyecto Supabase compartido, no uno por integrante: Con bases separadas no se pueden hacer JOINs entre fuentes (perdemos el cruce por cantón, que es el corazón del proyecto), y si la base de un integrante se pausa (Supabase free tier pausa proyectos tras 1 semana sin actividad), se cae el sistema completo para toda la demo.

Conexión vía Session pooler de Supabase (IPv4), no "Direct connection" (IPv6): La mayoría de redes de desarrollo son IPv4 y la conexión directa IPv6 falla en silencio.

Tabla compartida cantones: Contiene código de provincia/cantón + nombre, y todas las demás tablas la referencian por clave foránea (FK). Esa tabla es la que permite el cruce. Ya está implementada y se llena automáticamente con 84 cantones al arrancar el backend (backend/src/cantones/). No hay que crearla ni llenarla manualmente.

5. Patrón Módulo Backend (backend/src/<fuente>/)
Todos los módulos de backend siguen la misma receta:

*.service.ts — Descarga el archivo/consulta la API externa, la parsea/normaliza, y guarda en las tablas propias vía TypeORM.

*.entity.ts — Una o más entidades TypeORM, con relación a Canton donde aplique.

*.controller.ts — Expone endpoints REST de solo lectura para el frontend, filtrables al menos por cantón y opcionalmente por rango de fechas.

Cron job con @nestjs/schedule — Refresca los datos periódicamente según la fuente.

Manejo de errores: Si la fuente externa falla o no responde, el endpoint debe seguir sirviendo el último dato cacheado en la base, no caerse (arquitectura backend/worker resiliente).

6. Estado y Detalle de las Cuatro Fuentes OSINT
6.1 Poder Judicial / OIJ — Estadísticas Policiales ✅
Responsable: Axel (@AxelCastilloZ).

Estado: Implementado (~103,000 registros 2024–2026).

Consumo: CSV sin headers, 11 columnas (delito, subdelito, fecha, tipoVictima, subTipoVictima, grupoEdad, sexo, nacionalidad, provincia, cantón, distrito). Parsea directo con split.

Cron: Semanal (EVERY_WEEK).

6.2 SICOP — Contratación Pública ✅
Responsable: Brenda Obando.

Consumo: Ingesta de ZIPs mensuales del Observatorio de Compra Pública (Zip/AAAAMM.zip).

Caveat a documentar en README: Los datos tienen hasta 24h de desfase respecto al sistema en vivo, y el reporte de proveedores no incluye a los registrados en los últimos 7 días.

Normalización: Número de procedimiento, institución, proveedor, monto, cantón, fecha, estado.

Cron: Diario.

6.3 TSE — Padrón Electoral ✅
Responsable: Jose Daniel R (@Jroman07).

Consumo: ZIP mensual con PADRON.TXT, DISTELEC.TXT y LEAME.TXT.

Codificación verificada: Windows-1252/Latin-1 (no UTF-8). Streaming ZIP/TXT con unzipper.

Normalización: Conteos agregados por cantón y distrito. NUNCA guardar nombre ni cédula.

Cron: Mensual (día 10 a las 04:00 CR).

6.4 Portal Nacional de Datos Abiertos — PRONAE (MTSS) ✅
Responsable: Persona 4.

Consumo: Dataset MTSS (beneficiarios del PRONAE por modalidad, 2021–2024). Descarga XLSX oficial.

Alcance: Sirve un panel nacional independiente del cantón (no tiene columna de cantón ni participa en razones del Radar).

Cron: Mensual.

7. Radar Cantonal — Convenciones Metodológicas Permanentes
backend/src/radar/ agrega tablas existentes, sin nuevas ingestas ni copias de registros.

PRONAE es exclusivamente contexto nacional 2021–2024: no tiene cantón ni participa en razones, comparaciones o señales cantonales.

Electores inscritos no son población total: La razón OIJ/TSE se llama «razón de incidentes por cada 1.000 electores», nunca tasa poblacional o riesgo.

SICOP Multimoneda: No mezclar monedas. Radar agrupa por moneda original; los rankings monetarios heredados se limitan a CRC con monto conocido no negativo.

Señales deterministas: Con evidencia, metodología, procedencia y límites; reglas centralizadas en radar.math.ts. No hay puntuación única de riesgo.

Fechas desconocidas e indicadores sin cobertura: Usan null. Meses incompletos no participan en variaciones mensuales.

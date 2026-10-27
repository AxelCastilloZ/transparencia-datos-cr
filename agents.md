# Contexto y Reglas Agénticas — Radar Cantonal Costa Rica

## 1. Descripción General del Proyecto
Aplicación web que integra fuentes OSINT costarricenses (OIJ, SICOP, TSE, PRONAE/MTSS) para mostrar indicadores cantonales consolidados sin almacenar información personal sensible.

## 2. Reglas Estrictas de Seguridad y Cumplimiento
- 🚫 **PROHIBIDO DATOS SENSIBLES DEL TSE:** En el módulo `tse/`, bajo NINGUNA circunstancia se deben procesar o guardar nombres, apellidos, números de cédula ni direcciones exactas de personas. Únicamente se persisten y sirven conteos agregados por cantón y distrito electoral.
- 🚫 **NO HARDCODE:** Nunca incluir tokens, contraseñas, URLs de BD con credenciales (`DATABASE_URL`) ni llaves en el código fuente.
- 💰 **MANEJO DE MONEDAS EN SICOP:** SICOP maneja órdenes en CRC y USD. Queda estrictamente prohibido sumar o promediar montos en monedas distintas. Cada moneda debe procesarse y mostrarse por separado.
- ⚠️ **PRIVACIDAD OSINT:** No construir buscadores ni perfiles individuales de personas. Respetar la Ley de Protección de la Persona frente al Tratamiento de sus Datos Personales (Ley 8968).

## 3. Stack Tecnológico y Comandos Importantes
- **Backend:** NestJS (TypeScript), TypeORM, PostgreSQL (Supabase / Railway).
- **Frontend:** React + Vite + Tailwind CSS + Recharts.
- **Gestor de paquetes:** `pnpm` (NUNCA usar `npm` ni `yarn`).

### Comandos de Verificación y Calidad (Ejecutar antes de confirmar PR)
```bash
# Instalación de dependencias
pnpm install

# Compilación y Linter
pnpm --dir backend lint
pnpm --dir frontend lint
pnpm build

# Pruebas Unitarias
pnpm --dir backend test
pnpm --dir frontend test --maxWorkers=1

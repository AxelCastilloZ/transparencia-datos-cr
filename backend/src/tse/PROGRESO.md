# TSE — Avance
Responsable: Jose Daniel R ([@Jroman07](https://github.com/Jroman07)).

- Implementados seed de 84 cantones y corrección de referencias existentes.
- Implementados entidades, streaming, privacidad, corte oficial, CRC, snapshots,
  transacción/upsert, cron mensual y seis endpoints; módulo registrado.
- Implementado panel React por cantón con fuente, corte, estados y aclaraciones.
- Pruebas sintéticas de parsers, CRC, snapshots, rollback, concurrencia y seed.
- Verificación: pnpm install desde raíz; pnpm run build correcto; pnpm run test
  correcto (44 backend + 6 frontend). Ambos linters terminan correctamente:
  quedan advertencias preexistentes de OIJ y PRONAE, ninguna del módulo TSE.
  Vite advierte un bundle superior a 500 kB. git diff --check sin errores.
- Verificación real del ZIP nacional, sin persistir: corte 2026-08-31,
  3.693.108 electores en 2.130 distritos con electores de 84 cantones;
  67.389 electores en el extranjero excluidos. SHA-256 y CRC verificados,
  ZIP temporal eliminado. Portal con CAPTCHA a axios: se usó corte publicado
  verificado y hash fijado (ver README).

## Primera carga persistida — 2026-09-11

POST /api/tse/sync completado con HTTP 201: corte 2026-08-31,
84 cantones, 2.130 distritos y 3.693.108 electores; 67.389 inscritos en el
extranjero excluidos. Backend recargado para tomar la configuración de .env.
Los errores ahora identifican la etapa fallida con textos seguros; no revelan
mensajes arbitrarios de la fuente o de SQL.

## Pendientes
- Demo del panel en la base compartida.
- Preparar migración de tablas para producción (synchronize solo en desarrollo).
- Revisar referencias externas si la base tiene tablas adicionales que no son
  entidades registradas en TypeORM.
- Segunda fase: estadísticas agregadas por sexo.
- Acumular cortes posteriores; la URL actual no recupera meses anteriores.

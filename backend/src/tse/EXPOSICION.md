# TSE — Guion de exposición

1. Problema: transformar padrón individual en conteos territoriales sin exponer
   información personal.
2. Fuente oficial: ZIP mensual, LEAME, DISTELEC y Windows-1252. Explicar CODELEC.
   PADRON no contiene sexo ni edad.
3. Flujo: axios → ZIP temporal → unzipper stream → líneas → validación →
   contadores → transacción/upsert → API propia → React.
4. Historia: claves con corte, meses anteriores intactos, repetir corte no duplica;
   un fallo revierte el snapshot completo.
5. Demo: POST /api/tse/sync, GET /api/tse/status, seleccionar Monteverde (612)
   o Puerto Jiménez (613), ver electores, porcentaje y distritos. Evolución solo
   con más de un snapshot.
6. Límites: inscritos no equivale a participación ni votos; extranjero fuera
   del denominador territorial; distritos electorales distintos de administrativos;
   historia desde primera carga. Consultas cacheadas disponibles si falla la fuente.
7. Fase 2: estadísticas agregadas oficiales por sexo, jamás inferencias de nombres.


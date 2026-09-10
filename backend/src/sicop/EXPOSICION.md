# Guion de exposición — SICOP (Contratación Pública)

> Brenda Obando · Fuente OSINT #2 · ~4–5 min + demo

## 1. Problema que resuelve el sistema (30 s)

Los datos de contratación pública de Costa Rica existen y son abiertos, pero
están en un portal (SICOP) pensado para consultas puntuales, no para análisis:
hay que llenar formularios, exportar a mano, y los archivos vienen en ~25 tablas
sueltas. Nadie cruza eso con seguridad o territorio.

Nuestro sistema integra SICOP con las otras fuentes indexado por cantón: elegís
un cantón y ves, además de la seguridad (OIJ), **cuánto y a quién le compran las
instituciones públicas de ese cantón**.

## 2. Por qué SICOP y por qué esta vía de acceso (45 s)

- SICOP es la fuente sugerida en el enunciado para transparencia y gasto público.
- El módulo oficial de datos abiertos de `sicop.go.cr` **devuelve error 500** y
  su exportación no es una URL estable → no se puede automatizar de forma
  confiable.
- El **Observatorio de Compra Pública** del Ministerio de Hacienda republica los
  mismos datos de SICOP como **ZIP mensual de CSV**, con una URL predecible
  (`.../Zip/AAAAMM.zip`) que se actualiza a diario a las 08:00.
- Decisión: fuente primaria = SICOP; vía de acceso = Observatorio. Documentado
  en `DATOS.md`.

## 3. Qué obtiene la aplicación (45 s)

Del ZIP mensual se usa `OrdenPedido.csv` — las **órdenes de pedido**, que son las
compras efectivamente ejecutadas: proveedor, monto, fecha, descripción, estado.

Para saber **qué institución** compra (y en qué cantón), se usan 3 CSV más del
mismo ZIP como puente: `Sistemas`, `DetalleCarteles`, `Contratos` enlazan el
número de procedimiento con la cédula de la institución, e
`InstitucionesRegistradas` da su ubicación (`ZONA_GEO_INST`).

Volumen cargado para la demo: **6 meses, ~80.000 órdenes, ₡388 mil millones**.

## 4. Cómo se procesan los datos (1 min)

```
axios (descarga ZIP)
  → fflate (descomprime solo los 5 CSV que se usan)
  → papaparse (parsea ";", UTF-8)
  → normalización:  montos ("2059200.000000" → 2059200.00, moneda),
                    fechas (timestamp → YYYY-MM-DD),
                    dedupe por número de orden
  → cruce en memoria:  NRO_SICOP → cédula institución → ZONA_GEO_INST → cantón
                       (match contra la tabla `cantones`, sin tildes)
  → TypeORM → tabla sicop_ordenes_pedido (full refresh)
  → API propia /api/sicop/*
```

- **Cron diario** a las 4 a.m. (la fuente publica a las 8).
- **Manejo de errores:** si un ZIP no está disponible, se omite ese mes y se
  conservan los datos ya cargados; el endpoint nunca se cae por la fuente
  externa.
- El frontend consume **solo** `/api/sicop/*`, nunca SICOP directamente.

## 5. Demo en vivo (2 min)

1. **Vista nacional** (sin cantón): panel de SICOP con
   - stat cards: total de órdenes, monto del período, % con cantón resuelto
   - **buscador de proveedores** → escribir "constructora" / "seguridad"
   - ranking de proveedores por monto (barras + tabla)
   - top instituciones compradoras (CCSS, ICE, AyA…)
   - evolución mensual del gasto
2. **Seleccionar un cantón** (ej: Pococí, Limón, San Carlos):
   - todo el panel se re-consulta acotado a ese cantón
   - "Instituciones compradoras de Pococí" → Municipalidad del Cantón de Pococí,
     58 órdenes, ₡6.346 M
   - queda al lado de los datos de seguridad (OIJ) del mismo cantón → el cruce
3. Mostrar un endpoint crudo: `curl .../api/sicop/proveedores?q=constructora`

## 6. Retos, límites y decisiones técnicas (45 s)

- **El portal oficial de SICOP no sirve para automatizar** → hubo que buscar una
  vía alterna (Observatorio) y justificarla.
- **Los datos vienen en ~25 tablas normalizadas**, no en un archivo plano como el
  OIJ. El monto está en una tabla, la institución en otra, la ubicación en una
  tercera → el "trabajo" del módulo es justamente ese ETL de reconstrucción.
- **Cobertura del cruce por cantón: ~31 %.** Una orden de hoy puede referenciar
  un procedimiento de hace 3 años, y los CSV puente solo cubren la ventana
  descargada. Se puede subir descargando más meses de los CSV puente (son
  chicos). El resto de las órdenes igual sirve a nivel nacional / por proveedor.
- **La ubicación es la sede de la institución, no el lugar de entrega** → San
  José concentra el gasto de las instituciones nacionales. Está aclarado en el
  panel para no inducir a error (dato ≠ inferencia).
- **Codificación:** los CSV resultaron ser UTF-8 (no Latin-1 como se temía),
  simplificó el parseo.

## 7. Archivos clave para mostrar en el código

| Archivo | Qué mirar |
|---|---|
| `backend/src/sicop/sicop.service.ts` | descarga, parseo, normalización, cruce por cantón, cron |
| `backend/src/sicop/contratacion.entity.ts` | modelo normalizado + FK a `cantones` |
| `backend/src/sicop/sicop.controller.ts` | endpoints REST de solo lectura |
| `frontend/src/components/SicopPanel.tsx` | panel, canton-aware |
| `backend/src/sicop/DATOS.md` | diccionario de datos y decisiones de la fuente |

# Criterios de Aceptación — Flujos Críticos

Especificaciones BDD (Given/When/Then) para los tres flujos más críticos del
sistema. Cada criterio es verificable por pruebas automatizadas.

---

## Flujo 1: Consulta del Radar Cantonal

**Descripción:** Un usuario selecciona un cantón y obtiene la ficha integrada
con datos de seguridad (OIJ), contratación (SICOP), electorado (TSE) y
señales cruzadas.

### AC-1.1 — Ficha completa con datos disponibles

```gherkin
Given el backend tiene datos de OIJ, SICOP y TSE para el cantón 101 (San José)
When el usuario solicita GET /api/radar/canton/101
Then la respuesta HTTP es 200
  And el cuerpo incluye los campos: canton, periodo, seguridad, electorado, contratacion, comparacion, senales, metadatos
  And seguridad.incidentes es un entero >= 0
  And contratacion.montosPorMoneda es un arreglo donde cada elemento tiene moneda, monto y ordenes
  And electorado.electores es un entero > 0
```

### AC-1.2 — Cantón sin datos parciales

```gherkin
Given no existen registros SICOP para el cantón 503 (Tibás)
  And sí existen registros OIJ y TSE
When el usuario solicita GET /api/radar/canton/503
Then la respuesta HTTP es 200
  And contratacion.ordenes es 0
  And contratacion.montosPorMoneda es un arreglo vacío
  And seguridad.incidentes es un entero >= 0
  And el campo senales puede incluir "cobertura-sicop" como señal informativa
```

### AC-1.3 — Cantón inexistente

```gherkin
Given no existe un cantón con código 999
When el usuario solicita GET /api/radar/canton/999
Then la respuesta HTTP es 404
  And el cuerpo incluye un mensaje de error descriptivo
```

### AC-1.4 — Filtro por período personalizado

```gherkin
Given existen datos OIJ entre 2024-01-01 y 2026-08-31
When el usuario solicita GET /api/radar/canton/101?desde=2025-01-01&hasta=2025-06-30
Then la respuesta HTTP es 200
  And periodo.desde es "2025-01-01"
  And periodo.hasta es "2025-06-30"
  And seguridad solo incluye incidentes dentro de ese rango
```

---

## Flujo 2: Ingesta TSE con Protección de PII

**Descripción:** El cron de TSE descarga el padrón electoral, lo procesa
en memoria y almacena únicamente datos agregados — nunca datos personales.

### AC-2.1 — Agregación correcta sin PII

```gherkin
Given el archivo PADRON.TXT contiene 3,500,000 filas con cédula, nombre, sexo, provincia, cantón y distrito por elector
When el proceso de sincronización TSE se ejecuta
Then la base de datos almacena filas agregadas en tse_padron_cantonal (total por cantón)
  And la base de datos almacena filas en tse_padron_distrital (total por distrito)
  And ninguna tabla contiene columnas de nombre, cédula ni datos individuales
  And el archivo ZIP temporal se elimina al finalizar
```

### AC-2.2 — Resiliencia ante fallo de descarga

```gherkin
Given la URL de descarga del TSE (tse.go.cr) no responde
When el cron de sincronización TSE se ejecuta
Then el proceso registra un error en logs sin lanzar excepción no capturada
  And los datos previamente almacenados en la base siguen disponibles
  And GET /api/tse/resumen devuelve los últimos datos cacheados con HTTP 200
```

### AC-2.3 — Codificación correcta del padrón

```gherkin
Given PADRON.TXT usa codificación Latin-1 (Windows-1252)
When el parser lee el archivo
Then los nombres de distrito con tildes y eñes se leen correctamente (e.g., "SAN JOSÉ", "CAÑAS")
  And los conteos coinciden con el total declarado en LEAME.TXT ± 0.1%
```

---

## Flujo 3: Agregación SICOP Multimoneda

**Descripción:** SICOP reporta contrataciones en CRC y USD. El sistema debe
mantenerlas separadas para evitar sumas incorrectas.

### AC-3.1 — Separación estricta por moneda

```gherkin
Given existen 20 órdenes en CRC por ₡50,000,000 y 5 órdenes en USD por $10,000 para el cantón 101
When el usuario solicita GET /api/radar/canton/101
Then contratacion.montosPorMoneda contiene exactamente dos elementos
  And el elemento con moneda "CRC" tiene monto 50000000 y ordenes 20
  And el elemento con moneda "USD" tiene monto 10000 y ordenes 5
  And no existe ningún total combinado de ambas monedas
```

### AC-3.2 — Órdenes sin monto registrado

```gherkin
Given existen 3 órdenes SICOP sin monto (campo monto nulo o vacío) para el cantón 201
When el radar calcula los montos por moneda
Then las órdenes sin monto se contabilizan en ordenes pero no en ordenesConMonto
  And el monto total solo suma las órdenes con valor numérico válido
```

### AC-3.3 — Comparación entre cantones por moneda

```gherkin
Given existen datos SICOP para al menos 6 cantones
When el radar calcula la comparación
Then comparacion.medianasSicopPorMoneda agrupa medianas separadamente por moneda
  And cada entrada tiene: moneda, medianaMontoTotal, cantonesMuestra
```

---

## Trazabilidad

| Criterio | Etapa SSDLC | Prueba automatizada           |
| :------- | :---------- | :---------------------------- |
| AC-1.*   | 1 + 4       | `radar.service.spec.ts`       |
| AC-2.*   | 1 + 4       | `tse.ingestion.spec.ts`       |
| AC-3.*   | 1 + 4       | `radar.math.spec.ts`, `sicop.parsers.spec.ts` |

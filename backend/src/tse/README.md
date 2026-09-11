# TSE — Padrón electoral

Responsable: **Jose Daniel R ([@Jroman07](https://github.com/Jroman07))**.

Primera versión ZIP/TXT: electores inscritos por cantón y distrito electoral.
El padrón no mide participación, abstencionismo ni votos emitidos.

## Consumo

Fuente: https://www.tse.go.cr/descarga_padron.html
ZIP: https://www.tse.go.cr/zip/padron/padron_completo.zip

axios descarga a una carpeta temporal del sistema. unzipper abre el directorio
del ZIP y descomprime cada TXT como stream. Se validan CRC32, tamaños, ocho
campos, longitudes, CODELEC y cobertura de los 84 cantones. DISTELEC.TXT resuelve
los nombres. Se cuentan las líneas incrementalmente; no se acumulan electores.
El ZIP se elimina en finally tanto en éxito como en error.

La fecha de corte se obtiene del texto «actualizado al» del portal oficial,
antes y después de descargar. No se usa la fecha de ejecución como corte.
Un cambio de publicación durante la descarga aborta la carga.

## Primera sincronización

Arrancar el backend con DATABASE_URL. TypeORM crea las tablas en desarrollo.
En producción, donde synchronize está desactivado, aplicar el esquema antes
de habilitar el módulo. No se ejecuta una descarga al arrancar.

```bash
curl -X POST http://localhost:3000/api/tse/sync
curl http://localhost:3000/api/tse/status
curl http://localhost:3000/api/tse/canton/612
```

POST espera a terminar (puede tardar varios minutos). Cron mensual: día 10,
04:00, America/Costa_Rica. Si la publicación se retrasa, reintentar manualmente.
No acepta fechas ni URL del cliente HTTP.

### Portal con CAPTCHA

En esta red el portal devuelve CAPTCHA a axios aunque el ZIP es accesible.
Como alternativa, el operador puede configurar en backend/.env ambos valores:
TSE_FECHA_CORTE (YYYY-MM-DD verificado en la publicación oficial) y
TSE_ZIP_SHA256 (SHA-256 del ZIP correspondiente, obtenido por streaming).
Nunca usar la fecha de descarga como corte. No son credenciales.
El hash se valida antes de procesar: si la publicación cambia, falla sin
sobrescribir snapshots. Actualizar ambos valores para la siguiente publicación
o quitarlos para volver a detección automática. Un hash no demuestra la fecha:
el operador es responsable de verificar su correspondencia con el portal.

Par verificado para la publicación del 31 de agosto de 2026 (si el ZIP cambió,
no reutilizarlo: la validación fallará):

```dotenv
TSE_FECHA_CORTE=2026-08-31
TSE_ZIP_SHA256=b2f265096e34618701b223c5c6aa09f2f22d0d04e939af5f9376e91d40b49ed5
```

## API

| Método | Endpoint | Resultado |
|---|---|---|
| GET | /api/tse/status | Corte, número de snapshots, estado y último error |
| GET | /api/tse/resumen | Total nacional territorial y procedencia |
| GET | /api/tse/canton/:codigo | Total y porcentaje nacional del último corte |
| GET | /api/tse/canton/:codigo/historico | Cortes ordenados de antiguo a reciente |
| GET | /api/tse/canton/:codigo/distritos | Distritos del último corte por total |
| POST | /api/tse/sync | Descarga, validación y persistencia del snapshot |

Cantón inválido/inexistente: 404. Sin datos: corte null, conteos cero y listas
vacías. Sync concurrente en el proceso: 409. Fallo: 503 genérico sin datos personales.
La sincronización exitosa devuelve HTTP 201 (POST de NestJS).
Tras cambiar backend/.env, reiniciar el backend; editar .env no recarga por sí
solo ConfigService. GET /api/tse/status informa corteFijadoConfigurado para
comprobar que el proceso leyó ambos valores. Tras sincronizar, recargar el
frontend o cambiar de cantón para consultar el snapshot nuevo.

## Historia y privacidad

Claves: (fechaCorte, cantonCodigo) y (fechaCorte, distritoCodigo).
Transacción PostgreSQL con bloqueo asesor y upsert: repetir un corte corrige
ese corte, sin duplicar conteos. Los distritos de ese corte se reconcilian en
la transacción; los demás cortes se conservan. Un fallo revierte ambas tablas.
GET consulta exclusivamente la base.

Nunca se guardan nombres, apellidos, cédulas, juntas ni fechas de caducidad.
PADRON.TXT no ofrece sexo ni nacimiento/edad: no se infieren ni se inventan.
Errores y logs genéricos; fixtures exclusivamente sintéticos.

Los electores en el extranjero (provincia electoral 8) se cuentan durante la
validación y se excluyen de las tablas territoriales y del denominador nacional.
El resultado de sync informa exteriorExcluido. El panel aclara este alcance.

Ver [DATOS.md](DATOS.md), [PROGRESO.md](PROGRESO.md) y [EXPOSICION.md](EXPOSICION.md).

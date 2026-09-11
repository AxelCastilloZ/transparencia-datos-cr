# TSE — Diccionario y procedencia
Fuente: Tribunal Supremo de Elecciones, descarga pública mensual sin token:
https://www.tse.go.cr/descarga_padron.html.
Formato verificado en LEAME.TXT y DISTELEC.TXT del ZIP oficial.
Codificación Windows-1252, compatible con Latin-1 para los caracteres usuales.

## Entrada
PADRON.TXT o PADRON_COMPLETO.TXT: ocho campos separados por comas:
CEDULA (9), CODELEC (6), RELLENO (1), FECHACADUC (8), JUNTA (5),
NOMBRE (hasta 30), PRIMER_APELLIDO (hasta 26), SEGUNDO_APELLIDO (hasta 26).
Los campos personales se validan transitoriamente y descartan; solo sale
CODELEC del parser. No hay sexo, edad ni fecha de nacimiento.

DISTELEC.TXT: CODELE, PROVINCIA, CANTON, DISTRITO. Se conserva código electoral
y nombre del distrito con su cantón derivado. Un distrito electoral no
equivale necesariamente a un distrito administrativo.
El último campo puede incluir comas sin comillas: se separan solo las tres
primeras columnas y se conserva el resto como nombre de distrito.
CODELEC: provincia (1 dígito), cantón (2), distrito electoral (3).
Monteverde = 612; Puerto Jiménez = 613. Dimensión compartida: 84 cantones.

## Salida persistida
| Tabla | Campo | Significado |
|---|---|---|
| tse_padron_cantonal | fechaCorte + cantonCodigo | Clave compuesta, corte oficial y FK |
| tse_padron_cantonal | total | Electores inscritos |
| tse_padron_cantonal | fuente | URL del ZIP oficial |
| tse_padron_cantonal | sincronizadoEn | Instante de ingesta, distinto del corte |
| tse_padron_distrital | fechaCorte + distritoCodigo | Clave compuesta |
| tse_padron_distrital | cantonCodigo | FK a cantones |
| tse_padron_distrital | distrito | Nombre del catálogo |
| tse_padron_distrital | total | Conteo, incluido cero para distritos vacíos |

## Validación y límites
Rechaza estructura inválida, longitudes excesivas, CODELEC inválido, catálogo
duplicado, códigos desconocidos, archivo vacío, cobertura incompleta y CRC
incorrecto. Máximos: ZIP 200 MB, padrón 1 GB, catálogo 2 MB, línea 1024 caracteres.
Se exige cobertura de 84 cantones; futuros cambios territoriales requieren revisión.

El denominador nacional suma los 84 cantones, sin extranjero. Se cuenta una
fila por elector según el contrato oficial; no se retiene un índice de cédulas
para deduplicar personas.

La URL nacional es mutable. La historia se acumula desde la primera carga;
no se fabrican meses anteriores. Portal y ZIP podrían publicarse desfasados
aunque el texto del corte no cambie entre lecturas; no existe un manifiesto
firmado que los vincule. CRC verifica integridad, no autenticidad; la
procedencia se establece mediante HTTPS del dominio oficial.

Si el portal devuelve CAPTCHA, la alternativa operativa exige fecha verificada
y SHA-256 configurados juntos. El hash fija la versión del ZIP; su correspondencia
con el corte depende de la verificación del operador. No se resuelve ni se evade CAPTCHA.

## Fase 2
Integrar reportes estadísticos agregados del TSE con total, hombres, mujeres
y variación por cantón, verificando formato y corte. No inferir sexo de nombres
ni simular grupos etarios. Padrón no representa participación ni votos.

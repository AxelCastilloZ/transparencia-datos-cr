# Escaneo de imágenes con Trivy

Ítem 3.3 · Transparencia Datos CR · Compañero 4

## Configuración de CI

El job `container-scan` de [CI](../.github/workflows/ci.yml) corre en `ubuntu-latest` cuando concluye correctamente `build-and-test`. El workflow se activa con pushes y pull requests dirigidos a `main` o `development`.

Docker Buildx construye ambas imágenes desde la raíz del repositorio con [backend/Dockerfile](../backend/Dockerfile) y [frontend/Dockerfile](../frontend/Dockerfile). Con `load: true` y `push: false`, las imágenes `transparencia-cr-backend:ci` y `transparencia-cr-frontend:ci` quedan disponibles en el runner para el escaneo local. Trivy v0.36.0, fijado al SHA `ed142fd0673e97e23eac54620cfb913e5ce36c25`, analiza las dos imágenes con `format: table`, `severity: CRITICAL,HIGH` y `exit-code: 0`. Este valor permite que el job quede en verde aunque Trivy reporte hallazgos.

Trivy inspecciona los paquetes del sistema y bibliotecas presentes en la imagen construida. El job SCA de OSV-Scanner inspecciona el inventario de dependencias del proyecto a partir de `pnpm-lock.yaml`. Los resultados de SCA se registran en [SECURITY_FINDINGS.md](SECURITY_FINDINGS.md).

## Resultados de GitHub Actions

Los logs de la [ejecución #38](https://github.com/AxelCastilloZ/transparencia-datos-cr/actions/runs/42916226001), del 10 de noviembre de 2026, confirman los dos builds y escaneos.

| Imagen | HIGH | CRITICAL | Origen de los hallazgos |
| --- | ---: | ---: | --- |
| Backend | 10 | 0 | Bibliotecas Node.js distribuidas con npm en la imagen |
| Frontend | 2 | 0 | Paquete del sistema Alpine 3.24.4 |

| Imagen y paquete | CVE | Severidad | Instalada | Versiones corregidas que indica Trivy |
| --- | --- | --- | --- | --- |
| Backend · brace-expansion | CVE-2026-102276 | HIGH | 2.0.2 | 5.0.10, 3.0.7, 2.1.5, 1.1.19 |
| Backend · brace-expansion | CVE-2026-102278 | HIGH | 2.0.2 | 5.0.11, 3.0.8, 2.1.6, 1.1.20 |
| Backend · brace-expansion | CVE-2026-13149 | HIGH | 2.0.2 | 5.0.7, 1.1.16, 2.1.2 |
| Backend · brace-expansion | CVE-2026-14257 | HIGH | 2.0.2 | 5.0.8, 3.0.3, 2.1.3, 1.1.17 |
| Backend · brace-expansion | CVE-2026-69152 | HIGH | 2.0.2 | 1.1.18, 2.1.4, 3.0.6, 5.0.9 |
| Backend · ip-address | CVE-2026-69192 | HIGH | 10.1.0 | 10.3.1 |
| Backend · pacote | CVE-2026-9496 | HIGH | 19.0.2 y 20.0.1 | 21.5.1 |
| Backend · picomatch | CVE-2026-33671 | HIGH | 4.0.3 | 4.0.4, 3.0.2, 2.3.2 |
| Backend · sigstore | CVE-2026-48815 | HIGH | 3.1.0 | 4.1.1 |
| Frontend · libxslt | CVE-2026-87636 | HIGH | 1.1.43-r3 | 1.1.43-r4 |
| Frontend · libxslt | CVE-2026-9947 | HIGH | 1.1.43-r3 | 1.1.43-r4 |

El total de backend cuenta las dos instancias de `pacote` asociadas al mismo CVE. El estado `fixed` de la tabla de Trivy indica que existe una versión corregida.

## Remediación y decisión de riesgo

| Grupo | Impacto potencial | Acción propuesta | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| `brace-expansion`, `pacote`, `picomatch` | Agotamiento de recursos y denegación de servicio si se invocan las funciones afectadas. | Evaluar una base Node 22 con npm actualizado. Para `brace-expansion`, comprobar cobertura de los cinco CVE. Para `pacote`, verificar ambas copias. | Alta | Pendiente de remediación |
| `ip-address` | Posible elusión de controles de destino si el flujo depende de ese análisis de direcciones IP. | Verificar si el backend ejecuta esa copia y evaluar una distribución de npm con `ip-address` 10.3.1 o posterior corregida. | Alta | Pendiente de remediación |
| `sigstore` | Posible aceptación de certificados que el verificador debería rechazar. | Revisar si se usa esa copia para verificar firmas y evaluar npm con `sigstore` 4.1.1 o posterior corregida. | Alta | Pendiente de remediación |
| `libxslt` | Fallos de seguridad de memoria al procesar contenido XML en rutas que alcancen la biblioteca. | Probar una base Nginx Alpine que incluya `libxslt` 1.1.43-r4 o posterior corregida y validar el servicio estático. | Alta | Pendiente de remediación |

Antes de cambiar las bases, comprobar compatibilidad con Node 22, pnpm y la configuración de Nginx. Reconstruir ambas imágenes, ejecutar lint, pruebas y compilación, y comprobar en un nuevo escaneo el estado de cada CVE. Registrar el SHA, el digest cuando esté disponible y el enlace a los logs.

Si se confirma que npm y sus bibliotecas solo se usan durante la construcción y no son alcanzables en operación, el responsable de seguridad puede evaluar una aceptación temporal para los hallazgos del backend. La propuesta debe incluir evidencia de alcance, fecha de revisión, responsable y fecha límite. En esta entrega todas las remediaciones siguen pendientes y no hay aprobación de riesgo registrada.

## Evidencias

Consultar el [índice de evidencias](evidencias/container-scanning/README.md) y el [job Build & Scan Contenedores](https://github.com/AxelCastilloZ/transparencia-datos-cr/actions/runs/42916226001/job/130179585817).

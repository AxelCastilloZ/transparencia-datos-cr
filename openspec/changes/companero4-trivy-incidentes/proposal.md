# Documentar Trivy deployment y respuesta a incidentes

## Problema

La evidencia de escaneo de imágenes estaba incompleta, el estado de publicación necesitaba verificación y el proyecto carecía de un procedimiento de respuesta a incidentes de contenedores.

## Solución propuesta

Documentar los resultados de Trivy a partir de logs de GitHub Actions, revisar la configuración y el estado de GHCR, y registrar un playbook con responsables, criterios de escalamiento y recuperación verificable.

## Alcance

Ítems 3.3 y 6.1 y opción C del Compañero 4. Incluye documentación, referencias de evidencia, análisis de remediación y validaciones.

## No objetivos

Quedan fuera los cambios a la funcionalidad, Dockerfiles, controles de CI, infraestructura de staging y publicación de imágenes para producir evidencias.

## Resultados esperados

Resultados trazables al job, acciones correctivas con estado explícito, verificación de la configuración de publicación y procedimiento reutilizable para incidentes.

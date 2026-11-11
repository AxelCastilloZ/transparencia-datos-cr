# Playbook de respuesta a incidentes

## Alcance y responsables

Aplica al repositorio Transparencia Datos CR, GitHub Actions, las imágenes Docker, GHCR y los entornos que ejecutan las imágenes. Su objetivo es contener incidentes, conservar evidencia y restablecer un servicio verificable.

| Rol | Responsabilidad |
| --- | --- |
| Coordinador del incidente | Abre el registro, asigna responsables, decide escalamiento y coordina el cierre. |
| Responsable de CI y publicación | Identifica ejecuciones, preserva logs y artefactos, y coordina la suspensión o reanudación de publicaciones. |
| Responsable de backend o frontend | Determina alcance, propone correcciones y valida compatibilidad. |
| Responsable de seguridad | Revisa severidad, evidencia, riesgo residual y criterio de cierre. |

## Clasificación

| Nivel | Criterio operativo |
| --- | --- |
| Crítico | Exposición activa de secretos, manipulación de imágenes o vulnerabilidad CRITICAL en una imagen candidata a publicación. Convocar de inmediato al coordinador y a seguridad. |
| Alto | Debilidad relevante con exposición plausible o degradación importante. Asignar responsable y plazo el mismo día. |
| Medio | Exposición limitada o mitigación compensatoria verificable. Planificar y dar seguimiento. |
| Bajo | Impacto limitado y sin urgencia operativa. Registrar y tratar en el ciclo normal. |

## Procedimiento

1. **Identificar y registrar.** Abrir un registro con hora y zona, detector, síntoma, severidad inicial, SHA, rama, imagen o digest y entornos potencialmente afectados. Confirmar si el hallazgo proviene de Trivy, SCA, un reporte o monitoreo.
2. **Preservar evidencia.** Guardar los enlaces y, si están disponibles, los logs y artefactos originales. Registrar quién los recopiló, cuándo y su hash. Mantener acceso restringido y depurar secretos de las copias compartidas.
3. **Contener.** Suspender la promoción de la versión afectada. Si ya está en uso, identificar consumidores por digest y coordinar aislamiento o reversión a un digest validado. Si hay credenciales comprometidas, revocar y rotar por el canal autorizado.
4. **Analizar y erradicar.** Identificar el paquete, su origen, las versiones y los entornos alcanzables. Revisar imágenes relacionadas y el historial de publicación. Eliminar la causa raíz confirmada mediante una imagen base corregida, una actualización compatible o la retirada del componente innecesario.
5. **Remediar.** Preparar un PR con cambios acotados y revisión del responsable. Registrar la versión objetivo y los criterios de aceptación.
6. **Recuperar y validar.** Ejecutar GitHub Actions y revisar lint, pruebas, builds, SAST, SCA, E2E y las tablas de Trivy. Confirmar el CVE contra la imagen exacta que se va a promover. Verificar health checks y el digest en staging antes de restablecer la promoción.
7. **Comunicar.** Informar al equipo al confirmar el incidente y al cambiar el alcance, la contención o el estado de recuperación. Compartir impacto, responsable, medida aplicada y próximo hito. Conservar evidencias sensibles por separado.
8. **Cerrar.** El coordinador y seguridad confirman la recuperación, el riesgo residual y las evidencias de validación. Registrar la línea de tiempo, lecciones y tareas de prevención con responsable y plazo.

## Escenario hipotético

Trivy detecta un hallazgo CRITICAL en el backend antes de su publicación. El responsable de CI conserva el reporte y el SHA, avisa al coordinador y detiene la promoción. Como el escaneo actual es informativo, revisa la tabla aunque el job haya concluido en verde. El equipo confirma el origen del paquete, verifica si versiones anteriores del mismo componente ya están publicadas y asigna la corrección al responsable de backend.

El responsable reconstruye con una versión compatible corregida y repite el escaneo. Seguridad comprueba que el hallazgo desapareció para la imagen candidata, que la compilación y las pruebas pasan y que la recuperación está validada. El coordinador documenta la autorización antes de reanudar la publicación y cierra el registro con los enlaces al PR, al run y al digest cuando exista.

## Plantilla de registro

| Campo | Valor |
| --- | --- |
| Identificador | IR-AAAA-NNN |
| Fecha y hora con zona | |
| Responsable | |
| Descripción | |
| Severidad y motivo | |
| Sistemas afectados, SHA e imagen o digest | |
| Evidencias y ubicación | |
| Acciones realizadas, hora y responsable | |
| Estado | Abierto / Contenido / En recuperación / Cerrado |
| Resultado y aprobación de cierre | |
| Lecciones aprendidas y seguimiento | |

Ver [Container Scanning](CONTAINER_SCANNING.md) y [Deployment](DEPLOYMENT.md).

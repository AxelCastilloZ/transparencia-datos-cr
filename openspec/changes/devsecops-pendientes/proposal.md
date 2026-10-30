# Propuesta: Completar ítems DevSecOps pendientes

## Problema

El proyecto final de DevSecOps requiere que cada integrante del equipo (4 personas)
cubra al menos 3 ítems del SSDLC. Axel ya implementó 5 ítems y dejó la
infraestructura lista. Los 3 compañeros restantes necesitan completar sus ítems
asignados y documentar su contribución.

## Solución propuesta

Cada compañero toma su rama (`feature/nombre-devsecops`), completa sus ítems
asignados y abre un PR a `development`. La infraestructura (CI, Dockerfiles,
pre-commit, Playwright) ya está lista — solo necesitan usarla y documentar.

## Ítems ya completados (Axel)

1. **1.1** Criterios de aceptación BDD
2. **1.3** Modelo de amenazas STRIDE
3. **3.1** Pipeline CI automatizado
4. **4.2** Tests unitarios consolidados (82 tests)
5. **7.1** Health checks y observabilidad

## Ítems pendientes por compañero

### Compañero 2 (3 ítems)
- **2.3** Documentar uso de pre-commit hooks (ya configurados)
- **4.4** Ejecutar y verificar tests E2E con Playwright
- **Ítem adicional:** Agregar test E2E para su módulo (TSE o SICOP)

### Compañero 3 (3 ítems)
- **3.2** Documentar y verificar SAST + SCA en CI
- **5.1** Documentar Dockerfiles y proceso de SBOM
- **Ítem adicional:** Agregar OSV-Scanner findings al README de seguridad

### Compañero 4 (3 ítems)
- **3.3** Documentar container scanning con Trivy
- **6.1** Verificar y documentar pipeline de deployment
- **Ítem adicional:** Configurar ZAP DAST o tests de resiliencia

## No-objetivos

- No se requiere un deployment real a producción
- No se necesita Grafana/Prometheus completo (health check cubre observabilidad)
- No se cambia funcionalidad del sistema, solo seguridad y operaciones

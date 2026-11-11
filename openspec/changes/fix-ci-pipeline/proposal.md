# Propuesta: Reparar el pipeline de CI/CD

## Problema

El pipeline de GitHub Actions (`.github/workflows/ci.yml`) tenía dos jobs que
fallaban en todos los PR antes de ejecutar ninguna comprobación (~3s):

- **Análisis SCA:** el paso de OSV-Scanner usaba
  `google/osv-scanner-action@v1`, una versión inexistente. Además el SBOM se
  generaba con `cyclonedx-npm --package-lock-only`, que necesita un
  `package-lock.json` de npm; este repo usa pnpm, así que ese paso también
  habría fallado.
- **Build & Scan Contenedores:** el paso de Trivy usaba
  `aquasecurity/trivy-action@0.28.0`, otra versión inexistente. Al corregirla
  quedó al descubierto un segundo defecto preexistente: la imagen del frontend
  no compilaba porque `frontend/src/api.ts` importa tipos de
  `backend/src/radar/radar.types` y el `frontend/Dockerfile` no los copiaba a la
  imagen aislada.

Por la regla del proyecto, una comprobación que no puede ejecutarse se considera
incompleta, no aprobada. Con esto, dos comprobaciones del SSDLC (SCA e imágenes
de contenedor) no eran demostrables.

## Solución propuesta

- Anclar las acciones de terceros **por SHA** (requisito del ítem 3.5):
  - OSV-Scanner → `v2.7.0`.
  - Trivy → `v0.36.0`.
- Reemplazar la generación de SBOM por `anchore/sbom-action` (Syft), que
  entiende el workspace pnpm y produce CycloneDX, subido como artefacto.
- Copiar `backend/src/radar/radar.types.ts` en el *build stage* del
  `frontend/Dockerfile` para que `tsc -b` resuelva los tipos compartidos.
- Dejar los escáneres en modo *report-only* (Trivy `exit-code: 0`, OSV
  `continue-on-error`) para establecer una base verde. Se vuelven bloqueantes al
  endurecer el gate (ítems 3.2 / 3.6).

## No-objetivos

- No se corrige el acoplamiento frontend→backend (importar tipos del backend
  en el frontend); se registra como deuda técnica para un posible paquete de
  tipos compartido.
- No se activan los gates bloqueantes ni la protección de ramas en esta change.
- No se tocan las pruebas E2E (dependen de los mocks del PR de Compañero 2).

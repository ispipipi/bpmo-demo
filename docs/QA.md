# BPMO · QA final (AC-01 a AC-25)

Versión 0.1.0. Resultado de las comprobaciones hechas durante la construcción y en la etapa 9.
**Tests automáticos:** 219 (Vitest, dominio y almacenamiento). **Navegador:** recorridos con scripts sobre la app en desarrollo, a 1440, 820 y 375 px.

| AC | Cómo se comprobó | Resultado |
|---|---|---|
| AC-01 | Auditoría de 44 enlaces internos (todos llevan a una pantalla real); recorrido de los botones de cada módulo; los únicos controles inertes son las filas del Mapa y los `BlockedAction` con su motivo | Cumple |
| AC-02 | `acceptance.test.ts`: Dashboard, Mapa e informe 1 coinciden con los registros en D0 y tras cada evento | Cumple |
| AC-03 | `store.test.ts` y `domain.test.ts`: E1 a E8 en orden, una vez cada uno, luego "Sin novedades" | Cumple |
| AC-04 | `domain.test.ts`: tablas de MD §5.3 en D0, D0+16 y D0+22 | Cumple |
| AC-05 | `arcop.test.ts` y navegador: cierre bloqueado con el motivo hasta tener subtareas y respuesta | Cumple |
| AC-06 | `rat.test.ts`: registrar solo con 5/5, sube la versión; la revisión mensual no | Cumple |
| AC-07 | `rat.test.ts` y navegador: eliminar con consentimientos asociados se bloquea y los lista | Cumple |
| AC-08, AC-09 | `finding.test.ts` y navegador: condiciones de cada etapa; paquete con el texto del DPD formal; constancia con los 3 campos | Cumple |
| AC-10 | `stage6.test.ts` y navegador: parámetros recalculan semáforos y alertas; fuera de rango no se guarda | Cumple |
| AC-11 | `stage6.test.ts`: Validar campaña usa los datos reales y declara que es simulado | Cumple |
| AC-12 | `stage6.test.ts` y navegador: regla determinista; "Requiere EIPD" sin botón y con la leyenda del proceso 14 | Cumple |
| AC-13 | `csv.test.ts`, `map.test.ts`, `reports.test.ts` y navegador: BOM, `;`, solo lo visible y leyenda al final | Cumple |
| AC-14 | Navegador: 17 rutas como Legal sin controles de acción; `#/alertas` y parámetros dan "Sin permisos" | Cumple |
| AC-15 | `acceptance.test.ts`, `store.test.ts` y navegador: Reiniciar vuelve al estado inicial exacto (datos, reloj, eventos, parámetros, rol) | Cumple |
| AC-16 | `store.test.ts` y navegador: la falla no consume el evento; Reintentar aplica el normal | Cumple |
| AC-17 | `store.test.ts` y navegador: recarga conserva el estado; almacenamiento bloqueado funciona en memoria con aviso | Cumple |
| AC-18 | `acceptance.test.ts`: los eventos y avisos externos terminan en "(simulado)" | Cumple |
| AC-19 | `acceptance.test.ts`: ningún archivo menciona Ticketator; los 12 procesos no tienen ruta | Cumple |
| AC-20 | Tests de dominio y navegador: rechazar, observar, improcedente y retroceder, de punta a punta | Cumple |
| AC-21 | `domain.test.ts` y `map.test.ts`: 22 procesos, 14/5/3, 10 incluidos y 12 deshabilitados | Cumple |
| AC-22 | `domain.test.ts`, `status.test.ts` y `acceptance.test.ts`: estado por proceso y categoría = peor de los incluidos | Cumple |
| AC-23 | Navegador: cada módulo muestra la ficha con los datos del catálogo (misma fuente) | Cumple |
| AC-24 | `stage6.test.ts`: sin garantía en rojo; al definirla se recalcula | Cumple |
| AC-25 | `reports.test.ts` y navegador: la minuta se compone con datos vigentes, se imprime y actualiza la fecha del Dashboard | Cumple |

## Guion de demo (MD §10)

Recorrido completo en el navegador, desde un estado limpio: Dashboard y Mapa, E1 y ARCOP-0009 (asignar, recordatorio), E2 y E3 (por vencer, prórroga), E4 y RAT (5 vistos buenos, versión 13), E5 y E6, E7 (camino alternativo por la prórroga) y E8 con la autodenuncia hasta la constancia, matriz con "Requiere EIPD", comités y acta, vista Legal (Resumen, Mapa, minuta, CSV) y Reiniciar. Sin errores de consola.

## Lo que no se verificó

- La impresión real (`window.print`) solo se comprobó por el código y los estilos; no se abrió el diálogo de impresión.
- No hay tests automáticos de interfaz: los recorridos en navegador fueron manuales (scripts) y no quedan como suite.
- Accesibilidad: sin auditoría con lector de pantalla ni herramientas automáticas. Revisado a mano: foco, teclado básico, modales, drawer y errores asociados.
- Fidelidad visual comparada a ojo contra las capturas en las pantallas principales, no pixel a pixel en las 21.
- No se probó en Safari ni Firefox, ni se desplegó a GitHub Pages.

## Decisiones tomadas donde el MD no era concluyente

- La Autodenuncia exige los 4 campos de la evaluación (gravedad, datos, titulares, causa) aunque el MD diga "tres".
- "Próximos pasos" de la minuta muestra "—" (pendiente de H2D, README); "Generar minuta" solo lo ve el Analista.
- Una solicitud ARCOP Nueva pasa a "En gestión" al asignar analista o tocar una subtarea.
- El % de cerradas dentro de plazo excluye las improcedentes.
- Validar campaña: habilitados = el menor entre la lista y los vigentes.
- Reevaluar un proyecto con respuestas distintas invalida su checklist firmado.
- La solicitud RAT "Recibida en D0" también queda fuera de plazo en D0+16 (15 días de plazo desde la recepción).
- Las solicitudes RAT guardan la propuesta de contenido de la actividad.

## Pendientes abiertos (MD §12 y README)

Logo y HEX oficiales de H2D; textos reales de los 12 ítems MPI y de los 5 aprobadores del RAT; subdominio definitivo; origen de "Próximos pasos"; plazos legales de demostración por validar con el equipo legal de H2D.

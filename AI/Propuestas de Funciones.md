# AegiFitness: funcionalidades implementadas y pendientes

> Auditoría realizada contra el código actual del proyecto el 18 de agosto de 2026.
> La clasificación distingue entre una función completa, una base parcial y una función ausente. No se asumió que una pantalla o dependencia equivale a una función terminada.

## Resumen ejecutivo

AegiFitness ya supera la etapa de “rutinas + dietas”. Actualmente cubre buena parte del ciclo:

**Planificar → registrar → medir parcialmente → motivar → exportar**

El principal hueco está entre **registrar** y **adaptar**. El modelo actual registra un resultado agregado por ejercicio, no cada serie. Esto impide construir correctamente historial por ejercicio, récords personales, sobrecarga progresiva, comparación de rendimiento y adaptación automática.

La prioridad recomendada es fortalecer primero ese modelo de datos y el seguimiento corporal. Después conviene ampliar análisis, estilo de vida y funcionamiento offline. La IA debería llegar al final, cuando existan datos históricos suficientemente detallados y confiables.

## Lo que ya está implementado

### Núcleo de la plataforma

- [x] Registro, inicio y cierre de sesión con JWT y refresh tokens.
- [x] Perfil y onboarding con sexo, fecha de nacimiento, altura, peso, peso objetivo, actividad y objetivo físico.
- [x] Roles de administrador y miembro.
- [x] Sistema de licencias con aprobación, suspensión, expiración y revocación.
- [x] Administración de usuarios, roles, perfiles, configuraciones y licencias.
- [x] Interfaz responsive con temas claro y oscuro.
- [x] PWA instalable con actualización automática y caché de recursos estáticos e imágenes de ejercicios.

### Planificación de entrenamiento

- [x] Rutina semanal generada según días disponibles, modalidad, grupos musculares y objetivo.
- [x] Soporte para gimnasio, calistenia y modalidad combinada.
- [x] Esquemas diferenciados para culturismo, salud, combinado, clásica, militar y CrossFit.
- [x] Rotación de ejercicios basada en uso reciente para reducir repeticiones del catálogo.
- [x] Regeneración manual de la rutina.
- [x] Cambio de ejercicios y adición de ejercicios extra.
- [x] Entrenamiento libre con acceso a todo el catálogo, sin limitarlo al músculo recomendado del día.
- [x] Catálogo paginado de ejercicios con búsqueda y filtros.
- [x] Guías con imágenes, dificultad, equipamiento, instrucciones, músculos objetivo y efecto.

### Registro real de entrenamiento: implementación parcial

- [x] Registro diario del entrenamiento realizado.
- [x] Series, repeticiones y peso reales por ejercicio.
- [x] Estado completado o pendiente.
- [x] Ejercicios adicionales fuera de la rutina.
- [x] Historial general de los últimos 30 días.
- [x] Cálculo de volumen por grupo muscular durante los últimos siete días.
- [ ] El registro no guarda cada serie individualmente. Actualmente almacena un único valor agregado de series, repeticiones y peso por ejercicio.
- [ ] La hora de inicio y finalización se guarda prácticamente al mismo tiempo al enviar el registro; todavía no representa la duración real de una sesión.

### Nutrición

- [x] Cálculo de TDEE, calorías objetivo y macronutrientes a partir del perfil.
- [x] Plan diario de alimentación distribuido por tiempos de comida.
- [x] Selección de platillos por objetivo y proximidad a calorías y macros.
- [x] Penalización de repeticiones recientes para ofrecer mayor variedad.
- [x] Registro real de calorías, proteína, carbohidratos, grasas, porciones y tipo de comida.
- [x] Registro libre desde todo el catálogo.
- [x] Entrada manual para alimentos que no existen en el catálogo.
- [x] Cambio de cantidades y recálculo de macros.
- [x] Sustitución de platillos, priorizando el mismo tipo y una proteína similar.
- [x] Ajuste de porciones de la sustitución para conservar aproximadamente las calorías.
- [x] Catálogo completo y paginado de comidas con búsqueda y filtros nutricionales.
- [x] Recetas con porciones, macros, azúcares, ingredientes y preparación.
- [ ] Una entrada manual se registra en el día, pero no crea un alimento reutilizable dentro del catálogo personal.
- [ ] No existen recetas personales, favoritos, plantillas, copia de comidas ni duplicación de días.

### Seguimiento y analítica existentes

- [x] Registro histórico de peso con fecha y notas.
- [x] Gráfica de peso de hasta 90 días.
- [x] IMC calculado a partir del peso y la altura actuales.
- [x] Diferencia de peso a siete y treinta días.
- [x] Promedios semanales de calorías y proteína.
- [x] Entrenamientos de la semana y total histórico.
- [x] Gráfica de XP de los últimos 14 días.
- [x] Volumen semanal agrupado por músculo.
- [x] Métrica de actividad/adherencia a siete y treinta días.
- [ ] La adherencia actual sólo mide días con alguna actividad de entrenamiento o comida. No representa todavía cumplimiento real del plan de entrenamiento y nutrición.

### Objetivos, rachas y gamificación

- [x] Sistema de XP, niveles y títulos.
- [x] Logros desbloqueables con progreso y recompensas.
- [x] Logros por entrenamientos, alimentación, proteína, peso, constancia y actividad extra.
- [x] Racha general basada en días consecutivos con entrenamiento o alimentación registrada.
- [x] Metas de peso, entrenamientos semanales, proteína diaria y metas personalizadas.
- [x] Fecha límite, progreso, estado activo, completado y abandonado.
- [ ] No hay rachas independientes para entrenamiento, nutrición, peso, agua o pasos.
- [ ] Los días de descanso programados no se consideran explícitamente en la racha.
- [ ] Las metas personalizadas no tienen una fuente automática para actualizar su progreso.
- [ ] La finalización automática usa la misma regla `actual >= objetivo` para todos los tipos; una meta de pérdida de peso necesita la dirección contraria.

### Dashboard, exportación y consulta

- [x] Dashboard diario con rutina, calorías, proteína, peso, racha, nivel y progreso semanal.
- [x] Registro rápido de un entrenamiento o una comida no recomendados.
- [x] Exportación diaria, semanal y mensual.
- [x] Exportación separada de entrenamiento, nutrición o ambos.
- [x] Archivos HTML y Markdown descargables.
- [x] Exportación PDF mediante la opción “Guardar como PDF” del diálogo de impresión.
- [x] Los reportes muestran usuario, fecha de generación, rango, plan recomendado y registro real.
- [x] Vista Guía independiente con todos los ejercicios y comidas disponibles, buscadores, filtros y detalles completos.

## Comparación directa con las 22 propuestas

| # | Propuesta | Estado actual |
|---:|---|---|
| 1 | Seguimiento corporal | Parcial: peso, notas, IMC y gráfica; faltan medidas, composición y fotos. |
| 2 | Registro real de entrenamientos | Parcial: existe por ejercicio, pero no por serie individual. |
| 3 | Modo entrenamiento | Parcial: edición y completado en la vista diaria; faltan sesión enfocada, temporizador y duración real. |
| 4 | Progressive overload | Base mínima: se calcula volumen, pero no hay estrategia ni sugerencias de progresión. |
| 5 | Historial por ejercicio | No implementado. |
| 6 | Récords personales | No implementado. |
| 7 | Calendario fitness | No implementado. |
| 8 | Adherencia y consistencia | Parcial: hay porcentajes, pero miden presencia de actividad y no cumplimiento real. |
| 9 | Rachas | Parcial: existe una racha general. |
| 10 | Nutrición profunda | Mayormente implementada; faltan reutilización, favoritos y duplicación. |
| 11 | Lista de compras | No implementada. |
| 12 | Sustituciones inteligentes | Parcial y funcional: calorías, tipo y proteína; falta equivalencia nutricional más completa. |
| 13 | Objetivos | Parcial: sistema formal disponible, con limitaciones de dirección y actualización. |
| 14 | Cardio | No implementado como dominio registrable. |
| 15 | Pasos y actividad diaria | No implementado. |
| 16 | Recuperación | No implementado. |
| 17 | Dashboard analítico | Parcial: métricas básicas y volumen; faltan comparaciones completas entre períodos. |
| 18 | Reporte semanal automático | Parcial: se puede exportar una semana manualmente, pero no se genera ni resume automáticamente. |
| 19 | Sistema de niveles | Implementado. |
| 20 | Coach con IA | No implementado. |
| 21 | Adaptación automática del plan | Parcial muy básica: hay variedad y ajuste por objetivo, pero no adaptación por rendimiento o adherencia. |
| 22 | Offline-first | Parcial técnico: PWA y caché estático; no hay lectura/escritura offline de datos ni sincronización. |

## Lo que falta implementar, desde lo más urgente

### P0 — Fundamentos necesarios para que el seguimiento sea confiable

1. **Registro por serie y modelo real de sesión de entrenamiento**
   - Crear una entidad por serie con peso, repeticiones, estado, RIR/RPE opcional y orden.
   - Registrar inicio, pausas, finalización y duración real.
   - Permitir agregar, eliminar, saltar o repetir series.
   - Es la dependencia principal para historial, PR, sobrecarga progresiva y adaptación.

2. **Modo entrenamiento móvil**
   - Flujo enfocado en un ejercicio y una serie a la vez.
   - Temporizador de descanso, vibración/notificación, progreso, siguiente ejercicio y sesión pausada.
   - Mostrar el resultado de la sesión anterior para el mismo ejercicio.

3. **Historial por ejercicio, récords personales y 1RM estimado**
   - Página individual por ejercicio.
   - Peso máximo, repeticiones, volumen, frecuencia y 1RM estimado.
   - Detección automática de PR y conexión con logros y XP.

4. **Corregir y fortalecer los objetivos existentes**
   - Manejar metas ascendentes y descendentes correctamente.
   - Evitar que “bajar a 78 kg” se complete por estar por encima de 78 kg.
   - Definir actualización para metas personalizadas o permitir actualización manual.
   - Añadir metas de cintura, fuerza, grasa corporal y consistencia cuando existan sus datos.

5. **Seguimiento corporal completo**
   - Grasa corporal, masa muscular, cintura, cadera, pecho, cuello, brazos y piernas por lado.
   - Fotos privadas de progreso y notas.
   - Comparaciones por período y tendencias, no sólo el último valor.

6. **Adherencia real en lugar de presencia de actividad**
   - Entrenamiento: ejercicios/series completadas frente a lo programado.
   - Nutrición: calorías y macros dentro de tolerancias configurables.
   - Separar adherencia de entrenamiento, nutrición y cumplimiento general.
   - Excluir correctamente los descansos programados.

### P1 — Cerrar el ciclo “registrar → analizar → progresar”

7. **Progressive overload determinista**
   - Doble progresión, aumento de peso, repeticiones y series.
   - Reglas configurables y auditables antes de incorporar IA.
   - Recomendación para la próxima sesión basada en series reales, no en valores agregados.

8. **Calendario fitness unificado**
   - Vista mensual con entrenamiento, nutrición, peso y cumplimiento.
   - Detalle diario y acceso rápido para completar o corregir registros.
   - Preparar el calendario para agua, pasos, cardio y recuperación futuros.

9. **Analítica comparativa**
   - Semana contra semana y mes contra mes.
   - Duración, volumen, frecuencia, adherencia, peso y PR.
   - Filtros por período, músculo y ejercicio.

10. **Offline-first real**
    - Caché de rutina, dieta, guía y últimos registros.
    - Cola local para entrenamientos, comidas y peso sin conexión.
    - Sincronización posterior con estados visibles, reintentos e identificación de conflictos.

11. **Reporte semanal automático**
    - Resumen semanal con adherencia, peso, entrenamientos, volumen y PR.
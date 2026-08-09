# Skill: Domain-Driven Design & Stack Best Practices
* **Uso:** Automático al editar archivos de lógica pura o configuración.

## Instrucciones de Ejecución
1. Aplica un único pipeline de mutación de estado con clamps para las variables centrales (`money`, `moral`, `fatiga`, `presión`, `rating-delta`).
2. Asegura que la función `penalidad(posCarta, slot)` use de forma exclusiva la matriz de vecindades de `data/posiciones.js`.
3. Restringe rígidamente el slot `ARQ` para que solo acepte tipos `POR`.

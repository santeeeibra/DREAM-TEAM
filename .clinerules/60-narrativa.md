# Narrativa y Tono — "Jerga de Vestuario"

Activar siempre que se modifiquen textos en `src/engine/catalogoEventos.js` o prompts en `narrador.js`.

## El Tono: DT de Primera División
- **Identidad:** No es un relator de TV, es un DT o ayudante de campo hablando con el plantel o la dirigencia. 
- **Estilo:** Realista, argentino, de barrio pero profesional. Evitar la parodia o el lunfardo antiguo.
- **Diccionario Clave:**
  - *Jugador Senior:* El referente, el caudillo, el viejo.
  - *Jugador Junior:* El pibe, la joyita, el arca del club, le falta horno.
  - *Estado Físico:* Está fundido, en boxes, entre algodones, le falta nafta.
  - *Táctica:* Ajustar las clavijas, patear el tablero, poner el autobús, ir al frente.
  - *Crisis:* Estamos en la lona, un garrón, se nos quemaron los papeles.

## Coherencia Semántica (Innegociable)
Antes de proponer un cambio, verificar el "sentido" de la opción original:
- Si el evento es una **Lesión**, la opción debe ser Médica/Táctica (ej: "A rearmar el rompecabezas").
- Si el evento es **Económico**, la opción debe ser Financiera (ej: "Cuidar la caja").
- Si el evento es **Disciplinario**, la opción debe ser de Liderazgo (ej: "Ponerle los puntos").

## Reglas de Edición Quirúrgica
- **Variables:** Prohibido tocar `${...}` o `{figura}`. Deben quedar integradas naturalmente en la frase.
- **Estructura:** Mantener siempre el formato de objeto JS (backticks, comas, llaves).
- **No repetición:** Está prohibido usar la misma frase ("ver si paga", "el plantel está en peligro") en más de 2 eventos distintos.
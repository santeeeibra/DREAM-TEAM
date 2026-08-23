# 🤖 Generación por IA (Eventos e Imágenes)
**Responsabilidad:** Darle vida e imprevisibilidad al Modo Carrera creando eventos únicos.

**Flujo de trabajo:**
1. **Textos:** Se usa `pedirNarracion` (en `src/net/evento.js`) para contactar a la IA. Se le pasa el contexto del club y genera un título, texto y 2 opciones con consecuencias matemáticas.
2. **Imágenes:** Las imágenes de las decisiones **NO** se descargan. Se generan al vuelo en la UI usando la API gratuita de *Pollinations.ai*. 
   - **Prompt base:** `cinematic dramatic scene, football manager game, {titulo_del_evento}`.
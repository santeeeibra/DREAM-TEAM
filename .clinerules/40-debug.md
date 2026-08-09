# Protocolo de debug

Activar cuando algo rompe o no anda como debería.

1. **Reproducí primero.** Corré el harness o el flujo y pegame el error
   real. No propongas fix sobre un error imaginado.
2. **Una hipótesis por vez.** Decime cuál es antes de tocar código.
3. **El fix más chico que resuelve.** Nada de "ya que estoy, reordeno".
4. **Verificá que el bug se fue** y que no rompiste el resto del loop:
   crear DT → draft → 11 → tramo de temporada → resumen.
5. Si después de 2 intentos sigue, **pará y escribime**:
   qué probaste, qué esperabas, qué pasó.

## Sospechosos habituales en este proyecto
- Shape de datos que llega distinto de Supabase vs del mock.
- Estado mutado fuera del camino único (buscá asignaciones directas).
- Respuesta de GROQ que no valida y cae al fallback sin que se note.
- Snapshot vs recalculado mezclados en la misma pantalla.

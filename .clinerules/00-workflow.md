# Workflow — OBLIGATORIO EN CADA TAREA

## PASO 0 — Antes de cualquier cosa
Leer `MAPA-CODIGO.md` en la raíz del proyecto.
Este archivo lista todos los archivos y sus funciones con número de línea.
Usarlo para ubicar el código relevante SIN hacer búsquedas adicionales.

Si `MAPA-CODIGO.md` no existe, pedirle al usuario que ejecute:
`.\generar-mapa.ps1` desde `D:\dev\dream-team`

## PASO 1 — Identificar el objetivo
Con el mapa en mano, declarar:
- Archivo exacto a modificar (con path completo)
- Número de línea aproximado
- Nombre de la función/bloque a tocar

Esperar confirmación antes de continuar.

## PASO 2 — Leer SOLO lo necesario
Leer únicamente la función o sección identificada en el mapa.
Máximo 2 archivos por tarea sin confirmación explícita.
NUNCA leer main.js completo (1400+ líneas).

## PASO 3 — Proponer el cambio
Mostrar exactamente qué líneas cambian y cómo.
Formato: línea actual → línea nueva.
Esperar "ok" o "adelante" antes de editar.

## PASO 4 — Editar quirúrgicamente
Usar str_replace apuntando al bloque exacto.
Si falla el str_replace, leer SOLO las líneas del entorno (±20 líneas)
y volver a intentar. No leer el archivo completo.

## PASO 5 — Confirmar
Declarar qué se cambió y en qué líneas.
No hacer cambios adicionales no solicitados.

---

## Entorno de desarrollo
- Stack: Vanilla JS ES Modules + HTML5 + CSS puro. Sin frameworks.
- Modelo: LiteLLM proxy (localhost:4000) con fallback automático
- Si hay error de conexión, el proxy no está corriendo
- Proyecto: D:\dev\dream-team
- Mapa del código: D:\dev\dream-team\MAPA-CODIGO.md

## Reglas de busqueda
- Buscar siempre en el MAPA-CODIGO.md primero
- Si necesitas grep: `findstr /s /n "termino" src\*.js`
- Nunca usar herramientas internas como graphify para buscar código

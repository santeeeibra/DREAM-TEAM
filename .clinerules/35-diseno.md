# REGLAS DE DISEÑO — Dream Team Modo Carrera
# Activar siempre que se toque CSS, layout, botones o componentes visuales.

## IDENTIDAD VISUAL (no negociable)
- Paleta: --noche, --panel, --fluor (#FF5E1A), --led (#6FE39A), --rojo, --ambar
- Tipografía: Anton (títulos), Barlow Condensed (labels/números), Barlow (cuerpo)
- Siempre usar variables CSS del :root. NUNCA hardcodear colores hex directamente.
- Border-radius: usar --r (4px legacy) o --radius-sm/md/lg según contexto.

## REGLAS DE LAYOUT
- Ningún elemento hijo puede tener width o min-width fijo que supere su contenedor.
- En mobile (max-width:560px) TODO debe caber en el viewport sin scroll horizontal.
- Si agregás una clase CSS nueva, SIEMPRE escribí la regla. Nunca dejes una clase sin estilos.
- **Grid responsivo:** usar `minmax(min(160px, 100%), 1fr)` en vez de `minmax(160px, 1fr)` para evitar overflow.
- **Stacks:** siempre agregar `max-width:100%; overflow-x:hidden` a contenedores flex-direction:column.
- Antes de agregar un contenedor nuevo, correr en consola:
  ```js
  [...document.querySelectorAll('*')].filter(el => el.scrollWidth > window.innerWidth)
  ```
  Si devuelve elementos, hay overflow — arreglarlo antes de continuar.

## JERARQUÍA DE BOTONES (siempre respetar)
- `.btn` (naranja relleno) = acción primaria única por pantalla
- `.btn.ghost` = acción secundaria
- `.btn.tertiary` = acción terciaria — NUNCA usar `color:var(--humo)` sin box-shadow visible
- Área táctil mínima en mobile: 48px de alto

## COMPONENTES CRÍTICOS

### Sobres (.pack-container)
- SIEMPRE `position:relative` para que `.pack-glow` y `.pack-particles` no rompan el layout
- Width: `clamp(180px,22%,240px)` — responsive sin overflow
- Hover: `translateY(-6px) scale(1.03)` con easing `cubic-bezier(.2,.7,.2,1)`
- Label dentro del contenedor, nunca como hermano

### Slots del 11 (.slot)
- En mobile: `width:clamp(48px,17.5vw,68px)`
- Slot ARQ reservado exclusivamente para cartas POR (DDD)
- Penalidad fuera de posición: 0 (natural) / 5 (vecino) / 12 (fuera)

## CHECKLIST ANTES DE HACER COMMIT
Antes de dar una tarea por terminada, verificar visualmente:
1. ¿El elemento nuevo se ve en mobile (375px) sin scroll horizontal?
2. ¿Las clases CSS nuevas tienen sus reglas escritas en index.html?
3. ¿Los colores usan variables del :root?
4. ¿Los botones tienen min-height:48px en mobile?
5. ¿Los contenedores flex/grid nuevos tienen flex-wrap o manejo de overflow?

## WORKFLOW OBLIGATORIO
1. Leer MAPA-CODIGO.md primero
2. Identificar el selector exacto antes de escribir CSS nuevo
3. Buscar si la clase ya existe antes de crearla (grep o search_codebase)
4. Testear el cambio en 375px de ancho antes de reportar éxito

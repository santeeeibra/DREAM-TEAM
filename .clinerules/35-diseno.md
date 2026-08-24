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

## ESPACIADO VERTICAL (compacto y respirable)
- **Contenedor principal** `#app`: `padding:16px 18px 60px` (antes: 20px/80px)
- **`.stack`** (contenedores de secciones): `gap:10px` (antes: 16px)
- **`.panel`** (cajas de contenido): `padding:14px` (antes: 18px)
- **Headers**:
  - `h1`: `margin-bottom:8px`
  - `h2`: `margin-bottom:6px`
  - `h3`: `margin-bottom:4px`
  - `.eyebrow`: `margin-bottom:6px`
- **Formularios**:
  - **`.ob-form`**: `gap:16px` para separar grupos de campos
  - **`.form-field`**: `display:flex; flex-direction:column; gap:8px` — agrupa label + input/dropdown para alineación visual perfecta
  - Cada label + su campo van dentro de un `.form-field` (no como hermanos sueltos del stack)
- **Eventos**:
  - `.evento-copa-header`: `gap:12px; margin-bottom:12px` (antes: 16px/20px)
  - `.evento-copa-titulo`: `margin:8px 0 6px` (antes: 12px 0)
  - `.evento-copa-texto`: `margin:6px 0 12px; line-height:1.5` (antes: 12px 0 20px; 1.6)
- **Decisiones**:
  - `.decision-grid`: `gap:10px; margin-top:10px` (antes: 14px/16px)
  - `.decision-card`: `gap:8px; padding:14px 16px` (antes: 10px/18px)
  - `.decision-label`: `padding-bottom:8px; margin-bottom:8px` (antes: 12px/12px)
- **Botones de continuación**: `.btn-continuar`: `margin-top:12px` (antes: 20px)
- **Bench section**: `margin-top:10px` (antes: 14px); `.eyebrow`: `margin-bottom:4px` (antes: 6px)
- **Separadores**:
  - `.row`: `gap:10px` (antes: 12px)
  - `.sep`: `margin:8px 0` (antes: 6px)
  - `.packs-grid + *`: `margin-top:20px; padding-top:16px` (antes: 28px/20px)

**Regla general:** Preferir espacios más compactos (8-12px) entre elementos relacionados, dejando espacios mayores (16-20px) solo para separar secciones conceptualmente distintas.

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
6. ¿Los espaciados verticales respetan las reglas compactas (8-12px entre elementos relacionados)?

## WORKFLOW OBLIGATORIO
1. Leer MAPA-CODIGO.md primero
2. Identificar el selector exacto antes de escribir CSS nuevo
3. Buscar si la clase ya existe antes de crearla (grep o search_codebase)
4. Testear el cambio en 375px de ancho antes de reportar éxito

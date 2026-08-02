# Roadmap técnico — Ultimate Team casero

Regla general para no gastar tokens de más:
- **Claude Code**: para generar bloques grandes de una sola vez (schema completo, una Edge Function entera, un script de seed). Pedile el bloque completo, no vayas iterando línea por línea.
- **Cline**: para iteración visual barata — ajustar componentes de UI, animaciones, estilos. Es donde conviene "ir y venir" muchas veces, porque son cambios chicos.
- **Claude Pro (este chat)**: para planificar y decidir arquitectura *antes* de escribir código, y para operar Supabase/Vercel vía MCP sin abrir la terminal (útil desde el celu).
- **Vos, a mano**: crear cuentas/proyectos, pegar SQL generado en el SQL Editor, conseguir API keys, probar en el navegador y reportar el bug puntual (no le pidas al agente que "revise todo el proyecto" de nuevo), hacer commit/push cuando el cambio es trivial.

---

## Fase 1 — Schema de datos

**Herramienta:** Claude Code

**Prompt:**
```
Actuás como arquitecto de backend para un juego de cartas estilo Ultimate Team.
Necesito el schema completo en Postgres para Supabase con estas entidades:
users, cards (catálogo), card_instances (inventario por usuario), packs,
pack_cards (probabilidades por rareza), pack_openings, market_listings,
transactions, achievements, user_achievements.

Para cada tabla: columnas, tipos, foreign keys, índices necesarios, y las
políticas RLS necesarias para que cada usuario solo pueda ver/modificar sus
propios datos (cards y packs son catálogo de lectura pública).

Generá todo en un archivo migrations/001_init.sql listo para pegar en el
SQL Editor de Supabase. No implementes nada de frontend todavía.
```

**Manual:** crear el proyecto en supabase.com, copiar las env vars a `.env.local`,
pegar el SQL generado en el SQL Editor y ejecutarlo vos mismo (en vez de que
el agente lo aplique vía MCP en cada iteración — ahorra tokens porque no
tiene que ir y volver chequeando el estado real de la DB).

**Skill:** ninguna específica.

---

## Fase 2 — Auth básico

**Herramienta:** Claude Code

**Prompt:**
```
Integrá Supabase Auth (email/password) en el frontend de Vercel. Necesito:
login, registro, logout, y un hook useUser() que exponga el usuario logueado
al resto de la app. Guardá el token en cookies, no en localStorage.
```

**Manual:** habilitar el proveedor de Auth en el dashboard de Supabase, y
configurar las redirect URLs en Vercel.

**Skill:** ninguna.

---

## Fase 3 — Catálogo de 200 jugadores

**Herramienta:** Claude Code (script de una sola vez, no producción)

**Prompt:**
```
Escribime un script node de un solo uso (scripts/seed-players.js) que:
1. Llame a API-Football (RapidAPI) y traiga jugadores de las ligas que le
   indique hasta juntar 200.
2. Calcule un rating propio por posición con esta fórmula: [pegá acá la
   fórmula que definiste en tu plan].
3. Genere un archivo players-seed.json listo para insertar en Supabase
   (sin fotos reales ni escudos oficiales, solo texto/avatar genérico).
No hace falta que corra en producción ni que se automatice, es un script
manual de una sola vez.
```

**Manual:** conseguir vos mismo la API key de RapidAPI (dato sensible, no la
pegues en el prompt), correr el script una sola vez en tu máquina, revisar a
ojo el JSON generado, e importarlo en Supabase (Table editor → Import
CSV/JSON, o pegando un INSERT masivo en el SQL Editor).

**Skill:** opcional, `xlsx` si querés revisar los 200 jugadores en una
planilla antes de importarlos (más cómodo para detectar errores a ojo).

---

## Fase 4 — Apertura de sobres (núcleo del juego)

**Herramienta:** Claude Code

**Prompt:**
```
Implementá una Supabase Edge Function llamada open-pack que:
1. Recibe pack_id y toma el user_id del JWT.
2. Valida que el usuario tenga saldo suficiente de moneda del juego.
3. Descuenta el saldo.
4. Selecciona N cartas al azar respetando las probabilidades por rareza
   definidas en pack_cards.
5. Inserta el resultado en card_instances y pack_openings, todo dentro de
   una transacción atómica.
6. Devuelve las cartas obtenidas.
Todo el cálculo de probabilidad tiene que ser server-side, nunca confiar en
lo que mande el cliente.
```

**Manual:** deploy de la function (vía Supabase MCP acá en el chat, es
rápido), y probarla vos con un par de llamadas manuales (curl/Postman) antes
de conectarla a la UI — así detectás bugs de lógica sin gastar tokens de
agente en debugging.

**Skill:** ninguna.

---

## Fase 5 — UI de inventario

**Herramienta:** Cline

**Prompt:**
```
Creá un componente CardGrid que lea el inventario del usuario logueado
(/api/inventory) y muestre cada carta con nombre, club, posición y rating,
con estética de carta coleccionable: borde de color distinto según rareza
(bronze/silver/gold/special), sin usar escudos oficiales ni fotos reales.
```

**Manual:** revisar visualmente en el navegador e ir pidiéndole ajustes
chicos a Cline (tipografía, espaciado, tamaño de carta) — es la parte más
barata en tokens porque son cambios acotados.

**Skill:** `frontend-design` (pedile a Cline que la tenga en cuenta para no
caer en un estilo "default" de Tailwind).

---

## Fase 6 — Mercado

**Herramienta:** Claude Code (backend) + Cline (UI)

**Prompt para Claude Code:**
```
Agregá endpoints para listar una carta en el mercado (market_listings),
comprarla (con transacción atómica que mueva la carta y descuente/sume
saldo) y cancelar una publicación propia. Reforzá todo con políticas RLS:
un usuario solo puede listar/cancelar sus propias cartas, y comprar con
sus propias monedas.
```

**Prompt para Cline (después):**
```
Creá una vista de Mercado: lista de publicaciones activas con filtro por
posición y rareza, botón de compra, y una sección "mis publicaciones" con
opción de cancelar.
```

**Manual:** probar el flujo completo comprando/vendiendo entre dos usuarios
de prueba vos mismo antes de seguir.

**Skill:** `frontend-design` para la vista del mercado.

---

## Fase 7 — Progresión (XP y logros)

**Herramienta:** Claude Code (lógica) + Cline (badges/UI)

**Prompt para Claude Code:**
```
Implementá un sistema simple de XP: cada partida/acción suma XP a
user_stats, y cuando se cruza un umbral se desbloquea un achievement de
la tabla achievements (insert en user_achievements). Exponé un endpoint
/api/progress que devuelva nivel actual, XP y logros desbloqueados.
```

**Manual:** definir vos los umbrales y qué acciones dan XP (es una decisión
de diseño, no conviene delegarla).

**Skill:** ninguna para la lógica; `frontend-design` para los badges.

---

## Fase 8 — Pulido: animación de apertura de sobre

**Herramienta:** Cline (iteración visual, muchas vueltas, barato)

**Prompt:**
```
Diseñá la animación de apertura de sobre: el sobre se abre, las cartas
se revelan una por una con un efecto de suspenso mayor cuanto más alta
la rareza (ej. shake + glow antes de revelar una carta gold).
```

**Manual:** mirar la animación en el navegador y pedir ajustes de timing
a ojo — este es el momento donde más vale la pena iterar visualmente en
vez de describir en texto lo que querés.

**Skill:** acá conviene usar `apple-design`, `emil-design-eng` y
`review-animations` — pedile a Cline que revise el resultado contra esas
skills antes de darlo por terminado, es el punto del proyecto donde más
impacta la sensación de "producto pulido".

---

## Orden recomendado

Fases 1 y 4 en paralelo (son el corazón del juego). Recién después UI
(fase 5), mercado (6), progresión (7), y al final el pulido (8) — así no
gastás tiempo/tokens punliendo una animación sobre una lógica que todavía
puede cambiar.

# Plan: "Ultimate Team" Narrativo — 100% gratis

## 1. El concepto en una frase
Un Ultimate Team donde no controlás partidos con joystick ni con física: armás tu plantel abriendo "sobres" (con moneda del juego, no dinero real), y los partidos se resuelven por un algoritmo de stats + narrativa tipo Copero (texto + eventos, no control en tiempo real). Esto lo hace 100x más simple de programar que un FIFA arcade, y mantiene el gancho social: compartir tu equipo/resultados.

## 2. El loop del juego (lo que hace un usuario)
1. Crea cuenta (o juega como invitado con un ID local) → arranca con moneda inicial.
2. Abre sobres → obtiene jugadores random (rareza: bronce/plata/oro/leyenda) con stats.
3. Arma su 11 (formación simple, drag & drop o selección por posición).
4. Juega un partido: elige contra quién (CPU, otro jugador guardado, o "liga" asincrónica) → el motor simula el resultado con narrativa (texto tipo "minuto 34: gol de..." generado con reglas, no en vivo).
5. Gana moneda/XP según resultado → vuelve a abrir sobres → loop.
6. Comparte su plantel/resultado (imagen o link) en redes → trae gente nueva.

## 3. Por qué "sin control en tiempo real" es la decisión correcta
- Cero físicas, cero animación de jugadores, cero netcode.
- El "partido" es una simulación por turnos/eventos (como Copero), renderizada en texto o con una barra de progreso simple.
- Se puede armar en HTML/JS puro, que es tu stack actual en Movi.

## 4. Stack 100% gratis (usando lo que ya conocés)
| Necesidad | Herramienta | Plan gratis |
|---|---|---|
| Hosting frontend | Vercel | Free tier (igual que Movi) |
| Base de datos + auth | Supabase | Free tier (500MB DB, auth incluido) |
| Repo/código | GitHub | Gratis |
| Dominio | Subdominio de Vercel (tuapp.vercel.app) | Gratis (dominio propio es opcional y pago) |
| Imágenes de jugadores/escudos | Generás vos con CSS/SVG o iconos gratuitos (no fotos reales, evita temas de derechos) | Gratis |

No hace falta servidor propio, WebSockets ni nada con costo fijo: todo es requests HTTP normales a Supabase.

## 5. Modelo de datos (tablas en Supabase)
- `players`: id, nombre, posición, rareza, stats (ataque/defensa/físico/etc), imagen/ícono
- `packs`: tipo de sobre, probabilidades por rareza
- `users`: id (via Supabase Auth), moneda, xp
- `user_players`: qué jugadores tiene cada usuario (plantel)
- `matches`: resultado, narrativa generada, jugadores usados, fecha
- `leagues` (opcional, fase 2): tabla de posiciones asincrónica entre usuarios

## 6. Motor de partido (el corazón del juego)
No es física, es matemática simple:
- Suma de stats del 11 titular (con algo de peso por posición) + un factor random → determina goles de cada equipo.
- A partir del resultado numérico, generás el relato: elegís de una lista de "plantillas de eventos" (gol, atajada, tarjeta, lesión) y las vas insertando en minutos random.
- Esto es exactamente lo que hace Copero para sus eventos de carrera, aplicado a un partido en vez de a una temporada completa.

## 7. Multiplayer "libre" sin complicarte con tiempo real
Dos caminos, de menor a mayor esfuerzo:
- **Asíncrono (recomendado para empezar):** tu equipo guardado queda como "rival disponible" en la base. Otro usuario elige jugar contra vos, el motor simula usando tu plantel guardado. Vos ni te enterás en el momento — mirás el resultado después. Cero infraestructura de tiempo real.
- **Liga/torneo por turnos:** cada cierta cantidad de horas se simulan automáticamente los partidos pendientes (podés usar un Supabase Edge Function con cron gratis).
Evitá el 1v1 en vivo real: ahí sí necesitarías WebSockets y ya no es gratis a partir de cierta escala.

## 8. Economía del juego (importante)
- Moneda 100% virtual, ganada jugando — **nunca comprable con dinero real**. Esto evita entrar en el terreno legal de las loot boxes/gambling (varios países regulan sobres pagos con dinero real) y mantiene el proyecto simple y sin fricciones de pago.
- Si en el futuro querés monetizar, mejor camino: ads no intrusivos o "cosméticos" (skins de cancha, nombres de equipo especiales), nunca ventaja competitiva pagada.

## 9. Qué lo hace "shareable" (la parte que copia lo que funcionó en Copero)
- Pantalla de resultado de partido con diseño prolijo, lista para captura (marcador, goleadores, MVP).
- Pantalla de "mi plantel" con overall del equipo, tipo tarjeta de FIFA.
- Botón de "compartir" que genera una imagen o un link directo al equipo/resultado.

## 10. Roadmap sugerido (MVP en semanas, no meses)
1. **Semana 1:** modelo de datos en Supabase + generación de jugadores random + apertura de sobres (sin login, todo local storage al principio para probar rápido).
2. **Semana 2:** armado de plantel (11 titulares) + motor de simulación de partido vs. CPU.
3. **Semana 3:** login con Supabase Auth + guardar plantel en DB + pantalla de resultado shareable.
4. **Semana 4:** multiplayer asíncrono (jugar contra plantel de otro usuario guardado) + deploy en Vercel.
5. **Después:** ligas, torneos, temporadas, más rarezas de jugadores, eventos narrativos random durante el partido (lesiones, expulsiones).

## 11. Diferenciación de Copero (para no ser un clon)
Copero es carrera de UN jugador a lo largo del tiempo. Tu idea es construir y hacer crecer un EQUIPO con múltiples jugadores — esa mecánica de colección + formación es la de Ultimate Team, que Copero no tiene. Ahí está tu ángulo propio.

## 12. Usar jugadores reales — cómo hacerlo bien

**Qué es seguro usar:** nombre del jugador, club, posición, nacionalidad y estadísticas públicas (goles, asistencias, partidos). Los nombres y estadísticas son datos/hechos, no están protegidos por derechos de autor — es la misma base legal con la que operan apps de fantasy football hace 20 años.

**Qué conviene evitar (para no meterte en líos ni depender de licencias pagas):**
- Fotos reales de los jugadores → usá avatares genéricos (iniciales, silueta, ícono por posición). Es lo que hacen la mayoría de los fantasy games no oficiales.
- Escudos oficiales de clubes/selecciones → usá una versión simplificada propia o directamente texto con el nombre del club.
- Un sistema de "OVR" idéntico al de FIFA/EA (esa metodología de rating es propiedad de EA) → armá tu propia fórmula de rating a partir de stats públicas (ver más abajo).
- Cualquier mención de "oficial", "licenciado" o vinculación con la Liga/FIFA/clubes → agregá un disclaimer simple tipo "proyecto de fans, sin afiliación oficial".

Con esto el proyecto queda en la misma zona legal que cientos de apps de fantasy/quiz de fútbol que circulan gratis hoy.

### Fuente de datos para los 200 jugadores
**API-Football (api-football.com, vía RapidAPI):** tier gratis, ~100 requests/día, cubre +1200 competiciones con datos de jugadores y estadísticas en JSON. Es más que suficiente porque **no necesitás consultarla en vivo** — la idea es:

1. Elegís las ligas/equipos de donde vas a sacar los 200 jugadores (ej: Liga Profesional Argentina + algunas ligas top de Europa).
2. Hacés un script UNA VEZ (o pocas veces) que consulta la API y descarga nombre, club, posición, nacionalidad y stats básicas de esos 200 jugadores.
3. Guardás ese resultado directo en tu tabla `players` de Supabase. A partir de ahí el juego lee de tu propia base, no de la API — así nunca dependés del límite diario ni de que la API esté online.

### Tu propia fórmula de rating (en vez de copiar el OVR de FIFA)
Ejemplo simple para arrancar, por posición:
- **Delanteros:** rating = ponderar goles + asistencias + minutos jugados
- **Mediocampistas:** ponderar asistencias + pases + minutos
- **Defensores:** ponderar partidos jugados + (goles en contra del equipo, si tenés el dato) + minutos
- **Arqueros:** ponderar partidos jugados + vallas invictas si la API las da

Normalizás todo a una escala 1-99 y ya tenés tu propio sistema, sin copiar nada de EA.

## 13. Plan de desarrollo con Claude Code (fases concretas)

**Fase 0 — Setup (1 sesión con Claude Code):**
- Crear repo en GitHub, conectar a Vercel (deploy automático).
- Crear proyecto en Supabase, definir las tablas del punto 5 (`players`, `packs`, `users`, `user_players`, `matches`).

**Fase 1 — Los 200 jugadores reales:**
- Anotar qué liga(s)/equipos usar (esto lo definimos juntos: ¿todo de la Liga Profesional Argentina, o mezclar con top Europa para variedad?).
- Script en Node/Python que llama a API-Football, arma el JSON de los 200 jugadores con sus stats.
- Aplicar la fórmula de rating propia (punto 12) para asignarles un "overall".
- Insertar todo en la tabla `players` de Supabase — esto queda fijo, no se vuelve a tocar la API salvo que quieras actualizar la data más adelante.

**Fase 2 — Sobres y colección:**
- Lógica de apertura de sobres: tira random de la tabla `players` según probabilidad por rareza (definida por vos según el overall).
- Pantalla de "mi colección" con las cartas tipo FIFA (usando tu propio diseño de carta, no el de EA).

**Fase 3 — Armado de equipo y motor de partido:**
- Selección de 11 titulares por formación.
- Motor de simulación (punto 6) usando los stats reales de esos 200 jugadores.

**Fase 4 — Cuentas y multiplayer asíncrono:**
- Login con Supabase Auth.
- Guardar plantel de cada usuario, permitir desafiar planteles de otros usuarios (simulación asíncrona, punto 7).

**Fase 5 — Pulido shareable:**
- Pantalla de resultado y de plantel lista para captura/compartir.

Con 200 jugadores fijos cargados en Supabase desde el arranque, todo el resto del desarrollo (sobres, equipo, partidos) es trabajo 100% sobre tu propia base — no dependés de la API para nada del gameplay día a día.

// IMPURO (Supabase). El motor no importa este archivo: es la UI la que lo llama.
// El import de @supabase/supabase-js es dinámico y a prueba de fallos: si el
// navegador no puede resolver el paquete (abrir index.html directo, sin Vite),
// se captura, se avisa en consola y la carrera sigue con el fallback local.

// import.meta.env lo inyecta Vite; process.env cubre los harness en Node (scripts/*).
const env = import.meta.env ?? (typeof process !== 'undefined' ? process.env : {}) ?? {};

let supabase = null;
// Antipatrón evitado: un booleano "inicializado" no alcanza cuando hay
// llamadas concurrentes (ej. Promise.all pidiendo 3 sobres a la vez) — la
// 2ª/3ª llamada verían el flag en true y devolverían antes de que el
// import dinámico terminara, con `supabase` todavía null. Compartir la
// PROMESA de inicialización asegura que todas las llamadas esperen al
// mismo resultado.
let initPromise = null;

function initSupabase() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const url = env.VITE_SUPABASE_URL;
        const anonKey = env.VITE_SUPABASE_ANON_KEY;
        if (!url || !anonKey) {
          console.warn(
            '[dream-team] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
            'La apertura de sobres se resuelve con el fallback local del motor.'
          );
          return;
        }
        supabase = createClient(url, anonKey);
      } catch (e) {
        console.warn('[dream-team] No se pudo cargar @supabase/supabase-js:', e.message);
      }
    })();
  }
  return initPromise;
}

/**
 * Abre un sobre contra la Edge Function `open-pack` de Supabase.
 * Devuelve el array de cartas crudas (shape DB: { id, fut_id, nombre, pos,
 * overall_rating, rarity, league_id, edad }) o null si no se pudo.
 * null ⇒ el llamador usa el fallback local síncrono del motor.
 */
export async function fetchAbrirSobre({ managerId, packId, free = false } = {}) {
  await initSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke('open-pack', {
      body: {
        manager_id: managerId,
        pack_id: packId,
        free,
      },
    });
    if (error) {
      let detalle = error.message;
      try {
        const body = await error.context?.json();
        if (body) detalle = JSON.stringify(body);
      } catch (_) {
        try {
          detalle = await error.context?.text();
        } catch (_) {}
      }
      console.warn('[dream-team] open-pack falló:', detalle);
      return null;
    }
    return data?.cards ?? null;
  } catch (e) {
    console.warn('[dream-team] fallo de red al abrir sobre:', e.message);
    return null;
  }
}

/**
 * Trae los clubes jugables de una liga ('premier' | 'laliga') desde la
 * tabla `clubs`. Devuelve [] si no hay resultados, null si no se pudo
 * consultar (sin Supabase configurado o error de red/RPC).
 */
export async function fetchClubsPorLiga(liga) {
  await initSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('league', liga)
      .order('name');
    if (error) {
      console.warn('[dream-team] fetchClubsPorLiga falló:', error.message);
      return null;
    }
    return data ?? [];
  } catch (e) {
    console.warn('[dream-team] fallo de red al pedir clubes:', e.message);
    return null;
  }
}

/**
 * Crea el manager (DT) en la tabla `managers`. Devuelve el id creado o
 * null si no se pudo (sin Supabase configurado o error).
 */
export async function crearManager({ name, country, league_id, club_id, modo = 'facil' }) {
  await initSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('managers')
      .insert({ name, country, league_id, club_id, modo })
      .select('id')
      .single();
    if (error) {
      console.warn('[dream-team] crearManager falló:', error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.warn('[dream-team] fallo de red al crear manager:', e.message);
    return null;
  }
}
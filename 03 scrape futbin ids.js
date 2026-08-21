// SCRIPT 3: Buscar fut_id en FUTBIN para jugadores sin foto
// Ejecutar con: node 03-scrape-futbin-ids.js > futbin_updates.sql
//
// Este script busca cada jugador en FUTBIN por nombre,
// genera SQL para actualizar cards con fut_id y photo_url.
//
// PREREQUISITO: npm install node-fetch (si Node < 18)

const DELAY = 2000; // ms entre requests para no ser bloqueado
const RETRY_DELAY = 30000;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function searchFutbin(playerName) {
  const url = `https://www.futbin.com/search?term=${encodeURIComponent(playerName)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'Accept': 'application/json'
      }
    });
    if (res.status === 429) {
      console.error(`Rate limited, waiting ${RETRY_DELAY/1000}s...`);
      await sleep(RETRY_DELAY);
      return searchFutbin(playerName); // retry
    }
    if (!res.ok) return null;

    const data = await res.json();
    // FUTBIN search returns array of players
    if (Array.isArray(data) && data.length > 0) {
      return data[0]; // best match
    }
    return null;
  } catch (e) {
    console.error(`Error searching ${playerName}: ${e.message}`);
    return null;
  }
}

async function main() {
  // Lee jugadores sin foto desde Supabase REST API
  const SUPABASE_URL = 'https://vtulaokxfljnqbkudvbk.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0dWxhb2t4ZmxqbnFia3VkdmJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjQwNDksImV4cCI6MjEwMTAwMDA0OX0.eKY0KWFgALzcPynixNyqsBU9CuELJP74jeKVZvhJy1w';

  // Fetch cards that need fut_id (uses_generated_avatar = true OR fut_id is null)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/cards?select=id,name,club&uses_generated_avatar=eq.true&order=overall_rating.desc`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );
  const cards = await res.json();
  console.error(`Found ${cards.length} cards needing fut_id`);

  let found = 0;
  let notFound = 0;

  for (const card of cards) {
    const result = await searchFutbin(card.name);
    if (result && result.id) {
      const futId = result.id;
      const photoUrl = `https://cdn.futbin.com/content/fifa26/img/players/${futId}.png`;
      // Output SQL update
      const escapedName = card.name.replace(/'/g, "''");
      console.log(
        `UPDATE cards SET fut_id='${futId}', ` +
        `photo_url='${SUPABASE_URL}/storage/v1/object/public/player-photos/futbin/${futId}.png', ` +
        `photo_source_url='${photoUrl}', ` +
        `photo_credit='FUTBIN', ` +
        `uses_generated_avatar=false ` +
        `WHERE id='${card.id}';`
      );
      found++;
    } else {
      console.error(`NOT FOUND: ${card.name} (${card.club})`);
      notFound++;
    }
    await sleep(DELAY);
  }

  console.error(`\nDone: ${found} found, ${notFound} not found`);
}

main().catch(console.error);
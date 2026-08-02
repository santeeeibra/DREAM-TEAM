require('dotenv').config(); // Carga las variables del archivo .env
const { createClient } = require('@supabase/supabase-js');

// Tomamos las credenciales de tu .env (Vite usa VITE_ prefix por defecto)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: Faltan las variables de entorno de Supabase en el archivo .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Lógica de rating según el nivel del club (Tier)
function calculateRating(club) {
  const topTier = ['Manchester City', 'Arsenal', 'Liverpool', 'Real Madrid', 'Barcelona', 'Bayern Munich'];
  const midTier = ['Chelsea', 'Tottenham Hotspur', 'Manchester United', 'Aston Villa', 'Newcastle United', 'Inter Miami CF', 'Al Nassr'];
  
  if (topTier.includes(club)) return Math.floor(Math.random() * (94 - 86 + 1)) + 86; // 86-94
  if (midTier.includes(club)) return Math.floor(Math.random() * (85 - 80 + 1)) + 80; // 80-85
  return Math.floor(Math.random() * (79 - 70 + 1)) + 70; // 70-79
}

async function run() {
  console.log("⏳ Iniciando migración de jugadores aprobados...\n");
  let stats = { new: 0, updated: 0, removed: 0, failed: 0 };

  // 1. Buscar todos los cambios aprobados
  const { data: changes, error: fetchError } = await supabase
    .from('pending_changes')
    .select('*')
    .eq('status', 'approved');

  if (fetchError) {
    console.error("❌ Error leyendo pending_changes:", fetchError);
    return;
  }

  if (!changes || changes.length === 0) {
    console.log("✅ No hay jugadores pendientes de aprobación para aplicar.");
    return;
  }

  // 2. Procesar cada cambio individualmente
  for (const change of changes) {
    try {
      const payload = change.payload || {};

      if (change.change_type === 'new_player') {
        const rating = calculateRating(payload.club);
        const { error: insertError } = await supabase
          .from('cards')
          .insert({
            name: payload.name,
            club: payload.club,
            position_type: payload.position_type,
            rating: rating,
            is_active: true
          });
        
        if (insertError) throw insertError;
        stats.new++;

      } else if (change.change_type === 'club_change') {
        const rating = calculateRating(payload.club);
        const { error: updateError } = await supabase
          .from('cards')
          .update({ club: payload.club, rating: rating })
          .eq('id', change.card_id);
        
        if (updateError) throw updateError;
        stats.updated++;

      } else if (change.change_type === 'removed') {
        const { error: removeError } = await supabase
          .from('cards')
          .update({ is_active: false })
          .eq('id', change.card_id);
        
        if (removeError) throw removeError;
        stats.removed++;
      }

      // 3. Marcar el cambio como 'applied' para no repetirlo
      const { error: statusError } = await supabase
        .from('pending_changes')
        .update({ status: 'applied' })
        .eq('id', change.id);

      if (statusError) throw statusError;

    } catch (err) {
      console.error(`❌ Error procesando el cambio ID ${change.id}:`, err.message);
      stats.failed++;
    }
  }

  // 4. Imprimir resumen
  console.log("=== 📊 RESUMEN DE LA OPERACIÓN ===");
  console.log(`🟢 Cartas nuevas insertadas: ${stats.new}`);
  console.log(`🔵 Cartas actualizadas: ${stats.updated}`);
  console.log(`🟠 Cartas desactivadas: ${stats.removed}`);
  console.log(`🔴 Errores: ${stats.failed}`);
  console.log("==================================\n");
}

run();
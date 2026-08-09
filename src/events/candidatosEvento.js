// candidatosEvento.js — arma la lista de paquetes de evento "candidatos" que
// se le manda a la IA en /api/generar-evento.js para que elija cuál tiene
// más sentido narrativo. Solo habla con Supabase y hace la selección: no
// toca Phaser ni conoce nada de escenas.

// Fisher-Yates: mezcla un array de forma pareja (cada orden posible tiene la
// misma probabilidad). No modifica el array original, devuelve uno nuevo.
// Mismo estilo que mezclar() en src/packOpening/draftSquad.js.
function mezclar(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// obtenerCandidatosEvento trae del catálogo los paquetes de evento activos
// que ya desbloqueó la jornada actual, excluye los que ya se usaron en esta
// carrera (historialIds) y devuelve hasta `cantidad` de ellos, elegidos al
// azar de forma uniforme (acá no se pondera por weight: el objetivo es
// variedad de opciones para que la IA elija, no favorecer un paquete sobre
// otro). El resultado ya viene mapeado al shape que espera el body del
// fetch a /api/generar-evento.js.
export async function obtenerCandidatosEvento({ supabase, jornadaActual, historialIds = [], cantidad = 5 }) {
  const { data, error } = await supabase
    .from('events_catalog')
    .select('code, title, description, trade_off_prosa, options')
    .eq('active', true)
    .lte('min_matchday', jornadaActual);
  if (error) throw error;

  const disponibles = data.filter((fila) => !historialIds.includes(fila.code));
  if (disponibles.length === 0) return [];

  const elegidos = disponibles.length > cantidad ? mezclar(disponibles).slice(0, cantidad) : disponibles;

  return elegidos.map((fila) => ({
    paqueteId: fila.code,
    tituloFallback: fila.title,
    descripcionFallback: fila.description,
    tradeOffProsa: fila.trade_off_prosa,
    options: (fila.options || []).map((option) => ({
      optionId: option.id,
      labelFallback: option.label,
      resumenEfectos: option.resumen_efectos,
    })),
  }));
}

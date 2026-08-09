// Seed de events_catalog — Opción B: id sigue uuid, id legible en `code`.
// Uso: node --env-file=.env scripts/seed-events-catalog.js
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const url = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url) {
  console.error('Falta VITE_SUPABASE_URL en .env');
  process.exit(1);
}

// El seed usa service_role para bypasear RLS. Si no está, cae a anon
// (fallará si la tabla tiene RLS de escritura cerrado). El service_role
// key va en .env (ya gitignoreado), NUNCA en el bundle del cliente.
const supabase = createClient(url, serviceRoleKey || anonKey);

const EVENTOS = [
  // ── Familia individual ──────────────────────────────────────────────
  {
    code: 'figura_tocada',
    familia: 'individual',
    requisitos: { tramo_min: 2, fatiga_figura_min: 60 },
    peso: 10,
    slots: ['jugador_figura', 'rival_proximo'],
    opciones: [
      { label_hint: 'Que juegue', efectos: { rating_delta: 4, fatiga_figura: 15, riesgo_lesion: 0.2 } },
      { label_hint: 'Lo cuido', efectos: { rating_delta: -3, fatiga_figura: -20, moral: 2 } },
    ],
  },
  {
    code: 'figura_habla_prensa',
    familia: 'individual',
    requisitos: { tramo_min: 1 },
    peso: 8,
    slots: ['jugador_figura', 'rival_proximo'],
    opciones: [
      { label_hint: 'Lo banco', efectos: { moral: 3, presion: 10 } },
      { label_hint: 'Lo freno', efectos: { moral: -2, presion: -8 } },
    ],
  },
  {
    code: 'figura_lesion_leve',
    familia: 'individual',
    requisitos: { tramo_min: 1, fatiga_figura_min: 50 },
    peso: 7,
    slots: ['jugador_figura', 'rival_proximo'],
    opciones: [
      { label_hint: 'Lo arriesgo', efectos: { rating_delta: 3, riesgo_lesion: 0.35 } },
      { label_hint: 'Lo preservo', efectos: { rating_delta: -4, fatiga_figura: -15 } },
    ],
  },

  // ── Familia tactico ─────────────────────────────────────────────────
  {
    code: 'rival_presion_alta',
    familia: 'tactico',
    requisitos: { tramo_min: 1 },
    peso: 9,
    slots: ['rival_proximo', 'jugador_figura'],
    opciones: [
      { label_hint: 'Atacar', efectos: { rating_delta: 5, presion: 12 } },
      { label_hint: 'Cautela', efectos: { rating_delta: -2, presion: -6 } },
    ],
  },
  {
    code: 'rival_figura_lesionada',
    familia: 'tactico',
    requisitos: { tramo_min: 2 },
    peso: 8,
    slots: ['rival_proximo'],
    opciones: [
      { label_hint: 'Explotar banda', efectos: { rating_delta: 4, fatiga: 10 } },
      { label_hint: 'No cambiar plan', efectos: { rating_delta: -1, fatiga: -5 } },
    ],
  },
  {
    code: 'rival_cambio_esquema',
    familia: 'tactico',
    requisitos: { tramo_min: 3 },
    peso: 7,
    slots: ['rival_proximo'],
    opciones: [
      { label_hint: 'Adaptar', efectos: { rating_delta: 3, presion: 8 } },
      { label_hint: 'Mantener', efectos: { rating_delta: -3, presion: -4 } },
    ],
  },

  // ── Familia institucional ───────────────────────────────────────────
  {
    code: 'sponsor_polemico',
    familia: 'institucional',
    requisitos: { money_max: 10 },
    peso: 6,
    slots: [],
    opciones: [
      { label_hint: 'Aceptar', efectos: { money: 15, presion: 10 } },
      { label_hint: 'Rechazar', efectos: { money: -5, moral: 3 } },
    ],
  },
  {
    code: 'gira_amistosa',
    familia: 'institucional',
    requisitos: { tramo_max: 2 },
    peso: 5,
    slots: [],
    opciones: [
      { label_hint: 'Aceptar', efectos: { money: 12, fatiga: 12 } },
      { label_hint: 'Declinar', efectos: { money: -3, fatiga: -8 } },
    ],
  },
  {
    code: 'eleccion_comision',
    familia: 'institucional',
    requisitos: { temporada_min: 2 },
    peso: 5,
    slots: [],
    opciones: [
      { label_hint: 'Apoyar', efectos: { money: -8, presion: -10 } },
      { label_hint: 'No meterme', efectos: { presion: 8, moral: -2 } },
    ],
  },

  // ── Familia vestuario ───────────────────────────────────────────────
  {
    code: 'vestuario_partido',
    familia: 'vestuario',
    requisitos: { moral_max: 55 },
    peso: 8,
    slots: [],
    opciones: [
      { label_hint: 'Charla grupal', efectos: { moral: 6, presion: 5 } },
      { label_hint: 'Dejarlo pasar', efectos: { moral: -4, presion: -3 } },
    ],
  },
  {
    code: 'filtracion_charla',
    familia: 'vestuario',
    requisitos: { temporada_min: 2 },
    peso: 6,
    slots: [],
    opciones: [
      { label_hint: 'Desmentir', efectos: { moral: -3, presion: -8 } },
      { label_hint: 'Asumir', efectos: { moral: 4, presion: 6 } },
    ],
  },
  {
    code: 'capitan_pedido',
    familia: 'vestuario',
    requisitos: { moral_max: 60 },
    peso: 7,
    slots: [],
    opciones: [
      { label_hint: 'Aceptar', efectos: { moral: 5, money: -6 } },
      { label_hint: 'Negar', efectos: { moral: -5, money: 2 } },
    ],
  },
];

// Completa las columnas del shape viejo que probablemente son NOT NULL,
// para que el INSERT no falle. `options` se deriva de `opciones` con el
// formato viejo (id, label, effects, resumen_efectos).
function aFilas() {
  return EVENTOS.map((e) => ({
    id: randomUUID(),
    code: e.code,
    familia: e.familia,
    requisitos: e.requisitos,
    peso: e.peso,
    slots: e.slots,
    opciones: e.opciones,
    title: e.code.replace(/_/g, ' '),
    description: 'Evento de familia ' + e.familia,
    options: e.opciones.map((o, i) => ({
      id: 'opt_' + i,
      label: o.label_hint,
      effects: o.efectos,
      resumen_efectos: '',
    })),
    weight: e.peso,
    min_matchday: 1,
    active: true,
    trade_off_prosa: '',
  }));
}

async function main() {
  const { data, error } = await supabase
    .from('events_catalog')
    .insert(aFilas());

  if (error) {
    console.error('Error al insertar eventos:', error.message);
    process.exit(1);
  }

  const { count, error: countError } = await supabase
    .from('events_catalog')
    .select('id', { count: 'exact', head: true });

  if (countError) {
    console.error('Error al contar eventos:', countError.message);
    process.exit(1);
  }

  console.log(`Seed OK: ${count} eventos en events_catalog`);
}

main();
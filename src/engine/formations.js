// formations.js — lista de formaciones que puede usar un equipo.
// atk/def son multiplicadores sobre el poder de ataque y defensa del equipo.
export const FORMATIONS = {
  '4-3-3':   { label: '4-3-3',   desc: 'Ofensivo',    atk: 1.15, def: 0.90 },
  '4-4-2':   { label: '4-4-2',   desc: 'Equilibrado', atk: 1.00, def: 1.00 },
  '4-2-3-1': { label: '4-2-3-1', desc: 'Control',     atk: 1.05, def: 1.05 },
  '3-5-2':   { label: '3-5-2',   desc: 'Mediocampo',  atk: 1.05, def: 0.95 },
  '3-4-2-1': { label: '3-4-2-1', desc: 'Creativo',    atk: 1.10, def: 0.85 },
  '5-3-2':   { label: '5-3-2',   desc: 'Defensivo',   atk: 0.85, def: 1.20 },
};
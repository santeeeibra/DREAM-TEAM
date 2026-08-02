// formations.js — lista de formaciones que puede usar un equipo.
// atk/def son multiplicadores sobre el poder de ataque y defensa del equipo.
export const FORMATIONS = {
  '4-4-2': { label: '4-4-2 (equilibrado)', atk: 1.0, def: 1.0 },
  '4-3-3': { label: '4-3-3 (ofensivo)', atk: 1.15, def: 0.9 },
  '3-5-2': { label: '3-5-2 (mediocampo)', atk: 1.05, def: 0.95 },
  '5-3-2': { label: '5-3-2 (defensivo)', atk: 0.85, def: 1.2 },
};
---
name: ligapro-zones
description: Handles zonesTable.js and eventSlots.js for Liga Profesional Argentina refactor. Activate when working on zone standings, inter-zone fixtures, or event slot configuration for 16-matchday seasons.
---

You are a Dream Team engine developer working on the Liga Profesional Argentina season format.

## Context
- Stack: Vanilla JS ES Modules, no frameworks
- Project: D:\dev\dream-team
- LigaPro format: 30 teams, 2 zones of 15, 16 matchdays (14 intra + 2 inter)
- Inter-zone: 1 clásico fijo + 1 random draw per team
- Event slots: 2-3 narrative decision points across 16 matchdays

## Task: Zone Table + Event Slots

### 1. src/engine/zonesTable.js — Add inter-zone matches

Current function `calcularTablaPorZona({ jugados, rivalNombre, rivalFuerza, esLocal, rng })` only does intra-zone round-robin.

Modify to:
- Accept optional `interZonales` parameter: array of { local, visitante, golesLocal, golesVisitante }
- Add inter-zone results to each team's standing
- Recalculate all derived stats (pts, diff, etc.) after adding inter-zone
- Keep backward compatibility: if no `interZonales` passed, works exactly as before

Also add: `generarFixtureInterZonal(clubesA, clubesB, clasicosMap, rng)` that:
- Creates 15 clásico matches from the fixed CLASICOS map
- Creates 15 random draw matches (shuffle B list, pair with A, exclude clásico pairings)
- Returns array of { local, visitante, tipo: 'clasico'|'sorteo' }

### 2. src/engine/eventSlots.js — LigaPro event slots

Add new export `EVENT_SLOTS_LIGAPRO`:
```js
export const EVENT_SLOTS_LIGAPRO = [
  { jornada: 4, tipo: 'decision', etiqueta: 'Primer checkpoint' },
  { jornada: 10, tipo: 'decision', etiqueta: ' mitad de temporada' },
  { jornada: 16, tipo: 'decision', etiqueta: 'Última fecha' },
];
```

Add helper: `obtenerEventosDisponiblesLigaPro(fase)` that returns slots for the current phase.

Also add: `calcularMomentosDestacadosLigaPro(jugados)` that builds highlight moments for the 16-matchday season (similar to existing `construirMomentosDestacados` but for LigaPro format).

### Rules
- Pure logic only. No DOM, Supabase, or Phaser imports.
- Follow existing code patterns in each file.
- Export new functions alongside existing ones.
- LigaPro functions should be clearly named with `LigaPro` suffix.
- Maintain full backward compatibility with existing non-LigaPro functions.

---
name: ligapro-foundation
description: Handles constants.js and rivals.js for Liga Profesional Argentina refactor. Activate when working on LIGAPRO_TEAMS, CLASICOS map, or zone-based rival generation.
---

You are a Dream Team engine developer working on the Liga Profesional Argentina season format refactor.

## Context
- Stack: Vanilla JS ES Modules, no frameworks
- Project: D:\dev\dream-team
- Engine modules: src/engine/ (pure logic, no DOM/Supabase imports)
- Constants: src/core/constants.js

## Task: Foundation Layer

### 1. src/core/constants.js — Add CLASICOS map

Add after LIGAPRO constants:

```js
export const CLASICOS = {
  'Zona A': {
    'Zona B': {
      'River Plate': 'Boca Juniors',
      'Independiente': 'Racing Club',
      'San Lorenzo': 'Huracán',
      'Estudiantes (LP)': 'Gimnasia (LP)',
      'Vélez Sarsfield': 'Ferro',
      'All Boys': 'Chacarita Juniors',
      'Nueva Chicago': 'Almirante Brown',
      'Deportivo Morón': 'Atlanta',
    }
  }
};
```

Also export a helper:
```js
export function getClasicoEquipo(nombreEquipo, zona) {
  const zonaPair = CLASICOS[zona];
  if (!zonaPair) return null;
  for (const [za, zb] of Object.entries(zonaPair)) {
    if (za === zona) {
      if (zb[nombreEquipo]) return { rival: zb[nombreEquipo], zonaRival: 'Zona B' };
    }
    if (zb && zb[nombreEquipo]) {
      const keys = Object.keys(zb);
      for (const key of keys) {
        if (key === nombreEquipo) return { rival: za, zonaRival: 'Zona A' };
      }
    }
  }
  return null;
}
```

### 2. src/engine/rivals.js — Zone-based rival generation

Add a new export `generarRivalesLigaPro` that:
- Takes: `equipoNombre`, `zona`, `clubesMismaZona`, `clubesOtraZona`
- Returns: `rivalesFuerza` (Map nombre→fuerza), `rivalesNombres` (Map nombre→nombre)
- Includes ALL 29 rivals (14 same zone + 15 other zone)
- Does NOT include the player's own team
- Uses the `fuerza` field from league clubs config
- Also generates `fixtureCompleto` with all 30 teams for full table simulation

### Rules
- Pure logic only. No DOM, Supabase, or Phaser imports.
- Follow existing code patterns in the file.
- Export new functions alongside existing ones (don't remove old exports).
- Use `Math.random` seeded via a passed `rng` parameter where needed.

---
name: ligapro-integration
description: Handles seasonSimulator.js, seasonOrchestrator.js, and SeasonScene.js for Liga Profesional Argentina refactor. Activate when integrating zone-based fixtures into the simulation loop or updating the season scene UI for LigaPro.
---

You are a Dream Team engine developer working on the full Liga Profesional Argentina season integration.

## Context
- Stack: Vanilla JS ES Modules + DOM (HTML/CSS/JS in src/ui/)
- Project: D:\dev\dream-team
- LigaPro format: 30 teams, 2 zones of 15, 16 matchdays
- Current flow: advance → simulate tramo → event → repeat → final table
- LigaPro flow should be: same (with events), but zone-based fixtures + zone tables + playoffs

## Task: Integration Layer

### 1. src/engine/seasonSimulator.js — Fixture support

Add `generarFixtureLigaPro(equipoNombre, zona, rivalesMismaZona, rivalesOtraZona, rng)` that:
- Generates 16 jornadas: 14 intra-zone + 2 inter-zone (1 clasico + 1 random)
- Inter-zone jornadas placed at random positions
- Returns: array of { jornada, rivalNombre, rivalFuerza, esLocal, tipo: 'intra'|'clasico'|'sorteo' }

Modify `simularTramo` to accept optional `fixture` parameter:
- If fixture provided: use fixture[jornada] to determine rival instead of `(jornada-1) % CANTIDAD_RIVALES`
- If no fixture: existing behavior (backward compatible)

Add `calcularTablaLigaPro(jugados)` that wraps zonesTable logic for the full 30-team standings.

### 2. src/engine/seasonOrchestrator.js — LigaPro orchestration

Modify `avanzar()`:
- Detect LigaPro via `ligaConfig.tienePlayoffs`
- If LigaPro: generate fixture on first call (store in `estado.fixture`)
- Pass fixture to `simularTramo`
- Use LigaPro event slots

Modify `simularHastaProximoEvento`:
- Accept `fixture` parameter, pass to `avanzar`
- Use LigaPro event slots when applicable

Modify `aplicarDecisionYContinuar`:
- Pass fixture through to next `avanzar` call

### 3. src/scenes/SeasonScene.js — UI updates

The current LigaPro flow (`simularTemporadaConPlayoffsCompleta`) simulates everything at once WITHOUT events. This is wrong.

Change LigaPro to use `avanzarSimulacion()` (same as other leagues) so events work:
- In `avanzarSimulacion()`, detect `this.tienePlayoffs`
- Generate and store fixture on first tramo
- Pass fixture through the advance loop
- On SEASON_COMPLETE: call `calcularTablaPorZona` instead of `calcularTablaFinal`
- Show zone tables (Zona A + Zona B) using existing `mostrarTablaZonas`
- Then proceed to playoffs if classified

Key changes in `avanzarSimulacion()`:
- Store `this.fixtureLigaPro` on first call
- On season complete: branch to zone table display
- Keep existing playoffs flow (bracket, phases, etc.)

### Rules
- Pure engine logic in seasonSimulator.js and seasonOrchestrator.js: no DOM/Supabase
- SeasonScene.js is DOM layer: can use DOM, Supabase, Phaser
- Maintain backward compatibility for non-LigaPro leagues
- Follow existing code patterns and variable naming
- LigaPro-specific code should be clearly marked with comments

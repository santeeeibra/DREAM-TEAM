#!/usr/bin/env bash
# Verifica la "ley de las flechas" (ver architecture_refactor_plan.md §2.3).
# Salida esperada al final del refactor: 0 líneas en total en los 4 checks.

echo "== phaser en engine, data o core =="
grep -rn "phaser" src/engine/ src/data/ src/core/ -i 2>/dev/null

echo "== supabaseClient importado desde engine (data SÍ puede) =="
grep -rn "supabaseClient" src/engine/ 2>/dev/null

echo "== ui importado desde engine o data =="
grep -rn "from '\.\./ui" src/engine/ src/data/ 2>/dev/null

echo "== scenes importado fuera de main.js/dev =="
grep -rn "from '\.\./scenes" src/ --include=*.js 2>/dev/null | grep -v "^src/main.js\|^src/dev/"

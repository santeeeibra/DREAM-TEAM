#!/usr/bin/env bash
echo "== phaser/supabase en engine, data o core =="
grep -rn "phaser\|supabase" src/engine/ src/data/ src/core/ 2>/dev/null
echo "== supabaseClient importado desde engine =="
grep -rn "supabaseClient" src/engine/ 2>/dev/null
echo "== ui importado desde engine o data =="
grep -rn "from .*/ui" src/engine/ src/data/ 2>/dev/null


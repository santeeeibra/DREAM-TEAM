# 🗃️ Guía: Importar Cartas a Supabase (Parte 2)

---

## 📊 Paso 6: Verificar la Importación

En el **SQL Editor** de Supabase, ejecuta:

```sql
-- Ver total de cartas por liga
SELECT league_id, COUNT(*) as total
FROM cards
WHERE is_active = true
GROUP BY league_id;

-- Ver cartas de la Liga Profesional Argentina
SELECT name, club, position, overall_rating, rarity
FROM cards
WHERE league_id = 'ligapro' AND is_active = true
ORDER BY overall_rating DESC
LIMIT 20;

-- Ver distribución por posición
SELECT position, COUNT(*) as total
FROM cards
WHERE league_id = 'ligapro' AND is_active = true
GROUP BY position;

-- Ver distribución por rareza
SELECT rarity, COUNT(*) as total
FROM cards
WHERE league_id = 'ligapro' AND is_active = true
GROUP BY rarity;
```

---

## 🔄 Importar Otras Ligas

El script soporta múltiples ligas:

```bash
node scripts/import-futgg-league.mjs premier    # Premier League
node scripts/import-futgg-league.mjs laliga     # LaLiga
node scripts/import-futgg-league.mjs seriea     # Serie A
node scripts/import-futgg-league.mjs bundesliga # Bundesliga
node scripts/import-futgg-league.mjs mls        # MLS
node scripts/import-futgg-league.mjs ligue1     # Ligue 1
```

---

## 🛠️ Troubleshooting

### Error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en .env"
✅ Verifica que el archivo `.env` tenga las credenciales correctas

### Error: "relation 'cards' does not exist"
✅ Ejecuta el SQL del Paso 2 para crear la tabla

### Error: "bucket does not exist"
✅ Crea los buckets `player-photos` y `team-badges` en Storage

### Error: "HTTP 429" (Rate limit)
⏳ FUT.GG tiene rate limits. Espera unos minutos y reintenta.

### Error: "Duplicate key value violates unique constraint"
✅ Normal si vuelves a correr el script. Hace upsert (actualiza si existe).

---

## 📝 Notas Importantes

1. **Tiempos de importación:**
   - Liga de 30 equipos (~600 jugadores): 5-10 minutos
   - El script descarga fotos en paralelo (8 threads)

2. **Re-ejecuciones:**
   - No duplica cartas (hace upsert)
   - Si una foto ya existe en Storage, no la vuelve a descargar

3. **Mapeo de posiciones:**
   - EA tiene 14+ posiciones (ST, CF, LW, RW, CAM, etc.)
   - Se mapean a 4: **POR, DEF, MED, DEL**

4. **Mapeo de rarezas:**
   - Overall >= 85: **épica**
   - Overall 80-84: **oro_único**
   - Overall 74-79: **oro_común**
   - Overall < 74: **bronce** (filtradas por defecto)

---

## ✅ Checklist Final

- [ ] Tabla `cards` creada en Supabase
- [ ] Buckets `player-photos` y `team-badges` creados
- [ ] Archivo `.env` configurado con credenciales
- [ ] Dry-run ejecutado exitosamente
- [ ] Importación real completada
- [ ] Verificación SQL muestra las cartas correctas

---

## 🎯 Resumen Rápido (TL;DR)

```bash
# 1. Configurar .env con credenciales de Supabase
# 2. Crear tabla cards en SQL Editor
# 3. Crear buckets player-photos y team-badges
# 4. Importar cartas:
node scripts/import-futgg-league.mjs ligapro --dry-run  # Previsualización
node scripts/import-futgg-league.mjs ligapro            # Importación real
```

---

## 📅 Fecha de Actualización
2026-08-25

## 🆘 Soporte
Si encuentras problemas, verifica:
1. Las credenciales en `.env`
2. Los logs del script (muestra errores detallados)
3. El estado de FUT.GG (puede estar caído temporalmente)

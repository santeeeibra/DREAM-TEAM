# Pipeline de jugadores (staging)

- **`ingest-fpl.js`**: baja `bootstrap-static` de la API pública de
  Fantasy Premier League y vuelca cada jugador en `staging_players`
  (source='fpl'), guardando el objeto crudo en `raw_data`. No toca
  `cards`.
- **`reconcile.js`**: compara `staging_players` contra `cards` por
  nombre (similitud, no exact match) + club, y encola diferencias en
  `pending_changes` (`new_player`, `club_change`, `removed`) para que
  un admin las revise. Tampoco toca `cards`.
- **`apply-approved.js`**: toma las filas de `pending_changes` que un
  admin ya puso en `status='approved'` y recién ahí escribe en
  `cards` (alta, update de club, o desactivar con `is_active=false`
  en vez de borrar). Cada cambio se aplica en su propia transacción
  de Postgres; si uno falla, los demás siguen y ese queda en
  `'approved'` para reintentarse en la próxima corrida.

Orden de ejecución:

```bash
node scripts/ingest-fpl.js
node scripts/reconcile.js
# ... revisión manual: pasar filas de pending_changes de 'pending' a
# 'approved' (o 'rejected') ...
node scripts/apply-approved.js
```

Requiere `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` en `.env` (service
role: estos scripts corren del lado del backend, nunca desde el
cliente).

# Escudos de club

- **`fetch-escudoteca-badges.js`**: pobla `clubs.logo_url` (LaLiga y
  Premier) con los escudos reales de Escudoteca Paladar Negro
  (`paladarnegro.net/escudoteca`), en vez del escudo genérico de
  iniciales que se ve hoy en el selector de club del onboarding.
  Scrapea la galería de cada liga, matchea por nombre contra la tabla
  `clubs` y sube cada PNG al bucket `club-badges`. Los clubes que no
  matcheen solos se resuelven a mano en `escudoteca-overrides.json`
  (`{ "Nombre exacto en clubs.name": "URL directa al PNG" }`).

  ```bash
  node scripts/fetch-escudoteca-badges.js --dry-run   # solo matchea, no sube nada
  node scripts/fetch-escudoteca-badges.js              # laliga + premier
  node scripts/fetch-escudoteca-badges.js --liga=laliga
  ```

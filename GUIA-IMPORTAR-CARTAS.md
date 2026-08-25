# 🗃️ Guía: Importar Cartas a Supabase

Esta guía explica cómo importar las cartas de la **Liga Profesional Argentina** (y otras ligas) desde FUT.GG a tu base de datos Supabase.

---

## 📋 Pre-requisitos

1. ✅ Cuenta en [Supabase](https://supabase.com)
2. ✅ Proyecto creado en Supabase
3. ✅ Node.js instalado (v18+)

---

## 🔑 Paso 1: Obtener Credenciales de Supabase

1. Ve a tu proyecto en [app.supabase.com](https://app.supabase.com)
2. Ve a **Settings** (⚙️) → **API**
3. Copia las siguientes credenciales:

```
Project URL:        https://xxxxx.supabase.co
anon public key:    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3...
service_role key:   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3... ⚠️ SECRETO
```

---

## 🗄️ Paso 2: Crear la Tabla `cards` en Supabase

Ve a **SQL Editor** en Supabase y ejecuta:

```sql
-- Tabla de cartas de jugadores
CREATE TABLE IF NOT EXISTS cards (
  id BIGSERIAL PRIMARY KEY,
  fut_id TEXT NOT NULL,
  name TEXT NOT NULL,
  club TEXT,
  position TEXT NOT NULL CHECK (position IN ('POR', 'DEF', 'MED', 'DEL')),
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 40 AND overall_rating <= 99),
  rarity TEXT NOT NULL CHECK (rarity IN ('bronce', 'oro_comun', 'oro_unico', 'epica')),
  league_id TEXT NOT NULL,
  photo_url TEXT,
  club_badge_url TEXT,
  league_logo_url TEXT,
  nation_flag_url TEXT,
  nationality_id INTEGER,
  is_active BOOLEAN DEFAULT true,
  uses_generated_avatar BOOLEAN DEFAULT false,
  photo_source_url TEXT,
  photo_credit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único para evitar duplicados (liga + jugador)
CREATE UNIQUE INDEX IF NOT EXISTS cards_league_fut_id_unique 
ON cards (league_id, fut_id) 
WHERE is_active = true;

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_cards_league ON cards(league_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cards_club ON cards(club) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cards_position ON cards(position) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity) WHERE is_active = true;

-- Habilitar Row Level Security (RLS)
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Política: lectura pública
CREATE POLICY "Lectura pública de cartas activas"
ON cards FOR SELECT
USING (is_active = true);

-- Política: solo service_role puede insertar/actualizar
CREATE POLICY "Solo service_role puede modificar"
ON cards FOR ALL
USING (auth.jwt()->>'role' = 'service_role');
```

---

## 📦 Paso 3: Crear Buckets de Storage

Ve a **Storage** en Supabase y crea estos buckets (públicos):

1. **`player-photos`** - Fotos de jugadores
2. **`team-badges`** - Escudos de clubes y banderas

Configuración recomendada:
- ✅ Public bucket
- ✅ Allowed MIME types: `image/png`, `image/webp`, `image/jpeg`
- ✅ Max file size: 2 MB

---

## ⚙️ Paso 4: Configurar `.env`

Edita tu archivo `.env` en la raíz del proyecto:

```bash
# Credenciales públicas (para el frontend)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3...

# Credenciales de servicio (para scripts backend - ⚠️ NUNCA exponer)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3...
```

⚠️ **IMPORTANTE:** Nunca commitees el archivo `.env` con credenciales reales.

---

## 🚀 Paso 5: Importar Cartas

### 5.1 Dry-run (Previsualización)

```bash
node scripts/import-futgg-league.mjs ligapro --dry-run
```

Genera `scripts/tmp-ligapro-preview.json` sin tocar la BD.

### 5.2 Importación Real

```bash
node scripts/import-futgg-league.mjs ligapro
```

**¿Qué hace?**
1. Descarga jugadores desde FUT.GG (EA ID: 353)
2. Filtra cartas base con overall >= 74
3. Sube fotos, escudos y banderas a Storage
4. Hace upsert en tabla `cards`

**Tiempo estimado:** 5-10 minutos para ~600 jugadores.

---

*Continúa en GUIA-IMPORTAR-CARTAS-PARTE-2.md*

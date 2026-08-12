// supabaseClient.js — un único punto de conexión a Supabase.
// Todo lo demás (auth.js, managers.js, packOpening/*) importa este mismo
// cliente en vez de crear uno propio, para compartir la sesión del usuario
// logueado (Supabase guarda la sesión en localStorage automáticamente).
import { createClient } from '@supabase/supabase-js';

// import.meta.env lo inyecta Vite; process.env cubre los harness en Node (scripts/*).
const env = import.meta.env ?? (typeof process !== 'undefined' ? process.env : {}) ?? {};

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// supabaseClient.js — un único punto de conexión a Supabase.
// Todo lo demás (auth.js, managers.js, packOpening/*) importa este mismo
// cliente en vez de crear uno propio, para compartir la sesión del usuario
// logueado (Supabase guarda la sesión en localStorage automáticamente).
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

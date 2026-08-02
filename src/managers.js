// managers.js — todo lo que tiene que ver con la tabla `managers` (el "DT"
// que crea cada usuario). La política RLS de esa tabla dice
// `auth.uid() = user_id`, así que solo se puede crear/leer el manager
// del usuario que está logueado en ese momento.
import { supabase } from './supabaseClient.js';

// Busca si el usuario logueado ya tiene un DT creado. Devuelve el manager
// (fila completa) o null si todavía no creó ninguno.
export async function getManagerForUser(userId) {
  const { data, error } = await supabase
    .from('managers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Crea el DT del usuario logueado. `region` tiene que ser uno de
// 'Europa' | 'América' | 'Asia' (lo controla el <select> del formulario,
// no hay un check constraint en la base para esto).
export async function createManager({ userId, name, age, country, region }) {
  const { data, error } = await supabase
    .from('managers')
    .insert({
      user_id: userId,
      name,
      age,
      country,
      region,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// auth.js — funciones simples para registrarse, loguearse, salir, y
// preguntar "¿hay alguien logueado ahora mismo?". Portado desde
// dream-team/src/auth.js (que quedó con dependencias rotas) a la raíz,
// que es el proyecto que sí tiene Phaser y Supabase JS instalados.
import { supabase } from './supabaseClient.js';

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

// Sesión anónima real de Supabase (no un "modo invitado" inventado): las
// tablas usan RLS con auth.uid(), así que el invitado necesita un uid
// válido igual que un usuario registrado. Requiere tener "Anonymous
// sign-ins" activado en el dashboard de Supabase.
export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  return { data, error };
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Supabase devuelve sus errores en inglés y en un formato pensado para
// developers, no para el usuario final. Acá traducimos los más comunes;
// si no reconocemos el mensaje, mostramos el original tal cual.
const MENSAJES_DE_ERROR = [
  {
    coincide: (m) => m.includes('Invalid login credentials'),
    traduccion:
      'Email o contraseña incorrectos. Revisá que estén bien escritos, o puede que esa cuenta nunca se haya llegado a crear (probá "Crear cuenta").',
  },
  {
    coincide: (m) => m.includes('email rate limit exceeded'),
    traduccion:
      'Supabase limita la cantidad de emails de confirmación que puede mandar. Probá entrar como invitado mientras tanto, o esperá unos minutos.',
  },
  {
    coincide: (m) => m.includes('User already registered'),
    traduccion: 'Ya existe una cuenta con ese email. Probá ingresar en vez de crear una cuenta nueva.',
  },
  {
    coincide: (m) => m.includes('Password should be at least'),
    traduccion: 'La contraseña es muy corta. Usá al menos 6 caracteres.',
  },
];

export function traducirErrorAuth(error) {
  if (!error) return '';
  const mensaje = error.message || '';
  const encontrado = MENSAJES_DE_ERROR.find(({ coincide }) => coincide(mensaje));
  return encontrado ? encontrado.traduccion : mensaje;
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

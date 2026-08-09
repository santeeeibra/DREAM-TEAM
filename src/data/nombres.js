// Datos de contenido. Shape REAL de una carta (no es un mock):
// { id, nombre, pos, rating, edad, rareza, club }
// Para cargar un dataset real (EA FC26) basta con producir objetos con este shape
// y pasárselo a crearPool() — no hay que tocar el motor.

export const NOMBRES = [
  'Aguirre', 'Bentancur', 'Cabrera', 'Duarte', 'Escalante', 'Ferreyra', 'Gaitán',
  'Herrera', 'Ibarra', 'Juárez', 'Kovac', 'Larrañaga', 'Medina', 'Núñez', 'Ojeda',
  'Paredes', 'Quiroga', 'Rojas', 'Sosa', 'Toledo', 'Urrutia', 'Vergara', 'Wagner',
  'Ximénez', 'Yáñez', 'Zabala', 'Almada', 'Bustos', 'Carrizo', 'Dellacroce',
  'Estévez', 'Fabbro', 'Godoy', 'Haedo', 'Insúa', 'Jerez', 'Klemm', 'Leguizamón',
  'Mansilla', 'Nardi', 'Olivera', 'Pizarro', 'Ravelli', 'Suárez', 'Tévez',
  'Ustari', 'Villalba', 'Zapata', 'Barros', 'Cazenave',
];

export const APODOS = [
  'el Chino', 'el Ruso', 'el Pulpo', 'el Tanque', 'la Joya', 'el Gato', 'el Loco',
  'el Pipa', 'el Colo', 'el Turco', 'el Flaco', 'el Zurdo', 'el Cuervo', 'el Pibe',
];

export const CLUBES_RIVALES = [
  // Clubes reales de la Premier League: matchean ESTILOS_CLUB en balance.js.
  // Los últimos 5 no tienen estilo propio → caen al default (club neutro).
  'Manchester City', 'Arsenal', 'Liverpool', 'Chelsea', 'Manchester United',
  'Tottenham', 'Aston Villa', 'Newcastle', 'West Ham', 'Brighton',
  'Burnley', 'Sheffield United', 'Luton Town', 'Brentford',
  'Everton', 'Crystal Palace', 'Fulham', 'Wolverhampton', 'Nottingham Forest',
];

export const CLUBES_JUGABLES = [
  { nombre: 'Club Atlético Viedma', apodo: 'los Ribereños', expectativa: 12 },
  { nombre: 'Deportivo Patagones', apodo: 'los Fortineros', expectativa: 14 },
  { nombre: 'Sportivo Balneario', apodo: 'los Marinos', expectativa: 10 },
];

// Formación, slots y compatibilidad de puestos: ver data/posiciones.js.

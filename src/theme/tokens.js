// Fuente única de verdad de colores y tipografía del juego.
// A futuro este objeto reemplaza a COLORES_BANDA, que hoy vive duplicado
// en CardSprite.js (esa migración es un prompt aparte, no se toca acá).
//
// Nota de formato: los valores de COLORS.tier van en hex numérico (0xRRGGBB)
// porque alimentan Phaser.Graphics/fillStyle, que espera números. Los de
// bg/accent/text van en string ('#RRGGBB') porque alimentan CSS
// (pantallas de login/crear DT en src/style.css). No son intercambiables:
// pasar un string a fillStyle o un número a CSS no funciona.

export const COLORS = {
  bg: {
    base: '#14161C',
    elevated: '#1C1F28',
  },
  // Turquesa. Uso exclusivo: botón primario / estado activo. Nunca decorativo.
  accent: '#2DE0C6',
  text: {
    primary: '#F2F3F5',
    secondary: '#8A8F9C',
  },
  tier: {
    bronze: 0xA8712E,
    silver: 0xB8C0CC,
    gold: 0xD9A441,
    special: {
      from: 0xA855F7,
      to: 0x000000,
    },
  },
};

// Estas 3 fuentes se cargan vía <link> a Google Fonts en index.html, y
// main.js espera a document.fonts.ready antes de crear el juego Phaser
// para garantizar que ya estén disponibles.
export const FONTS = {
  display: 'Rajdhani', // nombres de jugador, ratings grandes, títulos de escena
  body: 'Manrope', // texto general, botones, labels
  data: 'JetBrains Mono', // números de stats/rating chicos
};

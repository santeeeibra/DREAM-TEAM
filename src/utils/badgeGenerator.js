const PALETTE = [
  '#c0392b', // rojo
  '#2980b9', // azul
  '#27ae60', // verde
  '#8e44ad', // violeta
  '#d35400', // naranja
  '#16a085', // teal
  '#2c3e50', // azul noche
  '#c2185b', // magenta
  '#7f8c8d', // gris acero
  '#f39c12', // ambar
  '#1e824c', // verde bosque
  '#5d4037', // marron
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getInitials(clubName) {
  const words = clubName
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function shieldShape(color) {
  return `<path d="M50 4 L90 16 V50 C90 74 72 90 50 96 C28 90 10 74 10 50 V16 Z" fill="${color}" />`;
}

function circleShape(color) {
  return `<circle cx="50" cy="50" r="48" fill="${color}" />`;
}

function hexagonShape(color) {
  const points = [
    [50, 3],
    [93, 26.5],
    [93, 73.5],
    [50, 97],
    [7, 73.5],
    [7, 26.5],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
  return `<polygon points="${points}" fill="${color}" />`;
}

const SHAPES = [shieldShape, circleShape, hexagonShape];

export function generateClubBadge(clubName) {
  const hash = hashString(clubName);
  const color = PALETTE[hash % PALETTE.length];
  const shape = SHAPES[Math.floor(hash / PALETTE.length) % SHAPES.length];
  const initials = getInitials(clubName);

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  ${shape(color)}
  <text x="50" y="52" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="32">${initials}</text>
</svg>`;
}

export function generateClubBadgeDataURI(clubName) {
  const svg = generateClubBadge(clubName);
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}

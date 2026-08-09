// fitImage.js — equivalente a CSS object-fit para imágenes de Phaser.
//
// Phaser no tiene object-fit: setDisplaySize(ancho, alto) estira SIEMPRE la
// textura para que llene exactamente ese marco, así que una foto que no es
// cuadrada (o una bandera 3:2) se deforma. Este helper ajusta las
// dimensiones de visualización (displayWidth/displayHeight) PRESERVANDO la
// proporción natural de la textura fuente, con dos modos:
//
//   'contain' — la imagen entra completa dentro del marco, sin deformarse
//               ni recortarse (puede quedar espacio vacío a los lados).
//               Es el modo por defecto: nunca se ve estirada.
//   'cover'   — la imagen llena el marco por completo recortando el
//               sobrante (debe ir acompañada de una máscara si se quiere
//               que el recorte se oculte).
//
// No crea máscaras por sí mismo: la usamos con contain en las cartas, donde
// una imagen más chica que el marco se ve bien porque el fondo del escudo ya
// cubre el resto del espacio.
export function fitImagen(imagen, anchoMarco, altoMarco, modo = 'contain') {
  // Dimensiones naturales de la textura fuente (el píxel original, no el
  // displayWidth/displayHeight que ya podría estar escalado).
  const fuente = imagen.texture.getSourceImage?.() ?? null;
  const anchoFuente = fuente?.width || imagen.displayWidth;
  const altoFuente = fuente?.height || imagen.displayHeight;

  if (!anchoFuente || !altoFuente) {
    // Textura rara o sin dimensiones: no tocar nada, mejor que dividir por cero.
    return imagen;
  }

  const escala =
    modo === 'cover'
      ? Math.max(anchoMarco / anchoFuente, altoMarco / altoFuente)
      : Math.min(anchoMarco / anchoFuente, altoMarco / altoFuente);

  imagen.setDisplaySize(anchoFuente * escala, altoFuente * escala);
  return imagen;
}
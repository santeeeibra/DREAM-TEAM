// devContext.js — "buzón" compartido para que el panel de dev (que vive en
// el DOM normal, fuera de Phaser) pueda enterarse de cuál es el juego
// Phaser activo y cuál es el manager logueado en este momento.
// main.js llama a los setters cada vez que esas dos cosas cambian.

let juegoActivo = null;
let managerIdActivo = null;

export function setDevGame(juego) {
  juegoActivo = juego;
}

export function getDevGame() {
  return juegoActivo;
}

export function setDevManagerId(managerId) {
  managerIdActivo = managerId;
}

export function getDevManagerId() {
  return managerIdActivo;
}

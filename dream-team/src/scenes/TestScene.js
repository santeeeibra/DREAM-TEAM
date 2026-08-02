// TestScene.js — nuestra primera escena, solo para confirmar que Phaser arrancó bien
import Phaser from 'phaser';

export class TestScene extends Phaser.Scene {
  constructor() {
    // 'TestScene' es el identificador interno con el que Phaser reconoce esta escena
    super('TestScene');
  }

  create() {
    // this.add.text dibuja texto en pantalla. Los primeros dos números son
    // la posición X e Y en píxeles dentro del canvas.
    this.add.text(200, 250, 'DREAM TEAM ⚽ - Motor OK', {
      fontSize: '28px',
      color: '#ffffff',
    });

    // Un cuadrado de color, solo para probar que Phaser puede dibujar formas.
    // Lo vamos a reemplazar más adelante por el sprite de una carta.
    const box = this.add.rectangle(400, 350, 100, 140, 0x00aa55);

    // tweens = animaciones. Acá hacemos que el cuadrado suba y baje en loop,
    // como para comprobar que el motor de animación también funciona.
    this.tweens.add({
      targets: box,
      y: 320,
      duration: 800,
      yoyo: true,
      repeat: -1, // -1 = infinito
    });
  }
}
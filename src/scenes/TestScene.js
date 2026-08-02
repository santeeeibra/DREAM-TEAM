// TestScene.js — nuestra primera escena, solo para confirmar que Phaser arrancó bien
import Phaser from 'phaser';

export class TestScene extends Phaser.Scene {
  constructor() {
    // 'TestScene' es el identificador interno con el que Phaser reconoce esta escena
    super('TestScene');
  }

  create() {
    // this.add.text dibuja texto en pantalla (X, Y)
    this.add.text(200, 250, 'DREAM TEAM ⚽ - Motor OK', {
      fontSize: '28px',
      color: '#ffffff',
    });

    // Un cuadrado verde de prueba
    const box = this.add.rectangle(400, 350, 100, 140, 0x00aa55);

    // Animación simple (sube y baja)
    this.tweens.add({
      targets: box,
      y: 320,
      duration: 800,
      yoyo: true,
      repeat: -1, // infinito
    });
  }
}

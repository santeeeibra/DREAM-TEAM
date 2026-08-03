// EventScene.js — overlay placeholder para mostrar un evento de temporada y
// dejar que el jugador elija una opción.
//
// Se lanza con scene.launch (no scene.start) sobre SeasonScene, así queda
// dibujada encima sin destruir la escena de fondo. Al elegir una opción se
// llama a onResolve(option.id) y se cierra el overlay con scene.stop().
import Phaser from 'phaser';

export class EventScene extends Phaser.Scene {
  constructor() {
    super('EventScene');
  }

  // data = { eventDetails, onResolve }.
  // eventDetails = { id, titulo, descripcion, options: [{ id, label, effects }] }.
  init(data) {
    this.eventDetails = data.eventDetails;
    this.onResolve = data.onResolve;
  }

  create() {
    const anchoPantalla = this.scale.width;
    const altoPantalla = this.scale.height;

    this.add.rectangle(anchoPantalla / 2, altoPantalla / 2, anchoPantalla, altoPantalla, 0x000000, 0.75);

    this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 140, this.eventDetails.titulo, {
        fontFamily: 'Arial',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#d4af37',
        align: 'center',
        wordWrap: { width: anchoPantalla - 80 },
      })
      .setOrigin(0.5);

    this.add
      .text(anchoPantalla / 2, altoPantalla / 2 - 80, this.eventDetails.descripcion, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: anchoPantalla - 80 },
      })
      .setOrigin(0.5);

    const posicionInicialY = altoPantalla / 2;
    const espacioEntreBotones = 50;

    this.eventDetails.options.forEach((option, indice) => {
      const boton = this.add
        .text(anchoPantalla / 2, posicionInicialY + indice * espacioEntreBotones, option.label, {
          fontFamily: 'Arial',
          fontSize: '15px',
          color: '#1a1a2e',
          backgroundColor: '#d4af37',
          padding: { x: 16, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      boton.on('pointerdown', () => {
        this.onResolve(option.id);
        this.scene.stop();
      });
    });
  }
}

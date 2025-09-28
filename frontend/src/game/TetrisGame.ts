import Phaser from 'phaser';
import { TetrisScene } from './scenes/TetrisScene';

export class TetrisGame {
  private game: Phaser.Game;

  constructor(container: HTMLElement) {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 400,
      height: 600,
      parent: container,
      backgroundColor: '#222222',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false
        }
      },
      scene: TetrisScene
    };

    this.game = new Phaser.Game(config);
  }

  destroy(): void {
    if (this.game) {
      this.game.destroy(true);
    }
  }
}

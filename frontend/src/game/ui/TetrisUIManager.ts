import Phaser from 'phaser';

export class TetrisUIManager {
  private scoreText?: Phaser.GameObjects.Text;
  private linesText?: Phaser.GameObjects.Text;
  private levelText?: Phaser.GameObjects.Text;
  private gameOverText?: Phaser.GameObjects.Text;

  constructor(private readonly scene: Phaser.Scene) {}

  createBorder(x: number, y: number, gridWidth: number, gridHeight: number, blockSize: number): void {
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(2, 0xffffff);
    graphics.strokeRect(
      x - 1,
      y - 1,
      gridWidth * blockSize + 2,
      gridHeight * blockSize + 2
    );
  }

  createHUD(score: number, lines: number, level: number): void {
    this.scoreText = this.scene.add.text(320, 100, this.formatScore(score), {
      fontSize: '18px',
      color: '#ffffff'
    });

    this.linesText = this.scene.add.text(320, 130, this.formatLines(lines), {
      fontSize: '18px',
      color: '#ffffff'
    });

    this.levelText = this.scene.add.text(320, 160, this.formatLevel(level), {
      fontSize: '18px',
      color: '#ffffff'
    });

    this.scene.add.text(320, 200, 'Next:', {
      fontSize: '16px',
      color: '#ffffff'
    });
  }

  updateHUD(score: number, lines: number, level: number): void {
    this.scoreText?.setText(this.formatScore(score));
    this.linesText?.setText(this.formatLines(lines));
    this.levelText?.setText(this.formatLevel(level));
  }

  showGameOver(onRestart: () => void): void {
    this.gameOverText = this.scene.add.text(200, 300, 'GAME OVER', {
      fontSize: '32px',
      color: '#ff0000'
    }).setOrigin(0.5);

    this.scene.add.text(200, 340, 'Press R to restart', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const rKey = this.scene.input.keyboard!.addKey('R');
    rKey.once('down', onRestart);
  }

  clearGameOver(): void {
    this.gameOverText?.destroy();
    this.gameOverText = undefined;
  }

  private formatScore(score: number): string {
    return Score: ;
  }

  private formatLines(lines: number): string {
    return Lines: ;
  }

  private formatLevel(level: number): string {
    return Level: ;
  }
}

import Phaser from 'phaser';
import { TetrisPiece } from '../core/Tetromino';

export class TetrisRenderer {
  constructor(private readonly scene: Phaser.Scene, private readonly blockSize: number) {}

  render(grid: number[][], currentPiece?: TetrisPiece, nextPiece?: TetrisPiece): void {
    this.clearFrame();
    this.renderGrid(grid);

    if (currentPiece) {
      this.renderPiece(currentPiece);
    }

    if (nextPiece) {
      this.renderNextPiece(nextPiece);
    }
  }

  private renderGrid(grid: number[][]): void {
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col]) {
          this.drawBlock(col, row, grid[row][col]);
        }
      }
    }
  }

  private renderPiece(piece: TetrisPiece): void {
    for (let row = 0; row < piece.shape.length; row++) {
      for (let col = 0; col < piece.shape[row].length; col++) {
        if (piece.shape[row][col]) {
          this.drawBlock(piece.x + col, piece.y + row, piece.color);
        }
      }
    }
  }

  private renderNextPiece(piece: TetrisPiece): void {
    for (let row = 0; row < piece.shape.length; row++) {
      for (let col = 0; col < piece.shape[row].length; col++) {
        if (piece.shape[row][col]) {
          const block = this.scene.add.rectangle(
            320 + col * 20,
            230 + row * 20,
            18,
            18,
            piece.color
          );
          (block as any).tetrisBlock = true;
        }
      }
    }
  }

  private drawBlock(x: number, y: number, color: number): void {
    const pixelX = 50 + x * this.blockSize + this.blockSize / 2;
    const pixelY = 50 + y * this.blockSize + this.blockSize / 2;

    const block = this.scene.add.rectangle(pixelX, pixelY, this.blockSize - 1, this.blockSize - 1, color);
    (block as any).tetrisBlock = true;

    const border = this.scene.add.rectangle(pixelX, pixelY, this.blockSize - 1, this.blockSize - 1);
    border.setStrokeStyle(1, 0x333333);
    (border as any).tetrisBlock = true;
  }

  private clearFrame(): void {
    this.scene.children.list.forEach(child => {
      if ((child as any).tetrisBlock) {
        child.destroy();
      }
    });
  }
}

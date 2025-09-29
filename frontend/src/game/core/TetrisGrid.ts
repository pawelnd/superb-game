import { TetrisPiece } from './Tetromino';

export class TetrisGrid {
  private cells: number[][];

  constructor(private readonly width: number, private readonly height: number) {
    this.cells = this.createEmptyGrid();
  }

  reset(): void {
    this.cells = this.createEmptyGrid();
  }

  get data(): number[][] {
    return this.cells;
  }

  canPlace(piece: TetrisPiece, dx = 0, dy = 0): boolean {
    return !this.hasCollision(piece, dx, dy);
  }

  hasCollision(piece: TetrisPiece, dx = 0, dy = 0): boolean {
    for (let row = 0; row < piece.shape.length; row++) {
      for (let col = 0; col < piece.shape[row].length; col++) {
        if (!piece.shape[row][col]) continue;

        const newX = piece.x + col + dx;
        const newY = piece.y + row + dy;

        if (newX < 0 || newX >= this.width || newY >= this.height) {
          return true;
        }

        if (newY >= 0 && this.cells[newY][newX]) {
          return true;
        }
      }
    }

    return false;
  }

  placePiece(piece: TetrisPiece): void {
    for (let row = 0; row < piece.shape.length; row++) {
      for (let col = 0; col < piece.shape[row].length; col++) {
        if (!piece.shape[row][col]) continue;

        const gridY = piece.y + row;
        const gridX = piece.x + col;

        if (gridY >= 0) {
          this.cells[gridY][gridX] = piece.color;
        }
      }
    }
  }

  clearCompletedLines(): number {
    let linesCleared = 0;

    for (let row = this.height - 1; row >= 0; row--) {
      if (this.cells[row].every(cell => cell !== 0)) {
        this.cells.splice(row, 1);
        this.cells.unshift(Array(this.width).fill(0));
        linesCleared++;
        row++;
      }
    }

    return linesCleared;
  }

  private createEmptyGrid(): number[][] {
    return Array.from({ length: this.height }, () => Array(this.width).fill(0));
  }
}

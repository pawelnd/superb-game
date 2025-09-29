import Phaser from 'phaser';
import { TetrisGrid } from '../core/TetrisGrid';
import { TetrisRenderer } from '../rendering/TetrisRenderer';
import { TetrisUIManager } from '../ui/TetrisUIManager';
import { TetrisPiece, clonePiece, randomPiece, rotateClockwise } from '../core/Tetromino';

export class TetrisScene extends Phaser.Scene {
  private readonly gridWidth = 10;
  private readonly gridHeight = 20;
  private readonly blockSize = 30;

  private grid!: TetrisGrid;
  private renderer!: TetrisRenderer;
  private uiManager!: TetrisUIManager;

  private currentPiece?: TetrisPiece;
  private nextPiece?: TetrisPiece;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private dropTimer = 0;
  private dropSpeed = 500; // ms
  private score = 0;
  private lines = 0;
  private level = 1;
  private gameOver = false;

  constructor() {
    super({ key: 'TetrisScene' });
  }

  create(): void {
    this.resetState();

    this.grid = new TetrisGrid(this.gridWidth, this.gridHeight);
    this.renderer = new TetrisRenderer(this, this.blockSize);
    this.uiManager = new TetrisUIManager(this);

    this.uiManager.createBorder(50, 50, this.gridWidth, this.gridHeight, this.blockSize);
    this.uiManager.createHUD(this.score, this.lines, this.level);

    this.cursors = this.input.keyboard!.createCursorKeys();

    this.prepareNextPiece();
    this.spawnPiece();

    this.time.addEvent({
      delay: this.dropSpeed,
      callback: this.dropPiece,
      callbackScope: this,
      loop: true
    });
  }

  update(): void {
    if (this.gameOver || !this.currentPiece) return;

    if (Phaser.Input.Keyboard.JustDown(this.cursors.left!)) {
      this.tryMoveCurrentPiece(-1, 0);
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.right!)) {
      this.tryMoveCurrentPiece(1, 0);
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
      this.rotatePiece();
    }

    if (this.cursors.down!.isDown) {
      this.dropTimer += this.game.loop.delta;
      if (this.dropTimer >= 50) {
        if (this.grid.canPlace(this.currentPiece, 0, 1)) {
          this.currentPiece.y++;
          this.score++;
          this.uiManager.updateHUD(this.score, this.lines, this.level);
        }
        this.dropTimer = 0;
      }
    }

    this.renderer.render(this.grid.data, this.currentPiece, this.nextPiece);
  }

  private resetState(): void {
    this.currentPiece = undefined;
    this.nextPiece = undefined;
    this.dropTimer = 0;
    this.dropSpeed = 500;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
  }

  private spawnPiece(): void {
    this.currentPiece = this.nextPiece ? clonePiece(this.nextPiece) : randomPiece(this.gridWidth);
    this.currentPiece.y = 0;

    if (this.grid.hasCollision(this.currentPiece)) {
      this.endGame();
      return;
    }

    this.prepareNextPiece();
  }

  private prepareNextPiece(): void {
    this.nextPiece = randomPiece(this.gridWidth);
  }

  private dropPiece(): void {
    if (this.gameOver || !this.currentPiece) return;

    if (this.grid.canPlace(this.currentPiece, 0, 1)) {
      this.currentPiece.y++;
    } else {
      this.grid.placePiece(this.currentPiece);
      this.handleCompletedLines();
      this.spawnPiece();
    }
  }

  private handleCompletedLines(): void {
    const linesCleared = this.grid.clearCompletedLines();

    if (linesCleared === 0) {
      return;
    }

    this.lines += linesCleared;
    this.score += linesCleared * 100 * this.level;

    this.level = Math.floor(this.lines / 10) + 1;
    this.dropSpeed = Math.max(50, 500 - (this.level - 1) * 50);

    this.uiManager.updateHUD(this.score, this.lines, this.level);
  }

  private tryMoveCurrentPiece(dx: number, dy: number): void {
    if (!this.currentPiece) return;

    if (this.grid.canPlace(this.currentPiece, dx, dy)) {
      this.currentPiece.x += dx;
      this.currentPiece.y += dy;
    }
  }

  private rotatePiece(): void {
    if (this.gameOver || !this.currentPiece) return;

    const rotatedShape = rotateClockwise(this.currentPiece.shape);
    const rotatedPiece: TetrisPiece = {
      ...this.currentPiece,
      shape: rotatedShape
    };

    if (this.grid.canPlace(rotatedPiece)) {
      this.currentPiece.shape = rotatedShape;
    }
  }

  private endGame(): void {
    this.gameOver = true;
    this.uiManager.showGameOver(() => this.scene.restart());
  }
}

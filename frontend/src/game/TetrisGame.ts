import Phaser from "phaser";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 28;
const BOARD_OFFSET_X = 20;
const BOARD_OFFSET_Y = 60;
const BOARD_PIXEL_WIDTH = BOARD_WIDTH * BLOCK_SIZE;
const BOARD_PIXEL_HEIGHT = BOARD_HEIGHT * BLOCK_SIZE;

interface PieceDefinition {
  name: string;
  color: number;
  rotations: number[][][];
}

interface ActivePiece {
  x: number;
  y: number;
  rotationIndex: number;
  definition: PieceDefinition;
}

const rotateMatrix = (matrix: number[][]): number[][] => {
  const size = matrix.length;
  const result: number[][] = Array.from({ length: size }, () => Array(size).fill(0));

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      result[x][size - 1 - y] = matrix[y][x];
    }
  }

  return result;
};

const basePieces: { name: string; color: number; matrix: number[][] }[] = [
  {
    name: "I",
    color: 0x40c4ff,
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    name: "J",
    color: 0x3f51b5,
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    name: "L",
    color: 0xff9800,
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    name: "O",
    color: 0xffeb3b,
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  {
    name: "S",
    color: 0x4caf50,
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  {
    name: "T",
    color: 0x9c27b0,
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    name: "Z",
    color: 0xf44336,
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
];

const buildPieces = (): PieceDefinition[] =>
  basePieces.map(({ name, color, matrix }) => {
    const normalized = matrix.map((row) => {
      const paddedRow = [...row];
      while (paddedRow.length < 4) {
        paddedRow.push(0);
      }
      return paddedRow;
    });

    while (normalized.length < 4) {
      normalized.push(Array(4).fill(0));
    }

    const rotations: number[][][] = [];
    let current = normalized;
    for (let i = 0; i < 4; i += 1) {
      rotations.push(current.map((row) => [...row]));
      current = rotateMatrix(current);
    }

    return { name, color, rotations };
  });

const TETROMINOES: PieceDefinition[] = buildPieces();

class TetrisScene extends Phaser.Scene {
  private board: (number | null)[][] = [];

  private currentPiece: ActivePiece | null = null;

  private nextPiece: PieceDefinition | null = null;

  private dropTimer = 0;

  private dropInterval = 800;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private hardDropKey!: Phaser.Input.Keyboard.Key;

  private boardGraphics!: Phaser.GameObjects.Graphics;

  private previewGraphics!: Phaser.GameObjects.Graphics;

  private scoreText!: Phaser.GameObjects.Text;

  private linesText!: Phaser.GameObjects.Text;

  private levelText!: Phaser.GameObjects.Text;

  private score = 0;

  private lines = 0;

  private isGameOver = false;

  constructor() {
    super("TetrisScene");
  }

  preload(): void {
    this.cameras.main.setBackgroundColor("#0d1117");
  }

  create(): void {
    this.board = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
    this.boardGraphics = this.add.graphics();
    this.previewGraphics = this.add.graphics();

    this.add.text(BOARD_OFFSET_X, 12, "Tetris", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#61dafb",
    });

    const sidePanelX = BOARD_OFFSET_X + BOARD_PIXEL_WIDTH + 30;

    this.scoreText = this.add.text(sidePanelX, BOARD_OFFSET_Y, "Score: 0", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#f0f0f0",
    });

    this.linesText = this.add.text(sidePanelX, BOARD_OFFSET_Y + 30, "Lines: 0", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#f0f0f0",
    });

    this.levelText = this.add.text(sidePanelX, BOARD_OFFSET_Y + 60, "Level: 1", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#f0f0f0",
    });

    this.add.text(sidePanelX, BOARD_OFFSET_Y + 110, "Next", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#61dafb",
    });

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is unavailable");
    }

    this.cursors = keyboard.createCursorKeys();
    this.hardDropKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.nextPiece = this.pickRandomPiece();
    this.spawnPiece();
    this.render();
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver || !this.currentPiece) {
      return;
    }

    this.handleInput();

    this.dropTimer += delta;
    const downKey = this.cursors.down;
    const activeInterval = downKey && downKey.isDown ? this.dropInterval / 5 : this.dropInterval;

    if (this.dropTimer >= activeInterval) {
      this.dropTimer = 0;
      if (!this.movePiece(0, 1)) {
        this.lockPiece();
      }
    }
  }

  private handleInput(): void {
    if (!this.currentPiece) {
      return;
    }

    const { left, right, up, down } = this.cursors;

    if (left && Phaser.Input.Keyboard.JustDown(left)) {
      this.movePiece(-1, 0);
    }

    if (right && Phaser.Input.Keyboard.JustDown(right)) {
      this.movePiece(1, 0);
    }

    if (up && Phaser.Input.Keyboard.JustDown(up)) {
      this.rotatePiece();
    }

    if (this.hardDropKey && Phaser.Input.Keyboard.JustDown(this.hardDropKey)) {
      this.hardDrop();
    }

    if (down && down.isDown) {
      if (!this.movePiece(0, 1)) {
        this.lockPiece();
      }
    }
  }

  private pickRandomPiece(): PieceDefinition {
    return Phaser.Utils.Array.GetRandom(TETROMINOES);
  }

  private spawnPiece(): void {
    const definition = this.nextPiece ?? this.pickRandomPiece();
    this.nextPiece = this.pickRandomPiece();

    this.currentPiece = {
      x: Math.floor(BOARD_WIDTH / 2) - 2,
      y: -1,
      rotationIndex: 0,
      definition,
    };

    if (!this.isValidPosition(this.currentPiece.x, this.currentPiece.y, this.currentPiece.rotationIndex)) {
      this.triggerGameOver();
    }
  }

  private getCells(definition: PieceDefinition, rotationIndex: number): { x: number; y: number }[] {
    const matrix = definition.rotations[rotationIndex % definition.rotations.length];
    const cells: { x: number; y: number }[] = [];

    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (matrix[y][x]) {
          cells.push({ x, y });
        }
      }
    }

    return cells;
  }

  private isValidPosition(x: number, y: number, rotationIndex: number): boolean {
    if (!this.currentPiece) {
      return false;
    }

    const cells = this.getCells(this.currentPiece.definition, rotationIndex);

    return cells.every((cell) => {
      const boardX = x + cell.x;
      const boardY = y + cell.y;

      if (boardX < 0 || boardX >= BOARD_WIDTH) {
        return false;
      }

      if (boardY >= BOARD_HEIGHT) {
        return false;
      }

      if (boardY < 0) {
        return true;
      }

      return this.board[boardY][boardX] === null;
    });
  }

  private movePiece(offsetX: number, offsetY: number): boolean {
    if (!this.currentPiece) {
      return false;
    }

    const targetX = this.currentPiece.x + offsetX;
    const targetY = this.currentPiece.y + offsetY;

    if (this.isValidPosition(targetX, targetY, this.currentPiece.rotationIndex)) {
      this.currentPiece.x = targetX;
      this.currentPiece.y = targetY;
      this.render();
      return true;
    }

    return false;
  }

  private rotatePiece(): void {
    if (!this.currentPiece) {
      return;
    }

    const nextRotation = (this.currentPiece.rotationIndex + 1) % this.currentPiece.definition.rotations.length;
    const offsets = [0, -1, 1, -2, 2];

    for (const offset of offsets) {
      if (this.isValidPosition(this.currentPiece.x + offset, this.currentPiece.y, nextRotation)) {
        this.currentPiece.x += offset;
        this.currentPiece.rotationIndex = nextRotation;
        this.render();
        return;
      }
    }
  }

  private hardDrop(): void {
    if (!this.currentPiece) {
      return;
    }

    while (this.movePiece(0, 1)) {
      // Keep moving down until collision.
    }

    this.lockPiece();
  }

  private lockPiece(): void {
    if (!this.currentPiece) {
      return;
    }

    const cells = this.getCells(this.currentPiece.definition, this.currentPiece.rotationIndex);

    cells.forEach((cell) => {
      const boardX = this.currentPiece!.x + cell.x;
      const boardY = this.currentPiece!.y + cell.y;

      if (boardY >= 0 && boardY < BOARD_HEIGHT) {
        this.board[boardY][boardX] = this.currentPiece!.definition.color;
      }
    });

    const cleared = this.clearLines();
    this.updateScore(cleared);

    this.currentPiece = null;
    this.spawnPiece();
    this.render();
  }

  private clearLines(): number {
    let cleared = 0;

    for (let row = BOARD_HEIGHT - 1; row >= 0; row -= 1) {
      const isFull = this.board[row].every((cell) => cell !== null);

      if (isFull) {
        this.board.splice(row, 1);
        this.board.unshift(Array(BOARD_WIDTH).fill(null));
        cleared += 1;
        row += 1;
      }
    }

    return cleared;
  }

  private updateScore(linesCleared: number): void {
    if (linesCleared > 0) {
      const lineScores = [0, 100, 300, 500, 800];
      this.score += lineScores[linesCleared] ?? linesCleared * 200;
      this.lines += linesCleared;

      const level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(120, 800 - (level - 1) * 60);
    }

    this.scoreText.setText(`Score: ${this.score}`);
    this.linesText.setText(`Lines: ${this.lines}`);
    const level = Math.floor(this.lines / 10) + 1;
    this.levelText.setText(`Level: ${level}`);
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.add.text(BOARD_OFFSET_X + 10, BOARD_OFFSET_Y + 200, "Game Over", {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#f44336",
    });
    this.add.text(BOARD_OFFSET_X + 10, BOARD_OFFSET_Y + 240, "Press Reset", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
    });
  }

  private render(): void {
    this.renderBoard();
    this.renderPreview();
  }

  private renderBoard(): void {
    this.boardGraphics.clear();

    this.boardGraphics.fillStyle(0x161b22, 1);
    this.boardGraphics.fillRoundedRect(
      BOARD_OFFSET_X - 6,
      BOARD_OFFSET_Y - 6,
      BOARD_PIXEL_WIDTH + 12,
      BOARD_PIXEL_HEIGHT + 12,
      8
    );

    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        const color = this.board[y][x];
        const posX = BOARD_OFFSET_X + x * BLOCK_SIZE;
        const posY = BOARD_OFFSET_Y + y * BLOCK_SIZE;

        this.boardGraphics.fillStyle(color ?? 0x0d1117, 1);
        this.boardGraphics.fillRect(posX + 1, posY + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        this.boardGraphics.lineStyle(1, 0x1f2933, 0.6);
        this.boardGraphics.strokeRect(posX + 1, posY + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      }
    }

    if (!this.currentPiece || this.isGameOver) {
      return;
    }

    const cells = this.getCells(this.currentPiece.definition, this.currentPiece.rotationIndex);
    const color = this.currentPiece.definition.color;

    cells.forEach((cell) => {
      const boardX = this.currentPiece!.x + cell.x;
      const boardY = this.currentPiece!.y + cell.y;

      if (boardY < 0) {
        return;
      }

      const posX = BOARD_OFFSET_X + boardX * BLOCK_SIZE;
      const posY = BOARD_OFFSET_Y + boardY * BLOCK_SIZE;

      this.boardGraphics.fillStyle(color, 1);
      this.boardGraphics.fillRect(posX + 1, posY + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      this.boardGraphics.lineStyle(1, 0xffffff, 0.6);
      this.boardGraphics.strokeRect(posX + 1, posY + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
    });
  }

  private renderPreview(): void {
    this.previewGraphics.clear();

    const panelX = BOARD_OFFSET_X + BOARD_PIXEL_WIDTH + 30;
    const panelY = BOARD_OFFSET_Y + 140;

    this.previewGraphics.fillStyle(0x161b22, 1);
    this.previewGraphics.fillRoundedRect(panelX - 6, panelY - 6, 140, 140, 8);

    if (!this.nextPiece) {
      return;
    }

    const matrix = this.nextPiece.rotations[0];
    const size = matrix.length;
    const offsetX = panelX + (140 - size * BLOCK_SIZE) / 2;
    const offsetY = panelY + (140 - size * BLOCK_SIZE) / 2;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (matrix[y][x]) {
          const drawX = offsetX + x * BLOCK_SIZE;
          const drawY = offsetY + y * BLOCK_SIZE;

          this.previewGraphics.fillStyle(this.nextPiece.color, 1);
          this.previewGraphics.fillRect(drawX + 1, drawY + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
          this.previewGraphics.lineStyle(1, 0xffffff, 0.5);
          this.previewGraphics.strokeRect(drawX + 1, drawY + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        }
      }
    }
  }
}

export class TetrisGame {
  private game: Phaser.Game;

  constructor(parent: HTMLElement) {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: BOARD_OFFSET_X + BOARD_PIXEL_WIDTH + 220,
      height: BOARD_OFFSET_Y + BOARD_PIXEL_HEIGHT + 40,
      backgroundColor: "#0d1117",
      parent,
      scene: TetrisScene,
    };

    this.game = new Phaser.Game(config);
  }

  destroy(): void {
    this.game.destroy(true);
  }
}


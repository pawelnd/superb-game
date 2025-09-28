import Phaser from 'phaser';

interface TetrisPiece {
  shape: number[][];
  color: number;
  x: number;
  y: number;
}

export class TetrisScene extends Phaser.Scene {
  private grid: number[][] = [];
  private gridWidth: number = 10;
  private gridHeight: number = 20;
  private blockSize: number = 30;
  private currentPiece!: TetrisPiece;
  private nextPiece!: TetrisPiece;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private dropTimer: number = 0;
  private dropSpeed: number = 500; // ms
  private score: number = 0;
  private lines: number = 0;
  private level: number = 1;
  private scoreText!: Phaser.GameObjects.Text;
  private linesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private gameOver: boolean = false;
  private gameOverText!: Phaser.GameObjects.Text;

  private tetrominoes = [
    // I-piece
    {
      shape: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ],
      color: 0x00ffff // Cyan
    },
    // O-piece
    {
      shape: [
        [1, 1],
        [1, 1]
      ],
      color: 0xffff00 // Yellow
    },
    // T-piece
    {
      shape: [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]
      ],
      color: 0xff00ff // Magenta
    },
    // S-piece
    {
      shape: [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]
      ],
      color: 0x00ff00 // Green
    },
    // Z-piece
    {
      shape: [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]
      ],
      color: 0xff0000 // Red
    },
    // J-piece
    {
      shape: [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]
      ],
      color: 0x0000ff // Blue
    },
    // L-piece
    {
      shape: [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]
      ],
      color: 0xffa500 // Orange
    }
  ];

  constructor() {
    super({ key: 'TetrisScene' });
  }

  create(): void {
    // Initialize grid
    this.grid = Array(this.gridHeight).fill(null).map(() => Array(this.gridWidth).fill(0));
    
    // Create game area border
    this.createBorder();
    
    // Create UI
    this.createUI();
    
    // Setup input
    this.cursors = this.input.keyboard!.createCursorKeys();
    
    // Spawn first pieces
    this.spawnPiece();
    this.generateNextPiece();
    
    // Setup game loop
    this.time.addEvent({
      delay: this.dropSpeed,
      callback: this.dropPiece,
      callbackScope: this,
      loop: true
    });
  }

  private createBorder(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xffffff);
    graphics.strokeRect(49, 49, this.gridWidth * this.blockSize + 2, this.gridHeight * this.blockSize + 2);
  }

  private createUI(): void {
    this.scoreText = this.add.text(320, 100, `Score: ${this.score}`, {
      fontSize: '18px',
      color: '#ffffff'
    });

    this.linesText = this.add.text(320, 130, `Lines: ${this.lines}`, {
      fontSize: '18px',
      color: '#ffffff'
    });

    this.levelText = this.add.text(320, 160, `Level: ${this.level}`, {
      fontSize: '18px',
      color: '#ffffff'
    });

    // Next piece preview
    this.add.text(320, 200, 'Next:', {
      fontSize: '16px',
      color: '#ffffff'
    });
  }

  private spawnPiece(): void {
    if (this.nextPiece) {
      this.currentPiece = { ...this.nextPiece };
    } else {
      const randomPiece = this.tetrominoes[Math.floor(Math.random() * this.tetrominoes.length)];
      this.currentPiece = {
        shape: randomPiece.shape.map(row => [...row]),
        color: randomPiece.color,
        x: Math.floor(this.gridWidth / 2) - Math.floor(randomPiece.shape[0].length / 2),
        y: 0
      };
    }

    // Check for game over
    if (this.isCollision(this.currentPiece, 0, 0)) {
      this.endGame();
      return;
    }

    this.generateNextPiece();
  }

  private generateNextPiece(): void {
    const randomPiece = this.tetrominoes[Math.floor(Math.random() * this.tetrominoes.length)];
    this.nextPiece = {
      shape: randomPiece.shape.map(row => [...row]),
      color: randomPiece.color,
      x: Math.floor(this.gridWidth / 2) - Math.floor(randomPiece.shape[0].length / 2),
      y: 0
    };
  }

  private dropPiece(): void {
    if (this.gameOver) return;

    if (this.canMove(this.currentPiece, 0, 1)) {
      this.currentPiece.y++;
    } else {
      this.placePiece();
      this.clearLines();
      this.spawnPiece();
    }
  }

  private canMove(piece: TetrisPiece, dx: number, dy: number): boolean {
    return !this.isCollision(piece, dx, dy);
  }

  private isCollision(piece: TetrisPiece, dx: number, dy: number): boolean {
    for (let row = 0; row < piece.shape.length; row++) {
      for (let col = 0; col < piece.shape[row].length; col++) {
        if (piece.shape[row][col]) {
          const newX = piece.x + col + dx;
          const newY = piece.y + row + dy;

          if (newX < 0 || newX >= this.gridWidth || newY >= this.gridHeight) {
            return true;
          }

          if (newY >= 0 && this.grid[newY][newX]) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private placePiece(): void {
    for (let row = 0; row < this.currentPiece.shape.length; row++) {
      for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
        if (this.currentPiece.shape[row][col]) {
          const gridY = this.currentPiece.y + row;
          const gridX = this.currentPiece.x + col;
          if (gridY >= 0) {
            this.grid[gridY][gridX] = this.currentPiece.color;
          }
        }
      }
    }
  }

  private clearLines(): void {
    let linesCleared = 0;

    for (let row = this.gridHeight - 1; row >= 0; row--) {
      if (this.grid[row].every(cell => cell !== 0)) {
        this.grid.splice(row, 1);
        this.grid.unshift(Array(this.gridWidth).fill(0));
        linesCleared++;
        row++; // Check the same row again
      }
    }

    if (linesCleared > 0) {
      this.lines += linesCleared;
      this.score += linesCleared * 100 * this.level;
      
      // Increase level every 10 lines
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropSpeed = Math.max(50, 500 - (this.level - 1) * 50);

      this.updateUI();
    }
  }

  private updateUI(): void {
    this.scoreText.setText(`Score: ${this.score}`);
    this.linesText.setText(`Lines: ${this.lines}`);
    this.levelText.setText(`Level: ${this.level}`);
  }

  private rotatePiece(): void {
    if (this.gameOver) return;

    const rotated = this.currentPiece.shape[0].map((_, index) =>
      this.currentPiece.shape.map(row => row[index]).reverse()
    );

    const rotatedPiece = {
      ...this.currentPiece,
      shape: rotated
    };

    if (!this.isCollision(rotatedPiece, 0, 0)) {
      this.currentPiece.shape = rotated;
    }
  }

  private endGame(): void {
    this.gameOver = true;
    this.gameOverText = this.add.text(200, 300, 'GAME OVER', {
      fontSize: '32px',
      color: '#ff0000'
    }).setOrigin(0.5);

    this.add.text(200, 340, 'Press R to restart', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Add restart key
    const rKey = this.input.keyboard!.addKey('R');
    rKey.once('down', () => {
      this.scene.restart();
    });
  }

  update(): void {
    if (this.gameOver) return;

    // Handle input
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left!)) {
      if (this.canMove(this.currentPiece, -1, 0)) {
        this.currentPiece.x--;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.right!)) {
      if (this.canMove(this.currentPiece, 1, 0)) {
        this.currentPiece.x++;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
      this.rotatePiece();
    }

    if (this.cursors.down!.isDown) {
      this.dropTimer += this.game.loop.delta;
      if (this.dropTimer >= 50) {
        if (this.canMove(this.currentPiece, 0, 1)) {
          this.currentPiece.y++;
          this.score++;
          this.updateUI();
        }
        this.dropTimer = 0;
      }
    }

    // Render the game
    this.render();
  }

  private render(): void {
    // Clear previous frame
    this.children.list.forEach(child => {
      if ((child as any).tetrisBlock) {
        child.destroy();
      }
    });

    // Render placed blocks
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        if (this.grid[row][col]) {
          this.drawBlock(col, row, this.grid[row][col]);
        }
      }
    }

    // Render current piece
    if (this.currentPiece) {
      for (let row = 0; row < this.currentPiece.shape.length; row++) {
        for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
          if (this.currentPiece.shape[row][col]) {
            this.drawBlock(
              this.currentPiece.x + col,
              this.currentPiece.y + row,
              this.currentPiece.color
            );
          }
        }
      }
    }

    // Render next piece preview
    if (this.nextPiece) {
      for (let row = 0; row < this.nextPiece.shape.length; row++) {
        for (let col = 0; col < this.nextPiece.shape[row].length; col++) {
          if (this.nextPiece.shape[row][col]) {
            const block = this.add.rectangle(
              320 + col * 20,
              230 + row * 20,
              18,
              18,
              this.nextPiece.color
            );
            (block as any).tetrisBlock = true;
          }
        }
      }
    }
  }

  private drawBlock(x: number, y: number, color: number): void {
    const pixelX = 50 + x * this.blockSize + this.blockSize / 2;
    const pixelY = 50 + y * this.blockSize + this.blockSize / 2;

    const block = this.add.rectangle(pixelX, pixelY, this.blockSize - 1, this.blockSize - 1, color);
    (block as any).tetrisBlock = true;

    // Add border for better visibility
    const border = this.add.rectangle(pixelX, pixelY, this.blockSize - 1, this.blockSize - 1);
    border.setStrokeStyle(1, 0x333333);
    (border as any).tetrisBlock = true;
  }
}

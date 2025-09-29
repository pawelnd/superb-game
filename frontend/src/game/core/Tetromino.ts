export interface TetrisPiece {
  shape: number[][];
  color: number;
  x: number;
  y: number;
}

export interface TetrominoDefinition {
  shape: number[][];
  color: number;
}

export const TETROMINOES: TetrominoDefinition[] = [
  {
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    color: 0x00ffff
  },
  {
    shape: [
      [1, 1],
      [1, 1]
    ],
    color: 0xffff00
  },
  {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: 0xff00ff
  },
  {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    color: 0x00ff00
  },
  {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    color: 0xff0000
  },
  {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: 0x0000ff
  },
  {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: 0xffa500
  }
];

export function createPieceFromDefinition(definition: TetrominoDefinition, gridWidth: number): TetrisPiece {
  const spawnX = Math.floor(gridWidth / 2) - Math.floor(definition.shape[0].length / 2);

  return {
    shape: cloneShape(definition.shape),
    color: definition.color,
    x: spawnX,
    y: 0
  };
}

export function randomPiece(gridWidth: number): TetrisPiece {
  const definition = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
  return createPieceFromDefinition(definition, gridWidth);
}

export function clonePiece(piece: TetrisPiece): TetrisPiece {
  return {
    shape: cloneShape(piece.shape),
    color: piece.color,
    x: piece.x,
    y: piece.y
  };
}

export function rotateClockwise(shape: number[][]): number[][] {
  return shape[0].map((_, index) => shape.map(row => row[index]).reverse());
}

function cloneShape(shape: number[][]): number[][] {
  return shape.map(row => [...row]);
}

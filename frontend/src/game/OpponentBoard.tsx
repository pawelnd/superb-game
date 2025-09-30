import React, { useMemo } from "react";
import { TetrisStateSnapshot } from "./TetrisGame";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

interface OpponentBoardProps {
  state: TetrisStateSnapshot | null;
}

const toColor = (value: number): string => `#${value.toString(16).padStart(6, "0")}`;

export const OpponentBoard: React.FC<OpponentBoardProps> = ({ state }) => {
  const board = useMemo(() => {
    if (!state) {
      return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
    }
    return state.board;
  }, [state]);

  return (
    <div className="opponent-board">
      <div className="opponent-board-inner">
        {board.map((row, rowIndex) =>
          row.map((value, columnIndex) => (
            <div
              key={`${rowIndex}-${columnIndex}`}
              className="opponent-cell"
              style={{ backgroundColor: value ? toColor(value) : "#0d1117" }}
            />
          )),
        )}
      </div>
      {!state && <div className="opponent-board-overlay">Waiting for opponent...</div>}
      {state?.isGameOver && <div className="opponent-board-overlay">Opponent topped out</div>}
    </div>
  );
};
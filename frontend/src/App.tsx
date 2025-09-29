import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import { TetrisGame } from "./game/TetrisGame";

const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const gameRef = useRef<TetrisGame | null>(null);
  const gameContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (gameStarted && gameContainerRef.current && !gameRef.current) {
      try {
        gameRef.current = new TetrisGame(gameContainerRef.current);
      } catch (error) {
        console.error("Error creating Tetris game", error);
        setGameStarted(false);
        alert("Error starting game. Check console for details.");
      }
    }

    if (!gameStarted && gameRef.current) {
      gameRef.current.destroy();
      gameRef.current = null;
      if (gameContainerRef.current) {
        gameContainerRef.current.innerHTML = "";
      }
    }
  }, [gameStarted]);

  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
    };
  }, []);

  const startGame = () => {
    if (!gameStarted) {
      setGameStarted(true);
    }
  };

  const resetGame = () => {
    setGameStarted(false);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Superb Game</h1>
        <p>Tetris - Classic Puzzle Game</p>
      </header>

      <main className="main-content">
        {!gameStarted ? (
          <div className="menu-screen">
            <div className="menu-container">
              <h2>Ready to Play?</h2>
              <p>Stack the falling tetrominoes to clear lines and chase a new high score.</p>
              <div className="controls-info">
                <h3>Controls</h3>
                <ul>
                  <li><strong>Left / Right</strong> move piece</li>
                  <li><strong>Up</strong> rotate piece</li>
                  <li><strong>Down</strong> soft drop</li>
                  <li><strong>Space</strong> hard drop</li>
                </ul>
              </div>
              <button className="start-game-btn" onClick={startGame}>
                Start Game
              </button>
            </div>
          </div>
        ) : (
          <div className="game-screen">
            <div className="game-ui">
              <button className="reset-game-btn" onClick={resetGame}>
                Reset
              </button>
            </div>
            <div id="game-container" ref={gameContainerRef} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

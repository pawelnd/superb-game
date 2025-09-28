import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { TetrisGame } from './game/TetrisGame';

const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const gameRef = useRef<TetrisGame | null>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  const startGame = () => {
    console.log('Start game clicked');
    if (!gameStarted) {
      setGameStarted(true);
    }
  };

  useEffect(() => {
    if (gameStarted && gameContainerRef.current && !gameRef.current) {
      try {
        console.log('Creating BattleCityGame...');
        gameRef.current = new TetrisGame(gameContainerRef.current);
        console.log('Game created successfully');
      } catch (error) {
        console.error('Error creating game:', error);
        alert('Error starting game: ' + error);
        setGameStarted(false);
      }
    }
  }, [gameStarted]);

  const resetGame = () => {
    if (gameRef.current) {
      gameRef.current.destroy();
      gameRef.current = null;
    }
    setGameStarted(false);
  };

  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
      }
    };
  }, []);

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
              <h2>Tetris</h2>
              <p>Arrange falling blocks to clear lines!</p>
              <div className="controls-info">
                <h3>Controls:</h3>
                <ul>
                  <li><strong>Left/Right Arrows:</strong> Move piece</li>
                  <li><strong>Up Arrow:</strong> Rotate piece</li>
                  <li><strong>Down Arrow:</strong> Drop faster</li>
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
                Back to Menu
              </button>
            </div>
            <div ref={gameContainerRef} id="game-container"></div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

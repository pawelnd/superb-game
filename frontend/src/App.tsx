import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { OpponentBoard } from "./game/OpponentBoard";
import { TetrisGame, TetrisStateSnapshot } from "./game/TetrisGame";

type Phase = "setup" | "lobby" | "playing";
type GameStatus = "idle" | "waiting" | "active" | "finished";

type LobbyPlayer = {
  id: string;
  name: string;
  isReady: boolean;
};

type MatchInfo = {
  gameId: string;
  opponent: LobbyPlayer | null;
};

const deriveWsBase = (): string => {
  const envBase = process.env.REACT_APP_WS_BASE;
  if (envBase) {
    return envBase.replace(/\/$/, "");
  }

  const { protocol, hostname, port } = window.location;
  const wsProtocol = protocol === "https:" ? "wss" : "ws";
  const defaultPort = port || (protocol === "https:" ? "443" : "80");
  const targetPort = defaultPort === "3000" ? "8000" : defaultPort;
  return `${wsProtocol}://${hostname}:${targetPort}`;
};

const buildWsUrl = (base: string, path: string): string => `${base}${path}`;

const isSocketOpen = (socket: WebSocket | null): boolean => socket?.readyState === WebSocket.OPEN;

const App: React.FC = () => {
  const [phase, setPhase] = useState<Phase>("setup");
  const [playerName, setPlayerName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [isQueued, setIsQueued] = useState(false);
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");
  const [localState, setLocalState] = useState<TetrisStateSnapshot | null>(null);
  const [opponentState, setOpponentState] = useState<TetrisStateSnapshot | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const lobbySocketRef = useRef<WebSocket | null>(null);
  const gameSocketRef = useRef<WebSocket | null>(null);
  const gameContainerRef = useRef<HTMLDivElement | null>(null);
  const tetrisRef = useRef<TetrisGame | null>(null);

  const wsBase = useMemo(() => deriveWsBase(), []);

  useEffect(
    () => () => {
      lobbySocketRef.current?.close();
      gameSocketRef.current?.close();
      tetrisRef.current?.destroy();
    },
    [],
  );

  const handleLobbyMessage = (message: any) => {
    switch (message.type) {
      case "joined": {
        setPlayerId(message.playerId);
        setPlayerName(nameInput.trim());
        setLobbyPlayers(message.players ?? []);
        setPhase("lobby");
        setStatusMessage("Connected to lobby. Queue up when you are ready.");
        break;
      }
      case "lobby_state": {
        const players: LobbyPlayer[] = message.players ?? [];
        setLobbyPlayers(players);
        if (playerId) {
          const me = players.find((player) => player.id === playerId);
          setIsQueued(Boolean(me?.isReady));
        }
        break;
      }
      case "match_found": {
        const opponent: LobbyPlayer = message.opponent ?? null;
        const info: MatchInfo = { gameId: message.gameId, opponent };
        setMatchInfo(info);
        setPhase("playing");
        setGameStatus("waiting");
        setIsQueued(false);
        setStatusMessage("Match found! Connecting to game server...");
        connectToGame(info.gameId);
        break;
      }
      case "error": {
        setStatusMessage(message.message ?? "Lobby error");
        break;
      }
      default:
        break;
    }
  };

  const joinLobby = (event: React.FormEvent) => {
    event.preventDefault();
    if (!nameInput.trim()) {
      setStatusMessage("Enter a display name to join the lobby.");
      return;
    }
    if (lobbySocketRef.current) {
      return;
    }

    const socket = new WebSocket(buildWsUrl(wsBase, "/ws/lobby"));
    lobbySocketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "join",
          name: nameInput.trim(),
        }),
      );
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleLobbyMessage(data);
      } catch (error) {
        console.error("Failed to parse lobby message", error);
      }
    };

    socket.onclose = () => {
      lobbySocketRef.current = null;
      setIsQueued(false);
      if (phase !== "playing") {
        setPhase("setup");
        setPlayerId(null);
        setLobbyPlayers([]);
        setStatusMessage("Disconnected from lobby.");
      }
    };

    socket.onerror = () => {
      setStatusMessage("Unable to reach lobby server.");
    };
  };

  const toggleQueue = () => {
    if (!playerId || !lobbySocketRef.current) {
      return;
    }

    const nextReady = !isQueued;
    lobbySocketRef.current.send(
      JSON.stringify({
        type: "set_ready",
        ready: nextReady,
      }),
    );
    setIsQueued(nextReady);
    setStatusMessage(nextReady ? "Searching for an opponent..." : "Matchmaking paused.");
  };

  const connectToGame = (gameId: string) => {
    if (!playerId) {
      return;
    }

    if (gameSocketRef.current) {
      try {
        gameSocketRef.current.close();
      } catch (error) {
        console.warn("Error closing previous game socket", error);
      }
    }

    setLocalState(null);
    setOpponentState(null);

    const socket = new WebSocket(buildWsUrl(wsBase, `/ws/game/${gameId}?playerId=${playerId}`));
    gameSocketRef.current = socket;

    socket.onopen = () => {
      setStatusMessage("Connected to game room. Waiting for opponent...");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleGameMessage(data);
      } catch (error) {
        console.error("Failed to parse game message", error);
      }
    };

    socket.onclose = () => {
      gameSocketRef.current = null;
      if (gameStatus !== "idle") {
        setStatusMessage((message) => message || "Game connection closed.");
      }
    };

    socket.onerror = () => {
      setStatusMessage("Lost connection to game server.");
    };
  };

  const handleGameMessage = (message: any) => {
    switch (message.type) {
      case "connected": {
        if (message.opponent) {
          setMatchInfo((current) => (current ? { ...current, opponent: message.opponent } : current));
        }
        setStatusMessage("Opponent connected. Get ready!");
        break;
      }
      case "start": {
        setGameStatus("active");
        setStatusMessage("");
        break;
      }
      case "opponent_state": {
        setOpponentState(message.state ?? null);
        break;
      }
      case "opponent_game_over": {
        setOpponentState(message.state ?? null);
        setStatusMessage("Opponent topped out!");
        setGameStatus("finished");
        break;
      }
      case "opponent_left": {
        setStatusMessage("Opponent disconnected. Returning to lobby once you leave the game.");
        setGameStatus("finished");
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    if (gameStatus !== "active" || !gameContainerRef.current) {
      return;
    }

    if (tetrisRef.current) {
      return;
    }

    const onStateUpdate = (snapshot: TetrisStateSnapshot) => {
      setLocalState(snapshot);
      if (isSocketOpen(gameSocketRef.current)) {
        gameSocketRef.current!.send(
          JSON.stringify({
            type: "state_update",
            state: snapshot,
          }),
        );
      }
    };

    const onGameOver = (snapshot: TetrisStateSnapshot) => {
      setLocalState(snapshot);
      if (isSocketOpen(gameSocketRef.current)) {
        gameSocketRef.current!.send(
          JSON.stringify({
            type: "game_over",
            state: snapshot,
          }),
        );
      }
      setStatusMessage("You topped out. Head back to the lobby when ready.");
      setGameStatus("finished");
    };

    const game = new TetrisGame(gameContainerRef.current, {
      onStateUpdate,
      onGameOver,
      stateUpdateInterval: 150,
    });

    tetrisRef.current = game;

    return () => {
      game.destroy();
      tetrisRef.current = null;
    };
  }, [gameStatus]);

  const leaveGame = () => {
    if (isSocketOpen(gameSocketRef.current)) {
      gameSocketRef.current!.send(JSON.stringify({ type: "leave" }));
    }
    gameSocketRef.current?.close();
    gameSocketRef.current = null;

    if (tetrisRef.current) {
      tetrisRef.current.destroy();
      tetrisRef.current = null;
    }

    setGameStatus("idle");
    setMatchInfo(null);
    setLocalState(null);
    setOpponentState(null);
    setStatusMessage("Returned to lobby.");
    setPhase("lobby");
  };

  const renderLobby = () => (
    <div className="lobby-screen">
      <div className="lobby-card">
        <div className="lobby-header">
          <h2>Lobby</h2>
          <p>Signed in as <strong>{playerName}</strong></p>
        </div>
        <button className="matchmaking-btn" onClick={toggleQueue}>
          {isQueued ? "Cancel Matchmaking" : "Find Match"}
        </button>
        <div className="lobby-list">
          {lobbyPlayers.length === 0 ? (
            <p className="lobby-empty">No other players yet. Invite a friend!</p>
          ) : (
            lobbyPlayers.map((player) => (
              <div
                key={player.id}
                className={`lobby-player${player.id === playerId ? " me" : ""}${player.isReady ? " ready" : ""}`}
              >
                <span className="lobby-player__name">{player.name}</span>
                <span className="lobby-player__status">{player.isReady ? "Ready" : "Idle"}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderGame = () => {
    const opponentName = matchInfo?.opponent?.name ?? "Opponent";

    return (
      <div className="multiplayer-layout">
        <div className="game-toolbar">
          <div>
            <h2>Multiplayer Tetris</h2>
            {matchInfo?.opponent && <p>Playing against {matchInfo.opponent.name}</p>}
          </div>
          <button className="secondary-btn" onClick={leaveGame}>
            Back to Lobby
          </button>
        </div>

        <div className="board-columns">
          <div className="board-column">
            <h3>Your Board</h3>
            <div id="game-container" ref={gameContainerRef} />
            <div className="score-card">
              <div>Score: {localState?.score ?? 0}</div>
              <div>Lines: {localState?.lines ?? 0}</div>
              <div>Level: {localState?.level ?? 1}</div>
            </div>
          </div>

          <div className="board-column">
            <h3>{`${opponentName}'s Board`}</h3>
            <OpponentBoard state={opponentState} />
            <div className="score-card">
              <div>Score: {opponentState?.score ?? 0}</div>
              <div>Lines: {opponentState?.lines ?? 0}</div>
              <div>Level: {opponentState?.level ?? 1}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Superb Game</h1>
        <p>Multiplayer Tetris Arena</p>
      </header>

      <main className="main-content">
        {phase === "setup" && (
          <div className="menu-screen">
            <div className="menu-container">
              <h2>Join the Lobby</h2>
              <p>Enter a display name and start matching with other players.</p>
              <form className="name-form" onSubmit={joinLobby}>
                <input
                  className="name-input"
                  maxLength={24}
                  onChange={(event) => setNameInput(event.target.value)}
                  placeholder="Display name"
                  value={nameInput}
                />
                <button className="start-game-btn" type="submit">
                  Enter Lobby
                </button>
              </form>
            </div>
          </div>
        )}

        {phase === "lobby" && renderLobby()}

        {phase === "playing" && renderGame()}
      </main>

      {statusMessage && <div className="status-banner">{statusMessage}</div>}
    </div>
  );
};

export default App;

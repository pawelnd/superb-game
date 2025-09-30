import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { OpponentBoard } from "./game/OpponentBoard";
import { TetrisGame, TetrisStateSnapshot } from "./game/TetrisGame";

type Phase = "setup" | "lobby" | "playing";
type GameStatus = "idle" | "waiting" | "active" | "finished";

type LobbyPlayer = {
  id: string;
  name: string;
  isReady: boolean;
  isConnected?: boolean;
};

type MatchInfo = {
  gameId: string;
  opponent: LobbyPlayer | null;
};

type PersistedState = {
  playerId?: string;
  playerName?: string;
  phase?: Phase;
  matchInfo?: MatchInfo | null;
  gameStatus?: GameStatus;
  isQueued?: boolean;
  localState?: TetrisStateSnapshot | null;
  opponentState?: TetrisStateSnapshot | null;
};

const STORAGE_KEY = "superb-game-state";

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

const loadPersistedState = (): PersistedState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch (error) {
    console.warn("Failed to load persisted state", error);
    return null;
  }
};

const storePersistedState = (state: PersistedState): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to persist state", error);
  }
};

const clearPersistedState = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear persisted state", error);
  }
};

const App: React.FC = () => {
  const restoredRef = useRef<PersistedState | null>(loadPersistedState());
  const restored = restoredRef.current;

  const initialPhase: Phase = restored?.phase === "playing"
    ? (restored.matchInfo ? "playing" : "lobby")
    : restored?.phase === "lobby"
    ? "lobby"
    : "setup";

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [playerName, setPlayerName] = useState(restored?.playerName ?? "");
  const [nameInput, setNameInput] = useState(restored?.playerName ?? "");
  const [playerId, setPlayerId] = useState<string | null>(restored?.playerId ?? null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [isQueued, setIsQueued] = useState(restored?.isQueued ?? false);
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(restored?.matchInfo ?? null);
  const [gameStatus, setGameStatus] = useState<GameStatus>(
    initialPhase === "playing" ? "waiting" : restored?.gameStatus ?? "idle",
  );
  const [localState, setLocalState] = useState<TetrisStateSnapshot | null>(restored?.localState ?? null);
  const [opponentState, setOpponentState] = useState<TetrisStateSnapshot | null>(restored?.opponentState ?? null);
  const [statusMessage, setStatusMessage] = useState(
    restored ? "Restoring previous session..." : "",
  );
  const phaseRef = useRef(phase);

  const lobbySocketRef = useRef<WebSocket | null>(null);
  const gameSocketRef = useRef<WebSocket | null>(null);
  const gameContainerRef = useRef<HTMLDivElement | null>(null);
  const tetrisRef = useRef<TetrisGame | null>(null);
  const pendingLobbyJoin = useRef<{ name: string; playerId?: string } | null>(
    restored?.playerName
      ? { name: restored.playerName, playerId: restored.playerId ?? undefined }
      : null,
  );

  const wsBase = useMemo(() => deriveWsBase(), []);

  useEffect(
    () => () => {
      lobbySocketRef.current?.close();
      gameSocketRef.current?.close();
      tetrisRef.current?.destroy();
    },
    [],
  );

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

  const connectToGame = useCallback(
    (gameId: string) => {
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

      const socket = new WebSocket(buildWsUrl(wsBase, `/ws/game/${gameId}?playerId=${playerId}`));
      gameSocketRef.current = socket;

      setStatusMessage((current) => current || "Connecting to game room...");

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
        if (phaseRef.current === "playing") {
          setStatusMessage((message) => message || "Game connection closed. Attempting to reconnect...");
        }
      };

      socket.onerror = () => {
        setStatusMessage("Lost connection to game server.");
      };
    },
    [playerId, wsBase],
  );

  const handleLobbyMessage = useCallback(
    (message: any) => {
      switch (message.type) {
        case "joined": {
          const joinedId = message.playerId as string;
          const joinedName = (message.playerName as string) ?? playerName;
          setPlayerId(joinedId);
          setPlayerName(joinedName);
          setNameInput(joinedName);
          setLobbyPlayers(message.players ?? []);
          setPhase((current) => (current === "setup" ? "lobby" : current));
          setStatusMessage((current) => current || "Connected to lobby. Queue up when you are ready.");
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
    },
    [playerId, playerName, connectToGame],
  );

  const connectToLobby = useCallback((options: { name: string; playerId?: string }) => {
    const displayName = options.name.trim();
    if (!displayName && !options.playerId) {
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
          name: displayName,
          playerId: options.playerId,
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
      if (phaseRef.current !== "playing") {
        setPlayerId(null);
        setLobbyPlayers([]);
        setStatusMessage((message) => message || "Disconnected from lobby.");
        setPhase("setup");
      }
    };

    socket.onerror = () => {
      setStatusMessage("Unable to reach lobby server.");
    };
  }, [wsBase, handleLobbyMessage]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);


  const joinLobby = (event: React.FormEvent) => {
    event.preventDefault();
    connectToLobby({ name: nameInput });
  };

  useEffect(() => {
    if (!lobbySocketRef.current && pendingLobbyJoin.current) {
      connectToLobby(pendingLobbyJoin.current);
      pendingLobbyJoin.current = null;
    }
  }, [connectToLobby]);


  useEffect(() => {
    if (phase === "playing" && matchInfo && playerId && !gameSocketRef.current) {
      setStatusMessage("Reconnecting to game room...");
      connectToGame(matchInfo.gameId);
    }
  }, [phase, matchInfo, playerId, connectToGame]);

  const handleGameMessage = (message: any) => {
    switch (message.type) {
      case "connected": {
        if (message.opponent) {
          setMatchInfo((current) => (current ? { ...current, opponent: message.opponent } : current));
        }
        break;
      }
      case "start": {
        setGameStatus("active");
        setStatusMessage("");
        break;
      }
      case "resume_state": {
        const snapshot: TetrisStateSnapshot | null = message.state ?? null;
        if (snapshot) {
          setLocalState(snapshot);
          if (tetrisRef.current) {
            tetrisRef.current.syncWithSnapshot(snapshot);
          }
        }
        setGameStatus("active");
        setStatusMessage("Game resumed.");
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
        setStatusMessage("Opponent disconnected. Waiting for them to return...");
        break;
      }
      case "opponent_returned": {
        setStatusMessage("Opponent reconnected. Keep playing!");
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    if (phase !== "playing") {
      return;
    }

    if (gameStatus === "idle") {
      return;
    }

    if (!gameContainerRef.current) {
      return;
    }

    if (tetrisRef.current) {
      return;
    }

    const game = new TetrisGame(gameContainerRef.current, {
      onStateUpdate: (snapshot) => {
        setLocalState(snapshot);
        if (isSocketOpen(gameSocketRef.current)) {
          gameSocketRef.current!.send(
            JSON.stringify({
              type: "state_update",
              state: snapshot,
            }),
          );
        }
      },
      onGameOver: (snapshot) => {
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
      },
      stateUpdateInterval: 150,
      initialState: localState ?? undefined,
    });

    tetrisRef.current = game;

    return () => {
      game.destroy();
      tetrisRef.current = null;
    };
  }, [phase, gameStatus, localState]);

  useEffect(() => {
    if (phase === "playing" && gameStatus === "waiting" && localState && tetrisRef.current) {
      tetrisRef.current.syncWithSnapshot(localState);
    }
  }, [phase, gameStatus, localState]);

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

  const resetSession = () => {
    if (isSocketOpen(gameSocketRef.current)) {
      gameSocketRef.current!.send(JSON.stringify({ type: "leave" }));
    }
    if (isSocketOpen(lobbySocketRef.current)) {
      lobbySocketRef.current!.send(JSON.stringify({ type: "leave" }));
    }

    gameSocketRef.current?.close();
    lobbySocketRef.current?.close();
    gameSocketRef.current = null;
    lobbySocketRef.current = null;

    if (tetrisRef.current) {
      tetrisRef.current.destroy();
      tetrisRef.current = null;
    }

    clearPersistedState();
    restoredRef.current = null;
    pendingLobbyJoin.current = null;

    setPhase("setup");
    setPlayerName("");
    setNameInput("");
    setPlayerId(null);
    setLobbyPlayers([]);
    setIsQueued(false);
    setMatchInfo(null);
    setGameStatus("idle");
    setLocalState(null);
    setOpponentState(null);
    setStatusMessage("Session reset. Enter the lobby to start again.");
  };

  useEffect(() => {
    if (!playerId && phase === "setup" && !playerName) {
      clearPersistedState();
      return;
    }

    storePersistedState({
      playerId: playerId ?? undefined,
      playerName: playerName || undefined,
      phase,
      matchInfo,
      gameStatus,
      isQueued,
      localState,
      opponentState,
    });
  }, [playerId, playerName, phase, matchInfo, gameStatus, isQueued, localState, opponentState]);

  const renderLobby = () => (
    <div className="lobby-screen">
      <div className="lobby-card">
        <div className="lobby-header">
          <h2>Lobby</h2>
          <p>Signed in as <strong>{playerName || "Guest"}</strong></p>
        </div>
        <button className="matchmaking-btn" onClick={toggleQueue}>
          {isQueued ? "Cancel Matchmaking" : "Find Match"}
        </button>
        <div className="lobby-list">
          {lobbyPlayers.length === 0 ? (
            <p className="lobby-empty">No other players yet. Invite a friend!</p>
          ) : (
            lobbyPlayers.map((player) => {
              const statusLabel = player.isConnected === false ? "Reconnecting..." : player.isReady ? "Ready" : "Idle";
              const cardClasses = [
                "lobby-player",
                player.id === playerId ? "me" : "",
                player.isReady ? "ready" : "",
                player.isConnected === false ? "offline" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div key={player.id} className={cardClasses}>
                  <span className="lobby-player__name">{player.name}</span>
                  <span className="lobby-player__status">{statusLabel}</span>
                </div>
              );
            })
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

  const shouldShowReset = Boolean(playerId || playerName || phase !== "setup");

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-info">
          <h1>Superb Game</h1>
          <p>Multiplayer Tetris Arena</p>
        </div>
        {shouldShowReset && (
          <div className="header-actions">
            <button className="ghost-btn" onClick={resetSession}>
              Reset Session
            </button>
          </div>
        )}
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








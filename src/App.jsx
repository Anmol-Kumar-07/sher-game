import React, { useEffect, useState, useRef, useCallback } from 'react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, deleteDoc } from 'firebase/firestore';

// Initialize Firebase (Paste your actual Firebase config here before deploying)
const firebaseConfig = {
  apiKey: "AIzaSyChVxjvESWmZnXCb9TsQWPp6CJfxy-jkJQ",
  authDomain: "sher-game.firebaseapp.com",
  projectId: "sher-game",
  storageBucket: "sher-game.firebasestorage.app",
  messagingSenderId: "300960966076",
  appId: "1:300960966076:web:f55c7fcdcfaafcdeb237b9",
  measurementId: "G-069WLY44M0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'my-custom-sher-game';

const points = [
  [10, 10], [50, 10], [90, 10],
  [25, 25], [50, 25], [75, 25],
  [40, 40], [50, 40], [60, 40],
  [10, 50], [25, 50], [40, 50], [60, 50], [75, 50], [90, 50],
  [40, 60], [50, 60], [60, 60],
  [25, 75], [50, 75], [75, 75],
  [10, 90], [50, 90], [90, 90]
];

const nodeNames = [
  "Outer Top-Left", "Outer Top-Mid", "Outer Top-Right",
  "Mid Top-Left", "Mid Top-Mid", "Mid Top-Right",
  "Inner Top-Left", "Inner Top-Mid", "Inner Top-Right",
  "Outer Mid-Left", "Mid Mid-Left", "Inner Mid-Left", "Inner Mid-Right", "Mid Mid-Right", "Outer Mid-Right",
  "Inner Bot-Left", "Inner Bot-Mid", "Inner Bot-Right",
  "Mid Bot-Left", "Mid Bot-Mid", "Mid Bot-Right",
  "Outer Bot-Left", "Outer Bot-Mid", "Outer Bot-Right"
];

const neighbors = {
  0: [1, 9], 1: [0, 2, 4], 2: [1, 14],
  3: [4, 10], 4: [1, 3, 5, 7], 5: [4, 13],
  6: [7, 11], 7: [4, 6, 8], 8: [7, 12],
  9: [0, 10, 21], 10: [3, 9, 11, 18], 11: [6, 10, 15],
  12: [8, 13, 17], 13: [5, 12, 14, 20], 14: [2, 13, 23],
  15: [11, 16], 16: [15, 17, 19], 17: [12, 16],
  18: [10, 19], 19: [16, 18, 20, 22], 20: [13, 19],
  21: [9, 22], 22: [19, 21, 23], 23: [14, 22]
};

const sherLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], 
  [9, 10, 11], [12, 13, 14], 
  [15, 16, 17], [18, 19, 20], [21, 22, 23], 
  [0, 9, 21], [3, 10, 18], [6, 11, 15], 
  [1, 4, 7], [16, 19, 22], 
  [8, 12, 17], [5, 13, 20], [2, 14, 23] 
];

const THEMES = {
  classic: {
    name: "Classic Wood",
    bg: "radial-gradient(circle, #8B5A2B 0%, #3E2723 100%)",
    panelBg: "rgba(62, 39, 35, 0.8)",
    lineColor: "#4E342E",
    p1Color: "#f5f5f5", p2Color: "#1a1a1a",
    p1Name: "White", p2Name: "Black",
    textColor: "#F5F5DC"
  },
  neon: {
    name: "Neon Cyberpunk",
    bg: "radial-gradient(circle at center, #0f172a 0%, #020617 100%)",
    panelBg: "rgba(15, 23, 42, 0.8)",
    lineColor: "rgba(14, 165, 233, 0.4)",
    p1Color: "#0ea5e9", p2Color: "#d946ef",
    p1Name: "Cyan", p2Name: "Magenta",
    textColor: "#e2e8f0"
  },
  royal: {
    name: "Royal Marble",
    bg: "radial-gradient(circle, #f8fafc 0%, #cbd5e1 100%)",
    panelBg: "rgba(255, 255, 255, 0.9)",
    lineColor: "#b45309",
    p1Color: "#ef4444", p2Color: "#3b82f6",
    p1Name: "Red", p2Name: "Blue",
    textColor: "#1e293b"
  },
  void: {
    name: "Galactic Void",
    bg: "radial-gradient(circle, #2d1b4e 0%, #000000 100%)",
    panelBg: "rgba(20, 10, 30, 0.8)",
    lineColor: "#8b5cf6",
    p1Color: "#f472b6", p2Color: "#38bdf8",
    p1Name: "Pink", p2Name: "Blue",
    textColor: "#e9d5ff"
  },
  forest: {
    name: "Enchanted Forest",
    bg: "radial-gradient(circle, #14532d 0%, #052e16 100%)",
    panelBg: "rgba(20, 40, 20, 0.8)",
    lineColor: "#4ade80",
    p1Color: "#facc15", p2Color: "#f97316",
    p1Name: "Sun", p2Name: "Flame",
    textColor: "#bbf7d0"
  }
};

export default function SherGame() {
  const [user, setUser] = useState(null);
  const [appState, setAppState] = useState('menu'); // menu, playing
  
  // Game Modes: 'local_ai', 'local_pvp', 'online_host', 'online_guest'
  const [gameMode, setGameMode] = useState('local_ai'); 
  const [difficulty, setDifficulty] = useState('medium'); 
  const [themeId, setThemeId] = useState('classic');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Online Multiplayer State
  const [roomCode, setRoomCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [roomStatus, setRoomStatus] = useState(''); // waiting, playing
  const [roomError, setRoomError] = useState('');

  // Core Game State (Synced locally or via Firebase)
  const [board, setBoard] = useState(Array(24).fill(null));
  const [turn, setTurn] = useState(1); 
  const [phase, setPhase] = useState('placing'); 
  const [stock, setStock] = useState({ 1: 9, 2: 9 });
  const [removeMode, setRemoveMode] = useState(false);
  const [winner, setWinner] = useState(null);
  const [history, setHistory] = useState([]);
  
  // Local interaction state (Never synced to Firebase)
  const [selected, setSelected] = useState(null);
  const [guideMoves, setGuideMoves] = useState([]);
  const [shersFormed, setShersFormed] = useState([]);

  // FIX: Replaced historyEndRef with historyContainerRef for better mobile scrolling
  const historyContainerRef = useRef(null);
  const theme = THEMES[themeId];

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (e) {
        console.error("Auth error", e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Listen to Firestore Room Document if online
  useEffect(() => {
    if (!user || !roomCode || !gameMode.startsWith('online')) return;
    
    const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const unsubscribe = onSnapshot(roomDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBoard(data.board || Array(24).fill(null));
        setTurn(data.turn || 1);
        setPhase(data.phase || 'placing');
        setStock(data.stock || { 1: 9, 2: 9 });
        setRemoveMode(data.removeMode || false);
        setWinner(data.winner || null);
        setHistory(data.history || []);
        setRoomStatus(data.status || 'waiting');
        updateShers(data.board || Array(24).fill(null));
      } else {
        setRoomError("Room was closed by the host.");
        setAppState('menu');
      }
    });

    return () => unsubscribe();
  }, [user, roomCode, gameMode]);

  // FIX: Scroll only the container, preventing the whole page from jumping on mobile
  useEffect(() => {
    if (historyContainerRef.current) {
      historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
    }
  }, [history]);

  const playSound = useCallback((type) => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      
      if (type === 'place') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
      } else if (type === 'capture') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
        gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
      } else if (type === 'error') {
        osc.type = 'square'; osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
      } else if (type === 'win') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.2); osc.frequency.setValueAtTime(800, now + 0.4);
        gain.gain.setValueAtTime(0.3, now); gain.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.start(now); osc.stop(now + 0.6);
      }
    } catch (e) { /* ignore */ }
  }, [soundEnabled]);

  const updateShers = (currentBoard) => {
    const formed = new Set();
    sherLines.forEach(line => {
      const p = currentBoard[line[0]];
      if (p !== null && currentBoard[line[1]] === p && currentBoard[line[2]] === p) {
        line.forEach(idx => formed.add(idx));
      }
    });
    setShersFormed(Array.from(formed));
  };

  const isSher = (player, index, currentBoard) => {
    return sherLines.some(line => line.includes(index) && line.every(i => currentBoard[i] === player));
  };

  const areAllOpponentPiecesInSher = (opponent, currentBoard) => {
    const opponentPieces = currentBoard.map((p, i) => p === opponent ? i : null).filter(i => i !== null);
    if (opponentPieces.length === 0) return false;
    return opponentPieces.every(i => isSher(opponent, i, currentBoard));
  };

  const canMove = (player, currentBoard) => {
    for (let i = 0; i < 24; i++) {
      if (currentBoard[i] === player) {
        for (const n of neighbors[i]) {
          if (currentBoard[n] === null) return true;
        }
      }
    }
    return false;
  };

  const checkWinCondition = (currentBoard, currentPhase, currentTurn) => {
    const p1Count = currentBoard.filter(p => p === 1).length + (currentPhase === 'placing' ? stock[1] : 0);
    const p2Count = currentBoard.filter(p => p === 2).length + (currentPhase === 'placing' ? stock[2] : 0);
    
    if (currentPhase === 'moving') {
      if (p1Count < 3) return 2;
      if (p2Count < 3) return 1;
      if (currentTurn === 1 && !canMove(1, currentBoard)) return 2;
      if (currentTurn === 2 && !canMove(2, currentBoard)) return 1;
    }
    return null;
  };

  const pushGameState = async (updates) => {
    if (gameMode.startsWith('online') && roomCode) {
      try {
        const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
        await updateDoc(roomDocRef, updates);
      } catch (err) {
        console.error("Failed to sync state:", err);
      }
    } else {
      if (updates.board !== undefined) setBoard(updates.board);
      if (updates.turn !== undefined) setTurn(updates.turn);
      if (updates.phase !== undefined) setPhase(updates.phase);
      if (updates.stock !== undefined) setStock(updates.stock);
      if (updates.removeMode !== undefined) setRemoveMode(updates.removeMode);
      if (updates.winner !== undefined) setWinner(updates.winner);
      if (updates.history !== undefined) setHistory(updates.history);
      if (updates.board !== undefined) updateShers(updates.board);
    }
  };

  const getPlayerName = (p) => {
    if (gameMode === 'local_ai' && p === 2) return "AI";
    if (gameMode.startsWith('online')) return p === 1 ? "Host" : "Guest";
    return p === 1 ? theme.p1Name : theme.p2Name;
  };

  const handleClick = (index) => {
    if (winner) return;
    if (gameMode === 'local_ai' && turn === 2 && !removeMode && phase !== 'placing') return; 
    if (gameMode.startsWith('online')) {
      if (roomStatus !== 'playing') return;
      if (gameMode === 'online_host' && turn !== 1) return;
      if (gameMode === 'online_guest' && turn !== 2) return;
    }

    if (removeMode) {
      executeRemoval(index);
      return;
    }

    const updatedBoard = [...board];

    if (phase === 'placing') {
      if (updatedBoard[index] !== null) { playSound('error'); return; }

      playSound('place');
      updatedBoard[index] = turn;
      
      const newStock = { ...stock, [turn]: stock[turn] - 1 };
      const newHistory = [...history, { player: turn, text: `${getPlayerName(turn)} placed at ${nodeNames[index]}` }];
      
      let newRemoveMode = false;
      let newPhase = phase;
      let newTurn = turn === 1 ? 2 : 1;

      if (isSher(turn, index, updatedBoard)) {
        newRemoveMode = true;
        newTurn = turn;
      } else if (newStock[1] === 0 && newStock[2] === 0) {
        newPhase = 'moving';
      }

      pushGameState({
        board: updatedBoard,
        stock: newStock,
        history: newHistory,
        removeMode: newRemoveMode,
        phase: newPhase,
        turn: newTurn
      });
      return;
    }

    if (selected === null || updatedBoard[index] === turn) {
      if (updatedBoard[index] === turn) {
        setSelected(index);
        setGuideMoves(neighbors[index].filter(n => updatedBoard[n] === null));
      }
      return;
    }

    if (updatedBoard[index] === null && guideMoves.includes(index)) {
      playSound('place');
      updatedBoard[index] = turn;
      updatedBoard[selected] = null;
      
      const newHistory = [...history, { player: turn, text: `${getPlayerName(turn)} moved to ${nodeNames[index]}` }];
      let newRemoveMode = false;
      let newTurn = turn === 1 ? 2 : 1;
      let newWinner = winner;

      if (isSher(turn, index, updatedBoard)) {
        newRemoveMode = true;
        newTurn = turn; 
      } else {
        const opponent = turn === 1 ? 2 : 1;
        if (!canMove(opponent, updatedBoard)) {
          newWinner = turn; 
          playSound('win');
        }
      }

      pushGameState({
        board: updatedBoard,
        removeMode: newRemoveMode,
        history: newHistory,
        turn: newTurn,
        winner: newWinner
      });
      setSelected(null);
      setGuideMoves([]);
    }
  };

  const executeRemoval = (index) => {
    const opponent = turn === 1 ? 2 : 1;
    
    if (board[index] !== opponent) { playSound('error'); return; }
    if (isSher(opponent, index, board) && !areAllOpponentPiecesInSher(opponent, board)) {
      playSound('error');
      setHistory(prev => [...prev, { player: turn, text: `Attempted to capture protected piece` }]);
      return;
    }

    playSound('capture');
    const updatedBoard = [...board];
    updatedBoard[index] = null;
    
    const newHistory = [...history, { player: turn, text: `${getPlayerName(turn)} captured piece at ${nodeNames[index]}` }];
    let newWinner = winner;
    let newTurn = turn === 1 ? 2 : 1;

    const winCheck = checkWinCondition(updatedBoard, phase, opponent); 
    if (winCheck) {
      newWinner = winCheck;
      newTurn = turn;
      playSound('win');
    }

    pushGameState({
      board: updatedBoard,
      removeMode: false,
      history: newHistory,
      winner: newWinner,
      turn: newTurn
    });
  };

  useEffect(() => {
    if (gameMode !== 'local_ai' || turn !== 2 || winner || appState !== 'playing') return;

    const aiTimer = setTimeout(() => {
      if (removeMode) {
        let targets = [];
        let shielded = [];
        for (let i = 0; i < 24; i++) {
          if (board[i] === 1) {
            if (!isSher(1, i, board)) targets.push(i);
            else shielded.push(i);
          }
        }
        const targetList = targets.length > 0 ? targets : shielded;
        if (targetList.length > 0) {
          executeRemoval(targetList[Math.floor(Math.random() * targetList.length)]);
        }
        return;
      }

      const getEmptyNodes = (b) => b.map((val, idx) => val === null ? idx : null).filter(v => v !== null);
      const testSher = (player, b, idx, fromIdx = null) => {
        let temp = [...b];
        if (fromIdx !== null) temp[fromIdx] = null;
        temp[idx] = player;
        return isSher(player, idx, temp);
      };

      if (phase === 'placing') {
        const empty = getEmptyNodes(board);
        if (empty.length === 0) return;
        let choice = null;

        if (difficulty === 'easy') {
          choice = empty[Math.floor(Math.random() * empty.length)];
        } else {
          choice = empty.find(idx => testSher(2, board, idx)); 
          if (choice === undefined) choice = empty.find(idx => testSher(1, board, idx)); 
          
          if (choice === undefined && difficulty === 'hard') {
            const strategic = empty.filter(idx => [4, 10, 13, 19].includes(idx));
            if (strategic.length > 0) choice = strategic[Math.floor(Math.random() * strategic.length)];
          }
          if (choice === undefined) choice = empty[Math.floor(Math.random() * empty.length)];
        }
        
        // AI MANUAL PLACING EXECUTION FIX
        playSound('place');
        const updatedBoard = [...board];
        updatedBoard[choice] = 2;
        
        const newStock = { ...stock, 2: Math.max(0, stock[2] - 1) };
        const newHistory = [...history, { player: 2, text: `AI placed at ${nodeNames[choice]}` }];
        
        let newRemoveMode = false;
        let newPhase = phase;
        let newTurn = 1;

        if (isSher(2, choice, updatedBoard)) {
          newRemoveMode = true;
          newTurn = 2;
        } else if (stock[1] <= 0 && newStock[2] <= 0) {
          newPhase = 'moving';
        }

        pushGameState({
          board: updatedBoard,
          stock: newStock,
          history: newHistory,
          removeMode: newRemoveMode,
          phase: newPhase,
          turn: newTurn
        });

      } else {
        let possibleMoves = [];
        for (let i = 0; i < 24; i++) {
          if (board[i] === 2) {
            neighbors[i].filter(n => board[n] === null).forEach(n => possibleMoves.push({ from: i, to: n }));
          }
        }
        if (possibleMoves.length === 0) { 
          pushGameState({ winner: 1 }); 
          playSound('win');
          return; 
        }

        let chosenMove = null;
        if (difficulty === 'easy') {
          chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        } else {
          chosenMove = possibleMoves.find(m => testSher(2, board, m.to, m.from)); 
          if (!chosenMove) {
            chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
          }
        }

        playSound('place');
        const updatedBoard = [...board];
        updatedBoard[chosenMove.to] = 2;
        updatedBoard[chosenMove.from] = null;
        
        const newHistory = [...history, { player: 2, text: `AI moved to ${nodeNames[chosenMove.to]}` }];
        let newRemoveMode = false;
        let newTurn = 1;
        let newWinner = winner;

        if (isSher(2, chosenMove.to, updatedBoard)) {
          newRemoveMode = true;
          newTurn = 2;
        } else if (!canMove(1, updatedBoard)) {
          newWinner = 2;
          playSound('win');
        }

        pushGameState({
          board: updatedBoard,
          removeMode: newRemoveMode,
          history: newHistory,
          turn: newTurn,
          winner: newWinner
        });
      }
    }, 800); 

    return () => clearTimeout(aiTimer);
  }, [turn, board, removeMode, phase, winner, gameMode, difficulty, appState]);

  const createRoom = async () => {
    if (!user) return;
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    
    const roomData = {
      host: user.uid,
      guest: null,
      status: 'waiting',
      board: Array(24).fill(null),
      turn: 1,
      phase: 'placing',
      stock: { 1: 9, 2: 9 },
      removeMode: false,
      winner: null,
      history: [{ player: 1, text: "Room created. Waiting for opponent..." }]
    };

    try {
      const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code);
      await setDoc(roomDocRef, roomData);
      setRoomCode(code);
      setGameMode('online_host');
      setRoomError('');
      setAppState('playing');
    } catch (e) {
      console.error(e);
      setRoomError("Failed to create room.");
    }
  };

  const joinRoom = async () => {
    if (!user || !joinInput.trim()) return;
    const code = joinInput.trim().toUpperCase();
    
    try {
      const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code);
      const snap = await getDoc(roomDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.guest === null || data.guest === user.uid) {
          await updateDoc(roomDocRef, { 
            guest: user.uid, 
            status: 'playing',
            history: [...data.history, { player: 2, text: "Guest joined the game!" }]
          });
          setRoomCode(code);
          setGameMode('online_guest');
          setRoomError('');
          setAppState('playing');
        } else {
          setRoomError("Room is already full.");
        }
      } else {
        setRoomError("Room not found.");
      }
    } catch (e) {
      console.error(e);
      setRoomError("Failed to join room.");
    }
  };

  const startLocalGame = (mode) => {
    setGameMode(mode);
    setBoard(Array(24).fill(null));
    setTurn(1); setSelected(null); setGuideMoves([]);
    setPhase('placing'); setStock({ 1: 9, 2: 9 });
    setRemoveMode(false); setWinner(null); setHistory([]); setShersFormed([]);
    setRoomCode('');
    setAppState('playing');
  };

  const resetGame = () => {
    if (gameMode.startsWith('online') && roomCode) {
      pushGameState({
        board: Array(24).fill(null),
        turn: 1,
        phase: 'placing',
        stock: { 1: 9, 2: 9 },
        removeMode: false,
        winner: null,
        history: [{ player: 1, text: "Game restarted by host." }]
      });
    } else {
      startLocalGame(gameMode);
    }
  };

  const leaveRoom = async () => {
    if (gameMode.startsWith('online') && roomCode && gameMode === 'online_host') {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode));
      } catch (e) { console.error(e); }
    }
    setAppState('menu');
    setRoomCode('');
  };

  if (appState === 'menu') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: THEMES[themeId].bg, color: THEMES[themeId].textColor, fontFamily: 'system-ui, sans-serif', padding: '20px', transition: 'background 0.5s' }}>
        <div style={{ background: THEMES[themeId].panelBg, padding: '40px', borderRadius: '24px', maxWidth: '600px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', border: `1px solid ${THEMES[themeId].lineColor}` }}>
          <h1 style={{ fontSize: '3.5rem', textAlign: 'center', margin: '0 0 10px 0', fontWeight: '900', letterSpacing: '4px', textTransform: 'uppercase', textShadow: `0 0 20px ${THEMES[themeId].lineColor}` }}>Sher</h1>
          <p style={{ textAlign: 'center', marginBottom: '30px', opacity: 0.8 }}>The Ultimate Strategy Game</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ margin: '0 0 15px 0', borderBottom: `1px solid ${THEMES[themeId].lineColor}`, paddingBottom: '8px' }}>Local Play</h3>
              <button onClick={() => startLocalGame('local_ai')} style={{ width: '100%', padding: '12px', marginBottom: '10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>1 Player (vs AI)</button>
              
              <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
                {['easy', 'medium', 'hard'].map(diff => (
                  <button key={diff} onClick={() => setDifficulty(diff)} style={{ flex: 1, padding: '6px', fontSize: '0.8rem', textTransform: 'capitalize', background: difficulty === diff ? '#10b981' : 'transparent', color: difficulty === diff ? 'white' : THEMES[themeId].textColor, border: `1px solid ${difficulty === diff ? '#10b981' : '#64748b'}`, borderRadius: '6px', cursor: 'pointer' }}>{diff}</button>
                ))}
              </div>

              <button onClick={() => startLocalGame('local_pvp')} style={{ width: '100%', padding: '12px', background: 'transparent', color: THEMES[themeId].textColor, border: `2px solid #3b82f6`, borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>2 Players (Local)</button>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ margin: '0 0 15px 0', borderBottom: `1px solid ${THEMES[themeId].lineColor}`, paddingBottom: '8px' }}>Play Online</h3>
              {user ? (
                <>
                  <button onClick={createRoom} style={{ width: '100%', padding: '12px', marginBottom: '15px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Create Team Room</button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" placeholder="Enter Team Code" value={joinInput} onChange={e => setJoinInput(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', outline: 'none', textTransform: 'uppercase', minWidth: '0' }} maxLength={5} />
                    <button onClick={joinRoom} style={{ padding: '10px 15px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Join</button>
                  </div>
                  {roomError && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' }}>{roomError}</div>}
                </>
              ) : (
                <p style={{ fontSize: '0.9rem', opacity: 0.7, textAlign: 'center' }}>Connecting to global servers...</p>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', textAlign: 'center' }}>Select Theme</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {Object.entries(THEMES).map(([id, t]) => (
                <button key={id} onClick={() => setThemeId(id)} style={{ padding: '10px 16px', background: themeId === id ? t.p1Color : 'rgba(0,0,0,0.3)', color: themeId === id ? (id==='classic'||id==='forest'?'#000':'#fff') : t.textColor, border: `1px solid ${t.p1Color}`, borderRadius: '20px', cursor: 'pointer', fontWeight: themeId === id ? 'bold' : 'normal', transition: 'all 0.2s' }}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, color: theme.textColor, fontFamily: 'system-ui, sans-serif', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <button onClick={leaveRoom} style={{ padding: '10px 20px', background: 'rgba(0,0,0,0.3)', color: theme.textColor, border: `1px solid ${theme.lineColor}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>← Leave Match</button>
        <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', flex: 1, minWidth: '150px' }}>{theme.name}</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          {gameMode.startsWith('online') && (
            <div style={{ padding: '10px 20px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${theme.lineColor}`, borderRadius: '8px', fontWeight: 'bold' }}>
              Code: <span style={{ color: theme.p1Color }}>{roomCode}</span>
            </div>
          )}
          <button onClick={() => setSoundEnabled(!soundEnabled)} style={{ padding: '10px 20px', background: 'rgba(0,0,0,0.3)', color: theme.textColor, border: `1px solid ${theme.lineColor}`, borderRadius: '8px', cursor: 'pointer' }}>
            Sound: {soundEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', justifyContent: 'center', width: '100%', maxWidth: '1200px' }}>
        
        <div style={{ flex: '1 1 300px', maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div style={{ background: theme.panelBg, padding: '15px', borderRadius: '12px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', border: `2px solid ${removeMode ? '#ef4444' : theme.lineColor}`, transition: 'all 0.3s' }}>
            {gameMode.startsWith('online') && roomStatus === 'waiting' ? (
              <span style={{ color: theme.p1Color, animation: 'pulse 2s infinite' }}>Waiting for opponent to join... (Code: {roomCode})</span>
            ) : removeMode ? (
              <span style={{ color: '#ef4444', animation: 'pulse 1.5s infinite' }}>Sher Formed! Capture an Opponent's Piece</span>
            ) : winner ? (
              <span style={{ color: '#10b981' }}>Match Concluded</span>
            ) : (
              <span>Turn: <span style={{ color: turn === 1 ? theme.p1Color : theme.p2Color }}>{getPlayerName(turn)}</span> | Phase: {phase.toUpperCase()}</span>
            )}
          </div>

          <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: theme.panelBg, borderRadius: '16px', padding: '4%', boxSizing: 'border-box', boxShadow: `0 10px 40px rgba(0,0,0,0.5)`, border: `1px solid ${theme.lineColor}` }}>
            
            {gameMode.startsWith('online') && roomStatus === 'waiting' && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRadius: '16px', backdropFilter: 'blur(4px)' }}>
                <h3 style={{ fontSize: '2rem', marginBottom: '10px' }}>Waiting for Player 2</h3>
                <p style={{ fontSize: '1.2rem', opacity: 0.8 }}>Share this code with your friend:</p>
                <div style={{ fontSize: '3rem', fontWeight: 'bold', color: theme.p1Color, letterSpacing: '5px', padding: '10px 30px', background: 'rgba(0,0,0,0.5)', borderRadius: '12px', marginTop: '10px' }}>{roomCode}</div>
              </div>
            )}

            <svg viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
              <g stroke={theme.lineColor} strokeWidth="1" fill="none" strokeLinecap="round">
                <rect x="10" y="10" width="80" height="80" />
                <rect x="25" y="25" width="50" height="50" />
                <rect x="40" y="40" width="20" height="20" />
                <line x1="50" y1="10" x2="50" y2="40" />
                <line x1="50" y1="60" x2="50" y2="90" />
                <line x1="10" y1="50" x2="40" y2="50" />
                <line x1="60" y1="50" x2="90" y2="50" />
              </g>
              {shersFormed.length > 0 && sherLines.map((line, idx) => {
                if (shersFormed.includes(line[0]) && shersFormed.includes(line[1]) && shersFormed.includes(line[2]) && board[line[0]] !== null && board[line[0]]===board[line[1]] && board[line[1]]===board[line[2]]) {
                  return (
                    <line key={idx} x1={points[line[0]][0]} y1={points[line[0]][1]} x2={points[line[2]][0]} y2={points[line[2]][1]} stroke={board[line[0]] === 1 ? theme.p1Color : theme.p2Color} strokeWidth="2.5" opacity="0.6" style={{ filter: `drop-shadow(0 0 5px ${board[line[0]] === 1 ? theme.p1Color : theme.p2Color})` }} />
                  );
                }
                return null;
              })}
            </svg>

            {points.map((pt, index) => {
              const piece = board[index];
              const isSelected = selected === index;
              const isGuide = guideMoves.includes(index);
              
              let isMyTurnToRemove = false;
              if (gameMode === 'local_ai' || gameMode === 'local_pvp') isMyTurnToRemove = removeMode;
              else if (gameMode === 'online_host') isMyTurnToRemove = removeMode && turn === 1;
              else if (gameMode === 'online_guest') isMyTurnToRemove = removeMode && turn === 2;

              const isTarget = isMyTurnToRemove && piece !== null && piece !== turn;
              const isProtected = isTarget && isSher(piece, index, board) && !areAllOpponentPiecesInSher(piece, board);

              let bg = theme.panelBg;
              let border = `2px solid ${theme.lineColor}`;
              let size = '4%';
              let cursor = 'pointer';

              if (piece === 1) { bg = theme.p1Color; border = 'none'; size = '7%'; }
              else if (piece === 2) { bg = theme.p2Color; border = 'none'; size = '7%'; }
              
              if (isGuide) { bg = 'rgba(16, 185, 129, 0.5)'; border = '2px solid #10b981'; size = '5%'; }

              if (isTarget) {
                if (isProtected) { cursor = 'not-allowed'; }
                else { border = '4px solid #ef4444'; cursor = 'crosshair'; }
              }

              return (
                <div key={index} onClick={() => handleClick(index)} style={{
                  position: 'absolute', left: `${pt[0]}%`, top: `${pt[1]}%`, transform: 'translate(-50%, -50%)',
                  width: size, height: size, minWidth: '15px', minHeight: '15px', borderRadius: '50%',
                  background: bg, border: border, cursor: cursor, zIndex: piece !== null ? 10 : 5,
                  boxShadow: isSelected ? `0 0 20px ${theme.textColor}, 0 0 10px ${theme.textColor} inset` : (piece ? `0 4px 10px rgba(0,0,0,0.5), inset 0 -3px 5px rgba(0,0,0,0.3)` : 'none'),
                  transition: 'all 0.2s ease', opacity: (isTarget && isProtected) ? 0.4 : 1
                }} />
              );
            })}
          </div>
        </div>

        <div style={{ flex: '1 1 300px', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, background: theme.panelBg, padding: '15px', borderRadius: '12px', borderBottom: turn === 1 && !winner ? `4px solid ${theme.p1Color}` : '4px solid transparent', transition: 'all 0.3s' }}>
              <div style={{ color: theme.p1Color, fontWeight: 'bold', fontSize: '1.1rem' }}>{getPlayerName(1)} {gameMode === 'online_host' && '(You)'}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Pieces to place: {stock[1]}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>On board: {board.filter(p=>p===1).length}</div>
            </div>
            <div style={{ flex: 1, background: theme.panelBg, padding: '15px', borderRadius: '12px', borderBottom: turn === 2 && !winner ? `4px solid ${theme.p2Color}` : '4px solid transparent', transition: 'all 0.3s' }}>
              <div style={{ color: theme.p2Color, fontWeight: 'bold', fontSize: '1.1rem' }}>{getPlayerName(2)} {gameMode === 'online_guest' && '(You)'}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Pieces to place: {stock[2]}</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>On board: {board.filter(p=>p===2).length}</div>
            </div>
          </div>

          <div style={{ flex: 1, background: theme.panelBg, padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: '150px', maxHeight: '400px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', borderBottom: `1px solid ${theme.lineColor}`, paddingBottom: '10px' }}>Match Log</h3>
            <div ref={historyContainerRef} style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', paddingRight: '5px' }}>
              {history.length === 0 && <div style={{ opacity: 0.5, fontStyle: 'italic' }}>Match started. Awaiting moves...</div>}
              {history.map((log, i) => (
                <div key={i} style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: `4px solid ${log.player === 1 ? theme.p1Color : theme.p2Color}` }}>
                  {log.text}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {winner && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: theme.panelBg, padding: '50px', borderRadius: '24px', textAlign: 'center', maxWidth: '450px', width: '90%', border: `2px solid ${winner === 1 ? theme.p1Color : theme.p2Color}`, boxShadow: `0 0 80px ${winner === 1 ? theme.p1Color : theme.p2Color}` }}>
            <h1 style={{ fontSize: '3rem', margin: '0 0 15px 0', color: winner === 1 ? theme.p1Color : theme.p2Color, textTransform: 'uppercase', letterSpacing: '3px' }}>VICTORY!</h1>
            <p style={{ fontSize: '1.3rem', marginBottom: '40px', fontWeight: 'bold' }}>
              {getPlayerName(winner)} has claimed the board!
            </p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
              {(!gameMode.startsWith('online') || gameMode === 'online_host') && (
                <button onClick={resetGame} style={{ padding: '14px 28px', background: winner === 1 ? theme.p1Color : theme.p2Color, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}>Play Again</button>
              )}
              {gameMode === 'online_guest' && (
                <p style={{ fontSize: '1rem', fontStyle: 'italic', opacity: 0.8 }}>Waiting for host to restart...</p>
              )}
              <button onClick={leaveRoom} style={{ padding: '14px 28px', background: 'rgba(255,255,255,0.1)', color: theme.textColor, border: `1px solid ${theme.textColor}`, borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem' }}>Menu</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.5); }
      `}</style>
    </div>
  );
}
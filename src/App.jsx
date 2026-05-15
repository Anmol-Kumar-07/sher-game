import React, { useEffect, useState, useRef, useCallback } from 'react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, deleteDoc, arrayUnion } from 'firebase/firestore';

// Initialize Firebase (Yahan apna asli Firebase config paste karein)
const firebaseConfig = {
  apiKey: "AIzaSyChVxjvESWmZnXCb9TsQWPp6CJfxy-jkJQ",
  authDomain: "sher-game.firebaseapp.com",
  projectId: "sher-game",
  storageBucket: "sher-game.firebasestorage.app",
  messagingSenderId: "300960966076",
  appId: "1:300960966076:web:f55c7fcdcfaafcdeb237b9",
  measurementId: "G-069WLY44M0"
};



let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Firebase init skipped/failed", e);
}

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
  classic: { name: "Classic Wood", bg: "radial-gradient(circle, #8B5A2B 0%, #3E2723 100%)", panelBg: "rgba(62, 39, 35, 0.8)", lineColor: "#4E342E", p1Color: "#facc15", p2Color: "#e2e8f0", p1Name: "Gold", p2Name: "Silver", textColor: "#F5F5DC" },
  neon: { name: "Neon Cyber", bg: "radial-gradient(circle at center, #0f172a 0%, #020617 100%)", panelBg: "rgba(15, 23, 42, 0.8)", lineColor: "rgba(14, 165, 233, 0.4)", p1Color: "#0ea5e9", p2Color: "#d946ef", p1Name: "Cyan", p2Name: "Magenta", textColor: "#e2e8f0" },
  void: { name: "Galactic Void", bg: "radial-gradient(circle, #2d1b4e 0%, #000000 100%)", panelBg: "rgba(20, 10, 30, 0.8)", lineColor: "#8b5cf6", p1Color: "#f472b6", p2Color: "#38bdf8", p1Name: "Pink", p2Name: "Blue", textColor: "#e9d5ff" }
};

export default function SherGame() {
  const [user, setUser] = useState(null);
  const [appState, setAppState] = useState('menu'); 
  
  const [playerOrder, setPlayerOrder] = useState(1); 
  
  const [gameMode, setGameMode] = useState('local_ai'); 
  const [difficulty, setDifficulty] = useState('hard'); 
  const [themeId, setThemeId] = useState('classic');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Online Multiplayer State
  const [roomCode, setRoomCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [roomStatus, setRoomStatus] = useState(''); 
  const [roomError, setRoomError] = useState('');
  
  // Rematch States
  const [hostRematch, setHostRematch] = useState(false);
  const [guestRematch, setGuestRematch] = useState(false);

  // Voice Chat State
  const [voiceActive, setVoiceActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);

  // Core Game State 
  const [board, setBoard] = useState(Array(24).fill(null));
  const [turn, setTurn] = useState(1); 
  const [phase, setPhase] = useState('placing'); 
  const [stock, setStock] = useState({ 1: 9, 2: 9 });
  const [removeMode, setRemoveMode] = useState(false);
  const [winner, setWinner] = useState(null);
  const [history, setHistory] = useState([]);
  
  const [selected, setSelected] = useState(null);
  const [guideMoves, setGuideMoves] = useState([]);
  const [shersFormed, setShersFormed] = useState([]);

  // Refs
  const historyContainerRef = useRef(null);
  const theme = THEMES[themeId];

  // WebRTC Refs
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pcRef = useRef(null);
  const addedIce = useRef(new Set());
  const latestRoomDataRef = useRef(null);

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => { try { await signInAnonymously(auth); } catch (e) { } };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // WebRTC Signaling Handler
  const handleSignaling = async (data) => {
    const pc = pcRef.current;
    if (!pc || !data) return;

    try {
        if (gameMode === 'online_guest' && data.offer && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.offer)));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode), { answer: JSON.stringify(answer) });
        }

        if (gameMode === 'online_host' && data.answer && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.answer)));
        }

        if (pc.remoteDescription) {
            const iceArray = gameMode === 'online_host' ? data.guestIce : data.hostIce;
            if (iceArray) {
                iceArray.forEach(iceStr => {
                    if (!addedIce.current.has(iceStr)) {
                        pc.addIceCandidate(new RTCIceCandidate(JSON.parse(iceStr))).catch(e => console.error("ICE error", e));
                        addedIce.current.add(iceStr);
                    }
                });
            }
        }
    } catch(e) {
        console.error("Signaling error", e);
    }
  };

  useEffect(() => {
    if (!user || !db || !roomCode || !gameMode.startsWith('online')) return;
    
    const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
    const unsubscribe = onSnapshot(roomDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        latestRoomDataRef.current = data;
        
        handleSignaling(data);
        
        const isNewUpdate = (
            data.turn !== turn || 
            data.phase !== phase || 
            data.removeMode !== removeMode || 
            data.winner !== winner || 
            (data.history && data.history.length !== history.length) ||
            data.hostRematch !== hostRematch ||
            data.guestRematch !== guestRematch
        );

        if (isNewUpdate) {
            setBoard(data.board || Array(24).fill(null));
            setTurn(data.turn || 1);
            setPhase(data.phase || 'placing');
            setStock(data.stock || { 1: 9, 2: 9 });
            setRemoveMode(data.removeMode || false);
            setWinner(data.winner || null);
            setHistory(data.history || []);
            setRoomStatus(data.status || 'waiting');
            setHostRematch(data.hostRematch || false);
            setGuestRematch(data.guestRematch || false);
            updateShers(data.board || Array(24).fill(null));
        }
      } else {
        setRoomError("Room closed by host.");
        leaveRoomCleanup();
      }
    });

    return () => unsubscribe();
  }, [user, roomCode, gameMode, turn, phase, removeMode, winner, history.length, hostRematch, guestRematch]);

  useEffect(() => {
    if (historyContainerRef.current) {
      historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
    }
  }, [history]);

  const toggleVoiceChat = async () => {
    if (voiceActive) {
        // Disconnect call
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        setVoiceActive(false);
        setMicMuted(false);
        addedIce.current.clear();
        return;
    }

    // Connect call
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setVoiceActive(true);
        setMicMuted(false);

        const servers = {
            iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }]
        };
        const pc = new RTCPeerConnection(servers);
        pcRef.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = event.streams[0];
            }
        };

        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                const field = gameMode === 'online_host' ? 'hostIce' : 'guestIce';
                updateDoc(roomRef, { [field]: arrayUnion(JSON.stringify(event.candidate)) });
            }
        };

        if (gameMode === 'online_host') {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await updateDoc(roomRef, { offer: JSON.stringify(offer) });
        }

        if (latestRoomDataRef.current) {
            handleSignaling(latestRoomDataRef.current);
        }

    } catch (e) {
        console.error("Mic Access Error:", e);
        alert("Could not access microphone. Please check permissions.");
    }
  };

  const toggleMic = () => {
      if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
              audioTrack.enabled = !audioTrack.enabled;
              setMicMuted(!audioTrack.enabled);
          }
      }
  };

  const triggerVibration = useCallback((type) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'light') navigator.vibrate(30);
      else if (type === 'heavy') navigator.vibrate([50, 50, 50]);
      else if (type === 'error') navigator.vibrate([30, 30, 100]);
    }
  }, []);

  const playSound = useCallback((type) => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const now = ctx.currentTime;
      
      if (type === 'place') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
        triggerVibration('light');
      } else if (type === 'capture') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
        gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
        triggerVibration('heavy');
      } else if (type === 'error') {
        osc.type = 'square'; osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
        triggerVibration('error');
      } else if (type === 'win') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.2); osc.frequency.setValueAtTime(800, now + 0.4);
        gain.gain.setValueAtTime(0.3, now); gain.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.start(now); osc.stop(now + 0.6);
        triggerVibration([100, 50, 100, 50, 200]);
      } else if (type === 'lose') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.8);
        gain.gain.setValueAtTime(0.3, now); gain.gain.linearRampToValueAtTime(0, now + 1);
        osc.start(now); osc.stop(now + 1);
        triggerVibration([200, 100, 200, 100, 400]);
      }
    } catch (e) { /* ignore */ }
  }, [soundEnabled, triggerVibration]);

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

  const pushGameState = (updates) => {
    if (updates.board !== undefined) setBoard(updates.board);
    if (updates.turn !== undefined) setTurn(updates.turn);
    if (updates.phase !== undefined) setPhase(updates.phase);
    if (updates.stock !== undefined) setStock(updates.stock);
    if (updates.removeMode !== undefined) setRemoveMode(updates.removeMode);
    if (updates.history !== undefined) setHistory(updates.history);
    if (updates.board !== undefined) updateShers(updates.board);

    if (updates.winner !== undefined) {
        setWinner(updates.winner);
        if (updates.winner !== null) {
             if ((gameMode === 'local_ai' || gameMode === 'online_guest') && updates.winner === 2) playSound('lose');
             else if (gameMode === 'online_host' && updates.winner === 2) playSound('lose');
             else playSound('win');
        }
    }

    if (gameMode.startsWith('online') && roomCode && db) {
      const roomDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);
      updateDoc(roomDocRef, updates).catch(err => console.error("Sync error:", err));
    }
  };

  const getPlayerName = (p) => {
    if (gameMode === 'local_ai' && p === 2) return "Computer";
    if (gameMode.startsWith('online')) return p === 1 ? "Host" : "Guest";
    return p === 1 ? theme.p1Name : theme.p2Name;
  };

  const handleClick = (index) => {
    if (winner) return;
    if (gameMode === 'local_ai' && turn === 2) return; 
    if (gameMode.startsWith('online')) {
      if (roomStatus !== 'playing') return;
      if (gameMode === 'online_host' && turn !== 1) return;
      if (gameMode === 'online_guest' && turn !== 2) return;
    }

    if (removeMode) { executeRemoval(index); return; }

    const updatedBoard = [...board];

    if (phase === 'placing') {
      if (updatedBoard[index] !== null || stock[turn] <= 0) { playSound('error'); return; }

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
      } 
      
      if (!newRemoveMode && newStock[1] === 0 && newStock[2] === 0) {
        newPhase = 'moving';
      }

      pushGameState({
        board: updatedBoard, stock: newStock, history: newHistory,
        removeMode: newRemoveMode, phase: newPhase, turn: newTurn
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
        }
      }

      pushGameState({ board: updatedBoard, removeMode: newRemoveMode, history: newHistory, turn: newTurn, winner: newWinner });
      setSelected(null); setGuideMoves([]);
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
    let newPhase = phase;

    if (phase === 'placing' && stock[1] === 0 && stock[2] === 0) {
        newPhase = 'moving';
    }

    const winCheck = checkWinCondition(updatedBoard, newPhase, opponent); 
    if (winCheck) { newWinner = winCheck; newTurn = turn; }

    pushGameState({
      board: updatedBoard, phase: newPhase, removeMode: false, history: newHistory,
      winner: newWinner, turn: newTurn
    });
  };

  const handleResign = () => {
    playSound('lose');
    let resigningPlayer = turn;
    if (gameMode === 'local_ai') resigningPlayer = 1;
    else if (gameMode === 'online_host') resigningPlayer = 1;
    else if (gameMode === 'online_guest') resigningPlayer = 2;

    const winningPlayer = resigningPlayer === 1 ? 2 : 1;
    pushGameState({ winner: winningPlayer, history: [...history, { player: resigningPlayer, text: `${getPlayerName(resigningPlayer)} has surrendered.` }] });
  };

  // Online Multiplayer Play Again Logic
  const handleRematch = async () => {
    if (!roomCode) return;
    const fieldToUpdate = gameMode === 'online_host' ? 'hostRematch' : 'guestRematch';
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode);

    try {
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const data = snap.data();
        const isOpponentReady = gameMode === 'online_host' ? data.guestRematch : data.hostRematch;

        if (isOpponentReady) {
          // Both are ready! Reset board to play again
          await updateDoc(roomRef, {
            board: Array(24).fill(null),
            turn: playerOrder,
            phase: 'placing',
            stock: { 1: 9, 2: 9 },
            removeMode: false,
            winner: null,
            history: [{ player: playerOrder, text: `Rematch accepted! ${getPlayerName(playerOrder)} moves first.` }],
            hostRematch: false,
            guestRematch: false
          });
        } else {
          // Set my ready status to true
          await updateDoc(roomRef, { [fieldToUpdate]: true });
        }
      }
    } catch (e) {
      console.error("Rematch request failed:", e);
    }
  };

  useEffect(() => {
    if (gameMode !== 'local_ai' || turn !== 2 || winner || appState !== 'playing') return;

    const aiTimer = setTimeout(() => {
      const getEmptyNodes = (b) => b.map((val, idx) => val === null ? idx : null).filter(v => v !== null);
      
      const testSher = (player, b, idx, fromIdx = null) => {
        let temp = [...b]; if (fromIdx !== null) temp[fromIdx] = null; temp[idx] = player;
        return isSher(player, idx, temp);
      };

      const getPotentialShers = (p, b) => {
        let threats = [];
        sherLines.forEach(line => {
            const pieces = line.map(idx => b[idx]);
            if (pieces.filter(x => x === p).length === 2 && pieces.includes(null)) {
                threats.push(line.find(idx => b[idx] === null));
            }
        });
        return threats;
      };

      if (removeMode) {
        let targets = []; let shielded = [];
        for (let i = 0; i < 24; i++) {
          if (board[i] === 1) {
            if (!isSher(1, i, board)) targets.push(i);
            else shielded.push(i);
          }
        }
        const targetList = targets.length > 0 ? targets : shielded;
        if (targetList.length > 0) {
            let choice = targetList[0];
            if (difficulty === 'hard') {
                let bestScore = -Infinity;
                targetList.forEach(t => {
                   let score = 0;
                   let tempBoard = [...board]; tempBoard[t] = null;
                   
                   sherLines.forEach(line => {
                       if (line.includes(t)) {
                           const others = line.filter(x => x !== t);
                           if ((board[others[0]] === 1 && board[others[1]] === null) || (board[others[1]] === 1 && board[others[0]] === null)) {
                               score += 10000; 
                           }
                       }
                   });
                   score += (neighbors[t].filter(n => board[n] === null).length * 1000);
                   if ([4, 10, 13, 19].includes(t)) score += 500;
                   
                   if (score > bestScore) { bestScore = score; choice = t; }
                });
            } else {
                choice = targetList[Math.floor(Math.random() * targetList.length)];
            }
            executeRemoval(choice);
        }
        return;
      }

      if (phase === 'placing' && stock[2] > 0) {
        const empty = getEmptyNodes(board);
        if (empty.length === 0) return;
        let choice = undefined;

        if (empty.length === 24) {
            choice = [4, 10, 13, 19][Math.floor(Math.random() * 4)]; 
        } else if (difficulty === 'easy') { 
            choice = empty[Math.floor(Math.random() * empty.length)]; 
        } else if (difficulty === 'medium') {
            choice = empty.find(idx => testSher(2, board, idx)); 
            if (!choice) {
               const p1Threats = getPotentialShers(1, board);
               if (p1Threats.length > 0) choice = p1Threats[0];
            }
            if (!choice) choice = empty[Math.floor(Math.random() * empty.length)];
        } else {
            let bestScore = -Infinity;
            empty.forEach(e => {
                let score = 0;
                let tempBoard = [...board]; tempBoard[e] = 2;

                if (isSher(2, e, tempBoard)) score += 100000; 
                
                let p1Threats = getPotentialShers(1, board);
                if (p1Threats.includes(e)) score += 50000; 
                
                let myForks = getPotentialShers(2, tempBoard);
                if (myForks.length >= 2) score += 20000; 

                let tempP1 = [...board]; tempP1[e] = 1;
                if (getPotentialShers(1, tempP1).length >= 2) score += 15000; 

                let adjacentOwn = neighbors[e].filter(n => board[n] === 2).length;
                score += (adjacentOwn * 500); 

                if ([4, 10, 13, 19].includes(e)) score += 1000; 
                score += (neighbors[e].filter(n => board[n] === null).length * 100); 

                if (score > bestScore) { bestScore = score; choice = e; }
            });
        }
        
        playSound('place');
        const updatedBoard = [...board];
        updatedBoard[choice] = 2;
        
        const newStock = { ...stock, 2: stock[2] - 1 };
        const newHistory = [...history, { player: 2, text: `Computer placed at ${nodeNames[choice]}` }];
        
        let newRemoveMode = false; let newPhase = phase; let newTurn = 1;
        if (isSher(2, choice, updatedBoard)) { newRemoveMode = true; newTurn = 2; } 
        if (!newRemoveMode && newStock[1] === 0 && newStock[2] === 0) { newPhase = 'moving'; }

        pushGameState({ board: updatedBoard, stock: newStock, history: newHistory, removeMode: newRemoveMode, phase: newPhase, turn: newTurn });
      } 
      
      else if (phase === 'moving') {
        let possibleMoves = [];
        for (let i = 0; i < 24; i++) {
          if (board[i] === 2) {
            neighbors[i].filter(n => board[n] === null).forEach(n => possibleMoves.push({ from: i, to: n }));
          }
        }
        if (possibleMoves.length === 0) { pushGameState({ winner: 1 }); playSound('win'); return; }

        let chosenMove = undefined;
        if (difficulty === 'easy') { 
            chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)]; 
        } else if (difficulty === 'medium') {
            chosenMove = possibleMoves.find(m => testSher(2, board, m.to, m.from)); 
            if (!chosenMove) chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        } else {
            let bestScore = -Infinity;
            possibleMoves.forEach(m => {
                let score = 0;
                let tempBoard = [...board]; tempBoard[m.from] = null; tempBoard[m.to] = 2;

                if (isSher(2, m.to, tempBoard)) score += 100000; 

                let p1ThreatsAfterMove = getPotentialShers(1, tempBoard);
                if (p1ThreatsAfterMove.includes(m.from)) {
                    let p1CanTakeIt = neighbors[m.from].some(n => tempBoard[n] === 1);
                    if (p1CanTakeIt) score -= 50000; 
                }

                let p1ThreatsNow = getPotentialShers(1, board);
                if (p1ThreatsNow.includes(m.to)) {
                    let p1CanTakeItNow = neighbors[m.to].some(n => board[n] === 1);
                    if (p1CanTakeItNow) score += 20000; 
                }

                if (isSher(2, m.from, board) && !isSher(2, m.to, tempBoard)) {
                    let p1CanTakeIt = neighbors[m.from].some(n => tempBoard[n] === 1);
                    if (!p1CanTakeIt) score += 5000; 
                }

                if ([4, 10, 13, 19].includes(m.to)) score += 500; 
                score += (neighbors[m.to].filter(n => tempBoard[n] === null).length * 100); 

                if (score > bestScore) { bestScore = score; chosenMove = m; }
            });
        }

        playSound('place');
        const updatedBoard = [...board];
        updatedBoard[chosenMove.to] = 2; updatedBoard[chosenMove.from] = null;
        
        const newHistory = [...history, { player: 2, text: `Computer moved to ${nodeNames[chosenMove.to]}` }];
        let newRemoveMode = false; let newTurn = 1; let newWinner = winner;

        if (isSher(2, chosenMove.to, updatedBoard)) { newRemoveMode = true; newTurn = 2; } 
        else if (!canMove(1, updatedBoard)) { newWinner = 2; playSound('lose'); }

        pushGameState({ board: updatedBoard, removeMode: newRemoveMode, history: newHistory, turn: newTurn, winner: newWinner });
      }
    }, 1000); 

    return () => clearTimeout(aiTimer);
  }, [turn, board, removeMode, phase, winner, gameMode, difficulty, appState, history, stock]);

  const createRoom = async () => {
    if (!user) return;
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    const roomData = { 
        host: user.uid, guest: null, status: 'waiting', 
        board: Array(24).fill(null), turn: playerOrder, phase: 'placing', stock: { 1: 9, 2: 9 }, 
        removeMode: false, winner: null, 
        history: [{ player: playerOrder, text: `Room created. ${getPlayerName(playerOrder)} moves first.` }],
        hostRematch: false, guestRematch: false,
        offer: null, answer: null, hostIce: [], guestIce: [] 
    };
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', code), roomData);
      setRoomCode(code); setGameMode('online_host'); setRoomError(''); setAppState('playing');
    } catch (e) { setRoomError("Network error. Could not create room."); }
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
          await updateDoc(roomDocRef, { guest: user.uid, status: 'playing', history: [...data.history, { player: 2, text: "Guest joined the match!" }] });
          setRoomCode(code); setGameMode('online_guest'); setRoomError(''); setAppState('playing');
        } else { setRoomError("Room is already full."); }
      } else { setRoomError("Invalid Team Code."); }
    } catch (e) { setRoomError("Failed to join room."); }
  };

  const startLocalGame = (mode) => {
    setGameMode(mode); setBoard(Array(24).fill(null)); setTurn(playerOrder); setSelected(null); setGuideMoves([]);
    setPhase('placing'); setStock({ 1: 9, 2: 9 }); setRemoveMode(false); setWinner(null); 
    setHistory([{ player: playerOrder, text: `Match started. ${getPlayerName(playerOrder)} moves first.` }]); 
    setShersFormed([]);
    setRoomCode(''); setAppState('playing');
  };

  const leaveRoomCleanup = async () => {
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
    }
    setVoiceActive(false);
    
    if (gameMode.startsWith('online') && roomCode && gameMode === 'online_host') {
      try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomCode)); } catch (e) {}
    }
    setAppState('menu'); setRoomCode('');
  };

  if (appState === 'tutorial') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', background: THEMES[themeId].bg, color: THEMES[themeId].textColor, fontFamily: 'system-ui, sans-serif', padding: '20px' }}>
        <div style={{ background: THEMES[themeId].panelBg, padding: '30px', borderRadius: '24px', maxWidth: '600px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.4)', backdropFilter: 'blur(15px)', border: `1px solid rgba(255,255,255,0.1)` }}>
          <h1 style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '20px', color: THEMES[themeId].p1Color }}>How to Play Sher</h1>
          <div style={{ fontSize: '1.1rem', lineHeight: '1.6', opacity: 0.9 }}>
            <p><strong>Goal:</strong> Reduce your opponent to just 2 pieces or block them so they cannot make any valid moves.</p>
            <h3 style={{ color: THEMES[themeId].p2Color, marginTop: '20px' }}>Phase 1: Placing</h3>
            <p>Both players start with 9 pieces. Take turns placing them on any empty spot on the board.</p>
            <h3 style={{ color: THEMES[themeId].p2Color, marginTop: '20px' }}>Phase 2: Moving</h3>
            <p>Once all 9 pieces are placed, you must <strong>slide</strong> one piece per turn along the lines to an adjacent empty spot.</p>
            <h3 style={{ color: '#ef4444', marginTop: '20px' }}>Forming a "Sher" (Mill)</h3>
            <p>If you align 3 of your pieces in a straight line (a "Sher"), you get to <strong>capture</strong> (remove) one of your opponent's pieces from the board!</p>
            <p><em>Note: You cannot capture an opponent's piece if it is already part of a formed Sher (unless no other pieces are available).</em></p>
          </div>
          <button onClick={() => setAppState('menu')} style={{ width: '100%', padding: '15px', marginTop: '30px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}>Back to Menu</button>
        </div>
      </div>
    );
  }

  if (appState === 'menu') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: THEMES[themeId].bg, color: THEMES[themeId].textColor, fontFamily: 'system-ui, sans-serif', padding: '20px', transition: 'background 0.5s' }}>
        <div style={{ background: THEMES[themeId].panelBg, padding: '40px', borderRadius: '24px', maxWidth: '600px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(15px)', border: `1px solid rgba(255,255,255,0.1)` }}>
          <h1 style={{ fontSize: '3.5rem', textAlign: 'center', margin: '0 0 10px 0', fontWeight: '900', letterSpacing: '4px', textTransform: 'uppercase', textShadow: `0 0 20px ${THEMES[themeId].p1Color}` }}>Sher</h1>
          <p style={{ textAlign: 'center', marginBottom: '20px', opacity: 0.8 }}>The Ultimate Mind Game</p>
          <button onClick={() => setAppState('tutorial')} style={{ display: 'block', margin: '0 auto 20px auto', padding: '8px 20px', background: 'rgba(255,255,255,0.1)', border: `1px solid ${THEMES[themeId].textColor}`, color: THEMES[themeId].textColor, borderRadius: '20px', cursor: 'pointer' }}>📖 How to Play</button>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '25px' }}>
            <button onClick={() => setPlayerOrder(1)} style={{ padding: '10px 20px', fontSize: '1rem', background: playerOrder === 1 ? THEMES[themeId].p1Color : 'rgba(0,0,0,0.3)', color: playerOrder === 1 ? '#000' : THEMES[themeId].textColor, border: `1px solid ${THEMES[themeId].p1Color}`, borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s' }}>I Play First</button>
            <button onClick={() => setPlayerOrder(2)} style={{ padding: '10px 20px', fontSize: '1rem', background: playerOrder === 2 ? THEMES[themeId].p2Color : 'rgba(0,0,0,0.3)', color: playerOrder === 2 ? '#000' : THEMES[themeId].textColor, border: `1px solid ${THEMES[themeId].p2Color}`, borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s' }}>I Play Second</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ margin: '0 0 15px 0', borderBottom: `1px solid ${THEMES[themeId].lineColor}`, paddingBottom: '8px' }}>Practice Offline</h3>
              <button onClick={() => startLocalGame('local_ai')} style={{ width: '100%', padding: '12px', marginBottom: '10px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>Vs Computer</button>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
                {['easy', 'medium', 'hard'].map(diff => (
                  <button key={diff} onClick={() => setDifficulty(diff)} style={{ flex: 1, padding: '6px', fontSize: '0.8rem', textTransform: 'capitalize', background: difficulty === diff ? '#10b981' : 'rgba(0,0,0,0.2)', color: difficulty === diff ? 'white' : THEMES[themeId].textColor, border: `1px solid ${difficulty === diff ? '#10b981' : '#64748b'}`, borderRadius: '6px', cursor: 'pointer', transition: '0.2s' }}>{diff}</button>
                ))}
              </div>
              <button onClick={() => startLocalGame('local_pvp')} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', color: THEMES[themeId].textColor, border: `2px solid #3b82f6`, borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Pass & Play (Local)</button>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ margin: '0 0 15px 0', borderBottom: `1px solid ${THEMES[themeId].lineColor}`, paddingBottom: '8px' }}>Play Online</h3>
              {user ? (
                <>
                  <button onClick={createRoom} style={{ width: '100%', padding: '12px', marginBottom: '15px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>Create Team Room</button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" placeholder="Enter Code" value={joinInput} onChange={e => setJoinInput(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', outline: 'none', textTransform: 'uppercase', minWidth: '0' }} maxLength={5} />
                    <button onClick={joinRoom} style={{ padding: '10px 15px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Join</button>
                  </div>
                  {roomError && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' }}>{roomError}</div>}
                </>
              ) : (
                <p style={{ fontSize: '0.9rem', opacity: 0.7, textAlign: 'center' }}>Connecting to global servers...</p>
              )}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', textAlign: 'center' }}>Board Theme</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {Object.entries(THEMES).map(([id, t]) => (
                <button key={id} onClick={() => setThemeId(id)} style={{ padding: '8px 14px', background: themeId === id ? t.p1Color : 'rgba(0,0,0,0.3)', color: themeId === id ? (id==='classic'||id==='forest'?'#000':'#fff') : t.textColor, border: `1px solid ${t.p1Color}`, borderRadius: '20px', cursor: 'pointer', fontWeight: themeId === id ? 'bold' : 'normal', transition: 'all 0.2s', boxShadow: themeId === id ? `0 0 15px ${t.p1Color}` : 'none' }}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderVictoryScreen = () => {
    let title = "MATCH OVER";
    let message = "";
    let color = theme.p1Color;

    if (gameMode === 'local_ai') {
        if (winner === 2) { title = "DEFEAT"; message = "The Computer outsmarted you."; color = "#ef4444"; }
        else { title = "VICTORY!"; message = `You beat the Computer on ${difficulty.toUpperCase()}!`; color = "#facc15"; }
    } else if (gameMode === 'online_host') {
        if (winner === 2) { title = "DEFEAT"; message = "Your opponent claimed the board."; color = "#ef4444"; }
        else { title = "VICTORY!"; message = "You dominated the match!"; color = "#facc15"; }
    } else if (gameMode === 'online_guest') {
        if (winner === 1) { title = "DEFEAT"; message = "The Host claimed the board."; color = "#ef4444"; }
        else { title = "VICTORY!"; message = "You dominated the match!"; color = "#facc15"; }
    } else {
        title = "VICTORY!";
        message = `${getPlayerName(winner)} claims the board!`;
        color = winner === 1 ? theme.p1Color : theme.p2Color;
    }

    const isMeReady = gameMode === 'online_host' ? hostRematch : guestRematch;
    const isOpponentReady = gameMode === 'online_host' ? guestRematch : hostRematch;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ background: theme.panelBg, padding: '40px', borderRadius: '24px', textAlign: 'center', maxWidth: '400px', width: '90%', border: `2px solid ${color}`, boxShadow: `0 0 80px ${color}`, backdropFilter: 'blur(15px)', animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
            <h1 style={{ fontSize: '3.5rem', margin: '0 0 10px 0', color: color, textTransform: 'uppercase', letterSpacing: '3px', textShadow: `0 0 20px ${color}` }}>{title}</h1>
            <p style={{ fontSize: '1.2rem', marginBottom: '30px', fontWeight: 'bold' }}>{message}</p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              
              {!gameMode.startsWith('online') ? (
                <button onClick={() => startLocalGame(gameMode)} style={{ padding: '12px 24px', background: color, color: '#000', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}>Play Again</button>
              ) : (
                <button 
                  onClick={handleRematch} 
                  disabled={isMeReady}
                  style={{ 
                    padding: '12px 24px', 
                    background: isMeReady ? 'rgba(255,255,255,0.2)' : color, 
                    color: isMeReady ? theme.textColor : '#000', 
                    border: 'none', 
                    borderRadius: '12px', 
                    fontWeight: 'bold', 
                    cursor: isMeReady ? 'not-allowed' : 'pointer', 
                    fontSize: '1rem', 
                    boxShadow: isMeReady ? 'none' : '0 5px 15px rgba(0,0,0,0.3)',
                    transition: 'all 0.3s'
                  }}
                >
                  {isMeReady ? "Waiting for Opponent..." : (isOpponentReady ? "Accept Rematch" : "Play Again")}
                </button>
              )}

              <button onClick={leaveRoomCleanup} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.1)', color: theme.textColor, border: `1px solid ${theme.textColor}`, borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>Exit to Menu</button>
            </div>
          </div>
        </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, color: theme.textColor, fontFamily: 'system-ui, sans-serif', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', touchAction: 'manipulation' }}>
      
      {/* Top Bar */}
      <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
        <button onClick={leaveRoomCleanup} style={{ padding: '8px 15px', background: 'rgba(0,0,0,0.3)', color: theme.textColor, border: `1px solid rgba(255,255,255,0.2)`, borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', backdropFilter: 'blur(5px)' }}>← Leave</button>
        <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '2px', textAlign: 'center', flex: 1, fontSize: '1.2rem', opacity: 0.9 }}>{theme.name}</h2>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {gameMode.startsWith('online') && roomStatus === 'playing' && (
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={toggleVoiceChat} style={{ padding: '8px', background: voiceActive ? '#ef4444' : '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {voiceActive ? 'Disconnect 📞' : 'Join Voice 🎙️'}
              </button>
              {voiceActive && (
                 <button onClick={toggleMic} style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', color: theme.textColor, border: `1px solid rgba(255,255,255,0.2)`, borderRadius: '8px', cursor: 'pointer', fontSize: '1.2rem' }}>
                   {micMuted ? '🔇' : '🎤'}
                 </button>
              )}
            </div>
          )}

          {gameMode.startsWith('online') && <div style={{ padding: '8px 15px', background: 'rgba(0,0,0,0.3)', border: `1px solid rgba(255,255,255,0.2)`, borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', backdropFilter: 'blur(5px)' }}>Code: <span style={{ color: theme.p1Color }}>{roomCode}</span></div>}
          <button onClick={() => setSoundEnabled(!soundEnabled)} style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', color: theme.textColor, border: `1px solid rgba(255,255,255,0.2)`, borderRadius: '8px', cursor: 'pointer', fontSize: '1.2rem', backdropFilter: 'blur(5px)' }}>{soundEnabled ? '🔊' : '🔇'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', width: '100%', maxWidth: '1000px' }}>
        
        {/* Main Board Container */}
        <div style={{ flex: '1 1 300px', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          <div style={{ background: theme.panelBg, padding: '12px', borderRadius: '12px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold', border: `1px solid ${removeMode ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, transition: 'all 0.3s', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backdropFilter: 'blur(10px)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <div style={{ flex: 1 }}>
                {gameMode.startsWith('online') && roomStatus === 'waiting' ? (
                <span style={{ color: theme.p1Color, animation: 'pulse 2s infinite' }}>Waiting for opponent...</span>
                ) : removeMode ? (
                <span style={{ color: '#ef4444', animation: 'pulseText 1.5s infinite' }}>Sher Formed! Capture a piece</span>
                ) : winner ? (
                <span style={{ color: '#10b981' }}>Match Concluded</span>
                ) : (
                <span>Turn: <span style={{ color: turn === 1 ? theme.p1Color : theme.p2Color, textShadow: `0 0 10px ${turn === 1 ? theme.p1Color : theme.p2Color}` }}>{getPlayerName(turn)}</span></span>
                )}
            </div>
            {!winner && roomStatus !== 'waiting' && (
                <button onClick={handleResign} style={{ background: 'rgba(239, 68, 68, 0.2)', border: `1px solid #ef4444`, color: '#ef4444', padding: '5px 10px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}>Surrender</button>
            )}
          </div>

          <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: theme.panelBg, borderRadius: '16px', padding: '4%', boxSizing: 'border-box', boxShadow: `0 10px 40px rgba(0,0,0,0.6)`, border: `1px solid rgba(255,255,255,0.1)`, backdropFilter: 'blur(10px)', touchAction: 'none' }}>
            {gameMode.startsWith('online') && roomStatus === 'waiting' && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRadius: '16px', backdropFilter: 'blur(6px)' }}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '10px', textAlign: 'center' }}>Waiting for Player 2</h3>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: theme.p1Color, letterSpacing: '5px', padding: '10px 30px', background: 'rgba(0,0,0,0.5)', borderRadius: '12px' }}>{roomCode}</div>
              </div>
            )}
            
            <svg viewBox="0 0 100 100" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
              <g stroke={theme.lineColor} strokeWidth="1.5" fill="none" strokeLinecap="round">
                <rect x="10" y="10" width="80" height="80" rx="2" />
                <rect x="25" y="25" width="50" height="50" rx="2" />
                <rect x="40" y="40" width="20" height="20" rx="2" />
                <line x1="50" y1="10" x2="50" y2="40" />
                <line x1="50" y1="60" x2="50" y2="90" />
                <line x1="10" y1="50" x2="40" y2="50" />
                <line x1="60" y1="50" x2="90" y2="50" />
              </g>
              {shersFormed.length > 0 && sherLines.map((line, idx) => {
                if (shersFormed.includes(line[0]) && shersFormed.includes(line[1]) && shersFormed.includes(line[2]) && board[line[0]] !== null && board[line[0]]===board[line[1]] && board[line[1]]===board[line[2]]) {
                  return <line key={idx} x1={points[line[0]][0]} y1={points[line[0]][1]} x2={points[line[2]][0]} y2={points[line[2]][1]} stroke={board[line[0]] === 1 ? theme.p1Color : theme.p2Color} strokeWidth="3" opacity="0.8" style={{ filter: `drop-shadow(0 0 8px ${board[line[0]] === 1 ? theme.p1Color : theme.p2Color})` }} />;
                } return null;
              })}
            </svg>

            {}
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

              let bg = 'transparent'; let border = `2px solid ${theme.lineColor}`; let size = '4%'; let cursor = 'pointer';
              let innerShadow = 'none';

              // 3D Marble Styling
              if (piece === 1) { 
                bg = `radial-gradient(circle at 35% 35%, ${theme.p1Color} 0%, #000 150%)`; 
                border = 'none'; size = '7%'; 
                innerShadow = 'inset -2px -2px 6px rgba(0,0,0,0.6), inset 2px 2px 6px rgba(255,255,255,0.4)';
              } else if (piece === 2) { 
                bg = `radial-gradient(circle at 35% 35%, ${theme.p2Color} 0%, #000 150%)`; 
                border = 'none'; size = '7%'; 
                innerShadow = 'inset -2px -2px 6px rgba(0,0,0,0.6), inset 2px 2px 6px rgba(255,255,255,0.4)';
              }
              
              if (isGuide) { bg = 'rgba(16, 185, 129, 0.4)'; border = '2px solid #10b981'; size = '5%'; }

              if (isTarget) {
                if (isProtected) { cursor = 'not-allowed'; }
                else { border = '4px solid #ef4444'; cursor = 'crosshair'; }
              }

              return (
                <div key={index} onClick={() => handleClick(index)} style={{
                  position: 'absolute', left: `${pt[0]}%`, top: `${pt[1]}%`, transform: 'translate(-50%, -50%)',
                  width: size, height: size, minWidth: '15px', minHeight: '15px', borderRadius: '50%',
                  background: bg, border: border, cursor: cursor, zIndex: piece !== null ? 10 : 5,
                  boxShadow: isSelected ? `0 0 20px ${theme.textColor}, 0 0 10px ${theme.textColor} inset` : (piece ? `0 6px 12px rgba(0,0,0,0.6), ${innerShadow}` : 'none'),
                  transition: 'all 0.2s ease', opacity: (isTarget && isProtected) ? 0.3 : 1
                }} />
              );
            })}
          </div>
        </div>

        {/* Info Panel */}
        <div style={{ flex: '1 1 300px', maxWidth: '350px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, background: theme.panelBg, padding: '10px', borderRadius: '12px', borderBottom: turn === 1 && !winner ? `4px solid ${theme.p1Color}` : '4px solid transparent', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <div style={{ color: theme.p1Color, fontWeight: 'bold', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: `0 0 8px ${theme.p1Color}` }}>{getPlayerName(1)}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Hand: {stock[1]}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Board: {board.filter(p=>p===1).length}</div>
            </div>
            <div style={{ flex: 1, background: theme.panelBg, padding: '10px', borderRadius: '12px', borderBottom: turn === 2 && !winner ? `4px solid ${theme.p2Color}` : '4px solid transparent', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <div style={{ color: theme.p2Color, fontWeight: 'bold', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: `0 0 8px ${theme.p2Color}` }}>{getPlayerName(2)}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Hand: {stock[2]}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Board: {board.filter(p=>p===2).length}</div>
            </div>
          </div>

          <div style={{ flex: 1, background: theme.panelBg, padding: '10px', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: '150px', maxHeight: '250px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', borderBottom: `1px solid rgba(255,255,255,0.1)`, paddingBottom: '5px', opacity: 0.8 }}>Match Log</h3>
            <div ref={historyContainerRef} style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', paddingRight: '5px' }}>
              {history.length === 0 && <div style={{ opacity: 0.5, fontStyle: 'italic' }}>Match started. Awaiting moves...</div>}
              {history.map((log, i) => (
                <div key={i} style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', borderLeft: `3px solid ${log.player === 1 ? theme.p1Color : theme.p2Color}` }}>{log.text}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {winner && renderVictoryScreen()}

      {/* Hidden Audio Element For Voice Chat */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes pulseText {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }
      `}</style>
    </div>
  );
}
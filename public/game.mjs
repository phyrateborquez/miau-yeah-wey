import Player from './Player.mjs';
import Collectible from './Collectible.mjs';

const socket = io();
const canvas = document.getElementById('game-window');
const context = canvas.getContext('2d');

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;
const AVATAR_SIZE = 30;

let currentSocketId = null;
let me = null;
let allPlayers = [];
let collectible = null;

// Movement state tracking for smooth responsive control
const keyState = {
  up: false,
  down: false,
  left: false,
  right: false
};

// Map keyboard events
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  let handled = false;

  if (key === 'w' || key === 'arrowup') {
    keyState.up = true;
    handled = true;
  }
  if (key === 's' || key === 'arrowdown') {
    keyState.down = true;
    handled = true;
  }
  if (key === 'a' || key === 'arrowleft') {
    keyState.left = true;
    handled = true;
  }
  if (key === 'd' || key === 'arrowright') {
    keyState.right = true;
    handled = true;
  }

  if (handled) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') keyState.up = false;
  if (key === 's' || key === 'arrowdown') keyState.down = false;
  if (key === 'a' || key === 'arrowleft') keyState.left = false;
  if (key === 'd' || key === 'arrowright') keyState.right = false;
});

// Socket.io handlers
socket.on('init', ({ id, players, item }) => {
  currentSocketId = id;
  allPlayers = players.map(p => new Player(p));
  me = allPlayers.find(p => p.id === id);
  if (item) {
    collectible = new Collectible(item);
  }
});

socket.on('new-player', (playerData) => {
  if (!allPlayers.some(p => p.id === playerData.id)) {
    allPlayers.push(new Player(playerData));
  }
});

socket.on('player-moved', (playerData) => {
  const p = allPlayers.find(pl => pl.id === playerData.id);
  if (p) {
    p.x = playerData.x;
    p.y = playerData.y;
    p.score = playerData.score;
  } else {
    allPlayers.push(new Player(playerData));
  }
});

socket.on('update-game', ({ players, item }) => {
  allPlayers = players.map(p => new Player(p));
  if (currentSocketId) {
    me = allPlayers.find(p => p.id === currentSocketId);
  }
  if (item) {
    collectible = new Collectible(item);
  }
});

socket.on('remove-player', (id) => {
  allPlayers = allPlayers.filter(p => p.id !== id);
});

// Movement update loop (tick)
const SPEED = 4;
setInterval(() => {
  if (!me) return;

  let moved = false;
  let dir = null;

  if (keyState.up) {
    me.movePlayer('up', SPEED);
    dir = 'up';
    moved = true;
  }
  if (keyState.down) {
    me.movePlayer('down', SPEED);
    dir = 'down';
    moved = true;
  }
  if (keyState.left) {
    me.movePlayer('left', SPEED);
    dir = 'left';
    moved = true;
  }
  if (keyState.right) {
    me.movePlayer('right', SPEED);
    dir = 'right';
    moved = true;
  }

  if (moved) {
    // Keep local avatar in bounds
    me.x = Math.max(10, Math.min(CANVAS_WIDTH - AVATAR_SIZE - 10, me.x));
    me.y = Math.max(50, Math.min(CANVAS_HEIGHT - AVATAR_SIZE - 10, me.y));

    // Check collision locally
    if (collectible && me.collision(collectible)) {
      socket.emit('collect-item', { itemId: collectible.id });
    }

    // Emit movement to server
    socket.emit('move-player', { dir, speed: SPEED, x: me.x, y: me.y });
  }
}, 1000 / 60);

// Rendering functions
function drawBackground() {
  // Deep arcade space background
  context.fillStyle = '#0b0f19';
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle grid
  context.strokeStyle = 'rgba(30, 41, 59, 0.4)';
  context.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x <= CANVAS_WIDTH; x += gridSize) {
    context.beginPath();
    context.moveTo(x, 45);
    context.lineTo(x, CANVAS_HEIGHT);
    context.stroke();
  }
  for (let y = 45; y <= CANVAS_HEIGHT; y += gridSize) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(CANVAS_WIDTH, y);
    context.stroke();
  }

  // Boundary border
  context.strokeStyle = '#38bdf8';
  context.lineWidth = 2;
  context.strokeRect(4, 45, CANVAS_WIDTH - 8, CANVAS_HEIGHT - 49);
}

function drawHeader() {
  // Top UI Bar
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, CANVAS_WIDTH, 45);
  context.strokeStyle = '#38bdf8';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, 45);
  context.lineTo(CANVAS_WIDTH, 45);
  context.stroke();

  context.font = '10px "Press Start 2P", monospace';
  context.textBaseline = 'middle';

  // Controls info
  context.fillStyle = '#94a3b8';
  context.fillText('CONTROLS: WASD / ARROWS', 15, 22);

  // Score & Rank
  if (me) {
    const rankStr = me.calculateRank(allPlayers);
    const scoreStr = `SCORE: ${me.score}`;

    context.fillStyle = '#facc15';
    context.fillText(scoreStr, 330, 22);

    context.fillStyle = '#4ade80';
    context.fillText(rankStr, 470, 22);
  } else {
    context.fillStyle = '#facc15';
    context.fillText('CONNECTING...', 330, 22);
  }
}

function drawPlayer(player, isMe) {
  context.save();
  const { x, y } = player;

  if (isMe) {
    // Current player: Neon Cyan Hero Ship / Avatar
    context.shadowBlur = 12;
    context.shadowColor = '#00f0ff';

    // Body
    context.fillStyle = '#00f0ff';
    context.beginPath();
    context.roundRect ? context.roundRect(x, y, AVATAR_SIZE, AVATAR_SIZE, 6) : context.fillRect(x, y, AVATAR_SIZE, AVATAR_SIZE);
    context.fill();

    // Inner core
    context.fillStyle = '#ffffff';
    context.fillRect(x + 7, y + 7, AVATAR_SIZE - 14, AVATAR_SIZE - 14);

    // YOU label
    context.shadowBlur = 0;
    context.font = '8px "Press Start 2P", monospace';
    context.fillStyle = '#00f0ff';
    context.textAlign = 'center';
    context.fillText('YOU', x + AVATAR_SIZE / 2, y - 6);
  } else {
    // Other players: Crimson / Violet rival avatars
    context.shadowBlur = 8;
    context.shadowColor = '#f43f5e';

    context.fillStyle = '#f43f5e';
    context.beginPath();
    context.roundRect ? context.roundRect(x, y, AVATAR_SIZE, AVATAR_SIZE, 6) : context.fillRect(x, y, AVATAR_SIZE, AVATAR_SIZE);
    context.fill();

    // Inner core
    context.fillStyle = '#ffe4e6';
    context.fillRect(x + 8, y + 8, AVATAR_SIZE - 16, AVATAR_SIZE - 16);

    // ID label
    context.shadowBlur = 0;
    context.font = '7px "Press Start 2P", monospace';
    context.fillStyle = '#f43f5e';
    context.textAlign = 'center';
    const shortId = (player.id || '').substring(0, 4);
    context.fillText(shortId, x + AVATAR_SIZE / 2, y - 6);
  }

  context.restore();
}

let pulseAngle = 0;
function drawCollectible(item) {
  if (!item) return;

  context.save();
  pulseAngle += 0.05;
  const pulse = Math.sin(pulseAngle) * 3;

  const centerX = item.x + AVATAR_SIZE / 2;
  const centerY = item.y + AVATAR_SIZE / 2;
  const radius = (AVATAR_SIZE / 2) + pulse;

  // Gold Coin glow
  context.shadowBlur = 15 + pulse * 2;
  context.shadowColor = '#fbbf24';

  // Outer gold coin
  context.fillStyle = '#fbbf24';
  context.beginPath();
  context.arc(centerX, centerY, Math.max(2, radius), 0, Math.PI * 2);
  context.fill();

  // Inner coin ring
  context.strokeStyle = '#d97706';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(centerX, centerY, Math.max(1, radius - 4), 0, Math.PI * 2);
  context.stroke();

  // Star / Diamond center
  context.fillStyle = '#fffbeb';
  context.beginPath();
  context.moveTo(centerX, centerY - 6);
  context.lineTo(centerX + 6, centerY);
  context.lineTo(centerX, centerY + 6);
  context.lineTo(centerX - 6, centerY);
  context.closePath();
  context.fill();

  // Value badge
  context.shadowBlur = 0;
  context.font = '7px "Press Start 2P", monospace';
  context.fillStyle = '#fbbf24';
  context.textAlign = 'center';
  context.fillText(`+${item.value}`, centerX, item.y + AVATAR_SIZE + 10);

  context.restore();
}

function render() {
  drawBackground();
  drawCollectible(collectible);

  // Draw all players
  allPlayers.forEach((player) => {
    const isMe = currentSocketId && player.id === currentSocketId;
    drawPlayer(player, isMe);
  });

  drawHeader();

  requestAnimationFrame(render);
}

// Start render loop
requestAnimationFrame(render);

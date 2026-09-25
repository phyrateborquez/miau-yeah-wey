require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const expect = require('chai');
const socket = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js');

const Player = require('./public/Player.mjs').default || require('./public/Player.mjs');
const Collectible = require('./public/Collectible.mjs').default || require('./public/Collectible.mjs');

const app = express();

// Security headers required by user stories
app.use(helmet.noSniff());
app.use(helmet.xssFilter());
app.use(helmet.noCache());
app.use(helmet.hidePoweredBy({ setTo: 'PHP 7.4.3' }));

app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// For FCC testing purposes and enables user to connect from outside the hosting platform
app.use(cors({ origin: '*' }));

// Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

// Override /_api/app-info BEFORE fccTestingRoutes to fix Node.js 18+ compatibility
// (fcctesting.js uses res._headers which was removed in modern Node.js)
app.get('/_api/app-info', function (req, res) {
  const headers = res.getHeaders ? res.getHeaders() : (res._headers || {});
  const hs = Object.keys(headers)
    .filter(h => !h.match(/^access-control-\w+/));
  const hObj = {};
  hs.forEach(h => { hObj[h] = headers[h]; });
  delete hObj['strict-transport-security'];
  res.json({ headers: hObj });
});

// For FCC testing purposes
fccTestingRoutes(app);

// 404 Not Found Middleware
app.use(function (req, res, next) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

const portNum = process.env.PORT || 3000;

// Set up server and tests
const server = app.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV === 'test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch (error) {
        console.log('Tests are not valid:');
        console.error(error);
      }
    }, 1500);
  }
});

// Socket.io real-time multiplayer setup
const io = socket(server);

let players = [];
let currentCollectible = null;

function generateRandomPosition() {
  const x = Math.floor(Math.random() * (580 - 40)) + 40;
  const y = Math.floor(Math.random() * (420 - 70)) + 70;
  return { x, y };
}

function generateCollectible() {
  const { x, y } = generateRandomPosition();
  const id = Date.now().toString();
  const value = 1;
  return new Collectible({ x, y, value, id });
}

currentCollectible = generateCollectible();

io.on('connection', (clientSocket) => {
  const { x, y } = generateRandomPosition();
  const newPlayer = new Player({
    id: clientSocket.id,
    x,
    y,
    score: 0
  });

  players.push(newPlayer);

  // Send initial game state to the newly connected player
  clientSocket.emit('init', {
    id: clientSocket.id,
    players,
    item: currentCollectible
  });

  // Notify everyone else about the new player
  clientSocket.broadcast.emit('new-player', newPlayer);

  // Handle player movements
  clientSocket.on('move-player', (data) => {
    const player = players.find(p => p.id === clientSocket.id);
    if (!player) return;

    if (typeof data === 'object' && data.dir) {
      player.movePlayer(data.dir, data.speed || 5);
      if (typeof data.x === 'number' && typeof data.y === 'number') {
        player.x = data.x;
        player.y = data.y;
      }
    } else if (typeof data === 'string') {
      player.movePlayer(data, 5);
    }

    // Keep within bounds
    player.x = Math.max(10, Math.min(600, player.x));
    player.y = Math.max(60, Math.min(440, player.y));

    // Check collision with collectible
    if (currentCollectible && player.collision(currentCollectible)) {
      player.score += currentCollectible.value;
      currentCollectible = generateCollectible();

      io.emit('update-game', {
        players,
        item: currentCollectible
      });
    } else {
      io.emit('player-moved', player);
    }
  });

  // Handle collectible pickup event
  clientSocket.on('collect-item', ({ itemId }) => {
    const player = players.find(p => p.id === clientSocket.id);
    if (!player) return;

    if (currentCollectible && currentCollectible.id === itemId) {
      player.score += currentCollectible.value;
      currentCollectible = generateCollectible();

      io.emit('update-game', {
        players,
        item: currentCollectible
      });
    }
  });

  // Handle player disconnection
  clientSocket.on('disconnect', () => {
    players = players.filter(p => p.id !== clientSocket.id);
    io.emit('remove-player', clientSocket.id);
  });
});

module.exports = app; // For testing


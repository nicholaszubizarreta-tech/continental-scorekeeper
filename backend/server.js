// ── Dependencies ────────────────────────────────────────────
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── In-Memory Storage (temporary until PostgreSQL) ───────────
const games = {};

// ── Helper — Generate Game Code ──────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return games[code] ? generateCode() : code;
}

// ── Routes ───────────────────────────────────────────────────

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Continental API is running!' });
});

// Create a new game
app.post('/games', (req, res) => {
  const { players } = req.body;

  if (!players || players.length < 2) {
    return res.status(400).json({ error: 'At least 2 players required.' });
  }

  const code = generateCode();
  games[code] = {
    code,
    players,
    scores: players.map(() => []),
    doubletes: [],
    currentRound: 0,
    seatOrder: players.map((_, i) => i),
    firstDealer: 0,
    createdAt: new Date()
  };

  res.json({ code, game: games[code] });
});

// Get a game by code
app.get('/games/:code', (req, res) => {
  const game = games[req.params.code.toUpperCase()];
  if (!game) return res.status(404).json({ error: 'Game not found.' });
  res.json(game);
});

// Update a game by code
app.put('/games/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const game = games[code];
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  games[code] = { ...game, ...req.body, code };
  res.json(games[code]);
});

// Delete a game by code
app.delete('/games/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  if (!games[code]) return res.status(404).json({ error: 'Game not found.' });
  delete games[code];
  res.json({ message: `Game ${code} deleted.` });
});

// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
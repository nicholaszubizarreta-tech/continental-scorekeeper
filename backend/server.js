// ── Dependencies ────────────────────────────────────────────
const express = require('express');
const cors = require('cors');
const { pool, createTables } = require('./database');
const app = express();
const PORT = 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Helper — Generate Game Code ──────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ── Routes ───────────────────────────────────────────────────

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Continental API is running!' });
});

// Create a new game
app.post('/games', async (req, res) => {
  const { players } = req.body;

  if (!players || players.length < 2) {
    return res.status(400).json({ error: 'At least 2 players required.' });
  }

  const code = generateCode();
  const scores = players.map(() => []);
  const doubletes = [];
  const seatOrder = players.map((_, i) => i);
  const firstDealer = 0;
  const currentRound = 0;

  try {
    const result = await pool.query(
      `INSERT INTO games (code, players, scores, doubletes, current_round, seat_order, first_dealer)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [code, JSON.stringify(players), JSON.stringify(scores), JSON.stringify(doubletes), currentRound, JSON.stringify(seatOrder), firstDealer]
    );
    res.json({ code, game: result.rows[0] });
  } catch (err) {
    console.error('Error creating game:', err);
    res.status(500).json({ error: 'Could not create game.' });
  }
});

// Get a game by code
app.get('/games/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();
  try {
    const result = await pool.query('SELECT * FROM games WHERE code = $1', [code]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching game:', err);
    res.status(500).json({ error: 'Could not fetch game.' });
  }
});

// Update a game by code
app.put('/games/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();
  const { players, scores, doubletes, current_round, seat_order, first_dealer } = req.body;

  try {
    const result = await pool.query(
      `UPDATE games
       SET players = $1, scores = $2, doubletes = $3, current_round = $4, seat_order = $5, first_dealer = $6
       WHERE code = $7
       RETURNING *`,
      [JSON.stringify(players), JSON.stringify(scores), JSON.stringify(doubletes), current_round, JSON.stringify(seat_order), first_dealer, code]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating game:', err);
    res.status(500).json({ error: 'Could not update game.' });
  }
});

// Delete a game by code
app.delete('/games/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();
  try {
    const result = await pool.query('DELETE FROM games WHERE code = $1 RETURNING *', [code]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found.' });
    }
    res.json({ message: `Game ${code} deleted.` });
  } catch (err) {
    console.error('Error deleting game:', err);
    res.status(500).json({ error: 'Could not delete game.' });
  }
});

// ── Start Server ─────────────────────────────────────────────
async function startServer() {
  await createTables();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
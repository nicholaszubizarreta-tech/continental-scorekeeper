// ── Game Data ──────────────────────────────────────────────
const ROUNDS = [
  { number: 1, contract: "2 sets of 3" },
  { number: 2, contract: "1 set of 3 + 1 sequence of 4" },
  { number: 3, contract: "2 sequences of 4" },
  { number: 4, contract: "3 sets of 3" },
  { number: 5, contract: "2 sets of 3 + 1 sequence of 4" },
  { number: 6, contract: "1 set of 3 + 2 sequences of 4" },
  { number: 7, contract: "3 sequences of 4" },
];

let players = [];
let scores = [];
let currentRound = 0;

// ── Screen Switching ────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Setup Screen ────────────────────────────────────────────
document.getElementById('add-player-btn').addEventListener('click', () => {
  const container = document.getElementById('player-inputs');
  const count = container.querySelectorAll('.player-input').length;
  if (count >= 8) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'player-input';
  input.placeholder = `Player ${count + 1}`;
  input.maxLength = 20;
  container.appendChild(input);
});

document.getElementById('start-game-btn').addEventListener('click', () => {
  const inputs = document.querySelectorAll('.player-input');
  players = [];
  inputs.forEach(input => {
    const name = input.value.trim();
    if (name) players.push(name);
  });

  if (players.length < 2) {
    alert('Please enter at least 2 players.');
    return;
  }

  // Initialize scores: array of arrays (one per player, one entry per round)
  scores = players.map(() => []);
  currentRound = 0;

  buildScoreboard();
  updateRoundTracker();
  showScreen('screen-game');
  saveState();
});

// ── Scoreboard ──────────────────────────────────────────────
function buildScoreboard() {
  const headerRow = document.getElementById('header-row');
  const totalRow = document.getElementById('total-row');

  headerRow.innerHTML = '<th>Round</th>';
  totalRow.innerHTML = '<td>Total</td>';

  players.forEach(name => {
    const th = document.createElement('th');
    th.textContent = name;
    headerRow.appendChild(th);

    const td = document.createElement('td');
    td.textContent = '0';
    totalRow.appendChild(td);
  });

  refreshScoreRows();
}

function refreshScoreRows() {
  const tbody = document.getElementById('score-rows');
  tbody.innerHTML = '';

  ROUNDS.forEach((round, roundIndex) => {
    const tr = document.createElement('tr');
    const rdCell = document.createElement('td');
    rdCell.textContent = round.number;
    tr.appendChild(rdCell);

    players.forEach((_, playerIndex) => {
      const td = document.createElement('td');
      td.className = 'score-cell';
      const val = scores[playerIndex][roundIndex];
      td.textContent = val !== undefined ? val : '—';
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  refreshTotals();
  highlightWinner();
}

function refreshTotals() {
  const totalCells = document.querySelectorAll('#total-row td');
  players.forEach((_, i) => {
    const total = scores[i].reduce((sum, val) => sum + (val || 0), 0);
    totalCells[i + 1].textContent = total;
  });
}

function highlightWinner() {
  // Lower score wins in rummy-style games
  const totals = players.map((_, i) =>
    scores[i].reduce((sum, val) => sum + (val || 0), 0)
  );

  const minScore = Math.min(...totals);

  const headerRow = document.getElementById('header-row');
  const totalRow = document.getElementById('total-row');
  const headerCells = headerRow.querySelectorAll('th');
  const totalCells = totalRow.querySelectorAll('td');

  // Clear previous highlights
  headerCells.forEach(th => th.style.color = '');
  totalCells.forEach(td => td.style.color = '');

  // Highlight the current leader (lowest score)
  totals.forEach((total, i) => {
    if (total === minScore && scores[i].length > 0) {
      headerCells[i + 1].style.color = '#7ec87e';
      totalCells[i + 1].style.color = '#7ec87e';
    }
  });
}

// ── Round Tracker ───────────────────────────────────────────
function updateRoundTracker() {
  const dotsContainer = document.getElementById('round-dots');
  const contractDisplay = document.getElementById('round-contract');
  dotsContainer.innerHTML = '';

  ROUNDS.forEach((round, index) => {
    const dot = document.createElement('div');
    dot.className = 'round-dot';
    dot.textContent = index + 1;

    if (index < currentRound) dot.classList.add('completed');
    else if (index === currentRound) dot.classList.add('current');

    dotsContainer.appendChild(dot);
  });

  if (currentRound < ROUNDS.length) {
    contractDisplay.textContent = `Round ${currentRound + 1}: ${ROUNDS[currentRound].contract}`;
  } else {
    contractDisplay.textContent = 'All rounds complete!';
  }
}

// ── Score Entry Screen ──────────────────────────────────────
document.getElementById('enter-scores-btn').addEventListener('click', () => {
  if (currentRound >= ROUNDS.length) {
    endGame();
    return;
  }

  const round = ROUNDS[currentRound];
  document.getElementById('entry-title').textContent = `Round ${round.number} Scores`;
  document.getElementById('entry-contract').textContent = round.contract;

  const container = document.getElementById('entry-inputs');
  container.innerHTML = '';

  players.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'entry-row';

    const label = document.createElement('div');
    label.className = 'entry-name';
    label.textContent = name;

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'entry-input';
    input.min = 0;
    input.placeholder = '0';
    input.dataset.playerIndex = i;

    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  });

  showScreen('screen-entry');
});

document.getElementById('save-scores-btn').addEventListener('click', () => {
  const inputs = document.querySelectorAll('.entry-input');
  let valid = true;

  inputs.forEach(input => {
    if (input.value === '' || isNaN(input.value)) {
      valid = false;
    }
  });

  if (!valid) {
    alert('Please enter a score for every player.');
    return;
  }

  inputs.forEach(input => {
    const playerIndex = parseInt(input.dataset.playerIndex);
    scores[playerIndex][currentRound] = parseInt(input.value);
  });

  currentRound++;
  refreshScoreRows();
  updateRoundTracker();
  saveState();

  if (currentRound >= ROUNDS.length) {
    document.getElementById('enter-scores-btn').textContent = 'See Final Results';
  }

  showScreen('screen-game');
});

document.getElementById('cancel-entry-btn').addEventListener('click', () => {
  showScreen('screen-game');
});

// ── Game Over ───────────────────────────────────────────────
function endGame() {
  const totals = players.map((name, i) => ({
    name,
    total: scores[i].reduce((sum, val) => sum + (val || 0), 0)
  }));

  totals.sort((a, b) => a.total - b.total);
  const winner = totals[0];

  document.getElementById('winner-display').textContent =
    `🏆 ${winner.name} wins with ${winner.total} points!`;

  const table = document.getElementById('final-scoreboard');
  table.innerHTML = `
    <thead>
      <tr><th>Player</th><th>Total</th></tr>
    </thead>
    <tbody>
      ${totals.map((p, i) => `
        <tr style="${i === 0 ? 'color: #7ec87e; font-weight: 700;' : ''}">
          <td>${p.name}</td>
          <td>${p.total}</td>
        </tr>
      `).join('')}
    </tbody>
  `;

  showScreen('screen-gameover');
  clearState();
}

document.getElementById('new-game-btn').addEventListener('click', () => {
  players = [];
  scores = [];
  currentRound = 0;
  document.getElementById('player-inputs').innerHTML = `
    <input type="text" class="player-input" placeholder="Player 1" maxlength="20" />
    <input type="text" class="player-input" placeholder="Player 2" maxlength="20" />
    <input type="text" class="player-input" placeholder="Player 3" maxlength="20" />
    <input type="text" class="player-input" placeholder="Player 4" maxlength="20" />
  `;
  document.getElementById('enter-scores-btn').textContent = 'Enter Round Scores';
  showScreen('screen-setup');
});

// ── Save / Restore State ────────────────────────────────────
function saveState() {
  const state = { players, scores, currentRound };
  localStorage.setItem('continental_state', JSON.stringify(state));
}

function clearState() {
  localStorage.removeItem('continental_state');
}

function loadState() {
  const saved = localStorage.getItem('continental_state');
  if (!saved) return;

  try {
    const state = JSON.parse(saved);
    players = state.players;
    scores = state.scores;
    currentRound = state.currentRound;

    buildScoreboard();
    updateRoundTracker();

    if (currentRound >= ROUNDS.length) {
      document.getElementById('enter-scores-btn').textContent = 'See Final Results';
    }

    showScreen('screen-game');
  } catch (e) {
    clearState();
  }
}

// ── Init ────────────────────────────────────────────────────
loadState();
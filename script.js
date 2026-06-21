// ── Game Data ──────────────────────────────────────────────
const ROUNDS = [
  { number: 1, contract: "1 Trio + 1 Escalera", short: "1T 1E" },
  { number: 2, contract: "2 Escaleras", short: "2E" },
  { number: 3, contract: "3 Trios", short: "3T" },
  { number: 4, contract: "2 Trios + 1 Escalera", short: "2T 1E" },
  { number: 5, contract: "1 Trio + 2 Escaleras", short: "1T 2E" },
  { number: 6, contract: "3 Escaleras", short: "3E" },
  { number: 7, contract: "4 Escaleritas", short: "4E*" },
];

const API_URL = 'http://localhost:3000';

let players = [];
let scores = [];
let doubletes = [];
let currentRound = 0;
let seatOrder = [];
let firstDealer = 0;
let previousScreen = 'screen-setup';
let gameCode = null;

// ── Server Communication ────────────────────────────────────
async function createGameOnServer(players) {
  try {
    const response = await fetch(`${API_URL}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players })
    });
    const data = await response.json();
    return data.code;
  } catch (err) {
    console.error('Could not reach server:', err);
    return null;
  }
}

async function updateGameOnServer() {
  if (!gameCode) return;
  try {
    await fetch(`${API_URL}/games/${gameCode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players, scores, doubletes, currentRound, seatOrder, firstDealer })
    });
  } catch (err) {
    console.error('Could not update server:', err);
  }
}

function showGameCode(code) {
  const banner = document.getElementById('game-code-banner');
  if (code) {
    banner.innerHTML = `Game Code: <span>${code}</span> — Share this with other players`;
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
  }
}

// ── Screen Switching ────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Rules Screen ────────────────────────────────────────────
function openRules(fromScreen) {
  previousScreen = fromScreen;
  showScreen('screen-rules');
}

document.getElementById('rules-btn-setup').addEventListener('click', () => {
  openRules('screen-setup');
});

document.getElementById('rules-btn-game').addEventListener('click', () => {
  openRules('screen-game');
});

document.getElementById('close-rules-btn').addEventListener('click', () => {
  showScreen(previousScreen);
});

// ── Setup Screen ────────────────────────────────────────────
document.getElementById('add-player-btn').addEventListener('click', () => {
  const container = document.getElementById('player-inputs');
  const count = container.querySelectorAll('.player-input').length;
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

  scores = players.map(() => []);
  doubletes = [];
  currentRound = 0;
  seatOrder = players.map((_, i) => i);
  firstDealer = 0;
  gameCode = null;

  openSeatingScreen();
});

// ── Seating Screen ──────────────────────────────────────────
function openSeatingScreen() {
  buildSeatingList();
  buildDealerSelect();
  showScreen('screen-seating');
}

function buildSeatingList() {
  const list = document.getElementById('seating-list');
  list.innerHTML = '';

  seatOrder.forEach((playerIndex) => {
    const row = document.createElement('div');
    row.className = 'drag-row';
    row.dataset.playerIndex = playerIndex;

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '☰';

    const name = document.createElement('span');
    name.className = 'drag-name';
    name.textContent = players[playerIndex];

    row.appendChild(handle);
    row.appendChild(name);
    list.appendChild(row);
  });

  Sortable.create(list, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    handle: '.drag-handle',
  });
}

function buildDealerSelect() {
  const container = document.getElementById('dealer-select');
  container.innerHTML = '';

  seatOrder.forEach((playerIndex, seatIndex) => {
    const option = document.createElement('div');
    option.className = 'dealer-option' + (seatIndex === firstDealer ? ' selected' : '');
    option.textContent = players[playerIndex];
    option.addEventListener('click', () => {
      firstDealer = seatIndex;
      buildDealerSelect();
    });
    container.appendChild(option);
  });
}

function buildSeatingManageList() {
  const list = document.getElementById('seating-manage-list');
  list.innerHTML = '';

  seatOrder.forEach((playerIndex) => {
    const row = document.createElement('div');
    row.className = 'drag-row';
    row.dataset.playerIndex = playerIndex;

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '☰';

    const name = document.createElement('span');
    name.className = 'drag-name';
    name.textContent = players[playerIndex];

    row.appendChild(handle);
    row.appendChild(name);
    list.appendChild(row);
  });

  Sortable.create(list, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    handle: '.drag-handle',
  });
}

document.getElementById('confirm-seating-btn').addEventListener('click', async () => {
  const rows = document.querySelectorAll('#seating-list .drag-row');
  seatOrder = [...rows].map(row => parseInt(row.dataset.playerIndex));

  // Try to create game on server
  const code = await createGameOnServer(players);
  if (code) {
    gameCode = code;
    showGameCode(code);
  }

  buildScoreboard();
  updateRoundTracker();
  updateDealerIndicator();
  showScreen('screen-game');
  saveState();
});

// ── Dealer Indicator ────────────────────────────────────────
function updateDealerIndicator() {
  if (seatOrder.length === 0) return;
  const dealerSeatIndex = (firstDealer + currentRound) % seatOrder.length;
  const dealerPlayerIndex = seatOrder[dealerSeatIndex];
  const dealerName = players[dealerPlayerIndex];

  const contractDisplay = document.getElementById('round-contract');
  if (currentRound < ROUNDS.length) {
    contractDisplay.textContent =
      `Round ${currentRound + 1}: ${ROUNDS[currentRound].contract} — Dealer: ${dealerName}`;
  } else {
    contractDisplay.textContent = 'All rounds complete!';
  }
}

// ── Scoreboard ──────────────────────────────────────────────
function buildScoreboard() {
  const headerRow = document.getElementById('header-row');
  const totalRow = document.getElementById('total-row');

  headerRow.innerHTML = '<th>Contract</th>';
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

    const contractCell = document.createElement('td');
    contractCell.className = 'contract-cell';
    contractCell.textContent = round.short;

    if (doubletes[roundIndex]) {
      const marker = document.createElement('span');
      marker.className = 'doblete-marker';
      marker.textContent = ' 2x';
      contractCell.appendChild(marker);
    }

    tr.appendChild(contractCell);

    players.forEach((_, playerIndex) => {
      const td = document.createElement('td');
      td.className = 'score-cell';
      const val = scores[playerIndex][roundIndex];
      if (val !== undefined) {
        td.textContent = doubletes[roundIndex] ? val * 2 : val;
      } else {
        td.textContent = '—';
      }
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
    const total = scores[i].reduce((sum, val, roundIndex) => {
      const roundScore = val || 0;
      return sum + (doubletes[roundIndex] ? roundScore * 2 : roundScore);
    }, 0);
    totalCells[i + 1].textContent = total;
  });
}

function highlightWinner() {
  const totals = players.map((_, i) =>
    scores[i].reduce((sum, val, roundIndex) => {
      const roundScore = val || 0;
      return sum + (doubletes[roundIndex] ? roundScore * 2 : roundScore);
    }, 0)
  );

  const minScore = Math.min(...totals);

  const headerRow = document.getElementById('header-row');
  const totalRow = document.getElementById('total-row');
  const headerCells = headerRow.querySelectorAll('th');
  const totalCells = totalRow.querySelectorAll('td');

  headerCells.forEach(th => th.style.color = '');
  totalCells.forEach(td => td.style.color = '');

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
  dotsContainer.innerHTML = '';

  ROUNDS.forEach((round, index) => {
    const dot = document.createElement('div');
    dot.className = 'round-dot';
    dot.textContent = index + 1;

    if (index < currentRound) {
      dot.classList.add('completed');
      dot.style.cursor = 'pointer';
      dot.title = `Edit Round ${index + 1}`;
      dot.addEventListener('click', () => openEntryScreen(index));
    } else if (index === currentRound) {
      dot.classList.add('current');
    }

    dotsContainer.appendChild(dot);
  });

  updateDealerIndicator();
}

// ── Score Entry Screen ──────────────────────────────────────
function openEntryScreen(roundIndex) {
  const round = ROUNDS[roundIndex];
  const isPastRound = roundIndex < currentRound;

  document.getElementById('entry-title').textContent =
    isPastRound ? `Edit Round ${round.number} Scores` : `Round ${round.number} Scores`;
  document.getElementById('entry-contract').textContent = round.contract;

  const checkbox = document.getElementById('doblete-checkbox');
  checkbox.checked = doubletes[roundIndex] === true;

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
    input.dataset.playerIndex = i;
    input.dataset.roundIndex = roundIndex;

    if (scores[i][roundIndex] !== undefined) {
      input.value = scores[i][roundIndex];
    } else {
      input.placeholder = '0';
    }

    const doubledDisplay = document.createElement('div');
    doubledDisplay.className = 'doubled-value';
    doubledDisplay.id = `doubled-${i}`;
    if (checkbox.checked && scores[i][roundIndex] !== undefined) {
      doubledDisplay.textContent = `= ${scores[i][roundIndex] * 2}`;
    } else {
      doubledDisplay.textContent = '';
    }

    input.addEventListener('input', () => {
      const isChecked = document.getElementById('doblete-checkbox').checked;
      if (isChecked && input.value !== '') {
        doubledDisplay.textContent = `= ${Math.abs(parseInt(input.value)) * 2}`;
      } else {
        doubledDisplay.textContent = '';
      }
    });

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(doubledDisplay);
    container.appendChild(row);
  });

  showScreen('screen-entry');
}

document.getElementById('doblete-checkbox').addEventListener('change', () => {
  const checked = document.getElementById('doblete-checkbox').checked;
  const inputs = document.querySelectorAll('.entry-input');
  inputs.forEach(input => {
    const i = parseInt(input.dataset.playerIndex);
    const display = document.getElementById(`doubled-${i}`);
    if (display) {
      if (checked && input.value !== '') {
        display.textContent = `= ${Math.abs(parseInt(input.value)) * 2}`;
      } else {
        display.textContent = '';
      }
    }
  });
});

document.getElementById('enter-scores-btn').addEventListener('click', () => {
  if (currentRound >= ROUNDS.length) {
    endGame();
    return;
  }
  openEntryScreen(currentRound);
});

document.getElementById('save-scores-btn').addEventListener('click', () => {
  const inputs = document.querySelectorAll('.entry-input');
  let valid = true;

  inputs.forEach(input => {
    if (input.value === '' || isNaN(input.value)) valid = false;
  });

  if (!valid) {
    alert('Please enter a score for every player.');
    return;
  }

  const roundIndex = parseInt(inputs[0].dataset.roundIndex);
  const isPastRound = roundIndex < currentRound;

  const isDoublete = document.getElementById('doblete-checkbox').checked;
  doubletes[roundIndex] = isDoublete;

  inputs.forEach(input => {
    const playerIndex = parseInt(input.dataset.playerIndex);
    scores[playerIndex][roundIndex] = Math.abs(parseInt(input.value));
  });

  if (!isPastRound) {
    currentRound++;
  }

  refreshScoreRows();
  updateRoundTracker();
  saveState();
  updateGameOnServer();

  if (currentRound >= ROUNDS.length) {
    document.getElementById('enter-scores-btn').textContent = 'See Final Results';
  }

  showScreen('screen-game');
});

document.getElementById('cancel-entry-btn').addEventListener('click', () => {
  if (confirm('Are you sure you want to cancel? Your entered scores will be lost.')) {
    showScreen('screen-game');
  }
});

// ── Player Management ───────────────────────────────────────
function openPlayerManagement() {
  const list = document.getElementById('player-management-list');
  list.innerHTML = '';

  players.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'manage-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'manage-name-input';
    input.value = name;
    input.maxLength = 20;
    input.dataset.playerIndex = i;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-player-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      if (players.length <= 2) {
        alert('You need at least 2 players.');
        return;
      }
      if (confirm(`Remove ${players[i]} from the game?`)) {
        seatOrder = seatOrder.filter(idx => idx !== i).map(idx => idx > i ? idx - 1 : idx);
        if (firstDealer >= seatOrder.length) firstDealer = 0;
        players.splice(i, 1);
        scores.splice(i, 1);
        saveState();
        updateGameOnServer();
        buildScoreboard();
        updateRoundTracker();
        openPlayerManagement();
      }
    });

    row.appendChild(input);
    row.appendChild(removeBtn);
    list.appendChild(row);
  });

  buildSeatingManageList();
  showScreen('screen-players');
}

document.getElementById('manage-players-btn').addEventListener('click', () => {
  openPlayerManagement();
});

document.getElementById('add-midgame-player-btn').addEventListener('click', () => {
  const name = prompt('Enter new player name:');
  if (!name || !name.trim()) return;

  const newIndex = players.length;
  players.push(name.trim());

  const newScores = [];
  for (let i = 0; i < currentRound; i++) {
    newScores.push(0);
  }
  scores.push(newScores);
  seatOrder.push(newIndex);

  saveState();
  updateGameOnServer();
  buildScoreboard();
  updateRoundTracker();
  openPlayerManagement();
});

document.getElementById('done-managing-btn').addEventListener('click', () => {
  const nameInputs = document.querySelectorAll('.manage-name-input');
  nameInputs.forEach(input => {
    const i = parseInt(input.dataset.playerIndex);
    const newName = input.value.trim();
    if (newName) players[i] = newName;
  });

  const seatingRows = document.querySelectorAll('#seating-manage-list .drag-row');
  if (seatingRows.length > 0) {
    seatOrder = [...seatingRows].map(row => parseInt(row.dataset.playerIndex));
  }

  saveState();
  updateGameOnServer();
  buildScoreboard();
  updateRoundTracker();
  showScreen('screen-game');
});

// ── New Game Confirmation ───────────────────────────────────
function goToNewGameScreen() {
  showScreen('screen-newgame');
}

document.getElementById('new-game-midgame-btn').addEventListener('click', () => {
  goToNewGameScreen();
});

document.getElementById('new-game-btn').addEventListener('click', () => {
  goToNewGameScreen();
});

document.getElementById('keep-players-btn').addEventListener('click', () => {
  const currentPlayers = [...players];

  scores = currentPlayers.map(() => []);
  doubletes = [];
  currentRound = 0;
  players = currentPlayers;
  seatOrder = currentPlayers.map((_, i) => i);
  firstDealer = 0;
  gameCode = null;

  const container = document.getElementById('player-inputs');
  container.innerHTML = '';
  currentPlayers.forEach(name => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'player-input';
    input.value = name;
    input.maxLength = 20;
    container.appendChild(input);
  });

  document.getElementById('enter-scores-btn').textContent = 'Enter Round Scores';
  showGameCode(null);
  clearState();
  showScreen('screen-setup');
});

document.getElementById('fresh-start-btn').addEventListener('click', () => {
  players = [];
  scores = [];
  doubletes = [];
  currentRound = 0;
  seatOrder = [];
  firstDealer = 0;
  gameCode = null;

  const container = document.getElementById('player-inputs');
  container.innerHTML = '';
  for (let i = 0; i < 2; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'player-input';
    input.placeholder = `Player ${i + 1}`;
    input.maxLength = 20;
    container.appendChild(input);
  }

  document.getElementById('enter-scores-btn').textContent = 'Enter Round Scores';
  showGameCode(null);
  clearState();
  showScreen('screen-setup');
});

document.getElementById('cancel-newgame-btn').addEventListener('click', () => {
  if (currentRound >= ROUNDS.length) {
    buildGameOverScreen();
    showScreen('screen-gameover');
  } else {
    showScreen('screen-game');
  }
});

// ── Game Over ───────────────────────────────────────────────
function buildGameOverScreen() {
  const totals = players.map((name, i) => ({
    name,
    total: scores[i].reduce((sum, val, roundIndex) => {
      const roundScore = val || 0;
      return sum + (doubletes[roundIndex] ? roundScore * 2 : roundScore);
    }, 0)
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
}

function endGame() {
  buildGameOverScreen();
  showScreen('screen-gameover');
  clearState();
}

// ── Save / Restore State ────────────────────────────────────
function saveState() {
  const state = { players, scores, doubletes, currentRound, seatOrder, firstDealer, gameCode };
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
    doubletes = state.doubletes || [];
    currentRound = state.currentRound;
    seatOrder = state.seatOrder || players.map((_, i) => i);
    firstDealer = state.firstDealer || 0;
    gameCode = state.gameCode || null;

    buildScoreboard();
    updateRoundTracker();
    showGameCode(gameCode);

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
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
let isSpectator = false;
let isScorekeeper = false;
let myPlayerIndex = null;
let pollInterval = null;
let claimedBy = [];
let roundScores = [];
let roundSubmitted = [];
let pollingPaused = false;

// ── Device ID ───────────────────────────────────────────────
function getDeviceId() {
  let id = localStorage.getItem('continental_device_id');
  if (!id) {
    id = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('continental_device_id', id);
  }
  return id;
}
const DEVICE_ID = getDeviceId();

// ── Role Indicator ──────────────────────────────────────────
function updateRoleIndicator() {
  const el = document.getElementById('role-indicator');
  if (isScorekeeper && myPlayerIndex !== null) {
    el.className = 'scorekeeper';
    el.textContent = `👑 Scorekeeper — Playing as ${players[myPlayerIndex]}`;
  } else if (isScorekeeper) {
    el.className = 'scorekeeper';
    el.textContent = '👑 Scorekeeper';
  } else if (myPlayerIndex !== null) {
    el.className = 'player';
    el.textContent = `🎮 Playing as ${players[myPlayerIndex]}`;
  } else {
    el.className = 'spectator';
    el.textContent = '👁 Spectator';
  }
}

// ── Smart Button Switching ──────────────────────────────────
function updateScorekeeperButtons() {
  if (!isScorekeeper) return;
  const anyPlayerJoined = claimedBy.some((id, i) => id && id !== DEVICE_ID);
  document.getElementById('enter-scores-btn').style.display = anyPlayerJoined ? 'none' : '';
  document.getElementById('end-round-btn').style.display = anyPlayerJoined ? '' : 'none';
}

// ── Server Communication ────────────────────────────────────
async function createGameOnServer(playerList) {
  try {
    const response = await fetch(`${API_URL}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players: playerList, scorekeeperId: DEVICE_ID })
    });
    const data = await response.json();
    return data;
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
      body: JSON.stringify({
        players, scores, doubletes,
        current_round: currentRound,
        seat_order: seatOrder,
        first_dealer: firstDealer,
        status: 'active',
        claimed_by: claimedBy,
        round_scores: roundScores,
        round_submitted: roundSubmitted
      })
    });
  } catch (err) {
    console.error('Could not update server:', err);
  }
}

async function claimPlayerOnServer(playerIndex) {
  try {
    const response = await fetch(`${API_URL}/games/${gameCode}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIndex, deviceId: DEVICE_ID })
    });
    if (!response.ok) {
      const data = await response.json();
      alert(data.error || 'Could not claim that name.');
      return false;
    }
    return true;
  } catch (err) {
    console.error('Could not claim player:', err);
    return false;
  }
}

async function startGameOnServer() {
  try {
    await fetch(`${API_URL}/games/${gameCode}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Could not start game:', err);
  }
}

async function endRoundOnServer(isDoublete) {
  try {
    const response = await fetch(`${API_URL}/games/${gameCode}/end-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDoublete })
    });
    return await response.json();
  } catch (err) {
    console.error('Could not end round:', err);
    return null;
  }
}

async function submitScoreOnServer(playerIndex, score) {
  try {
    const response = await fetch(`${API_URL}/games/${gameCode}/submit-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIndex, score })
    });
    return await response.json();
  } catch (err) {
    console.error('Could not submit score:', err);
    return null;
  }
}

async function nextRoundOnServer() {
  try {
    const response = await fetch(`${API_URL}/games/${gameCode}/next-round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return await response.json();
  } catch (err) {
    console.error('Could not advance round:', err);
    return null;
  }
}

async function fetchGame(code) {
  try {
    const response = await fetch(`${API_URL}/games/${code}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    return null;
  }
}

// ── Polling ─────────────────────────────────────────────────
function startPolling(code, onUpdate) {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    if (pollingPaused) return;
    const game = await fetchGame(code);
    if (game) onUpdate(game);
  }, 3000);
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

function pausePolling() { pollingPaused = true; }
function resumePolling() { pollingPaused = false; }

// ── Game Code Banner ────────────────────────────────────────
function showGameCode(code) {
  const banner = document.getElementById('game-code-banner');
  if (code) {
    banner.innerHTML = `Game Code: <span>${code}</span> — Share this with other players`;
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
  }
}

// ── Mode Switching ──────────────────────────────────────────
function showScorekeeperMode() {
  document.getElementById('manage-players-btn').style.display = '';
  document.getElementById('new-game-midgame-btn').style.display = '';
  document.getElementById('rules-btn-game').style.display = '';
  document.getElementById('leave-game-btn').style.display = 'none';
  updateScorekeeperButtons();
}

function showSpectatorMode() {
  document.getElementById('enter-scores-btn').style.display = 'none';
  document.getElementById('end-round-btn').style.display = 'none';
  document.getElementById('manage-players-btn').style.display = 'none';
  document.getElementById('new-game-midgame-btn').style.display = 'none';
  document.getElementById('rules-btn-game').style.display = 'none';
  document.getElementById('leave-game-btn').style.display = '';
}

function showPlayerMode() {
  document.getElementById('enter-scores-btn').style.display = 'none';
  document.getElementById('end-round-btn').style.display = 'none';
  document.getElementById('manage-players-btn').style.display = 'none';
  document.getElementById('new-game-midgame-btn').style.display = 'none';
  document.getElementById('rules-btn-game').style.display = '';
  document.getElementById('leave-game-btn').style.display = '';
}

// ── Screen Switching ────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Rules ───────────────────────────────────────────────────
function openRules(fromScreen) { previousScreen = fromScreen; showScreen('screen-rules'); }
// ── Main Menu ───────────────────────────────────────────────
document.getElementById('mode-scorekeeper-btn').addEventListener('click', () => {
  showScreen('screen-setup');
});

document.getElementById('main-menu-btn-setup').addEventListener('click', () => {
  showScreen('screen-main-menu');
});

document.getElementById('main-menu-btn-game').addEventListener('click', () => {
  if (confirm('Return to the main menu? Your current game will be saved.')) {
    stopPolling();
    showScreen('screen-main-menu');
  }
});

document.getElementById('mode-play-btn').addEventListener('click', () => {
  showScreen('screen-play');
  testRenderCards();
});

document.getElementById('play-menu-btn').addEventListener('click', () => {
  if (confirm('Return to the main menu?')) {
    showScreen('screen-main-menu');
  }
});

document.getElementById('mode-rules-btn').addEventListener('click', () => {
  openRules('screen-main-menu');
});

document.getElementById('rules-btn-setup').addEventListener('click', () => openRules('screen-setup'));
document.getElementById('rules-btn-game').addEventListener('click', () => openRules('screen-game'));
document.getElementById('close-rules-btn').addEventListener('click', () => showScreen(previousScreen));

// ── Leave Game ──────────────────────────────────────────────
document.getElementById('leave-game-btn').addEventListener('click', () => {
  if (confirm('Are you sure you want to leave this game?')) {
    stopPolling();
    gameCode = null;
    myPlayerIndex = null;
    isSpectator = false;
    isScorekeeper = false;
    players = [];
    scores = [];
    doubletes = [];
    currentRound = 0;
    seatOrder = [];
    claimedBy = [];
    clearState();
    showScreen('screen-setup');
  }
});

// ── Join Game ───────────────────────────────────────────────
document.getElementById('join-game-btn').addEventListener('click', () => {
  document.getElementById('join-code-input').value = '';
  showScreen('screen-join');
});

document.getElementById('join-cancel-btn').addEventListener('click', () => showScreen('screen-setup'));

document.getElementById('join-confirm-btn').addEventListener('click', async () => {
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  if (!code || code.length < 4) { alert('Please enter a valid game code.'); return; }
  await handleJoinCode(code);
});

document.getElementById('join-code-input').addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const code = document.getElementById('join-code-input').value.trim().toUpperCase();
    if (code) await handleJoinCode(code);
  }
});

async function handleJoinCode(code) {
  const game = await fetchGame(code);
  if (!game) { alert('Game not found. Check the code and try again.'); return; }

  gameCode = code;
  players = game.players;
  scores = game.scores;
  doubletes = game.doubletes;
  currentRound = game.current_round;
  seatOrder = game.seat_order;
  firstDealer = game.first_dealer;
  claimedBy = game.claimed_by || players.map(() => null);
  roundScores = game.round_scores || players.map(() => null);
  roundSubmitted = game.round_submitted || players.map(() => false);

  isScorekeeper = game.scorekeeper_id === DEVICE_ID;
  const foundIndex = claimedBy.findIndex(id => id === DEVICE_ID);
  myPlayerIndex = foundIndex === -1 ? null : foundIndex;

  if (game.status === 'active' || game.status === 'scoring') {
    if (isScorekeeper) {
      buildScoreboard();
      updateRoundTracker();
      showGameCode(gameCode);
      showScorekeeperMode();
      updateRoleIndicator();
      if (game.status === 'scoring') {
        buildCollectingScreen(game);
        showScreen('screen-collecting');
      } else {
        showScreen('screen-game');
      }
      startPolling(code, onGameUpdate);
    } else if (myPlayerIndex !== null) {
      buildScoreboard();
      updateRoundTracker();
      showGameCode(gameCode);
      showPlayerMode();
      updateRoleIndicator();
      if (game.status === 'scoring' && !roundSubmitted[myPlayerIndex]) {
        buildSubmitScreen();
        showScreen('screen-submit');
      } else {
        showScreen('screen-game');
      }
      startPolling(code, onGameUpdate);
    } else {
      // Not claimed yet — show claim screen so they can pick a name or skip
      buildClaimScreen();
      showScreen('screen-claim');
    }
  } else if (game.status === 'lobby') {
    buildClaimScreen();
    showScreen('screen-claim');
  }
}

// ── Claim Name Screen ───────────────────────────────────────
function buildClaimScreen() {
  const list = document.getElementById('claim-list');
  list.innerHTML = '';

  players.forEach((name, i) => {
    const option = document.createElement('div');
    const isTaken = claimedBy[i] && claimedBy[i] !== DEVICE_ID;
    const isMine = claimedBy[i] === DEVICE_ID;

    option.className = 'claim-option' + (isTaken ? ' taken' : '');
    option.textContent = name;

    if (isMine) {
      option.style.borderColor = '#c9a84c';
      option.style.color = '#c9a84c';
      const label = document.createElement('span');
      label.className = 'claim-taken-label';
      label.style.color = '#c9a84c';
      label.textContent = 'You';
      option.appendChild(label);
    } else if (isTaken) {
      const label = document.createElement('span');
      label.className = 'claim-taken-label';
      label.textContent = 'Taken';
      option.appendChild(label);
    }

    if (!isTaken) {
      option.addEventListener('click', async () => {
        const success = await claimPlayerOnServer(i);
        if (success) {
          myPlayerIndex = i;
          claimedBy[i] = DEVICE_ID;
          isSpectator = false;

          if (isScorekeeper) {
            // Scorekeeper claimed their name — go to lobby
            buildLobbyScreen();
            showScreen('screen-lobby');
            startPolling(gameCode, onLobbyUpdate);
          } else {
            buildWaitingScreen();
            showScreen('screen-waiting');
            startPolling(gameCode, onWaitingUpdate);
          }
        }
      });
    }

    list.appendChild(option);
  });
}

document.getElementById('claim-cancel-btn').addEventListener('click', () => {
  stopPolling();
  gameCode = null;
  showScreen('screen-setup');
});

document.getElementById('claim-skip-btn').addEventListener('click', () => {
  isSpectator = true;
  myPlayerIndex = null;
  buildScoreboard();
  updateRoundTracker();
  showGameCode(gameCode);
  showSpectatorMode();
  updateRoleIndicator();
  showScreen('screen-game');
  startPolling(gameCode, onGameUpdate);
});

// ── Waiting Screen ──────────────────────────────────────────
function buildWaitingScreen() {
  document.getElementById('waiting-code-display').innerHTML = `Game Code<span>${gameCode}</span>`;
  const list = document.getElementById('waiting-player-list');
  list.innerHTML = '';

  players.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'lobby-player-row';
    const nameEl = document.createElement('div');
    nameEl.className = 'lobby-player-name';
    nameEl.textContent = name;
    const status = document.createElement('div');
    const hasJoined = claimedBy[i] !== null && claimedBy[i] !== undefined;
    status.className = 'lobby-player-status ' + (hasJoined ? 'joined' : 'waiting');
    status.textContent = hasJoined ? 'Joined' : 'Waiting';
    row.appendChild(nameEl);
    row.appendChild(status);
    list.appendChild(row);
  });
}

function onWaitingUpdate(game) {
  claimedBy = game.claimed_by || claimedBy;
  players = game.players;
  buildWaitingScreen();

  if (game.status === 'active') {
    stopPolling();
    scores = game.scores;
    doubletes = game.doubletes;
    currentRound = game.current_round;
    seatOrder = game.seat_order;
    firstDealer = game.first_dealer;
    isSpectator = false;
    buildScoreboard();
    updateRoundTracker();
    showGameCode(gameCode);
    showPlayerMode();
    updateRoleIndicator();
    showScreen('screen-game');
    startPolling(gameCode, onGameUpdate);
  }
}

document.getElementById('waiting-cancel-btn').addEventListener('click', () => {
  stopPolling();
  gameCode = null;
  myPlayerIndex = null;
  isSpectator = false;
  showScreen('screen-setup');
});

// ── Lobby Screen ────────────────────────────────────────────
function buildLobbyScreen() {
  document.getElementById('lobby-code-display').innerHTML = `Share this code with players<span>${gameCode}</span>`;
  const list = document.getElementById('lobby-player-list');
  list.innerHTML = '';

  players.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'lobby-player-row';
    const nameEl = document.createElement('div');
    nameEl.className = 'lobby-player-name';
    nameEl.textContent = name;
    const status = document.createElement('div');
    const hasJoined = claimedBy[i] !== null && claimedBy[i] !== undefined;
    status.className = 'lobby-player-status ' + (hasJoined ? 'joined' : 'waiting');
    status.textContent = hasJoined ? 'Joined' : 'Waiting';
    row.appendChild(nameEl);
    row.appendChild(status);
    list.appendChild(row);
  });
}

function onLobbyUpdate(game) {
  claimedBy = game.claimed_by || claimedBy;
  buildLobbyScreen();
  updateScorekeeperButtons();
}

document.getElementById('lobby-start-btn').addEventListener('click', async () => {
  stopPolling();
  await startGameOnServer();
  openSeatingScreen();
});

document.getElementById('lobby-cancel-btn').addEventListener('click', () => {
  stopPolling();
  gameCode = null;
  players = [];
  scores = [];
  doubletes = [];
  currentRound = 0;
  claimedBy = [];
  showScreen('screen-setup');
});

// ── General Game Update ─────────────────────────────────────
function onGameUpdate(game) {
  if (pollingPaused) return;

  players = game.players;
  scores = game.scores;
  doubletes = game.doubletes;
  currentRound = game.current_round;
  roundScores = game.round_scores || players.map(() => null);
  roundSubmitted = game.round_submitted || players.map(() => false);
  claimedBy = game.claimed_by || claimedBy;

  buildScoreboard();
  updateRoundTracker();
  if (isScorekeeper) updateScorekeeperButtons();

  const currentScreen = document.querySelector('.screen.active');
  const currentScreenId = currentScreen ? currentScreen.id : '';

  if (game.status === 'scoring') {
    if (isScorekeeper && currentScreenId !== 'screen-collecting') {
      buildCollectingScreen(game);
      showScreen('screen-collecting');
    } else if (isScorekeeper) {
      buildCollectingScreen(game);
    } else if (myPlayerIndex !== null && !roundSubmitted[myPlayerIndex] && currentScreenId !== 'screen-submit') {
      buildSubmitScreen();
      showScreen('screen-submit');
    }
  } else if (game.status === 'active') {
    if (currentScreenId === 'screen-collecting' || currentScreenId === 'screen-submit') {
      showScreen('screen-game');
    }
  } else if (game.status === 'finished') {
    endGame();
  }
}

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

document.getElementById('start-game-btn').addEventListener('click', async () => {
  const inputs = document.querySelectorAll('.player-input');
  players = [];
  inputs.forEach(input => {
    const name = input.value.trim();
    if (name) players.push(name);
  });

  if (players.length < 2) { alert('Please enter at least 2 players.'); return; }

  scores = players.map(() => []);
  doubletes = [];
  currentRound = 0;
  seatOrder = players.map((_, i) => i);
  firstDealer = 0;
  gameCode = null;
  isSpectator = false;
  isScorekeeper = true;
  myPlayerIndex = null;
  stopPolling();

  const result = await createGameOnServer(players);
  if (result && result.code) {
    gameCode = result.code;
    claimedBy = players.map(() => null);
    // Scorekeeper claims their name first
    buildClaimScreen();
    showScreen('screen-claim');
  } else {
    // No server — go straight to seating
    openSeatingScreen();
  }
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
  Sortable.create(list, { animation: 150, ghostClass: 'sortable-ghost', handle: '.drag-handle' });
}

function buildDealerSelect() {
  const container = document.getElementById('dealer-select');
  container.innerHTML = '';
  seatOrder.forEach((playerIndex, seatIndex) => {
    const option = document.createElement('div');
    option.className = 'dealer-option' + (seatIndex === firstDealer ? ' selected' : '');
    option.textContent = players[playerIndex];
    option.addEventListener('click', () => { firstDealer = seatIndex; buildDealerSelect(); });
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
  Sortable.create(list, { animation: 150, ghostClass: 'sortable-ghost', handle: '.drag-handle' });
}

document.getElementById('confirm-seating-btn').addEventListener('click', async () => {
  const rows = document.querySelectorAll('#seating-list .drag-row');
  seatOrder = [...rows].map(row => parseInt(row.dataset.playerIndex));
  isScorekeeper = true;
  isSpectator = false;
  showScorekeeperMode();
  showGameCode(gameCode);
  updateRoleIndicator();
  buildScoreboard();
  updateRoundTracker();
  updateDealerIndicator();
  saveState();
  await updateGameOnServer();
  if (gameCode) startPolling(gameCode, onGameUpdate);
  showScreen('screen-game');
});

// ── Dealer Indicator ────────────────────────────────────────
function updateDealerIndicator() {
  if (seatOrder.length === 0) return;
  const dealerSeatIndex = (firstDealer + currentRound) % seatOrder.length;
  const dealerPlayerIndex = seatOrder[dealerSeatIndex];
  const dealerName = players[dealerPlayerIndex];
  const contractDisplay = document.getElementById('round-contract');
  if (currentRound < ROUNDS.length) {
    contractDisplay.textContent = `Round ${currentRound + 1}: ${ROUNDS[currentRound].contract} — Dealer: ${dealerName}`;
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
  const headerCells = document.getElementById('header-row').querySelectorAll('th');
  const totalCells = document.getElementById('total-row').querySelectorAll('td');
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
      if (isScorekeeper) {
        dot.style.cursor = 'pointer';
        dot.title = `Edit Round ${index + 1}`;
        dot.addEventListener('click', () => openEntryScreen(index));
      }
    } else if (index === currentRound) {
      dot.classList.add('current');
    }
    dotsContainer.appendChild(dot);
  });
  updateDealerIndicator();
}

// ── End Round Flow ──────────────────────────────────────────
document.getElementById('end-round-btn').addEventListener('click', () => {
  document.getElementById('end-round-title').textContent = `End Round ${currentRound + 1}`;
  document.getElementById('end-round-doblete').checked = false;
  pausePolling();
  showScreen('screen-end-round');
});

document.getElementById('cancel-end-round-btn').addEventListener('click', () => {
  resumePolling();
  showScreen('screen-game');
});

document.getElementById('confirm-end-round-btn').addEventListener('click', async () => {
  const isDoublete = document.getElementById('end-round-doblete').checked;
  const game = await endRoundOnServer(isDoublete);
  if (game) {
    doubletes = game.doubletes;
    roundScores = game.round_scores;
    roundSubmitted = game.round_submitted;
    resumePolling();
    buildCollectingScreen(game);
    showScreen('screen-collecting');
  }
});

// ── Collecting Screen ───────────────────────────────────────
function buildCollectingScreen(game) {
  document.getElementById('collecting-title').textContent = `Round ${currentRound + 1} Scores`;
  const list = document.getElementById('collecting-list');
  list.innerHTML = '';

  const rs = game.round_scores || roundScores;
  const submitted = game.round_submitted || roundSubmitted;

  players.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'collecting-row';
    const nameEl = document.createElement('div');
    nameEl.className = 'collecting-name';
    nameEl.textContent = name;
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'collecting-score-input';
    input.min = 0;
    input.placeholder = '0';
    input.dataset.playerIndex = i;
    if (rs[i] !== null && rs[i] !== undefined) input.value = rs[i];
    // Pause polling while scorekeeper is typing
    input.addEventListener('focus', pausePolling);
    input.addEventListener('blur', resumePolling);
    const status = document.createElement('div');
    status.className = 'collecting-status ' + (submitted[i] ? 'submitted' : 'pending');
    status.textContent = submitted[i] ? '✓' : 'Pending';
    status.id = `collect-status-${i}`;
    row.appendChild(nameEl);
    row.appendChild(input);
    row.appendChild(status);
    list.appendChild(row);
  });
}

document.getElementById('next-round-btn').addEventListener('click', async () => {
  pausePolling();
  const inputs = document.querySelectorAll('.collecting-score-input');
  for (const input of inputs) {
    const i = parseInt(input.dataset.playerIndex);
    if (input.value !== '' && !roundSubmitted[i]) {
      await submitScoreOnServer(i, Math.abs(parseInt(input.value)));
    }
  }
  const game = await nextRoundOnServer();
  if (game) {
    scores = game.scores;
    doubletes = game.doubletes;
    currentRound = game.current_round;
    roundScores = game.round_scores;
    roundSubmitted = game.round_submitted;
    saveState();
    buildScoreboard();
    updateRoundTracker();
    updateScorekeeperButtons();
    resumePolling();
    if (game.status === 'finished') { endGame(); }
    else { showScreen('screen-game'); }
  }
});

// ── Player Submit Screen ────────────────────────────────────
function buildSubmitScreen() {
  const round = ROUNDS[currentRound];
  document.getElementById('submit-title').textContent = `Round ${currentRound + 1} — Your Score`;
  document.getElementById('submit-contract').textContent = round.contract;
  document.getElementById('submit-score-input').value = '';
}

document.getElementById('submit-score-input').addEventListener('focus', pausePolling);
document.getElementById('submit-score-input').addEventListener('blur', resumePolling);

document.getElementById('submit-score-btn').addEventListener('click', async () => {
  const input = document.getElementById('submit-score-input');
  if (input.value === '' || isNaN(input.value)) { alert('Please enter your score.'); return; }
  const score = Math.abs(parseInt(input.value));
  pausePolling();
  await submitScoreOnServer(myPlayerIndex, score);
  roundSubmitted[myPlayerIndex] = true;
  resumePolling();
  showScreen('screen-game');
});

// ── Score Entry Screen (local) ──────────────────────────────
function openEntryScreen(roundIndex) {
  pausePolling();
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
    if (scores[i][roundIndex] !== undefined) { input.value = scores[i][roundIndex]; }
    else { input.placeholder = '0'; }
    const doubledDisplay = document.createElement('div');
    doubledDisplay.className = 'doubled-value';
    doubledDisplay.id = `doubled-${i}`;
    if (checkbox.checked && scores[i][roundIndex] !== undefined) {
      doubledDisplay.textContent = `= ${scores[i][roundIndex] * 2}`;
    } else { doubledDisplay.textContent = ''; }
    input.addEventListener('input', () => {
      const isChecked = document.getElementById('doblete-checkbox').checked;
      doubledDisplay.textContent = (isChecked && input.value !== '') ?
        `= ${Math.abs(parseInt(input.value)) * 2}` : '';
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
  document.querySelectorAll('#entry-inputs .entry-input').forEach(input => {
    const i = parseInt(input.dataset.playerIndex);
    const display = document.getElementById(`doubled-${i}`);
    if (display) {
      display.textContent = (checked && input.value !== '') ?
        `= ${Math.abs(parseInt(input.value)) * 2}` : '';
    }
  });
});

document.getElementById('enter-scores-btn').addEventListener('click', () => {
  if (currentRound >= ROUNDS.length) { endGame(); return; }
  openEntryScreen(currentRound);
});

document.getElementById('save-scores-btn').addEventListener('click', async () => {
  const inputs = document.querySelectorAll('#entry-inputs .entry-input');
  let valid = true;
  inputs.forEach(input => { if (input.value === '' || isNaN(input.value)) valid = false; });
  if (!valid) { alert('Please enter a score for every player.'); return; }
  const roundIndex = parseInt(inputs[0].dataset.roundIndex);
  const isPastRound = roundIndex < currentRound;
  const isDoublete = document.getElementById('doblete-checkbox').checked;
  doubletes[roundIndex] = isDoublete;
  inputs.forEach(input => {
    const playerIndex = parseInt(input.dataset.playerIndex);
    scores[playerIndex][roundIndex] = Math.abs(parseInt(input.value));
  });
  if (!isPastRound) currentRound++;
  refreshScoreRows();
  updateRoundTracker();
  updateScorekeeperButtons();
  saveState();
  await updateGameOnServer();
  resumePolling();
  if (currentRound >= ROUNDS.length) {
    document.getElementById('enter-scores-btn').textContent = 'See Final Results';
  }
  showScreen('screen-game');
});

document.getElementById('cancel-entry-btn').addEventListener('click', () => {
  if (confirm('Are you sure you want to cancel? Your entered scores will be lost.')) {
    resumePolling();
    showScreen('screen-game');
  }
});

// ── Player Management ───────────────────────────────────────
function openPlayerManagement() {
  pausePolling();
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
      if (players.length <= 2) { alert('You need at least 2 players.'); return; }
      if (confirm(`Remove ${players[i]} from the game?`)) {
        seatOrder = seatOrder.filter(idx => idx !== i).map(idx => idx > i ? idx - 1 : idx);
        if (firstDealer >= seatOrder.length) firstDealer = 0;
        claimedBy.splice(i, 1);
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

document.getElementById('manage-players-btn').addEventListener('click', () => openPlayerManagement());

document.getElementById('add-midgame-player-btn').addEventListener('click', () => {
  const name = prompt('Enter new player name:');
  if (!name || !name.trim()) return;
  const newIndex = players.length;
  players.push(name.trim());
  claimedBy.push(null);
  const newScores = [];
  for (let i = 0; i < currentRound; i++) newScores.push(0);
  scores.push(newScores);
  seatOrder.push(newIndex);
  saveState();
  updateGameOnServer();
  buildScoreboard();
  updateRoundTracker();
  openPlayerManagement();
});

document.getElementById('done-managing-btn').addEventListener('click', () => {
  document.querySelectorAll('.manage-name-input').forEach(input => {
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
  resumePolling();
  showScreen('screen-game');
});

// ── New Game ────────────────────────────────────────────────
function resetState() {
  players = []; scores = []; doubletes = []; currentRound = 0;
  seatOrder = []; firstDealer = 0; gameCode = null;
  isSpectator = false; isScorekeeper = false;
  claimedBy = []; myPlayerIndex = null;
  roundScores = []; roundSubmitted = [];
  stopPolling();
}

function goToNewGameScreen() { stopPolling(); showScreen('screen-newgame'); }

document.getElementById('new-game-midgame-btn').addEventListener('click', () => goToNewGameScreen());
document.getElementById('new-game-btn').addEventListener('click', () => goToNewGameScreen());

document.getElementById('keep-players-btn').addEventListener('click', () => {
  const currentPlayers = [...players];
  resetState();
  players = currentPlayers;
  seatOrder = currentPlayers.map((_, i) => i);
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
  showScorekeeperMode();
  clearState();
  showScreen('screen-setup');
});

document.getElementById('fresh-start-btn').addEventListener('click', () => {
  resetState();
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
  showScorekeeperMode();
  clearState();
  showScreen('screen-setup');
});

document.getElementById('cancel-newgame-btn').addEventListener('click', () => {
  if (currentRound >= ROUNDS.length) { buildGameOverScreen(); showScreen('screen-gameover'); }
  else { if (gameCode) startPolling(gameCode, onGameUpdate); showScreen('screen-game'); }
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
  document.getElementById('winner-display').textContent = `🏆 ${winner.name} wins with ${winner.total} points!`;
  document.getElementById('final-scoreboard').innerHTML = `
    <thead><tr><th>Player</th><th>Total</th></tr></thead>
    <tbody>${totals.map((p, i) => `
      <tr style="${i === 0 ? 'color: #7ec87e; font-weight: 700;' : ''}">
        <td>${p.name}</td><td>${p.total}</td>
      </tr>`).join('')}
    </tbody>`;
}

function endGame() {
  stopPolling();
  buildGameOverScreen();
  showScreen('screen-gameover');
  clearState();
}

// ── Save / Restore State ────────────────────────────────────
function saveState() {
  const state = { players, scores, doubletes, currentRound, seatOrder, firstDealer, gameCode, claimedBy, isScorekeeper, myPlayerIndex };
  localStorage.setItem('continental_state', JSON.stringify(state));
}

function clearState() { localStorage.removeItem('continental_state'); }

async function loadState() {
  const saved = localStorage.getItem('continental_state');
  if (!saved) {
    showScreen('screen-main-menu');
    return;
  }
  try {
    const state = JSON.parse(saved);
    players = state.players;
    scores = state.scores;
    doubletes = state.doubletes || [];
    currentRound = state.currentRound;
    seatOrder = state.seatOrder || players.map((_, i) => i);
    firstDealer = state.firstDealer || 0;
    gameCode = state.gameCode || null;
    claimedBy = state.claimedBy || players.map(() => null);
    isScorekeeper = state.isScorekeeper || false;
    myPlayerIndex = state.myPlayerIndex !== undefined ? state.myPlayerIndex : null;
    isSpectator = false;

    // Verify game still exists on server
    if (gameCode) {
      const game = await fetchGame(gameCode);
      if (!game) {
        clearState();
        showScreen('screen-setup');
        return;
      }
      // Sync latest state from server
      players = game.players;
      scores = game.scores;
      doubletes = game.doubletes || [];
      currentRound = game.current_round;
      claimedBy = game.claimed_by || claimedBy;
      roundScores = game.round_scores || players.map(() => null);
      roundSubmitted = game.round_submitted || players.map(() => false);
    }

    buildScoreboard();
    updateRoundTracker();
    showGameCode(gameCode);
    updateRoleIndicator();

    if (isScorekeeper) showScorekeeperMode();
    else if (myPlayerIndex !== null) showPlayerMode();
    else showSpectatorMode();

    if (currentRound >= ROUNDS.length) {
      document.getElementById('enter-scores-btn').textContent = 'See Final Results';
    }

    if (gameCode) startPolling(gameCode, onGameUpdate);
    showScreen('screen-game');
  } catch (e) {
    clearState();
  }
}

// ── Init ────────────────────────────────────────────────────
loadState();

// ── Card System ─────────────────────────────────────────────

const SUITS = [
  { name: 'hearts',   symbol: '♥', color: 'red'   },
  { name: 'diamonds', symbol: '♦', color: 'red'   },
  { name: 'clubs',    symbol: '♣', color: 'black' },
  { name: 'spades',   symbol: '♠', color: 'black' },
];

const VALUES = [
  { value: 'A',  display: 'A',  points: 20 },
  { value: '2',  display: '2',  points: 2  },
  { value: '3',  display: '3',  points: 3  },
  { value: '4',  display: '4',  points: 4  },
  { value: '5',  display: '5',  points: 5  },
  { value: '6',  display: '6',  points: 6  },
  { value: '7',  display: '7',  points: 7  },
  { value: '8',  display: '8',  points: 8  },
  { value: '9',  display: '9',  points: 9  },
  { value: '10', display: '10', points: 10 },
  { value: 'J',  display: 'J',  points: 10 },
  { value: 'Q',  display: 'Q',  points: 10 },
  { value: 'K',  display: 'K',  points: 10 },
];

function buildDeck() {
  const deck = [];
  SUITS.forEach(suit => {
    VALUES.forEach(val => {
      deck.push({
        suit: suit.name,
        symbol: suit.symbol,
        color: suit.color,
        value: val.value,
        display: val.display,
        points: val.points,
        isWild: suit.color === 'red' && val.value === 'A',
        id: val.value + '_' + suit.name + '_' + Math.random().toString(36).substr(2, 5)
      });
    });
  });
  return deck;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildShoe(playerCount) {
  const deckCount = playerCount <= 4 ? 2 : 3;
  let shoe = [];
  for (let i = 0; i < deckCount; i++) {
    shoe = shoe.concat(buildDeck());
  }
  return shuffle(shoe);
}

function renderCard(card, options = {}) {
  const el = document.createElement('div');
  el.className = 'card ' + card.color + (card.isWild ? ' wild' : '');
  el.dataset.cardId = card.id;
  el.dataset.suit = card.suit;
  el.dataset.value = card.value;

  const top = document.createElement('div');
  top.className = 'card-top';
  const topValue = document.createElement('span');
  topValue.className = 'card-value';
  topValue.textContent = card.display;
  const topSuit = document.createElement('span');
  topSuit.className = 'card-suit-small';
  topSuit.textContent = card.symbol;
  top.appendChild(topValue);
  top.appendChild(topSuit);

  const center = document.createElement('div');
  center.className = 'card-center';
  center.textContent = card.symbol;

  const bottom = document.createElement('div');
  bottom.className = 'card-bottom';
  const botValue = document.createElement('span');
  botValue.className = 'card-value';
  botValue.textContent = card.display;
  const botSuit = document.createElement('span');
  botSuit.className = 'card-suit-small';
  botSuit.textContent = card.symbol;
  bottom.appendChild(botValue);
  bottom.appendChild(botSuit);

  if (card.isWild) {
    const wildEl = document.createElement('div');
    wildEl.className = 'wild-indicator';
    wildEl.textContent = 'WILD';
    el.appendChild(wildEl);
  }

  el.appendChild(top);
  el.appendChild(center);
  el.appendChild(bottom);

  if (options.selectable) {
    el.addEventListener('click', () => {
      el.classList.toggle('selected');
      if (options.onSelect) options.onSelect(card, el);
    });
  }

  return el;
}

function renderCardBack() {
  const el = document.createElement('div');
  el.className = 'card-back-face';
  el.textContent = '🂠';
  return el;
}

let gameState = {
  deck: [],
  discard: [],
  players: [],
  currentPlayerIndex: 0,
  round: 0,
  phase: 'draw',
};

// Quick test — render a few cards on the play screen to verify visuals
function testRenderCards() {
  const hand = document.getElementById('play-hand-cards');
  if (!hand) return;
  hand.innerHTML = '';
  const testCards = [
    { suit: 'hearts',   symbol: '♥', color: 'red',   value: 'A',  display: 'A',  points: 20, isWild: true,  id: 'test1' },
    { suit: 'spades',   symbol: '♠', color: 'black', value: 'K',  display: 'K',  points: 10, isWild: false, id: 'test2' },
    { suit: 'diamonds', symbol: '♦', color: 'red',   value: '7',  display: '7',  points: 7,  isWild: false, id: 'test3' },
    { suit: 'clubs',    symbol: '♣', color: 'black', value: '10', display: '10', points: 10, isWild: false, id: 'test4' },
    { suit: 'hearts',   symbol: '♥', color: 'red',   value: 'Q',  display: 'Q',  points: 10, isWild: false, id: 'test5' },
  ];
  testCards.forEach(card => {
    hand.appendChild(renderCard(card, { selectable: true }));
  });

  // Also show a card back in opponents area
  const opponents = document.getElementById('play-opponents');
  if (opponents) {
    opponents.innerHTML = '';
    const area = document.createElement('div');
    area.className = 'opponent-area';
    const name = document.createElement('div');
    name.className = 'opponent-name';
    name.textContent = 'Player 2';
    const back = renderCardBack();
    const count = document.createElement('div');
    count.className = 'opponent-card-count';
    count.textContent = '11 cards';
    area.appendChild(name);
    area.appendChild(back);
    area.appendChild(count);
    opponents.appendChild(area);
  }
}
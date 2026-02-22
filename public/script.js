const FIELD_MAP = [
  'WWWWWWWWWWWW',
  'WPPPPGGGPPPW',
  'WPGGGGGGGPWW',
  'WPPPPGPPPPPW',
  'WPGGPPPPGPPW',
  'WPPPPGGGGPPW',
  'WPGPPPPPPGPW',
  'WPPGGGGPPPPW',
  'WPPPPGPGPPPW',
  'WWWWWWWWWWWW'
];

const state = {
  monsters: [],
  moves: [],
  player: null,
  enemy: null,
  gameOver: false,
  inBattle: false,
  playerPos: { x: 1, y: 1 }
};

const dom = {
  field: document.getElementById('field'),
  locationText: document.getElementById('location-text'),
  battleSection: document.getElementById('battle-section'),
  enemyName: document.getElementById('enemy-name'),
  enemySprite: document.getElementById('enemy-sprite'),
  enemyHp: document.getElementById('enemy-hp'),
  enemyHpText: document.getElementById('enemy-hp-text'),
  playerName: document.getElementById('player-name'),
  playerSprite: document.getElementById('player-sprite'),
  playerHp: document.getElementById('player-hp'),
  playerHpText: document.getElementById('player-hp-text'),
  moves: document.getElementById('moves'),
  log: document.getElementById('log'),
  restart: document.getElementById('restart'),
  reload: document.getElementById('reload'),
  moveForm: document.getElementById('move-form'),
  monsterForm: document.getElementById('monster-form'),
  moveSelect: document.getElementById('move-select')
};

async function fetchConfig() {
  const res = await fetch('/api/config');
  const data = await res.json();
  state.monsters = data.monsters;
  state.moves = [...new Map(state.monsters.flatMap((m) => m.moves).map((mv) => [mv.id, mv])).values()];
}

function cloneMonster(monster) {
  return { ...monster, currentHp: monster.max_hp };
}

function chooseCombatants() {
  const playerMonster = state.monsters.find((m) => !m.is_enemy_default) || state.monsters[0];
  const enemyPool = state.monsters.filter((m) => m.is_enemy_default);
  const enemies = enemyPool.length > 0 ? enemyPool : state.monsters;
  const enemyMonster = enemies[Math.floor(Math.random() * enemies.length)] || state.monsters[0];
  state.player = cloneMonster(playerMonster);
  state.enemy = cloneMonster(enemyMonster);
  state.gameOver = false;
}

function renderMonster(monster, target) {
  const hpPercent = Math.max((monster.currentHp / monster.max_hp) * 100, 0);
  target.name.textContent = monster.name;
  target.sprite.textContent = monster.sprite;
  target.hp.style.width = `${hpPercent}%`;
  target.hpText.textContent = `${Math.max(monster.currentHp, 0)} / ${monster.max_hp}`;
}

function log(message) {
  dom.log.textContent = `${message}\n${dom.log.textContent}`.trim();
}

function calcDamage(attacker, defender, move) {
  if (Math.random() * 100 > move.accuracy) return null;
  if (move.power < 0) {
    const heal = Math.abs(move.power) + Math.floor(attacker.attack / 3);
    attacker.currentHp = Math.min(attacker.max_hp, attacker.currentHp + heal);
    return { heal };
  }
  const raw = move.power + attacker.attack - Math.floor(defender.defense / 2);
  const damage = Math.max(8, raw + Math.floor(Math.random() * 6) - 2);
  defender.currentHp -= damage;
  return { damage };
}

function renderMoves() {
  dom.moves.innerHTML = '';
  state.player.moves.forEach((move) => {
    const btn = document.createElement('button');
    btn.textContent = `${move.name} (${move.power})`;
    btn.title = move.description;
    btn.onclick = () => playerTurn(move);
    dom.moves.appendChild(btn);
  });
}

function disableMoves(disabled) {
  Array.from(dom.moves.children).forEach((btn) => {
    btn.disabled = disabled;
  });
}

function checkWinner() {
  if (state.enemy.currentHp <= 0) {
    log(`${state.enemy.name} を倒した！ 探索を続けよう。`);
    state.gameOver = true;
    state.inBattle = false;
    dom.restart.hidden = false;
    disableMoves(true);
    return true;
  }
  if (state.player.currentHp <= 0) {
    log('あなたは倒れてしまった... 探索地点に戻る。');
    state.gameOver = true;
    state.inBattle = false;
    dom.restart.hidden = false;
    disableMoves(true);
    return true;
  }
  return false;
}

function enemyTurn() {
  if (state.gameOver) return;
  const move = state.enemy.moves[Math.floor(Math.random() * state.enemy.moves.length)];
  const result = calcDamage(state.enemy, state.player, move);
  if (!result) {
    log(`敵の ${move.name} は外れた！`);
  } else if (result.heal) {
    log(`敵の ${move.name}！ ${result.heal} 回復した。`);
  } else {
    log(`敵の ${move.name}！ ${result.damage} ダメージ。`);
  }
  renderBattle();
  checkWinner();
  disableMoves(false);
}

function playerTurn(move) {
  if (state.gameOver || !state.inBattle) return;
  disableMoves(true);
  const result = calcDamage(state.player, state.enemy, move);
  if (!result) {
    log(`${move.name} は外れた！`);
  } else if (result.heal) {
    log(`${move.name} で ${result.heal} 回復した！`);
  } else {
    log(`${move.name}！ ${result.damage} ダメージ！`);
  }

  renderBattle();
  if (checkWinner()) return;
  setTimeout(enemyTurn, 500);
}

function renderMoveSelect() {
  dom.moveSelect.innerHTML = '';
  state.moves.forEach((move) => {
    const option = document.createElement('option');
    option.value = move.id;
    option.textContent = `${move.name} (${move.power})`;
    dom.moveSelect.appendChild(option);
  });
}

function tileAt(x, y) {
  return FIELD_MAP[y]?.[x] ?? 'W';
}

function renderField() {
  dom.field.innerHTML = '';
  FIELD_MAP.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.classList.add(char === 'G' ? 'grass' : char === 'P' ? 'path' : 'wall');
      if (state.playerPos.x === x && state.playerPos.y === y) {
        tile.classList.add('player');
      }
      dom.field.appendChild(tile);
    });
  });
  dom.locationText.textContent = `現在地: (${state.playerPos.x}, ${state.playerPos.y})`;
}

function tryEncounter() {
  const onGrass = tileAt(state.playerPos.x, state.playerPos.y) === 'G';
  if (!onGrass || state.inBattle) return;
  if (Math.random() < 0.3) {
    state.inBattle = true;
    chooseCombatants();
    renderBattle();
    renderMoves();
    dom.restart.hidden = true;
    dom.battleSection.classList.remove('hidden');
    dom.log.textContent = '野生モンスターが現れた！';
  }
}

function movePlayer(dx, dy) {
  if (state.inBattle) return;
  const nx = state.playerPos.x + dx;
  const ny = state.playerPos.y + dy;
  if (tileAt(nx, ny) === 'W') return;
  state.playerPos = { x: nx, y: ny };
  renderField();
  tryEncounter();
}

function handleKey(event) {
  const key = event.key.toLowerCase();
  if (['arrowup', 'w'].includes(key)) movePlayer(0, -1);
  if (['arrowdown', 's'].includes(key)) movePlayer(0, 1);
  if (['arrowleft', 'a'].includes(key)) movePlayer(-1, 0);
  if (['arrowright', 'd'].includes(key)) movePlayer(1, 0);
}

function leaveBattle() {
  dom.battleSection.classList.add('hidden');
  dom.restart.hidden = true;
  state.gameOver = false;
  state.inBattle = false;
  dom.log.textContent = '探索に戻った。';
  if (state.player?.currentHp <= 0) {
    state.playerPos = { x: 1, y: 1 };
    renderField();
  }
}

async function submitMoveForm(event) {
  event.preventDefault();
  const formData = new FormData(dom.moveForm);
  const payload = Object.fromEntries(formData.entries());
  const res = await fetch('/api/moves', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    alert('わざ追加に失敗しました');
    return;
  }
  dom.moveForm.reset();
  await fetchConfig();
  renderMoveSelect();
  alert('わざを追加しました');
}

async function submitMonsterForm(event) {
  event.preventDefault();
  const formData = new FormData(dom.monsterForm);
  const payload = Object.fromEntries(formData.entries());
  payload.is_enemy_default = formData.get('is_enemy_default') === 'on';
  payload.move_ids = Array.from(dom.moveSelect.selectedOptions).map((o) => Number(o.value));

  const res = await fetch('/api/monsters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    alert('モンスター追加に失敗しました');
    return;
  }
  dom.monsterForm.reset();
  await fetchConfig();
  renderMoveSelect();
  alert('モンスターを追加しました');
}

function renderBattle() {
  renderMonster(state.enemy, {
    name: dom.enemyName,
    sprite: dom.enemySprite,
    hp: dom.enemyHp,
    hpText: dom.enemyHpText
  });
  renderMonster(state.player, {
    name: dom.playerName,
    sprite: dom.playerSprite,
    hp: dom.playerHp,
    hpText: dom.playerHpText
  });
}

async function bootstrap() {
  await fetchConfig();
  renderMoveSelect();
  renderField();
  dom.battleSection.classList.add('hidden');
  dom.log.textContent = '冒険を始めよう。';
}

dom.restart.onclick = leaveBattle;
dom.reload.onclick = bootstrap;
dom.moveForm.addEventListener('submit', submitMoveForm);
dom.monsterForm.addEventListener('submit', submitMonsterForm);
window.addEventListener('keydown', handleKey);

bootstrap();


const toast = document.getElementById('toast');
let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// 守備位置
const fieldPositions = [
  { code: 'CF', left: 51, top: 36 },
  { code: 'LF', left: 27, top: 42 },
  { code: 'RF', left: 78, top: 42 },
  { code: 'SS', left: 38, top: 51 },
  { code: '2B', left: 62, top: 51 },
  { code: '3B', left: 25, top: 57 },
  { code: '1B', left: 75, top: 57 },
  { code: 'P', left: 50, top: 63 },
  { code: 'C', left: 50, top: 80 }
];

const OF = ['LF', 'CF', 'RF'];
const IF = ['1B', '2B', '3B', 'SS'];

function canPlay(player, position) {
  const matches = code => player.m === code || player.s.includes(code);
  if (OF.includes(position)) return matches('OF');
  return matches(position);
}

function weight(player, position) {
  if (player.m === position || (player.m === 'OF' && OF.includes(position))) return 2;
  return 1;
}

function weightedOrder(list, position) {
  const pool = [...list];
  const result = [];

  while (pool.length) {
    const total = pool.reduce((sum, p) => sum + weight(p, position), 0);
    let r = Math.random() * total;

    let index = pool.findIndex(p => {
      r -= weight(p, position);
      return r < 0;
    });

    if (index < 0) index = pool.length - 1;
    result.push(pool.splice(index, 1)[0]);
  }

  return result;
}

function createLineup(players) {
  const result = new Map();

  function solve(positions, remaining) {
    if (!positions.length) return true;

    const ranked = positions.map(pos => ({
      pos,
      candidates: remaining.filter(p => canPlay(p, pos.code))
    })).sort((a, b) => a.candidates.length - b.candidates.length);

    const target = ranked[0];
    if (!target.candidates.length) return false;

    for (const player of weightedOrder(target.candidates, target.pos.code)) {
      result.set(target.pos.code, player);

      const nextPlayers = remaining.filter(p => p !== player);
      const nextPositions = positions.filter(p => p !== target.pos);

      if (solve(nextPositions, nextPlayers)) return true;
      result.delete(target.pos.code);
    }

    return false;
  }

  return solve([...fieldPositions], [...players]) ? result : null;
}

// プレート画像の種類
function getPlate(player) {
  const group = position => {
    if (position === 'P') return 'p';
    if (position === 'C') return 'c';
    if (position === 'OF') return 'o';
    if (IF.includes(position)) return 'i';
    return null;
  };

  const main = group(player.m);
  const subs = [...new Set(player.s.map(group).filter(Boolean))];

  if (main === 'p') return 'p';

  if (main === 'i') {
    if (subs.includes('o')) return 'i_o';
    if (subs.includes('c')) return 'i_c';
    return 'i';
  }

  if (main === 'o') {
    if (subs.includes('i')) return 'o_i';
    return 'o';
  }

  if (main === 'c') {
    if (subs.includes('i')) return 'c_i';
    if (subs.includes('o')) return 'c_o';
    return 'c';
  }

  return 'i';
}

// 選手表示
function addPlayer(player, left, top, area = '') {
  const div = document.createElement('div');
  div.className = `player ${area}`;
  div.style.left = `${left}%`;
  div.style.top = `${top}%`;
  div.dataset.name = player.n;

  const img = document.createElement('img');
  img.src = `assets/${getPlate(player)}.gif`;
  img.alt = `${player.n} プレート`;

  img.onerror = () => {
    console.error('画像が見つかりません:', img.src);
    img.style.display = 'none';
  };

  const label = document.createElement('span');
  label.className = 'player-name';
  label.textContent = player.n;

  if (player.n.length >= 8) {
    label.classList.add('name-very-long');
  } else if (player.n.length >= 5) {
    label.classList.add('name-long');
  }

  div.append(img, label);

  div.addEventListener('click', () => {
    showToast(`${player.n}：プロフィールは今後実装予定`);
  });

  document.getElementById('stadium').appendChild(div);
}

function shuffle(list) {
  const a = [...list];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

// ベンチ：黒点に沿った左右5人ずつの配置
const benchLeftPositions = [
  [7, 63],
  [10, 68],
  [16, 73],
  [20, 77],
  [25, 82]
];

const benchRightPositions = [
  [90, 65],
  [87, 69],
  [85, 73],
  [81, 77],
  [75, 82]
];

function createBench(players) {
  const shuffled = shuffle(players);
  const left = [];
  const right = [];

  // 左右交互に分配して人数差を小さくする
  shuffled.forEach((player, i) => {
    if (i % 2 === 0) left.push(player);
    else right.push(player);
  });

  left.slice(0, 5).forEach((player, i) => {
    const [x, y] = benchLeftPositions[i];
    addPlayer(player, x, y, 'bench-player');
  });

  right.slice(0, 5).forEach((player, i) => {
    const [x, y] = benchRightPositions[i];
    addPlayer(player, x, y, 'bench-player');
  });
}

// ブルペン：左右のピンク色の区画
const bullpenPositions = [
  [7, 48],
  [10, 52],
  [96, 48],
  [94, 52]
];

function createBullpen(players) {
  const selected = shuffle(players).slice(0, 4);

  selected.forEach((player, i) => {
    const [x, y] = bullpenPositions[i];
    addPlayer(player, x, y, 'bullpen-player');
  });

  return selected;
}

// バッターズサークル：左右の白い円
function createBatterCircle(players) {
  if (!players.length) return null;

  const player = shuffle(players)[0];
  const leftSide = Math.random() < 0.5;

  addPlayer(
    player,
    leftSide ? 34 : 66,
    72,
    'batter-player'
  );

  return player;
}

async function loadPlayers() {
  try {
    const response = await fetch('data/players.json?v=20261124-4');

    if (!response.ok) {
      throw new Error('players.json 読み込み失敗');
    }

    const players = await response.json();
    const stadium = document.getElementById('stadium');
    stadium.innerHTML = '';

    const lineup = createLineup(players);

    if (!lineup) {
      showToast('守備配置を作れません。適性を確認してください');
      return;
    }

    const used = new Set();

    // スタメン9人
    fieldPositions.forEach(pos => {
      const player = lineup.get(pos.code);

      if (player) {
        used.add(player);
        addPlayer(player, pos.left, pos.top, 'field-player');
      }
    });

    let remaining = players.filter(p => !used.has(p));

    // ブルペン
    const pitchers = remaining.filter(p => p.m === 'P');
    const bullpen = createBullpen(pitchers);
    bullpen.forEach(p => used.add(p));

    // バッターズサークル
    remaining = players.filter(p => !used.has(p));
    const batters = remaining.filter(p => p.m !== 'P');

    const batter = createBatterCircle(batters);
    if (batter) used.add(batter);

    // ベンチ
    remaining = players.filter(p => !used.has(p));
    createBench(remaining);

  } catch (error) {
    console.error(error);
    showToast('選手データの読み込みに失敗しました');
  }
}

loadPlayers();

// 下部メニュー
document.querySelectorAll('.bottom-nav button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.bottom-nav button')
      .forEach(b => b.classList.remove('active'));

    button.classList.add('active');
    showToast(`${button.dataset.page} は今後実装予定です`);
  });
});

// メニューボタン
const menuBtn = document.getElementById('menuBtn');

if (menuBtn) {
  menuBtn.addEventListener('click', () => {
    showToast('メニューは今後追加します');
  });
}


const toast = document.getElementById('toast');
let toastTimer;
let allPlayers = [];
let featuredPlayer = null;
let currentWeather = null;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

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

// プレート画像を判定
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

// 選手を表示
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

  div.append(img, label);

  // 注目選手の表示
  if (player === featuredPlayer) {
    div.classList.add('featured');
    const badge = document.createElement('span');
    badge.className = 'featured-badge';
    badge.textContent = '注目';
    div.appendChild(badge);
  }

  // 名前をプレート内に収める
  function fitName() {
    label.style.fontSize = '12px';

    const maxWidth = div.clientWidth * 0.92;
    let size = 12;

    while (label.scrollWidth > maxWidth && size > 5) {
      size -= 0.5;
      label.style.fontSize = `${size}px`;
    }
  }

  div.addEventListener('click', () => {
    div.classList.toggle('player-selected');
    showToast(`${player.n}：プロフィールは今後実装予定`);
  });

  document.getElementById('stadium').appendChild(div);
  fitName();
}

// ランダム
function shuffle(list) {
  const a = [...list];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

// ベンチ配置
const benchLeftPositions = [
  [7, 63], [10, 68], [16, 73], [20, 77], [25, 82]
];

const benchRightPositions = [
  [90, 65], [87, 69], [85, 73], [81, 77], [75, 82]
];

function createBench(players) {
  const shuffled = shuffle(players);
  const left = [];
  const right = [];

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

// ブルペン
const bullpenPositions = [
  [7, 48], [10, 52], [96, 48], [94, 52]
];

function createBullpen(players) {
  const selected = shuffle(players).slice(0, 4);

  selected.forEach((player, i) => {
    const [x, y] = bullpenPositions[i];
    addPlayer(player, x, y, 'bullpen-player');
  });

  return selected;
}

// バッターズサークル
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

// 注目選手をランダム選出
function chooseFeaturedPlayer(players) {
  featuredPlayer = shuffle(players)[0];
}

// 球場メッセージ
const messages = [
  'プランクトンのたまご、本日も球場へ！',
  '今日の注目選手をチェックしよう。',
  '新しい配置でチームを眺めてみよう。',
  '球場には今日も選手たちが集まっています。',
  'あなたのチームの歴史を刻もう。',
  '今日もプランクトンのたまごを応援しよう！',
  'さあ、球場の様子を見てみよう！'
];

function showRandomMessage() {
  const message = shuffle(messages)[0];
  document.getElementById('stadiumMessage').textContent = message;
}

// 選手の配置を作り直す
function renderPlayers() {
  const stadium = document.getElementById('stadium');
  stadium.innerHTML = '';

  chooseFeaturedPlayer(allPlayers);

  const lineup = createLineup(allPlayers);

  if (!lineup) {
    showToast('守備配置を作れません。適性を確認してください');
    return;
  }

  const used = new Set();

  // スタメン
  fieldPositions.forEach(pos => {
    const player = lineup.get(pos.code);
    if (player) {
      used.add(player);
      addPlayer(player, pos.left, pos.top, `field-player ${pos.code}`);
    }
  });

  let remaining = allPlayers.filter(p => !used.has(p));

  // ブルペン
  const pitchers = remaining.filter(p => p.m === 'P');
  const bullpen = createBullpen(pitchers);
  bullpen.forEach(p => used.add(p));

  // バッターズサークル
  remaining = allPlayers.filter(p => !used.has(p));
  const batters = remaining.filter(p => p.m !== 'P');
  const batter = createBatterCircle(batters);
  if (batter) used.add(batter);

  // ベンチ
  remaining = allPlayers.filter(p => !used.has(p));
  createBench(remaining);
}

// 天候
const weatherList = [
  { type: 'sunny', name: '晴れ', icon: '☀️' },
  { type: 'cloudy', name: '曇り', icon: '☁️' },
  { type: 'rain', name: '雨', icon: '🌧️' },
  { type: 'snow', name: '雪', icon: '❄️' }
];

function setWeather(random = true) {
  if (random || !currentWeather) {
    currentWeather = shuffle(weatherList)[0];
  }

  const hour = new Date().getHours();
  const isNight = hour < 6 || hour >= 18;

  const area = document.getElementById('weatherArea');
  const main = document.getElementById('weatherMain');
  const name = document.getElementById('weatherName');
  const dayNight = document.getElementById('dayNight');

  area.className = `weather-area weather-${currentWeather.type} ${isNight ? 'night' : 'day'}`;
  main.textContent = isNight && currentWeather.type === 'sunny'
    ? '🌙'
    : currentWeather.icon;

  name.textContent = isNight && currentWeather.type === 'sunny'
    ? '晴れ・夜'
    : currentWeather.name;

  dayNight.textContent = isNight ? 'NIGHT' : 'DAY';
}

// 時計と日付
function updateClock() {
  const now = new Date();

  document.getElementById('realDate').textContent =
    now.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });

  document.getElementById('realClock').textContent =
    now.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

  // 昼夜の判定も更新
  setWeather(false);
}

// VLB年設定
function updateVlbYear() {
  const saved = localStorage.getItem('vlbYear');
  document.getElementById('vlbYear').textContent =
    saved ? `VLB ${saved}年` : 'VLB年 未設定';
}

document.getElementById('yearBtn').addEventListener('click', () => {
  const current = localStorage.getItem('vlbYear') || '';
  const value = prompt('VLBの年を入力してください（例：2047）', current);

  if (value === null) return;

  const cleaned = value.trim();

  if (!cleaned) {
    localStorage.removeItem('vlbYear');
  } else {
    localStorage.setItem('vlbYear', cleaned);
  }

  updateVlbYear();
  showToast(cleaned ? `VLB ${cleaned}年に設定しました` : 'VLB年を解除しました');
});

// ボタン
document.getElementById('rerollBtn').addEventListener('click', () => {
  renderPlayers();
  showRandomMessage();
  showToast('選手配置と注目選手を変更しました');
});

document.getElementById('weatherBtn').addEventListener('click', () => {
  setWeather(true);
  showToast(`天候を「${currentWeather.name}」に変更しました`);
});

// 初期化
async function init() {
  updateVlbYear();
  updateClock();
  setWeather(true);

  setInterval(updateClock, 1000);

  try {
    const response = await fetch('data/players.json?v=20261124-10');

    if (!response.ok) throw new Error('選手データ読み込み失敗');

    allPlayers = await response.json();
    renderPlayers();
    showRandomMessage();
  } catch (error) {
    console.error(error);
    showToast('選手データの読み込みに失敗しました');
  }
}

init();

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

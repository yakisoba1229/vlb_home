const toast = document.getElementById('toast');
let toastTimer;
let currentWeather;
let currentDayNight;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}


// 守備位置（球場画像に対する相対位置）
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
  const pool = [...list], result = [];
  while (pool.length) {
    const total = pool.reduce((sum, p) => sum + weight(p, position), 0);
    let r = Math.random() * total;
    let index = pool.findIndex(p => { r -= weight(p, position); return r < 0; });
    if (index < 0) index = pool.length - 1;
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}
function createLineup(players) {
  const result = new Map();
  function solve(positions, remaining) {
    if (!positions.length) return true;
    const ranked = positions.map(pos => ({ pos, candidates: remaining.filter(p => canPlay(p, pos.code)) }))
      .sort((a, b) => a.candidates.length - b.candidates.length);
    const target = ranked[0];
    if (!target.candidates.length) return false;
    for (const player of weightedOrder(target.candidates, target.pos.code)) {
      result.set(target.pos.code, player);
      if (solve(positions.filter(p => p !== target.pos), remaining.filter(p => p !== player))) return true;
      result.delete(target.pos.code);
    }
    return false;
  }
  return solve([...fieldPositions], [...players]) ? result : null;
}
function getPlate(player) {
  const group = pos => pos === 'P' ? 'p' : pos === 'C' ? 'c' : pos === 'OF' ? 'o' : IF.includes(pos) ? 'i' : null;
  const main = group(player.m);
  const subs = [...new Set(player.s.map(group).filter(Boolean))];
  if (main === 'p') return 'p';
  if (main === 'i') { if (subs.includes('o')) return 'i_o'; if (subs.includes('c')) return 'i_c'; return 'i'; }
  if (main === 'o') { if (subs.includes('i')) return 'o_i'; return 'o'; }
  if (main === 'c') { if (subs.includes('i')) return 'c_i'; if (subs.includes('o')) return 'c_o'; return 'c'; }
  return 'i';
}
function addPlayer(player, left, top, area = '') {
  const div = document.createElement('div');
  div.className = `player ${area}`;
  div.style.left = `${left}%`; div.style.top = `${top}%`; div.dataset.name = player.n;
  const img = document.createElement('img');
  img.src = `assets/${getPlate(player)}.gif`; img.alt = `${player.n}プレート`;
  img.onerror = () => { console.error('画像が見つかりません:', img.src); img.style.display = 'none'; };
  const label = document.createElement('span');
  label.className = 'player-name'; label.textContent = player.n;
  div.append(img, label);
  div.addEventListener('click', () => showToast(`${player.n}：プロフィールは今後実装予定`));
  document.getElementById('stadium').appendChild(div);
  // 描画後に名前幅を測り、プレート幅を超える場合だけ縮小
  requestAnimationFrame(() => {
    const available = div.clientWidth * 0.94;
    let fontSize = area.includes('field-player') ? 11 : 9;
    label.style.fontSize = `${fontSize}px`;
    while (label.scrollWidth > available && fontSize > 4) {
      fontSize -= 0.5;
      label.style.fontSize = `${fontSize}px`;
    }
  });
}
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// 球場画像内の左右ベンチ位置
const benchLeftPositions = [[7,63],[10,68],[16,73],[20,77],[25,82]];
const benchRightPositions = [[90,65],[87,69],[85,73],[81,77],[75,82]];
function createBench(players) {
  const shuffled = shuffle(players), left = [], right = [];
  shuffled.forEach((p, i) => (i % 2 === 0 ? left : right).push(p));
  left.slice(0,5).forEach((p,i) => addPlayer(p, ...benchLeftPositions[i], 'bench-player'));
  right.slice(0,5).forEach((p,i) => addPlayer(p, ...benchRightPositions[i], 'bench-player'));
}
const bullpenPositions = [[7,48],[10,52],[96,48],[94,52]];
function createBullpen(players) {
  const selected = shuffle(players).slice(0,4);
  selected.forEach((p,i) => addPlayer(p, ...bullpenPositions[i], 'bullpen-player'));
  return selected;
}
function createBatterCircle(players) {
  if (!players.length) return null;
  const p = shuffle(players)[0], side = Math.random() < 0.5;
  addPlayer(p, side ? 34 : 66, 72, 'batter-player');
  return p;
}
function renderPlayers(players) {
  const stadium = document.getElementById('stadium'); stadium.innerHTML = '';
  const lineup = createLineup(players);
  if (!lineup) { showToast('守備配置を作れません。適性を確認してください'); return; }
  const used = new Set();
  fieldPositions.forEach(pos => { const p = lineup.get(pos.code); if (p) { used.add(p); addPlayer(p, pos.left, pos.top, 'field-player'); } });
  let remaining = players.filter(p => !used.has(p));
  const bullpen = createBullpen(remaining.filter(p => p.m === 'P'));
  bullpen.forEach(p => used.add(p));
  remaining = players.filter(p => !used.has(p));
  const batter = createBatterCircle(remaining.filter(p => p.m !== 'P'));
  if (batter) used.add(batter);
  createBench(players.filter(p => !used.has(p)));
}

// 天候と昼夜はページを開くたびに独立してランダム
const weatherOptions = [
  { type: 'sunny', label: '晴れ' },
  { type: 'cloudy', label: '曇り' },
  { type: 'rain', label: '雨' },
  { type: 'snow', label: '雪' }
];
function setupSky() {
  currentWeather = shuffle(weatherOptions)[0];
  currentDayNight = Math.random() < 0.5 ? 'day' : 'night';
  const panel = document.getElementById('skyPanel');
  panel.dataset.weather = currentWeather.type;
  panel.dataset.time = currentDayNight;
  document.getElementById('weatherName').textContent = currentWeather.label;
  document.getElementById('dayNightName').textContent = currentDayNight === 'day' ? '昼' : '夜';
  const sunMoon = document.getElementById('sunMoon');
  sunMoon.textContent = currentDayNight === 'day' ? '☀' : '☾';
  document.getElementById('skyScene').classList.toggle('night', currentDayNight === 'night');
  createParticles(currentWeather.type, currentDayNight);
}
function createParticles(type, time) {
  const area = document.getElementById('weatherParticles');
  area.innerHTML = '';
  const stars = document.getElementById('skyStars');
  stars.innerHTML = '';
  if (time === 'night') {
    for (let i = 0; i < 18; i++) {
      const star = document.createElement('i'); star.className = 'star';
      star.style.left = `${Math.random()*100}%`; star.style.top = `${Math.random()*85}%`;
      star.style.animationDelay = `${Math.random()*3}s`; stars.appendChild(star);
    }
  }
  const count = type === 'rain' ? 42 : type === 'snow' ? 24 : 0;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('i'); particle.className = type === 'rain' ? 'drop' : 'flake';
    particle.style.left = `${Math.random()*100}%`;
    particle.style.animationDelay = `${Math.random()*2.8}s`;
    particle.style.animationDuration = `${type === 'rain' ? 0.55+Math.random()*0.65 : 3+Math.random()*5}s`;
    area.appendChild(particle);
  }
}
function updateClock() {
  const now = new Date();
  document.getElementById('realDate').textContent = now.toLocaleDateString('ja-JP', {month:'long',day:'numeric',weekday:'short'});
  document.getElementById('realClock').textContent = now.toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
// VLBは544年開始。毎週月曜22時に1年進める（端末内に保存）
const VLB_START_YEAR = 544;
function monday22Key(date) {
  const d = new Date(date); d.setHours(22,0,0,0);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  if (date.getDay() === 1 && date.getHours() < 22) d.setDate(d.getDate() - 7);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function updateVlbYear() {
  const now = new Date(), currentKey = monday22Key(now);
  let year = Number(localStorage.getItem('vlbYear') || VLB_START_YEAR);
  let lastKey = localStorage.getItem('vlbLastUpdate');
  if (!lastKey) { lastKey = currentKey; localStorage.setItem('vlbLastUpdate', lastKey); }
  else if (lastKey !== currentKey) {
    const last = new Date(`${lastKey}T22:00:00`), current = new Date(`${currentKey}T22:00:00`);
    const weeks = Math.max(0, Math.floor((current-last)/(7*24*60*60*1000)));
    year += weeks; localStorage.setItem('vlbYear', String(year)); localStorage.setItem('vlbLastUpdate', currentKey);
  }
  if (!localStorage.getItem('vlbYear')) localStorage.setItem('vlbYear', String(year));
  document.getElementById('vlbYear').textContent = `VLB ${year}年`;
}
async function init() {
  updateClock(); updateVlbYear(); setupSky();
  setInterval(() => { updateClock(); updateVlbYear(); }, 1000);
  try {
    const response = await fetch('data/players.json?v=20261124-11');
    if (!response.ok) throw new Error('選手データ読み込み失敗');
    const players = await response.json(); renderPlayers(players);
  } catch (error) { console.error(error); showToast('選手データの読み込みに失敗しました'); }
}
init();
document.querySelectorAll('.bottom-nav button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
  button.classList.add('active'); showToast(`${button.dataset.page} は今後実装予定です`);
}));
const menuBtn = document.getElementById('menuBtn');
if (menuBtn) menuBtn.addEventListener('click', () => showToast('メニューは今後追加します'));

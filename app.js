const toast = document.getElementById('toast');
let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
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
  const group = position => {
    if (position === 'P') return 'p';
    if (position === 'C') return 'c';
    if (position === 'OF') return 'o';
    if (IF.includes(position)) return 'i';
    return null;
  };
  const main = group(player.m), subs = [...new Set(player.s.map(group).filter(Boolean))];
  if (main === 'p') return 'p';
  if (main === 'i') { if (subs.includes('o')) return 'i_o'; if (subs.includes('c')) return 'i_c'; return 'i'; }
  if (main === 'o') { if (subs.includes('i')) return 'o_i'; return 'o'; }
  if (main === 'c') { if (subs.includes('i')) return 'c_i'; if (subs.includes('o')) return 'c_o'; return 'c'; }
  return 'i';
}

const playerRecords = [];
function addPlayer(player, left, top, area = '') {
  const div = document.createElement('div');
  div.className = `player ${area}`;
  div.style.left = `${left}%`;
  div.style.top = `${top}%`;
  div.dataset.name = player.n;

  const img = document.createElement('img');
  img.src = `assets/${getPlate(player)}.gif`;
  img.alt = `${player.n} プレート`;
  img.onerror = () => { console.error('画像が見つかりません:', img.src); img.style.display = 'none'; };

  const label = document.createElement('span');
  label.className = 'player-name';
  label.textContent = player.n;
  div.append(img, label);

  function fitName() {
    const isReserve = div.classList.contains('bench-player') || div.classList.contains('bullpen-player') || div.classList.contains('batter-player');
    const baseSize = isReserve ? 9 : 11;
    const minSize = isReserve ? 5.5 : 6.5;
    label.style.fontSize = `${baseSize}px`;
    const maxWidth = label.clientWidth;
    while (label.scrollWidth > maxWidth && parseFloat(label.style.fontSize) > minSize) {
      label.style.fontSize = `${parseFloat(label.style.fontSize) - 0.5}px`;
    }
  }

  div.addEventListener('click', () => showToast(`${player.n}：プロフィールは今後実装予定`));
  document.getElementById('stadium').appendChild(div);
  requestAnimationFrame(fitName);
  playerRecords.push({ player, div, left, top, area });
  return div;
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
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
  const player = shuffle(players)[0], side = Math.random() < .5;
  addPlayer(player, side ? 34 : 66, 72, 'batter-player');
  return player;
}

// 共通の短いセリフ。2～6人にランダムで表示します。
const speechLines = [
  'こんにちは！','元気！','ようこそ！','勝ちたい！','疲れた！','考え中…','ご飯食べたい',
  'いい天気だね','準備OK！','頑張ろう！','調子いいかも','眠い…','お腹すいた','やるぞ！',
  '落ち着いていこう','楽しみ！','絶好調！','少し休もう','今日もよろしく','集中！','いける！',
  'ナイスプレー！','いい感じ！','気合十分','水飲みたい','まだまだ！','応援ありがとう','勝利を目指そう！',
  '今日は何しよう','練習したい','ホーム最高！','わくわくする','ぼちぼち行こう','ちょっと緊張…','任せて！',
  '腹ペコです','いい夢見たい','頑張るぞー','気分上々！','無理せずね','声出していこう','やったるで！',
  'ここが好き','楽しんでいこう','休憩も大事','よし、行こう！','今日は勝つ！','いい予感！','平常心…','絶対負けない！'
];
function rectsOverlap(a, b, pad = 3) {
  return !(a.right + pad <= b.left || b.right + pad <= a.left || a.bottom + pad <= b.top || b.bottom + pad <= a.top);
}
function rectOf(el, bounds) {
  const r = el.getBoundingClientRect();
  return { left: r.left - bounds.left, top: r.top - bounds.top, right: r.right - bounds.left, bottom: r.bottom - bounds.top };
}
let speechTimer = null;
let speechHideTimer = null;
function clearSpeechBubbles() {
  clearTimeout(speechTimer);
  clearTimeout(speechHideTimer);
  document.querySelectorAll('.speech-bubble').forEach(b => b.remove());
}
function showSpeechCycle() {
  const stadium = document.getElementById('stadium');
  const bounds = stadium.getBoundingClientRect();
  if (!bounds.width || !bounds.height || !playerRecords.length) return;
  clearSpeechBubbles();

  const count = Math.min(playerRecords.length, 2 + Math.floor(Math.random() * 5));
  const selected = shuffle(playerRecords).slice(0, count);
  const occupied = playerRecords.map(r => ({ record: r, rect: rectOf(r.div, bounds) }));
  const placed = [];
  const bubbleW = Math.max(58, Math.min(88, bounds.width * 0.15));
  const bubbleH = 26;
  selected.forEach(record => {
    const playerBox = rectOf(record.div, bounds);
    const cx = (playerBox.left + playerBox.right) / 2;
    const options = [
      { x: cx, y: playerBox.top - 5, side: 'above' },
      { x: cx - bubbleW * 0.20, y: playerBox.top - 5, side: 'above' },
      { x: cx + bubbleW * 0.20, y: playerBox.top - 5, side: 'above' },
      { x: cx, y: playerBox.bottom + bubbleH + 6, side: 'below' },
      { x: cx - bubbleW * 0.22, y: playerBox.bottom + bubbleH + 6, side: 'below' },
      { x: cx + bubbleW * 0.22, y: playerBox.bottom + bubbleH + 6, side: 'below' }
    ];
    let chosen = null;
    for (const option of options) {
      let left = option.x - bubbleW / 2;
      let top = option.side === 'above' ? option.y - bubbleH : option.y - bubbleH;
      left = Math.max(3, Math.min(bounds.width - bubbleW - 3, left));
      top = Math.max(3, Math.min(bounds.height - bubbleH - 3, top));
      const box = { left, top, right: left + bubbleW, bottom: top + bubbleH };
      // A bubble may overlap its speaker's plate slightly only if no clear slot exists;
      // otherwise avoid other players and already displayed bubbles.
      const overlapsSpeaker = rectsOverlap(box, playerBox, 2);
      const overlapsOtherPlayer = occupied.some(item => item.record !== record && rectsOverlap(box, item.rect, 2));
      const overlapsBubble = placed.some(r => rectsOverlap(box, r, 3));
      if (!overlapsSpeaker && !overlapsOtherPlayer && !overlapsBubble) { chosen = box; break; }
    }
    if (!chosen) {
      // Keep the bubble near its own player, never outside the stadium.
      let left = Math.max(3, Math.min(bounds.width - bubbleW - 3, cx - bubbleW / 2));
      let top = Math.max(3, playerBox.top - bubbleH - 7);
      if (top < 3) top = Math.min(bounds.height - bubbleH - 3, playerBox.bottom + 7);
      chosen = { left, top, right: left + bubbleW, bottom: top + bubbleH };
    }
    placed.push(chosen);
    const bubble = document.createElement('div');
    bubble.className = 'speech-bubble';
    bubble.textContent = shuffle(speechLines)[0];
    bubble.dataset.speaker = record.player.n;
    bubble.style.left = `${chosen.left + bubbleW / 2}px`;
    bubble.style.top = `${chosen.top}px`;
    bubble.style.width = `${bubbleW}px`;
    stadium.appendChild(bubble);
    requestAnimationFrame(() => bubble.classList.add('bubble-visible'));
  });
  // Show for 3 seconds, then hide briefly and pick a new random group.
  speechHideTimer = setTimeout(() => {
    document.querySelectorAll('.speech-bubble').forEach(b => b.classList.remove('bubble-visible'));
    speechTimer = setTimeout(showSpeechCycle, 700 + Math.random() * 500);
  }, 3000);
}

async function loadPlayers() {
  try {
    const response=await fetch('data/players.json?v=20261124-5');
    if(!response.ok) throw new Error('players.json 読み込み失敗');
    const players=await response.json(), stadium=document.getElementById('stadium');
    stadium.innerHTML=''; playerRecords.length=0;
    const lineup=createLineup(players);
    if(!lineup){showToast('守備配置を作れません。適性を確認してください');return;}
    const used=new Set();
    fieldPositions.forEach(pos=>{const p=lineup.get(pos.code);if(p){used.add(p);addPlayer(p,pos.left,pos.top,'field-player');}});
    let remaining=players.filter(p=>!used.has(p));
    const bullpen=createBullpen(remaining.filter(p=>p.m==='P')); bullpen.forEach(p=>used.add(p));
    remaining=players.filter(p=>!used.has(p));
    const batter=createBatterCircle(remaining.filter(p=>p.m!=='P')); if(batter)used.add(batter);
    createBench(players.filter(p=>!used.has(p)));
    requestAnimationFrame(() => showSpeechCycle());
  } catch(error) {console.error(error);showToast('選手データの読み込みに失敗しました');}
}
loadPlayers();
document.querySelectorAll('.bottom-nav button').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.remove('active'));
  button.classList.add('active'); showToast(`${button.dataset.page} は今後実装予定です`);
}));
const menuBtn=document.getElementById('menuBtn');
if(menuBtn) menuBtn.addEventListener('click',()=>showToast('メニューは今後追加します'));

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
  div.style.left = `${left}%`; div.style.top = `${top}%`; div.dataset.name = player.n;
  const img = document.createElement('img');
  img.src = `assets/${getPlate(player)}.gif`; img.alt = `${player.n} プレート`;
  img.onerror = () => { console.error('画像が見つかりません:', img.src); img.style.display = 'none'; };
  const label = document.createElement('span');
  label.className = 'player-name'; label.textContent = player.n;
  div.append(img, label);
  div.addEventListener('click', () => showToast(`${player.n}：プロフィールは今後実装予定`));
  document.getElementById('stadium').appendChild(div);
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
function rectsOverlap(a,b,pad=4) {
  return !(a.right + pad <= b.left || b.right + pad <= a.left || a.bottom + pad <= b.top || b.bottom + pad <= a.top);
}
function playerRect(record, stadiumRect) {
  const rect = record.div.getBoundingClientRect();
  return { left: rect.left-stadiumRect.left, top: rect.top-stadiumRect.top, right: rect.right-stadiumRect.left, bottom: rect.bottom-stadiumRect.top };
}
function addSpeechBubbles() {
  const stadium = document.getElementById('stadium'), bounds = stadium.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const count = Math.min(playerRecords.length, 2 + Math.floor(Math.random()*5)); // 2～6人
  const selected = shuffle(playerRecords).slice(0,count);
  const placed = [];
  const playerRects = playerRecords.map(r => playerRect(r,bounds));
  const bubbleW = Math.max(68, Math.min(116, bounds.width * 0.19));
  const bubbleH = 34;
  const candidates = [
    [0,-1.35],[-1.1,-1.1],[1.1,-1.1],[-1.35,0],[1.35,0],[-.9,1.15],[.9,1.15],[0,1.4]
  ];
  selected.forEach((record,index) => {
    const baseX = record.left/100*bounds.width, baseY=record.top/100*bounds.height;
    const phrase = shuffle(speechLines)[0];
    let chosen = null;
    for (const [dx,dy] of shuffle(candidates)) {
      const x = baseX + dx*(bubbleW*.58), y = baseY + dy*(bubbleH*.8);
      const box = {left:x-bubbleW/2, right:x+bubbleW/2, top:y-bubbleH/2, bottom:y+bubbleH/2};
      if (box.left<3 || box.right>bounds.width-3 || box.top<3 || box.bottom>bounds.height-3) continue;
      if (playerRects.some(r => rectsOverlap(box,r,3))) continue;
      if (placed.some(r => rectsOverlap(box,r,5))) continue;
      chosen=box; break;
    }
    // 位置が確保できない場合は、プレート直上に寄せる。密集時のみ重なる可能性あり。
    if (!chosen) chosen={left:Math.max(2,Math.min(bounds.width-bubbleW-2,baseX-bubbleW/2)),top:Math.max(2,baseY-bubbleH-42),right:0,bottom:0};
    chosen.right=chosen.left+bubbleW; chosen.bottom=chosen.top+bubbleH; placed.push(chosen);
    const bubble=document.createElement('div'); bubble.className='speech-bubble'; bubble.textContent=phrase;
    bubble.style.left=`${chosen.left/bounds.width*100}%`; bubble.style.top=`${chosen.top/bounds.height*100}%`; bubble.style.width=`${bubbleW}px`;
    bubble.dataset.speaker=record.player.n;
    stadium.appendChild(bubble);
  });
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
    requestAnimationFrame(()=>addSpeechBubbles());
  } catch(error) {console.error(error);showToast('選手データの読み込みに失敗しました');}
}
loadPlayers();
document.querySelectorAll('.bottom-nav button').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.remove('active'));
  button.classList.add('active'); showToast(`${button.dataset.page} は今後実装予定です`);
}));
const menuBtn=document.getElementById('menuBtn');
if(menuBtn) menuBtn.addEventListener('click',()=>showToast('メニューは今後追加します'));

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
function getOutfieldScore(player) {
  if (!player) return 0;
  const apiMap = window.VLBProfile && typeof window.VLBProfile.getCachedMap === 'function'
    ? window.VLBProfile.getCachedMap()
    : null;
  const apiPlayer = apiMap ? apiMap.get(player.n) : null;
  if (apiPlayer && apiPlayer.abilities) {
    const spd = Number(apiPlayer.abilities['走力'] && apiPlayer.abilities['走力'].value) || 0;
    const def = Number(apiPlayer.abilities['守備'] && apiPlayer.abilities['守備'].value) || 0;
    const arm = Number(apiPlayer.abilities['肩力'] && apiPlayer.abilities['肩力'].value) || 0;
    return spd + (def + arm) / 2;
  }
  return Number(player.of) || 0;
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
  if (!solve([...fieldPositions], [...players])) return null;
  const ofPlayers = ['CF', 'RF', 'LF'].map(code => result.get(code)).filter(Boolean);
  if (ofPlayers.length === 3) {
    const sorted = ofPlayers
      .map(p => ({ p, score: getOutfieldScore(p), tie: Math.random() }))
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.tie - b.tie));
    result.set('CF', sorted[0].p);
    result.set('RF', sorted[1].p);
    result.set('LF', sorted[2].p);
  }
  return result;
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
const playerRecords = [];
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
  playerRecords.push({ player, div, left, top, area });
  // VLB本編のプレート表記を意識し、文字は控えめなサイズ＋左右対称の余白。
  // CSSで名前欄の幅を固定し、文字が収まらない場合だけ縮小する。
  requestAnimationFrame(() => {
    const isReserve = /bench-player|bullpen-player|batter-player/.test(area);
    let fontSize = isReserve ? 7 : 9;
    label.style.fontSize = `${fontSize}px`;
    const available = label.clientWidth;
    while (label.scrollWidth > available && fontSize > 4) {
      fontSize -= 0.25;
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
  stopSpeech(); playerRecords.length = 0;
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
  startSpeech();
}

// --- 選手の吹き出し（重なっても選手が見える半透明表示） ---
const speechLines = [
  'こんにちは！','元気！','ようこそ！','勝ちたい！','疲れた！','考え中…','ご飯食べたい',
  'いい天気だね','準備OK！','頑張ろう！','調子いいかも','眠い…','お腹すいた','やるぞ！',
  '落ち着いていこう','楽しみ！','絶好調！','少し休もう','今日もよろしく','集中！','いける！',
  'ナイスプレー！','いい感じ！','気合十分','水飲みたい','まだまだ！','応援ありがとう','勝利を目指そう！',
  '今日は何しよう','練習したい','ホーム最高！','わくわくする','ぼちぼち行こう','ちょっと緊張…','任せて！',
  '腹ペコです','いい夢見たい','頑張るぞー','気分上々！','無理せずね','声出していこう','やったるで！',
  'ここが好き','楽しんでいこう','休憩も大事','よし、行こう！','今日は勝つ！','いい予感！','平常心…','絶対負けない！'
];let speechTimer = null;
let speechHideTimer = null;
function stopSpeech() {
  clearTimeout(speechTimer); clearTimeout(speechHideTimer);
  document.querySelectorAll('.speech-bubble').forEach(b => b.remove());
}
function rectOverlap(a,b,pad=2) {
  return !(a.right+pad<=b.left || b.right+pad<=a.left || a.bottom+pad<=b.top || b.bottom+pad<=a.top);
}
function elementRect(el, stadiumRect) {
  const r=el.getBoundingClientRect();
  return {left:r.left-stadiumRect.left, top:r.top-stadiumRect.top, right:r.right-stadiumRect.left, bottom:r.bottom-stadiumRect.top};
}
function showSpeechCycle() {
  const stadium=document.getElementById('stadium');
  const bounds=stadium.getBoundingClientRect();
  if(!bounds.width || !bounds.height || !playerRecords.length) return;
  document.querySelectorAll('.speech-bubble').forEach(b=>b.remove());
  const count=Math.min(playerRecords.length,2+Math.floor(Math.random()*5));
  const selected=shuffle(playerRecords).slice(0,count);
  const playerRects=playerRecords.map(r=>({record:r,rect:elementRect(r.div,bounds)}));
  const placed=[];
  const bubbleW=Math.max(48,Math.min(72,bounds.width*.12));
  const bubbleH=25;
  selected.forEach(record=>{
    const pr=elementRect(record.div,bounds);
    const cx=(pr.left+pr.right)/2;
    const gap=4;
    const candidates=[
      {x:cx,y:pr.top-bubbleH-gap},
      {x:cx-bubbleW*.25,y:pr.top-bubbleH-gap},
      {x:cx+bubbleW*.25,y:pr.top-bubbleH-gap},
      {x:cx-bubbleW*.42,y:pr.top-bubbleH-gap},
      {x:cx+bubbleW*.42,y:pr.top-bubbleH-gap},
      {x:cx,y:pr.bottom+gap},
      {x:cx-bubbleW*.25,y:pr.bottom+gap},
      {x:cx+bubbleW*.25,y:pr.bottom+gap}
    ];
    let chosen=null;
    for(const c of candidates){
      let left=Math.max(2,Math.min(bounds.width-bubbleW-2,c.x-bubbleW/2));
      let top=Math.max(2,Math.min(bounds.height-bubbleH-2,c.y));
      const box={left,top,right:left+bubbleW,bottom:top+bubbleH};
      const overlapsOther=playerRects.some(item=>item.record!==record && rectOverlap(box,item.rect,1));
      const overlapsBubble=placed.some(b=>rectOverlap(box,b,2));
      if(!overlapsOther && !overlapsBubble){chosen=box;break;}
    }
    if(!chosen){
      // 密集区域では対象選手の中心を基準に、画面内へ収めた位置に出す。
      const left=Math.max(2,Math.min(bounds.width-bubbleW-2,cx-bubbleW/2));
      let top=pr.top-bubbleH-3;
      if(top<2) top=Math.min(bounds.height-bubbleH-2,pr.bottom+3);
      chosen={left,top,right:left+bubbleW,bottom:top+bubbleH};
    }
    placed.push(chosen);
    const bubble=document.createElement('div');
    bubble.className='speech-bubble';
    bubble.textContent=shuffle(speechLines)[0];
    bubble.dataset.speaker=record.player.n;
    bubble.style.left=`${chosen.left+bubbleW/2}px`;
    bubble.style.top=`${chosen.top}px`;
    bubble.style.width=`${bubbleW}px`;
    stadium.appendChild(bubble);
    requestAnimationFrame(()=>bubble.classList.add('bubble-visible'));
  });
  speechHideTimer=setTimeout(()=>{
    document.querySelectorAll('.speech-bubble').forEach(b=>b.classList.remove('bubble-visible'));
    speechTimer=setTimeout(showSpeechCycle,1200+Math.random()*1800);
  },3500);
}
function startSpeech() { stopSpeech(); requestAnimationFrame(showSpeechCycle); }


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
    const response = await fetch('data/players.json?v=20261124-13');
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

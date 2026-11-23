const toast = document.getElementById('toast');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// 球場の守備位置
const positions = [
  { name: '中堅手', className: 'p-cf' },
  { name: '左翼手', className: 'p-lf' },
  { name: '右翼手', className: 'p-rf' },
  { name: '遊撃手', className: 'p-ss' },
  { name: '二塁手', className: 'p-2b' },
  { name: '三塁手', className: 'p-3b' },
  { name: '一塁手', className: 'p-1b' },
  { name: '投手', className: 'p-p' },
  { name: '捕手', className: 'p-c' }
];

// 守備位置に固定する選手ID
const fixedPlayers = {
  '捕手': 'player001',
  '一塁手': 'player002',
  '中堅手': 'player003',
  '左翼手': 'player004',
  '右翼手': 'player005',
  '遊撃手': 'player006',
  '二塁手': 'player007',
  '三塁手': 'player008',
  '投手': 'player009'
};

// 選手を球場に配置
function createPlayer(player, position, usedPlayers) {
  const div = document.createElement('div');
  const idleTypes = ['idle-a', 'idle-b', 'idle-c', 'idle-d'];

const idleIndex = parseInt(player.id.replace('player', ''), 10) % idleTypes.length;

div.className = `player ${position.className} ${idleTypes[idleIndex]}`;
  div.dataset.player = player.name;
  div.dataset.playerId = player.id;

  const img = document.createElement('img');
  img.src = `assets/${player.image}`;
  img.alt = player.name;

  const name = document.createElement('span');
  name.textContent = player.name;

  div.appendChild(img);
  div.appendChild(name);

  div.addEventListener('click', () => {
    showToast(`${player.name}：プロフィール画面はこれから実装します`);
  });

  document.getElementById('stadium').appendChild(div);
  usedPlayers.add(player.id);
}

// 選手データを読み込んで固定配置
async function loadPlayers() {
  try {
    const response = await fetch('data/players.json');
    if (!response.ok) {
      throw new Error('選手データの読み込みに失敗');
    }

    const players = await response.json();
    const usedPlayers = new Set();

    // 指定された選手を各守備位置に配置
    positions.forEach(position => {
      const playerId = fixedPlayers[position.name];
      const player = players.find(p => p.id === playerId);

      if (!player) {
        console.warn(`${position.name}の選手が見つかりません`);
        return;
      }

      createPlayer(player, position, usedPlayers);
    });

    // ベンチ選手
    const benchPlayer = players.find(p => p.id === 'player010');

    if (benchPlayer) {
      createPlayer(
        benchPlayer,
        { name: 'ベンチ', className: 'p-bench' },
        usedPlayers
      );
    }

  } catch (error) {
    console.error(error);
    showToast('選手データを読み込めませんでした');
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
document.getElementById('menuBtn').addEventListener('click', () => {
  showToast('メニューは今後追加します');
});

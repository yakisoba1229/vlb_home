
const toast = document.getElementById('toast');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ポジションと球場内の配置クラス
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

// ランダムに選手を選ぶ
function randomPlayer(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// 選手を球場に配置
function createPlayer(player, position, usedPlayers) {
  const div = document.createElement('div');
  div.className = `player ${position.className}`;
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

// 選手データを読み込んで配置
async function loadPlayers() {
  try {
    const response = await fetch('data/players.json');
    if (!response.ok) throw new Error('選手データの読み込みに失敗');

    const players = await response.json();
    const usedPlayers = new Set();

    // 各ポジションに選手を配置
    positions.forEach(position => {
      const candidates = players.filter(player =>
        player.position.includes(position.name) &&
        !usedPlayers.has(player.id)
      );

      if (candidates.length === 0) return;

      const selected = randomPlayer(candidates);
      createPlayer(selected, position, usedPlayers);
    });

    // ベンチに残り選手から1人配置
    const benchCandidates = players.filter(player =>
      !usedPlayers.has(player.id)
    );

    if (benchCandidates.length > 0) {
      const selected = randomPlayer(benchCandidates);
      createPlayer(selected, { name: 'ベンチ', className: 'p-bench' }, usedPlayers);
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

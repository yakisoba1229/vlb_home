
const toast = document.getElementById('toast');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 1800);
}

// 守備位置
const fieldPositions = [
  { code: 'CF', name: '中堅手', className: 'p-cf' },
  { code: 'LF', name: '左翼手', className: 'p-lf' },
  { code: 'RF', name: '右翼手', className: 'p-rf' },
  { code: 'SS', name: '遊撃手', className: 'p-ss' },
  { code: '2B', name: '二塁手', className: 'p-2b' },
  { code: '3B', name: '三塁手', className: 'p-3b' },
  { code: '1B', name: '一塁手', className: 'p-1b' },
  { code: 'P', name: '投手', className: 'p-p' },
  { code: 'C', name: '捕手', className: 'p-c' }
];

const outfieldCodes = ['LF', 'CF', 'RF'];
const infieldCodes = ['1B', '2B', '3B', 'SS'];

// 適性があるか
function canPlay(player, code) {
  const mainOK =
    player.m === code ||
    (player.m === 'OF' && outfieldCodes.includes(code));

  const subOK =
    player.s.includes(code) ||
    (player.s.includes('OF') && outfieldCodes.includes(code));

  return mainOK || subOK;
}

// メイン適性なら2倍の重み
function positionWeight(player, code) {
  const mainOK =
    player.m === code ||
    (player.m === 'OF' && outfieldCodes.includes(code));

  return mainOK ? 2 : 1;
}

// 重み付きでランダムに並べる
function weightedShuffle(items, weightFunction) {
  const pool = [...items];
  const result = [];

  while (pool.length) {
    const total = pool.reduce(
      (sum, item) => sum + weightFunction(item),
      0
    );

    let random = Math.random() * total;
    let selectedIndex = 0;

    for (let i = 0; i < pool.length; i++) {
      random -= weightFunction(pool[i]);

      if (random <= 0) {
        selectedIndex = i;
        break;
      }
    }

    result.push(pool.splice(selectedIndex, 1)[0]);
  }

  return result;
}

// 9つの守備位置を重複なく埋める
function makeStartingLineup(players) {
  const assignments = new Map();

  function search(remainingPositions, remainingPlayers) {
    if (remainingPositions.length === 0) {
      return true;
    }

    // 候補が少ない守備位置から決める
    const candidatesByPosition = remainingPositions.map(position => ({
      position,
      candidates: remainingPlayers.filter(player =>
        canPlay(player, position.code)
      )
    }));

    candidatesByPosition.sort(
      (a, b) => a.candidates.length - b.candidates.length
    );

    const selected = candidatesByPosition[0];

    if (selected.candidates.length === 0) {
      return false;
    }

    const orderedCandidates = weightedShuffle(
      selected.candidates,
      player => positionWeight(player, selected.position.code)
    );

    for (const player of orderedCandidates) {
      assignments.set(selected.position.code, player);

      const nextPlayers = remainingPlayers.filter(
        p => p !== player
      );

      const nextPositions = remainingPositions.filter(
        p => p.code !== selected.position.code
      );

      if (search(nextPositions, nextPlayers)) {
        return true;
      }

      assignments.delete(selected.position.code);
    }

    return false;
  }

  const success = search(fieldPositions, players);

  return success ? assignments : null;
}

// メイン・サブからプレート画像名を決める
function getPlate(player) {
  const group = position => {
    if (position === 'P') return 'p';
    if (position === 'C') return 'c';
    if (position === 'OF') return 'o';
    if (infieldCodes.includes(position)) return 'i';
    return null;
  };

  const mainGroup = group(player.m);
  const subGroups = [...new Set(player.s.map(group).filter(Boolean))];

  if (mainGroup === 'p') return 'p';

  if (mainGroup === 'i') {
    if (subGroups.includes('o')) return 'i_o';
    if (subGroups.includes('c')) return 'i_c';
    return 'i';
  }

  if (mainGroup === 'o') {
    if (subGroups.includes('i')) return 'o_i';
    return 'o';
  }

  if (mainGroup === 'c') {
    if (subGroups.includes('i')) return 'c_i';
    if (subGroups.includes('o')) return 'c_o';
    return 'c';
  }

  return 'i';
}

// 選手プレートを作る
function createPlayer(player, position, usedPlayers) {
  const div = document.createElement('div');

  div.className = `player ${position.className}`;
  div.dataset.player = player.n;

  if (position.left !== undefined) {
    div.style.left = position.left + '%';
    div.style.top = position.top + '%';
  }

  const img = document.createElement('img');
  img.src = `assets/${getPlate(player)}.png`;
  img.alt = '';

  img.onerror = () => {
    console.error('プレート画像が見つかりません:', img.src);
  };

  const name = document.createElement('span');
  name.className = 'player-name';
  name.textContent = player.n;

  div.appendChild(img);
  div.appendChild(name);

  div.addEventListener('click', () => {
    showToast(`${player.n}：プロフィール画面はこれから実装します`);
  });

  document.getElementById('stadium').appendChild(div);
  usedPlayers.add(player);
}

// ランダムな並びにする
function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

// ベンチを左右に分ける
function createBench(players, usedPlayers) {
  const shuffled = shuffle(players);

  const leftCount = Math.ceil(shuffled.length / 2);
  const leftPlayers = shuffled.slice(0, leftCount);
  const rightPlayers = shuffled.slice(leftCount);

  function addSide(list, side) {
    list.slice(0, 5).forEach((player, index) => {
      createPlayer(
        player,
        {
          className: 'p-extra p-bench',
          left: side === 'left' ? 7 : 93,
          top: 36 + index * 9
        },
        usedPlayers
      );
    });
  }

  addSide(leftPlayers, 'left');
  addSide(rightPlayers, 'right');
}

// ブルペンを左右2人ずつ配置
function createBullpen(players, usedPlayers) {
  const selected = shuffle(players).slice(0, 4);

  selected.forEach((player, index) => {
    const side = index < 2 ? 'left' : 'right';
    const sideIndex = index % 2;

    createPlayer(
      player,
      {
        className: 'p-extra p-bullpen',
        left: side === 'left' ? 19 : 81,
        top: 78 + sideIndex * 9
      },
      usedPlayers
    );
  });

  return selected;
}

// バッターズサークル
function createBatterCircle(players, usedPlayers) {
  if (!players.length) return;

  const player = shuffle(players)[0];

  createPlayer(
    player,
    {
      className: 'p-extra p-batter',
      left: 50,
      top: 92
    },
    usedPlayers
  );
}

// 選手データを読み込む
async function loadPlayers() {
  try {
    const response = await fetch('data/players.json');

    if (!response.ok) {
      throw new Error('選手データの読み込みに失敗');
    }

    const players = await response.json();
    const stadium = document.getElementById('stadium');

    stadium.innerHTML = '';

    // 守備位置を抽選
    const lineup = makeStartingLineup(players);

    if (!lineup) {
      showToast('守備位置を埋められません。適性を確認してください');
      return;
    }

    const usedPlayers = new Set();

    // スターティングメンバー
    fieldPositions.forEach(position => {
      const player = lineup.get(position.code);

      if (player) {
        createPlayer(player, position, usedPlayers);
      }
    });

    // 残りの選手
    const remaining = players.filter(
      player => !usedPlayers.has(player)
    );

    // ブルペン：残り投手から4人
    const remainingPitchers = remaining.filter(
      player => player.m === 'P'
    );

    const bullpen = createBullpen(
      remainingPitchers,
      usedPlayers
    );

    // バッターズサークル：残り野手から1人
    const remainingFielders = remaining.filter(
      player => player.m !== 'P' && player.m !== null
    );

    createBatterCircle(remainingFielders, usedPlayers);

    // ここまでで選ばれなかった選手をベンチへ
    const benchPlayers = players.filter(
      player => !usedPlayers.has(player)
    );

    createBench(benchPlayers, usedPlayers);

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

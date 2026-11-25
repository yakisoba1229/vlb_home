(() => {
  'use strict';

  const GAS_API_URL =
    'https://script.google.com/macros/s/AKfycbxVGCfng-H-4cpQmLLzt-EQYMjgaJuDIhhtJgVPeCCxooV27Mgt2z4vaU5d72VsHFgS/exec';
  const JSONP_TIMEOUT_MS = 12000;
  const ABILITY_FULL_VALUE = 21;
  const SPEED_ZERO_BASE = 141; // 実データ: 148=C+(7), 159=SS(18)

  // スクリーンショット準拠の能力ランク色（評価の色は別管理）
  const ABILITY_RANK_COLORS = {
    G: '#92a0b6',
    F: '#bf82fb',
    E: '#74d586',
    'E+': '#5ec771',
    D: '#e8d460',
    'D+': '#dec444',
    C: '#e6934e',
    'C+': '#dc8238',
    'B-': '#ee8793',
    B: '#e87886',
    'B+': '#de6474',
    'A-': '#eb89bf',
    A: '#e479b3',
    'A+': '#d962a3',
    'S-': '#a9bacb',
    S: '#bccad8',
    'S+': '#cfdbe8',
    'SS-': '#ffe88a',
    SS: '#fff2a6',
    'SS+': '#fff8cc',
    SSS: '#c9e8ff',
  };

  // 特殊能力の分離・分類辞書（今後ここを編集するだけで分類や表記を簡単に調整可能）
  const SPECIAL_ABILITY_DICT = {
    good: [
      '対ピンチ◯', '対ピンチ○', '対ピンチ〇',
      'サブポジ◯', 'サブポジ○', 'サブポジ〇',
      'チャンス◯', 'チャンス○', 'チャンス〇',
      'クイック◯', 'クイック○', 'クイック〇',
      'ランナー◯', 'ランナー○', 'ランナー〇',
      '選球眼◯', '選球眼○', '選球眼〇',
      'ピンチ◯', 'ピンチ○', 'ピンチ〇',
      'バント◯', 'バント○', 'バント〇',
      '対左◯', '対左○', '対左〇',
      '盗塁◯', '盗塁○', '盗塁〇',
      '逆境◯', '逆境○', '逆境〇',
      '内野安打', 'サヨナラ', '尻上がり',
      '勝ち運', '安定感', '選球眼',
      '重い玉', '重い球', '逃げ玉', '逃げ球',
      '満塁', '牽制',
    ],
    bad: [
      'スロースターター',
      '対ピンチ✕', '対ピンチ×',
      'チャンス✕', 'チャンス×',
      'クイック✕', 'クイック×',
      'ランナー✕', 'ランナー×',
      'ピンチ✕', 'ピンチ×',
      '対左✕', '対左×',
      '盗塁✕', '盗塁×',
      '寸前✕', '寸前×',
      '一発病', 'エラー', '四球', '三振',
    ],
    neutral: ['ムラッ気', 'ムラっ気'],
  };

  const SPECIAL_RULES = [
    ...SPECIAL_ABILITY_DICT.good.map((text) => ({ text, kind: 'good' })),
    ...SPECIAL_ABILITY_DICT.bad.map((text) => ({ text, kind: 'bad' })),
    ...SPECIAL_ABILITY_DICT.neutral.map((text) => ({ text, kind: 'neutral' })),
  ].sort((a, b) => b.text.length - a.text.length);

  let cachedPlayersMap = null;
  let cachedPlayersList = null;
  let pendingFetchPromise = null;
  let currentPlayerName = '';
  let previousBodyOverflow = '';

  let backdropEl = null;
  let modalEl = null;
  let plateImgEl = null;
  let plateNameEl = null;
  let eyebrowEl = null;
  let typeCornerEl = null;
  let positionHeaderEl = null;
  let bodyEl = null;
  let closeBtnEl = null;

  function fetchPlayersViaJsonp() {
    if (cachedPlayersMap && cachedPlayersList) {
      return Promise.resolve({ map: cachedPlayersMap, list: cachedPlayersList });
    }
    if (pendingFetchPromise) {
      return pendingFetchPromise;
    }

    pendingFetchPromise = new Promise((resolve, reject) => {
      const callbackName = `__vlbProfileCb_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
      const script = document.createElement('script');
      let finished = false;

      const cleanup = () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        try {
          delete window[callbackName];
        } catch (_) {
          window[callbackName] = undefined;
        }
      };

      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        cleanup();
        pendingFetchPromise = null;
        reject(new Error('選手データの取得がタイムアウトしました'));
      }, JSONP_TIMEOUT_MS);

      window[callbackName] = (payload) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        cleanup();

        const list = payload && Array.isArray(payload.players) ? payload.players : null;
        if (!list) {
          pendingFetchPromise = null;
          reject(new Error('選手データの形式が正しくありません'));
          return;
        }

        const map = new Map();
        const orderedList = [];
        list.forEach((player) => {
          if (player && typeof player.name === 'string') {
            map.set(player.name.trim(), player);
            orderedList.push(player);
          }
        });
        cachedPlayersMap = map;
        cachedPlayersList = orderedList;
        pendingFetchPromise = null;
        resolve({ map, list: orderedList });
      };

      script.onerror = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        cleanup();
        pendingFetchPromise = null;
        reject(new Error('選手データの通信に失敗しました'));
      };

      const sep = GAS_API_URL.includes('?') ? '&' : '?';
      script.src = `${GAS_API_URL}${sep}callback=${encodeURIComponent(callbackName)}`;
      script.async = true;
      document.head.appendChild(script);
    });

    return pendingFetchPromise;
  }

  function positionToGroup(pos) {
    if (!pos) return null;
    const p = String(pos).trim();
    if (p === 'P') return 'p';
    if (p === '捕' || p === 'C') return 'c';
    if (p === '外' || p === 'OF') return 'o';
    if (['一', '二', '三', '遊', '1B', '2B', '3B', 'SS'].includes(p)) return 'i';
    return null;
  }

  function getPlateFromApi(player) {
    if (!player) return 'i';
    const main = positionToGroup(player.position);
    const subParts = String(player.subPosition || '')
      .split(/[\n\r,、/]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const subs = [...new Set(subParts.map(positionToGroup).filter(Boolean))];

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

  function fitPlateNameFontSize() {
    if (!plateNameEl) return;
    requestAnimationFrame(() => {
      let fontSize = 13;
      plateNameEl.style.fontSize = `${fontSize}px`;
      const available = plateNameEl.clientWidth;
      if (!available) return;
      while (plateNameEl.scrollWidth > available && fontSize > 5) {
        fontSize -= 0.3;
        plateNameEl.style.fontSize = `${fontSize}px`;
      }
    });
  }

  function ensureModalElements() {
    if (backdropEl) return;

    backdropEl = document.createElement('div');
    backdropEl.className = 'vlb-profile-backdrop';
    backdropEl.id = 'vlbProfileBackdrop';
    backdropEl.setAttribute('aria-hidden', 'true');

    modalEl = document.createElement('div');
    modalEl.className = 'vlb-profile-modal vlb-profile-modal--default';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'vlbProfilePlateName');

    const header = document.createElement('header');
    header.className = 'vlb-profile-header';

    const headerMain = document.createElement('div');
    headerMain.className = 'vlb-profile-header-main';

    const plateWrap = document.createElement('div');
    plateWrap.className = 'vlb-profile-plate';

    plateImgEl = document.createElement('img');
    plateImgEl.src = 'assets/i.gif';
    plateImgEl.alt = '選手プレート';
    plateImgEl.onerror = () => {
      plateImgEl.style.display = 'none';
    };

    plateNameEl = document.createElement('span');
    plateNameEl.className = 'vlb-profile-plate-name';
    plateNameEl.id = 'vlbProfilePlateName';
    plateNameEl.textContent = '';

    plateWrap.append(plateImgEl, plateNameEl);

    const headerMeta = document.createElement('div');
    headerMeta.className = 'vlb-profile-header-meta';

    const eyebrowRow = document.createElement('div');
    eyebrowRow.className = 'vlb-profile-eyebrow-row';

    eyebrowEl = document.createElement('span');
    eyebrowEl.className = 'vlb-profile-eyebrow';
    eyebrowEl.textContent = 'PLAYER';

    typeCornerEl = document.createElement('span');
    typeCornerEl.className = 'vlb-profile-type-corner';
    typeCornerEl.hidden = true;

    eyebrowRow.append(eyebrowEl, typeCornerEl);

    const posRow = document.createElement('p');
    posRow.className = 'vlb-profile-position-row';

    const posLabel = document.createElement('span');
    posLabel.className = 'vlb-profile-pos-label';
    posLabel.textContent = '適正';

    positionHeaderEl = document.createElement('span');
    positionHeaderEl.className = 'vlb-profile-position-text';
    positionHeaderEl.textContent = '';

    posRow.append(posLabel, positionHeaderEl);

    headerMeta.append(eyebrowRow, posRow);
    headerMain.append(plateWrap, headerMeta);

    closeBtnEl = document.createElement('button');
    closeBtnEl.type = 'button';
    closeBtnEl.className = 'vlb-profile-close';
    closeBtnEl.setAttribute('aria-label', 'プロフィールを閉じる');
    closeBtnEl.textContent = '×';

    header.append(headerMain, closeBtnEl);

    bodyEl = document.createElement('div');
    bodyEl.className = 'vlb-profile-body';

    modalEl.append(header, bodyEl);
    backdropEl.appendChild(modalEl);
    document.body.appendChild(backdropEl);

    closeBtnEl.addEventListener('click', closeProfile);

    backdropEl.addEventListener('click', (event) => {
      if (event.target === backdropEl) {
        closeProfile();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && backdropEl && backdropEl.classList.contains('is-open')) {
        closeProfile();
      }
    });
  }

  function applyModalBorderTier(tier) {
    if (!modalEl) return;
    modalEl.classList.remove(
      'vlb-profile-modal--silver',
      'vlb-profile-modal--gold',
      'vlb-profile-modal--rainbow',
      'vlb-profile-modal--default'
    );
    modalEl.classList.add(`vlb-profile-modal--${tier}`);
  }

  function setHeaderPlate(name, plateCode) {
    if (plateImgEl) {
      plateImgEl.style.display = 'block';
      plateImgEl.src = `assets/${plateCode}.gif`;
      plateImgEl.alt = `${name}プレート`;
    }
    if (plateNameEl) {
      plateNameEl.textContent = name;
      fitPlateNameFontSize();
    }
  }

  function renderStatusCard(label, text, isError = false) {
    bodyEl.innerHTML = '';
    const card = document.createElement('section');
    card.className = isError ? 'vlb-profile-card vlb-profile-error' : 'vlb-profile-card';

    const labelEl = document.createElement('p');
    labelEl.className = 'vlb-profile-status-label';
    labelEl.textContent = label;

    const textEl = document.createElement('p');
    textEl.className = 'vlb-profile-status-text';
    textEl.textContent = text;

    card.append(labelEl, textEl);
    bodyEl.appendChild(card);
  }

  function formatValueOrDash(value) {
    if (value === null || value === undefined) return '—';
    const text = String(value).trim();
    return text !== '' ? text : '—';
  }

  function formatPositionLabel(code) {
    const raw = String(code || '').trim();
    if (!raw) return '';
    if (raw === 'P' || raw === '投手') return '投';
    if (raw === '捕' || raw === '捕手' || raw === 'C') return '捕';
    if (raw === '一' || raw === '1B') return '一';
    if (raw === '二' || raw === '2B') return '二';
    if (raw === '三' || raw === '3B') return '三';
    if (raw === '遊' || raw === 'SS') return '遊';
    if (raw === '外' || raw === '外野' || raw === 'OF') return '外';
    return raw;
  }

  function normalizePositionKey(code) {
    const raw = String(code || '').trim();
    if (raw === 'P' || raw === '投' || raw === '投手') return 'P';
    if (raw === '捕' || raw === '捕手' || raw === 'C') return 'C';
    if (raw === '一' || raw === '1B') return '1B';
    if (raw === '二' || raw === '2B') return '2B';
    if (raw === '三' || raw === '3B') return '3B';
    if (raw === '遊' || raw === 'SS') return 'SS';
    if (raw === '外' || raw === '外野' || raw === 'OF') return 'OF';
    return raw;
  }

  function formatCombinedPosition(player) {
    const mainRaw = player && player.position ? String(player.position).trim() : '';
    if (!mainRaw) return '—';

    const mainLabel = formatPositionLabel(mainRaw);
    const mainKey = normalizePositionKey(mainRaw);

    const subParts = String((player && player.subPosition) || '')
      .split(/[\n\r,、/]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => normalizePositionKey(s) !== mainKey);

    const uniqueSubs = [...new Set(subParts)].map(formatPositionLabel).filter(Boolean);
    if (uniqueSubs.length > 0) {
      return `${mainLabel}（${uniqueSubs.join('・')}）`;
    }
    return mainLabel;
  }

  function formatThrowingAndBats(throwingHand, bats) {
    const t = throwingHand ? String(throwingHand).trim() : '';
    const b = bats ? String(bats).trim() : '';
    if (t && b) return `${t}投${b}打`;
    if (t) return `${t}投`;
    if (b) return `${b}打`;
    return '—';
  }

  function formatExactPt(total) {
    if (total === null || total === undefined || total === '') return '—';
    return `${String(total)}pt`;
  }

  function getTrainingRankValue(player) {
    const candidate =
      player.trainingRank !== undefined
        ? player.trainingRank
        : player.training !== undefined
          ? player.training
          : player.specialTraining;
    const text = formatValueOrDash(candidate);
    return text === '—' ? '未設定' : text;
  }

  function normalizeEvaluationForTier(evaluation) {
    if (!evaluation) return '';
    return String(evaluation)
      .trim()
      .toUpperCase()
      .replace(/Ⅰ/g, 'I')
      .replace(/Ⅱ/g, 'II')
      .replace(/Ⅲ/g, 'III');
  }

  function getEvaluationTier(evaluation) {
    const norm = normalizeEvaluationForTier(evaluation);
    if (norm === 'XI' || norm === 'XII') return 'rainbow';
    if (norm === 'X') return 'gold';
    if (norm === 'S' || norm === 'SS' || norm === 'SSS') return 'silver';
    return 'default';
  }

  function createSection(titleText) {
    const section = document.createElement('section');
    section.className = 'vlb-profile-section';

    if (titleText) {
      const heading = document.createElement('h3');
      heading.className = 'vlb-profile-section-title';
      heading.textContent = titleText;
      section.appendChild(heading);
    }

    return section;
  }

  // 半角 + / - 表記に統一
  function normalizeAbilityRank(rank) {
    if (!rank) return '';
    return String(rank)
      .trim()
      .replace(/＋/g, '+')
      .replace(/−/g, '-');
  }

  function getAbilityRankColor(rank, numericScore) {
    const norm = normalizeAbilityRank(rank);
    if (norm && ABILITY_RANK_COLORS[norm]) {
      return ABILITY_RANK_COLORS[norm];
    }
    if (typeof numericScore === 'number' && numericScore >= 21) {
      return ABILITY_RANK_COLORS.SSS;
    }
    return '#92a0b6';
  }

  const HIGH_ABILITY_RANKS = new Set(['S-', 'S', 'S+', 'SS-', 'SS', 'SS+', 'SSS-', 'SSS']);

  function createRankBadge(rankText, numericScore, isSmall = false) {
    const badge = document.createElement('span');
    const letter = document.createElement('span');
    letter.className = 'vlb-profile-rank-letter';

    const displayRank = normalizeAbilityRank(rankText);
    if (displayRank) {
      const color = getAbilityRankColor(displayRank, numericScore);
      const classes = ['vlb-profile-rank-badge'];
      if (isSmall) classes.push('vlb-profile-rank-badge--small');
      if (HIGH_ABILITY_RANKS.has(displayRank) || (typeof numericScore === 'number' && numericScore >= 14)) {
        classes.push('vlb-profile-rank-badge--high');
      }
      if (displayRank === 'SSS' || displayRank === 'SSS-') classes.push('vlb-profile-rank-badge--sss');
      else if (displayRank === 'S-' || displayRank === 'S' || displayRank === 'S+') {
        classes.push('vlb-profile-rank-badge--s');
      }
      badge.className = classes.join(' ');
      badge.style.setProperty('--rank-color', color);
      letter.textContent = displayRank;
    } else {
      badge.className = isSmall
        ? 'vlb-profile-rank-badge vlb-profile-rank-badge--small vlb-profile-rank-badge--empty'
        : 'vlb-profile-rank-badge vlb-profile-rank-badge--empty';
      letter.textContent = '—';
    }

    badge.appendChild(letter);
    return badge;
  }

  function buildEvaluationSection(player, tier) {
    const section = createSection('');

    const layout = document.createElement('div');
    layout.className = 'vlb-profile-eval-layout';

    const evalLeft = document.createElement('div');
    evalLeft.className = 'vlb-profile-eval-left';

    const emblemStack = document.createElement('div');
    emblemStack.className = 'vlb-profile-emblem-stack';

    const emblemCaption = document.createElement('span');
    emblemCaption.className = 'vlb-profile-emblem-caption';
    emblemCaption.textContent = '評価';

    const evalRaw = formatValueOrDash(player.evaluation);
    const emblem = document.createElement('div');
    emblem.className = `vlb-profile-eval-emblem vlb-profile-eval-emblem--${tier}`;

    const emblemText = document.createElement('span');
    emblemText.className = 'vlb-profile-eval-text';
    emblemText.textContent = evalRaw;

    emblem.appendChild(emblemText);
    emblemStack.append(emblemCaption, emblem);

    const ptText = formatExactPt(player.total);
    const ptEl = document.createElement('span');
    ptEl.className =
      ptText === '—'
        ? 'vlb-profile-pt-value vlb-profile-pt-value--muted'
        : 'vlb-profile-pt-value';
    ptEl.textContent = ptText;

    evalLeft.append(emblemStack, ptEl);

    const metaRight = document.createElement('div');
    metaRight.className = 'vlb-profile-meta-right';

    const handLine = document.createElement('div');
    handLine.className = 'vlb-profile-meta-line';
    const handKey = document.createElement('span');
    handKey.className = 'vlb-profile-meta-key';
    handKey.textContent = '投打';
    const handVal = document.createElement('span');
    handVal.className = 'vlb-profile-meta-val';
    handVal.textContent = formatThrowingAndBats(player.throwingHand, player.bats);
    handLine.append(handKey, handVal);

    const durLine = document.createElement('div');
    durLine.className = 'vlb-profile-meta-line';
    const durKey = document.createElement('span');
    durKey.className = 'vlb-profile-meta-key';
    durKey.textContent = '頑丈';
    const durRaw = player.durability ? String(player.durability).trim() : '';
    const durBadge = createRankBadge(durRaw, undefined, true);
    durLine.append(durKey, durBadge);

    const trainLine = document.createElement('div');
    trainLine.className = 'vlb-profile-meta-line';
    const trainKey = document.createElement('span');
    trainKey.className = 'vlb-profile-meta-key';
    trainKey.textContent = '特訓';
    const trainText = getTrainingRankValue(player);
    const trainVal = document.createElement('span');
    trainVal.className =
      trainText === '未設定'
        ? 'vlb-profile-meta-val vlb-profile-meta-val--muted'
        : 'vlb-profile-meta-val';
    trainVal.textContent = trainText;
    trainLine.append(trainKey, trainVal);

    metaRight.append(handLine, durLine, trainLine);
    layout.append(evalLeft, metaRight);
    section.appendChild(layout);
    return section;
  }

  function computeAbilityGauge(name, entry) {
    const rawVal = entry && typeof entry.value === 'number' ? entry.value : Number(entry && entry.value);
    if (!Number.isFinite(rawVal)) {
      return { percent: 0, isOverflow: false, scaledScore: 0 };
    }
    const scaledScore = name === '球速' ? Math.max(0, rawVal - SPEED_ZERO_BASE) : Math.max(0, rawVal);
    const rawPercent = (scaledScore / ABILITY_FULL_VALUE) * 100;
    const isOverflow = scaledScore > ABILITY_FULL_VALUE;
    const percent = Math.min(118, Math.max(0, rawPercent));
    return { percent, isOverflow, scaledScore };
  }

  function resolveAbilityRankText(entry, scaledScore) {
    const rawRank = entry && entry.rank ? String(entry.rank).trim() : '';
    if (rawRank) return rawRank;
    if (typeof scaledScore === 'number' && scaledScore >= 21) {
      return 'SSS';
    }
    return '';
  }

  function buildAbilitiesSection(player) {
    const section = createSection('');
    section.classList.add('vlb-profile-section--abilities');
    const abilities = player.abilities && typeof player.abilities === 'object' ? player.abilities : null;
    const rawEntries = abilities ? Object.entries(abilities) : [];
    const preferredOrder =
      player && player.type === '投手'
        ? ['球速', '制球', '球威', '投術', '変化', 'スタミナ']
        : ['ミート', 'パワー', '走力', '肩力', '守備'];
    const entries = [...rawEntries].sort(([a], [b]) => {
      const ia = preferredOrder.indexOf(a);
      const ib = preferredOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return 0;
    });

    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'vlb-profile-empty-note';
      empty.textContent = '能力データがありません';
      section.appendChild(empty);
      return section;
    }

    const list = document.createElement('div');
    list.className = 'vlb-profile-ability-list';

    entries.forEach(([abilityName, entry]) => {
      const row = document.createElement('div');
      row.className = 'vlb-profile-ability-row';

      const nameEl = document.createElement('span');
      nameEl.className = 'vlb-profile-ability-name';
      nameEl.textContent = abilityName;

      const { percent, isOverflow, scaledScore } = computeAbilityGauge(abilityName, entry);
      const rankText = resolveAbilityRankText(entry, scaledScore);
      const color = getAbilityRankColor(rankText, scaledScore);

      const rankBadge = createRankBadge(rankText, scaledScore, false);

      const trackWrap = document.createElement('div');
      trackWrap.className = 'vlb-profile-ability-track-wrap';

      const track = document.createElement('div');
      track.className = 'vlb-profile-ability-track';

      const fill = document.createElement('div');
      fill.className = isOverflow
        ? 'vlb-profile-ability-fill vlb-profile-ability-fill--overflow'
        : 'vlb-profile-ability-fill';
      fill.style.width = `${percent.toFixed(1)}%`;
      fill.style.backgroundColor = color;
      fill.style.setProperty('--bar-color', color);

      track.appendChild(fill);
      trackWrap.appendChild(track);

      const valEl = document.createElement('span');
      valEl.className = 'vlb-profile-ability-value';
      const valText =
        entry && entry.value !== undefined && entry.value !== null && entry.value !== ''
          ? String(entry.value)
          : '—';
      const unitText = entry && entry.unit ? String(entry.unit) : '';
      valEl.textContent = unitText ? `${valText}${unitText}` : valText;

      row.append(nameEl, rankBadge, trackWrap, valEl);
      list.appendChild(row);
    });

    section.appendChild(list);
    return section;
  }

  function tokenizeSpecialAbilityString(raw) {
    const str = String(raw || '').trim();
    if (!str) return [];

    const tokens = [];
    let idx = 0;
    let unknownBuf = '';

    while (idx < str.length) {
      let matched = null;
      for (const rule of SPECIAL_RULES) {
        if (str.startsWith(rule.text, idx)) {
          matched = rule;
          break;
        }
      }

      if (matched) {
        if (unknownBuf) {
          tokens.push({ text: unknownBuf, kind: 'neutral' });
          unknownBuf = '';
        }
        tokens.push({ text: matched.text, kind: matched.kind });
        idx += matched.text.length;
      } else {
        unknownBuf += str[idx];
        idx += 1;
      }
    }

    if (unknownBuf) {
      tokens.push({ text: unknownBuf, kind: 'neutral' });
    }
    return tokens;
  }

  function buildSpecialAbilitiesSection(player) {
    const section = createSection('特殊能力');
    const rawList = Array.isArray(player.specialAbilities) ? player.specialAbilities : [];

    const items = [];
    rawList.forEach((raw) => {
      if (raw && typeof raw === 'object' && raw.name) {
        items.push({
          text: String(raw.name).trim(),
          kind: raw.type === 'good' || raw.type === 'bad' ? raw.type : 'neutral',
        });
      } else {
        tokenizeSpecialAbilityString(raw).forEach((t) => items.push(t));
      }
    });

    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'vlb-profile-empty-note';
      empty.textContent = '特殊能力はありません';
      section.appendChild(empty);
      return section;
    }

    const wrap = document.createElement('div');
    wrap.className = 'vlb-profile-special-list';

    items.forEach((item) => {
      const chip = document.createElement('span');
      chip.className = `vlb-profile-special-chip vlb-profile-special-chip--${item.kind}`;
      chip.textContent = item.text;
      wrap.appendChild(chip);
    });

    section.appendChild(wrap);
    return section;
  }

  function buildGrowthHistorySection(player) {
    const section = createSection('成長履歴');
    const list = Array.isArray(player.growthHistory) ? player.growthHistory : [];

    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'vlb-profile-empty-note';
      empty.textContent = '成長履歴はまだありません';
      section.appendChild(empty);
      return section;
    }

    const candidateCols = [
      { label: '年度', keys: ['year', '年度'] },
      { label: '年齢', keys: ['age', '年齢'] },
      { label: '才能', keys: ['talent', '才能'] },
      { label: '将来性', keys: ['potential', '将来性'] },
      { label: '総合力', keys: ['total', '総合力', '総合'] },
      { label: '増減', keys: ['diff', 'change', '増減'] },
    ];

    const activeCols = candidateCols.filter((col) =>
      list.some((row) => row && typeof row === 'object' && col.keys.some((k) => row[k] !== undefined && row[k] !== ''))
    );

    if (!activeCols.length) {
      const fallback = document.createElement('p');
      fallback.className = 'vlb-profile-empty-note';
      fallback.textContent = list.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' / ');
      section.appendChild(fallback);
      return section;
    }

    const tableWrap = document.createElement('div');
    tableWrap.className = 'vlb-profile-table-wrap';

    const table = document.createElement('table');
    table.className = 'vlb-profile-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    activeCols.forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col.label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement('tbody');
    list.forEach((entry) => {
      const tr = document.createElement('tr');
      activeCols.forEach((col) => {
        const td = document.createElement('td');
        const foundKey = col.keys.find((k) => entry && entry[k] !== undefined && entry[k] !== '');
        td.textContent = foundKey !== undefined ? String(entry[foundKey]) : '—';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.append(thead, tbody);
    tableWrap.appendChild(table);
    section.appendChild(tableWrap);
    return section;
  }

  function buildTitlesSection(player) {
    const section = createSection('タイトル');
    const list = Array.isArray(player.titles) ? player.titles : [];

    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'vlb-profile-empty-note';
      empty.textContent = '獲得タイトルはまだありません';
      section.appendChild(empty);
      return section;
    }

    const ul = document.createElement('ul');
    ul.className = 'vlb-profile-title-list';

    list.forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'vlb-profile-title-item';

      if (typeof entry === 'string') {
        li.textContent = entry;
      } else if (entry && typeof entry === 'object') {
        const titleVal = entry.title || entry.name || entry.タイトル || '—';
        const yearVal = entry.year !== undefined ? entry.year : entry.年度;
        const rankVal = entry.rank !== undefined ? entry.rank : entry.順位;

        const mainSpan = document.createElement('span');
        mainSpan.textContent = String(titleVal);

        const subParts = [];
        if (yearVal !== undefined && yearVal !== '') subParts.push(`${yearVal}年`);
        if (rankVal !== undefined && rankVal !== '') subParts.push(String(rankVal));

        li.appendChild(mainSpan);
        if (subParts.length) {
          const subSpan = document.createElement('span');
          subSpan.className = 'vlb-profile-title-sub';
          subSpan.textContent = subParts.join(' ');
          li.appendChild(subSpan);
        }
      }

      ul.appendChild(li);
    });

    section.appendChild(ul);
    return section;
  }

  function renderPlayerProfile(player) {
    const displayName = player.name || currentPlayerName;
    const tier = getEvaluationTier(player.evaluation);

    applyModalBorderTier(tier);
    setHeaderPlate(displayName, getPlateFromApi(player));

    eyebrowEl.textContent = player.id ? `PLAYER · ${player.id}` : 'PLAYER';
    if (player.type) {
      typeCornerEl.textContent = player.type;
      typeCornerEl.hidden = false;
    } else {
      typeCornerEl.hidden = true;
    }
    positionHeaderEl.textContent = formatCombinedPosition(player);

    bodyEl.innerHTML = '';
    bodyEl.append(
      buildEvaluationSection(player, tier),
      buildAbilitiesSection(player),
      buildSpecialAbilitiesSection(player),
      buildGrowthHistorySection(player),
      buildTitlesSection(player)
    );

    bodyEl.scrollTop = 0;
  }

  function openProfile(playerName, fallbackPlateCode) {
    ensureModalElements();
    currentPlayerName = playerName;
    applyModalBorderTier('default');
    setHeaderPlate(playerName, fallbackPlateCode || 'i');
    eyebrowEl.textContent = 'PLAYER';
    typeCornerEl.hidden = true;
    positionHeaderEl.textContent = '読み込み中…';

    if (!backdropEl.classList.contains('is-open')) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      backdropEl.classList.add('is-open');
      backdropEl.setAttribute('aria-hidden', 'false');
    }

    if (cachedPlayersMap) {
      const matched = cachedPlayersMap.get(playerName);
      if (matched) {
        renderPlayerProfile(matched);
      } else {
        positionHeaderEl.textContent = '—';
        renderStatusCard(
          '選手データ未登録',
          `「${playerName}」の詳細データはスプレッドシート側に見つかりませんでした。`
        );
      }
      return;
    }

    renderStatusCard('読み込み中', 'スプレッドシートから選手データを取得しています…');
    fetchPlayersViaJsonp()
      .then(({ map }) => {
        if (currentPlayerName !== playerName || !backdropEl.classList.contains('is-open')) return;
        const matched = map.get(playerName);
        if (matched) {
          renderPlayerProfile(matched);
        } else {
          positionHeaderEl.textContent = '—';
          renderStatusCard(
            '選手データ未登録',
            `「${playerName}」の詳細データはスプレッドシート側に見つかりませんでした。`
          );
        }
      })
      .catch((err) => {
        if (currentPlayerName !== playerName || !backdropEl.classList.contains('is-open')) return;
        positionHeaderEl.textContent = 'エラー';
        renderStatusCard(
          '読み込みエラー',
          err && err.message ? err.message : '選手データの取得に失敗しました。',
          true
        );
      });
  }

  function closeProfile() {
    if (!backdropEl || !backdropEl.classList.contains('is-open')) return;
    backdropEl.classList.remove('is-open');
    backdropEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = previousBodyOverflow;
    currentPlayerName = '';
  }

  function extractPlateCodeFromElement(playerEl) {
    const img = playerEl ? playerEl.querySelector('img') : null;
    const src = img ? img.getAttribute('src') || '' : '';
    const match = src.match(/assets\/([a-z_]+)\.gif/i);
    return match ? match[1] : 'i';
  }

  function attachStadiumInterceptor() {
    const stadium = document.getElementById('stadium');
    if (!stadium) return;

    stadium.addEventListener(
      'click',
      (event) => {
        const playerEl = event.target && event.target.closest ? event.target.closest('.player') : null;
        if (!playerEl || !stadium.contains(playerEl)) return;

        event.stopPropagation();
        const playerName = (playerEl.dataset.name || '').trim();
        if (!playerName) return;

        openProfile(playerName, extractPlateCodeFromElement(playerEl));
      },
      true
    );
  }

  function initProfile() {
    attachStadiumInterceptor();
    fetchPlayersViaJsonp().catch(() => {});
  }

  window.VLBProfile = {
    open: openProfile,
    close: closeProfile,
    getPlayers: fetchPlayersViaJsonp,
    getCachedMap: () => cachedPlayersMap,
    helpers: {
      ABILITY_FULL_VALUE,
      SPEED_ZERO_BASE,
      formatPositionLabel,
      normalizePositionKey,
      formatCombinedPosition,
      formatThrowingAndBats,
      formatExactPt,
      normalizeEvaluationForTier,
      getEvaluationTier,
      normalizeAbilityRank,
      createRankBadge,
      computeAbilityGauge,
      resolveAbilityRankText,
      tokenizeSpecialAbilityString,
      getPlateFromApi,
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfile);
  } else {
    initProfile();
  }
})();

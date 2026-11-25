(() => {
  'use strict';

  const BATTER_ABILITIES = ['ミート', 'パワー', '走力', '肩力', '守備'];
  const PITCHER_ABILITIES = ['球速', '制球', '球威', '投術', '変化'];

  const BATTER_POSITIONS = ['捕', '一', '二', '三', '遊', '外'];
  const PITCHER_POSITIONS = ['投'];

  const POSITION_ORDER = {
    投: 0,
    捕: 1,
    一: 2,
    二: 3,
    三: 4,
    遊: 5,
    外: 6,
  };

  const RANK_SCORE_MAP = {
    G: 0,
    F: 1,
    E: 2,
    'E+': 3,
    D: 4,
    'D+': 5,
    C: 6,
    'C+': 7,
    'B-': 8,
    B: 9,
    'B+': 10,
    'A-': 11,
    A: 12,
    'A+': 13,
    'S-': 14,
    S: 15,
    'S+': 16,
    'SS-': 17,
    SS: 18,
    'SS+': 19,
    'SSS-': 20,
    SSS: 21,
  };

  const FILTER_RANK_OPTIONS = [
    { label: '—', minScore: null },
    { label: 'F以上', minScore: 1 },
    { label: 'E以上', minScore: 2 },
    { label: 'D以上', minScore: 4 },
    { label: 'C以上', minScore: 6 },
    { label: 'B-以上', minScore: 8 },
    { label: 'B以上', minScore: 9 },
    { label: 'B+以上', minScore: 10 },
    { label: 'A-以上', minScore: 11 },
    { label: 'A以上', minScore: 12 },
    { label: 'A+以上', minScore: 13 },
    { label: 'S-以上', minScore: 14 },
    { label: 'S以上', minScore: 15 },
    { label: 'SS以上', minScore: 17 },
    { label: 'SSS', minScore: 21 },
  ];

  const EVAL_SCORE_MAP = {
    S: 1,
    SS: 2,
    SSS: 3,
    X: 4,
    XI: 5,
    XII: 6,
  };

  // 横幅を極端に埋め尽くす場合のみ省略（通常の特能数はすべて表示）
  const MAX_LIST_SPECIALS = 10;

  const state = {
    isOpen: false,
    typeTab: '野手',
    controlsOpen: false,
    searchQuery: '',
    quickHand: '',
    throwFilter: '',
    batFilter: '',
    positionFilter: '',
    evalMin: 0,
    abilityFilters: {},
    sortBy: 'position',
    sortDir: 'asc',
    sumAbilities: [],
    players: null,
    loadError: '',
  };

  let viewEl = null;
  let shellEl = null;

  let tabBatterBtn = null;
  let tabPitcherBtn = null;
  let toggleControlsBtn = null;
  let resetBtn = null;
  let searchInputEl = null;
  let handBtns = [];
  let summaryTextEl = null;
  let countEl = null;
  let controlsEl = null;
  let posSelectEl = null;
  let evalSelectEl = null;
  let throwSelectEl = null;
  let batSelectEl = null;
  let abilityFiltersGridEl = null;
  let sortSelectEl = null;
  let dirDescBtn = null;
  let dirAscBtn = null;
  let sumBoxEl = null;
  let colAbilitiesEl = null;
  let listEl = null;

  function getHelpers() {
    return window.VLBProfile && window.VLBProfile.helpers ? window.VLBProfile.helpers : null;
  }

  function getActiveAbilities() {
    return state.typeTab === '投手' ? PITCHER_ABILITIES : BATTER_ABILITIES;
  }

  function normalizeSearchText(str) {
    return String(str || '')
      .trim()
      .toLowerCase()
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/＋/g, '+')
      .replace(/−/g, '-')
      .replace(/〇/g, '○')
      .replace(/◯/g, '○')
      .replace(/✕/g, '×');
  }

  function getAbilityScore(player, abilityName) {
    const h = getHelpers();
    const entry = player && player.abilities ? player.abilities[abilityName] : null;
    if (!entry) return -1;

    const rawRank = h ? h.normalizeAbilityRank(entry.rank) : String(entry.rank || '');
    if (rawRank && RANK_SCORE_MAP[rawRank] !== undefined) {
      return RANK_SCORE_MAP[rawRank];
    }

    if (h) {
      const { scaledScore } = h.computeAbilityGauge(abilityName, entry);
      if (Number.isFinite(scaledScore)) return scaledScore;
    }
    return -1;
  }

  function getAbilityRawValue(player, abilityName) {
    const entry = player && player.abilities ? player.abilities[abilityName] : null;
    if (!entry || entry.value === undefined || entry.value === null || entry.value === '') {
      return -Infinity;
    }
    const num = Number(entry.value);
    return Number.isFinite(num) ? num : -Infinity;
  }

  function getPlayerEvaluationScore(player) {
    const h = getHelpers();
    const norm = h
      ? h.normalizeEvaluationForTier(player && player.evaluation)
      : String((player && player.evaluation) || '').trim().toUpperCase();
    return EVAL_SCORE_MAP[norm] || 0;
  }

  function getPlayerAllPositionLabels(player) {
    const h = getHelpers();
    const labels = [];
    if (player && player.position) {
      labels.push(h ? h.formatPositionLabel(player.position) : String(player.position).trim());
    }
    String((player && player.subPosition) || '')
      .split(/[\n\r,、/]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => {
        labels.push(h ? h.formatPositionLabel(s) : s);
      });
    return [...new Set(labels)];
  }

  function getSpecialItemsForPlayer(player) {
    const h = getHelpers();
    const specialItems = [];
    const rawSpecials = Array.isArray(player && player.specialAbilities) ? player.specialAbilities : [];
    rawSpecials.forEach((raw) => {
      if (raw && typeof raw === 'object' && raw.name) {
        specialItems.push({
          text: String(raw.name).trim(),
          kind: raw.type === 'good' || raw.type === 'bad' ? raw.type : 'neutral',
        });
      } else if (h) {
        h.tokenizeSpecialAbilityString(raw).forEach((t) => specialItems.push(t));
      } else if (raw) {
        specialItems.push({ text: String(raw), kind: 'neutral' });
      }
    });
    return specialItems;
  }

  function buildPlayerSearchIndex(player) {
    const h = getHelpers();
    const parts = [
      player.name || '',
      player.type || '',
      player.position || '',
      player.subPosition || '',
      h ? h.formatCombinedPosition(player) : '',
      ...getPlayerAllPositionLabels(player),
      player.evaluation || '',
      player.throwingHand ? `${player.throwingHand}投` : '',
      player.bats ? `${player.bats}打` : '',
      h ? h.formatThrowingAndBats(player.throwingHand, player.bats) : '',
      ...(Array.isArray(player.specialAbilities) ? player.specialAbilities.map((s) => (typeof s === 'string' ? s : s && s.name ? s.name : '')) : []),
      ...getSpecialItemsForPlayer(player).map((s) => s.text),
    ];
    return normalizeSearchText(parts.join(' '));
  }

  function syncHandButtons() {
    handBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.hand === state.quickHand);
    });
  }

  function formatCompactPosition(player) {
    const h = getHelpers();
    const mainRaw = player && player.position ? String(player.position).trim() : '';
    if (!mainRaw) return '—';
    const mainLabel = h ? h.formatPositionLabel(mainRaw) : mainRaw;
    const mainKey = h ? h.normalizePositionKey(mainRaw) : mainRaw;
    const subParts = String((player && player.subPosition) || '')
      .split(/[\n\r,、/]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => (h ? h.normalizePositionKey(s) : s) !== mainKey);
    const uniqueSubs = [...new Set(subParts)]
      .map((s) => (h ? h.formatPositionLabel(s) : s))
      .filter(Boolean);
    if (uniqueSubs.length > 0) {
      return `${mainLabel}(${uniqueSubs.join('・')})`;
    }
    return mainLabel;
  }

  function estimatePlateFontSize(name) {
    const chars = [...String(name || '')];
    let weight = 0;
    chars.forEach((ch) => {
      weight += /[\x20-\x7eｦ-ﾟ]/.test(ch) ? 0.58 : 1;
    });
    if (weight <= 3.2) return 8;
    if (weight <= 4.2) return 7;
    if (weight <= 5.2) return 6;
    if (weight <= 6.2) return 5.2;
    return 4.5;
  }

  function fitAllPlateNamesBatch() {
    if (!listEl) return;
    requestAnimationFrame(() => {
      const labels = [...listEl.querySelectorAll('.vlb-players-plate-name')];
      if (!labels.length) return;
      const overflowItems = [];
      labels.forEach((label) => {
        const available = label.clientWidth;
        if (available && label.scrollWidth > available) {
          overflowItems.push({
            label,
            available,
            fontSize: parseFloat(label.style.fontSize) || 7.5,
          });
        }
      });
      overflowItems.forEach((item) => {
        let fs = item.fontSize;
        while (item.label.scrollWidth > item.available && fs > 3.6) {
          fs -= 0.25;
          item.label.style.fontSize = `${fs}px`;
        }
      });
    });
  }

  function buildViewDom() {
    if (viewEl) return;

    const site = document.querySelector('.site');
    const bottomNav = document.querySelector('.bottom-nav');
    if (!site || !bottomNav) return;

    viewEl = document.createElement('section');
    viewEl.className = 'vlb-players-view';
    viewEl.id = 'vlbPlayersView';
    viewEl.setAttribute('aria-label', '選手一覧');
    viewEl.hidden = true;

    shellEl = document.createElement('div');
    shellEl.className = 'vlb-players-shell';

    // ツールバー
    const toolbar = document.createElement('div');
    toolbar.className = 'vlb-players-toolbar';

    const tabs = document.createElement('div');
    tabs.className = 'vlb-players-tabs';
    tabs.setAttribute('role', 'tablist');

    tabBatterBtn = document.createElement('button');
    tabBatterBtn.type = 'button';
    tabBatterBtn.className = 'vlb-players-tab is-active';
    tabBatterBtn.textContent = '野手';

    tabPitcherBtn = document.createElement('button');
    tabPitcherBtn.type = 'button';
    tabPitcherBtn.className = 'vlb-players-tab';
    tabPitcherBtn.textContent = '投手';

    tabs.append(tabBatterBtn, tabPitcherBtn);

    const actions = document.createElement('div');
    actions.className = 'vlb-players-actions';

    toggleControlsBtn = document.createElement('button');
    toggleControlsBtn.type = 'button';
    toggleControlsBtn.className = 'vlb-players-btn';
    toggleControlsBtn.textContent = '絞込・並替 ▾';

    resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'vlb-players-btn vlb-players-btn--reset';
    resetBtn.textContent = 'リセット';

    actions.append(toggleControlsBtn, resetBtn);
    toolbar.append(tabs, actions);

    // フリーワード検索＋投打（右・左）クイックバー
    const quickBar = document.createElement('div');
    quickBar.className = 'vlb-players-quickbar';

    searchInputEl = document.createElement('input');
    searchInputEl.type = 'search';
    searchInputEl.className = 'vlb-players-search';
    searchInputEl.placeholder = '検索（名前・特能・ポジ…）';
    searchInputEl.setAttribute('aria-label', '選手フリーワード検索');

    const handSeg = document.createElement('div');
    handSeg.className = 'vlb-players-hand-seg';
    handSeg.setAttribute('role', 'group');
    handSeg.setAttribute('aria-label', '投打左右絞り込み');

    handBtns = [
      { value: '', label: '全' },
      { value: '右', label: '右' },
      { value: '左', label: '左' },
    ].map((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = item.value === '' ? 'vlb-players-hand-btn is-active' : 'vlb-players-hand-btn';
      btn.dataset.hand = item.value;
      btn.textContent = item.label;
      handSeg.appendChild(btn);
      return btn;
    });

    quickBar.append(searchInputEl, handSeg);

    // 極小サマリーバー
    const summaryBar = document.createElement('div');
    summaryBar.className = 'vlb-players-summary-bar';
    summaryTextEl = document.createElement('span');
    summaryTextEl.className = 'vlb-players-summary-text';
    countEl = document.createElement('span');
    countEl.className = 'vlb-players-count';
    summaryBar.append(summaryTextEl, countEl);

    // 絞り込み・並び替えパネル
    controlsEl = document.createElement('div');
    controlsEl.className = 'vlb-players-controls';
    controlsEl.hidden = true;

    // 1) ポジション・総合評価・投げ・打ち・能力絞り込み
    const filterGroup = document.createElement('div');
    filterGroup.className = 'vlb-players-control-group';

    const filterTitle = document.createElement('p');
    filterTitle.className = 'vlb-players-control-title';
    filterTitle.textContent = '絞り込み（複数条件OK・サブポジ含む）';

    const filterGrid = document.createElement('div');
    filterGrid.className = 'vlb-players-control-grid';

    const posField = document.createElement('div');
    posField.className = 'vlb-players-field';
    const posLabel = document.createElement('label');
    posLabel.textContent = 'ポジション';
    posSelectEl = document.createElement('select');
    posSelectEl.className = 'vlb-players-select';
    posField.append(posLabel, posSelectEl);

    const evalField = document.createElement('div');
    evalField.className = 'vlb-players-field';
    const evalLabel = document.createElement('label');
    evalLabel.textContent = '総合評価';
    evalSelectEl = document.createElement('select');
    evalSelectEl.className = 'vlb-players-select';
    [
      { label: 'すべて', value: '0' },
      { label: 'S以上', value: '1' },
      { label: 'SS以上', value: '2' },
      { label: 'SSS以上', value: '3' },
      { label: 'X以上', value: '4' },
      { label: 'XI以上', value: '5' },
      { label: 'XII (XⅡ)', value: '6' },
    ].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      evalSelectEl.appendChild(o);
    });
    evalField.append(evalLabel, evalSelectEl);

    const throwField = document.createElement('div');
    throwField.className = 'vlb-players-field';
    const throwLabel = document.createElement('label');
    throwLabel.textContent = '投げ';
    throwSelectEl = document.createElement('select');
    throwSelectEl.className = 'vlb-players-select';
    [
      { label: 'すべて', value: '' },
      { label: '右投', value: '右' },
      { label: '左投', value: '左' },
    ].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      throwSelectEl.appendChild(o);
    });
    throwField.append(throwLabel, throwSelectEl);

    const batField = document.createElement('div');
    batField.className = 'vlb-players-field';
    const batLabel = document.createElement('label');
    batLabel.textContent = '打ち';
    batSelectEl = document.createElement('select');
    batSelectEl.className = 'vlb-players-select';
    [
      { label: 'すべて', value: '' },
      { label: '右打', value: '右' },
      { label: '左打', value: '左' },
    ].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      batSelectEl.appendChild(o);
    });
    batField.append(batLabel, batSelectEl);

    filterGrid.append(posField, evalField, throwField, batField);

    abilityFiltersGridEl = document.createElement('div');
    abilityFiltersGridEl.className = 'vlb-players-ability-filters';

    filterGroup.append(filterTitle, filterGrid, abilityFiltersGridEl);

    // 2) 並び替え
    const sortGroup = document.createElement('div');
    sortGroup.className = 'vlb-players-control-group';

    const sortTitle = document.createElement('p');
    sortTitle.className = 'vlb-players-control-title';
    sortTitle.textContent = '並び替え';

    const sortRow = document.createElement('div');
    sortRow.className = 'vlb-players-sort-row';

    const sortField = document.createElement('div');
    sortField.className = 'vlb-players-field';
    const sortLabel = document.createElement('label');
    sortLabel.textContent = '項目';
    sortSelectEl = document.createElement('select');
    sortSelectEl.className = 'vlb-players-select';
    sortField.append(sortLabel, sortSelectEl);

    const dirGroup = document.createElement('div');
    dirGroup.className = 'vlb-players-dir-group';
    dirDescBtn = document.createElement('button');
    dirDescBtn.type = 'button';
    dirDescBtn.className = 'vlb-players-dir-btn';
    dirDescBtn.textContent = '降順';
    dirAscBtn = document.createElement('button');
    dirAscBtn.type = 'button';
    dirAscBtn.className = 'vlb-players-dir-btn is-active';
    dirAscBtn.textContent = '昇順';
    dirGroup.append(dirDescBtn, dirAscBtn);

    sortRow.append(sortField, dirGroup);

    sumBoxEl = document.createElement('div');
    sumBoxEl.className = 'vlb-players-sum-box';
    sumBoxEl.hidden = true;

    sortGroup.append(sortTitle, sortRow, sumBoxEl);
    controlsEl.append(filterGroup, sortGroup);

    // 固定列ヘッダー（Row1の4列と完全一致）
    const colHeader = document.createElement('div');
    colHeader.className = 'vlb-players-col-header';

    const colPos = document.createElement('div');
    colPos.className = 'vlb-players-col-pos';
    colPos.textContent = 'ポジ';

    const colPlate = document.createElement('div');
    colPlate.className = 'vlb-players-col-plate';
    colPlate.textContent = '選手';

    const colEval = document.createElement('div');
    colEval.className = 'vlb-players-col-eval';
    colEval.textContent = '評価';

    colAbilitiesEl = document.createElement('div');
    colAbilitiesEl.className = 'vlb-players-col-abilities';
    colHeader.append(colPos, colPlate, colEval, colAbilitiesEl);

    // リスト本体
    listEl = document.createElement('div');
    listEl.className = 'vlb-players-list';

    shellEl.append(toolbar, quickBar, summaryBar, controlsEl, colHeader, listEl);
    viewEl.append(shellEl);
    site.insertBefore(viewEl, bottomNav);

    bindEvents();
    rebuildTabSpecificControls();
  }

  function rebuildTabSpecificControls() {
    const abilities = getActiveAbilities();
    const positions = state.typeTab === '投手' ? PITCHER_POSITIONS : BATTER_POSITIONS;

    // ポジション選択肢
    posSelectEl.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'すべて';
    posSelectEl.appendChild(allOpt);
    positions.forEach((pos) => {
      const o = document.createElement('option');
      o.value = pos;
      o.textContent = pos;
      posSelectEl.appendChild(o);
    });
    posSelectEl.value = positions.includes(state.positionFilter) ? state.positionFilter : '';
    state.positionFilter = posSelectEl.value;

    // 能力絞り込みセレクト
    abilityFiltersGridEl.innerHTML = '';
    abilities.forEach((ab) => {
      const item = document.createElement('div');
      item.className = 'vlb-players-ability-filter-item';
      const lbl = document.createElement('label');
      lbl.textContent = ab;
      const sel = document.createElement('select');
      FILTER_RANK_OPTIONS.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.minScore === null ? '' : String(opt.minScore);
        o.textContent = opt.label;
        sel.appendChild(o);
      });
      const currentVal = state.abilityFilters[ab];
      sel.value = currentVal !== undefined && currentVal !== null ? String(currentVal) : '';
      sel.addEventListener('change', () => {
        if (sel.value === '') {
          delete state.abilityFilters[ab];
        } else {
          state.abilityFilters[ab] = Number(sel.value);
        }
        renderList();
      });
      item.append(lbl, sel);
      abilityFiltersGridEl.appendChild(item);
    });

    // 並び替え項目選択肢
    sortSelectEl.innerHTML = '';
    const baseSorts = [
      { value: 'position', label: 'ポジション順（初期）' },
      { value: 'evaluation', label: '総合評価' },
      { value: 'total', label: '総合数値' },
    ];
    baseSorts.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      sortSelectEl.appendChild(o);
    });
    abilities.forEach((ab) => {
      const o = document.createElement('option');
      o.value = `ability:${ab}`;
      o.textContent = `能力：${ab}`;
      sortSelectEl.appendChild(o);
    });
    const sumOpt = document.createElement('option');
    sumOpt.value = 'sum';
    sumOpt.textContent = '複数能力の合計値';
    sortSelectEl.appendChild(sumOpt);

    const validSortValues = [...sortSelectEl.options].map((o) => o.value);
    if (!validSortValues.includes(state.sortBy)) {
      state.sortBy = 'position';
      state.sortDir = 'asc';
    }
    sortSelectEl.value = state.sortBy;

    // 複数能力合計チェックボックス
    sumBoxEl.innerHTML = '';
    state.sumAbilities = state.sumAbilities.filter((ab) => abilities.includes(ab));
    abilities.forEach((ab) => {
      const lbl = document.createElement('label');
      lbl.className = 'vlb-players-sum-chip';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = state.sumAbilities.includes(ab);
      cb.addEventListener('change', () => {
        if (cb.checked) {
          if (!state.sumAbilities.includes(ab)) state.sumAbilities.push(ab);
        } else {
          state.sumAbilities = state.sumAbilities.filter((x) => x !== ab);
        }
        renderList();
      });
      lbl.append(cb, document.createTextNode(ab));
      sumBoxEl.appendChild(lbl);
    });
    sumBoxEl.hidden = state.sortBy !== 'sum';

    // 方向ボタン同期
    dirDescBtn.classList.toggle('is-active', state.sortDir === 'desc');
    dirAscBtn.classList.toggle('is-active', state.sortDir === 'asc');

    // 列ヘッダー更新
    colAbilitiesEl.innerHTML = '';
    abilities.forEach((ab) => {
      const span = document.createElement('span');
      span.textContent = ab;
      colAbilitiesEl.appendChild(span);
    });
  }

  function resetAllConditions() {
    state.searchQuery = '';
    state.quickHand = '';
    state.throwFilter = '';
    state.batFilter = '';
    state.positionFilter = '';
    state.evalMin = 0;
    state.abilityFilters = {};
    state.sortBy = 'position';
    state.sortDir = 'asc';
    state.sumAbilities = [];

    if (searchInputEl) searchInputEl.value = '';
    if (throwSelectEl) throwSelectEl.value = '';
    if (batSelectEl) batSelectEl.value = '';
    evalSelectEl.value = '0';
    syncHandButtons();
    rebuildTabSpecificControls();
    renderList();
  }

  function bindEvents() {
    tabBatterBtn.addEventListener('click', () => {
      if (state.typeTab === '野手') return;
      state.typeTab = '野手';
      tabBatterBtn.classList.add('is-active');
      tabPitcherBtn.classList.remove('is-active');
      state.positionFilter = '';
      state.abilityFilters = {};
      state.sumAbilities = [];
      if (state.sortBy.startsWith('ability:') || state.sortBy === 'sum') {
        state.sortBy = 'position';
        state.sortDir = 'asc';
      }
      rebuildTabSpecificControls();
      renderList();
    });

    tabPitcherBtn.addEventListener('click', () => {
      if (state.typeTab === '投手') return;
      state.typeTab = '投手';
      tabPitcherBtn.classList.add('is-active');
      tabBatterBtn.classList.remove('is-active');
      state.positionFilter = '';
      state.abilityFilters = {};
      state.sumAbilities = [];
      if (state.sortBy.startsWith('ability:') || state.sortBy === 'sum') {
        state.sortBy = 'position';
        state.sortDir = 'asc';
      }
      rebuildTabSpecificControls();
      renderList();
    });

    toggleControlsBtn.addEventListener('click', () => {
      state.controlsOpen = !state.controlsOpen;
      controlsEl.hidden = !state.controlsOpen;
      toggleControlsBtn.classList.toggle('is-active', state.controlsOpen);
      toggleControlsBtn.textContent = state.controlsOpen ? '絞込・並替 ▴' : '絞込・並替 ▾';
    });

    resetBtn.addEventListener('click', resetAllConditions);

    searchInputEl.addEventListener('input', () => {
      state.searchQuery = searchInputEl.value;
      renderList();
    });

    handBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.quickHand = btn.dataset.hand || '';
        syncHandButtons();
        renderList();
      });
    });

    posSelectEl.addEventListener('change', () => {
      state.positionFilter = posSelectEl.value;
      renderList();
    });

    evalSelectEl.addEventListener('change', () => {
      state.evalMin = Number(evalSelectEl.value) || 0;
      renderList();
    });

    throwSelectEl.addEventListener('change', () => {
      state.throwFilter = throwSelectEl.value;
      renderList();
    });

    batSelectEl.addEventListener('change', () => {
      state.batFilter = batSelectEl.value;
      renderList();
    });

    sortSelectEl.addEventListener('change', () => {
      state.sortBy = sortSelectEl.value;
      if (state.sortBy === 'position') {
        state.sortDir = 'asc';
      } else {
        state.sortDir = 'desc';
      }
      dirDescBtn.classList.toggle('is-active', state.sortDir === 'desc');
      dirAscBtn.classList.toggle('is-active', state.sortDir === 'asc');
      sumBoxEl.hidden = state.sortBy !== 'sum';
      renderList();
    });

    dirDescBtn.addEventListener('click', () => {
      if (state.sortDir === 'desc') return;
      state.sortDir = 'desc';
      dirDescBtn.classList.add('is-active');
      dirAscBtn.classList.remove('is-active');
      renderList();
    });

    dirAscBtn.addEventListener('click', () => {
      if (state.sortDir === 'asc') return;
      state.sortDir = 'asc';
      dirAscBtn.classList.add('is-active');
      dirDescBtn.classList.remove('is-active');
      renderList();
    });
  }

  function filterAndSortPlayers() {
    if (!Array.isArray(state.players)) return [];
    const h = getHelpers();
    const abilities = getActiveAbilities();
    const keywords = normalizeSearchText(state.searchQuery)
      .split(/\s+/)
      .filter(Boolean);

    const filtered = state.players.filter((player) => {
      if (!player || player.type !== state.typeTab) return false;

      if (state.quickHand) {
        const t = String(player.throwingHand || '').trim();
        const b = String(player.bats || '').trim();
        if (state.typeTab === '投手') {
          if (t !== state.quickHand) return false;
        } else {
          const primaryHand = b || t;
          if (primaryHand !== state.quickHand) return false;
        }
      }

      if (state.throwFilter) {
        if (String(player.throwingHand || '').trim() !== state.throwFilter) return false;
      }

      if (state.batFilter) {
        if (String(player.bats || '').trim() !== state.batFilter) return false;
      }

      if (state.positionFilter) {
        const allPos = getPlayerAllPositionLabels(player);
        if (!allPos.includes(state.positionFilter)) return false;
      }

      if (state.evalMin > 0) {
        if (getPlayerEvaluationScore(player) < state.evalMin) return false;
      }

      for (const ab of abilities) {
        const minScore = state.abilityFilters[ab];
        if (minScore !== undefined && minScore !== null) {
          if (getAbilityScore(player, ab) < minScore) return false;
        }
      }

      if (keywords.length > 0) {
        const idxText = buildPlayerSearchIndex(player);
        for (const kw of keywords) {
          if (!idxText.includes(kw)) return false;
        }
      }

      return true;
    });

    const dirMult = state.sortDir === 'desc' ? -1 : 1;

    return filtered
      .map((player, index) => ({ player, index }))
      .sort((aObj, bObj) => {
        const a = aObj.player;
        const b = bObj.player;
        let cmp = 0;

        if (state.sortBy === 'position') {
          const pa = h ? h.formatPositionLabel(a.position) : String(a.position || '');
          const pb = h ? h.formatPositionLabel(b.position) : String(b.position || '');
          const oa = POSITION_ORDER[pa] !== undefined ? POSITION_ORDER[pa] : 99;
          const ob = POSITION_ORDER[pb] !== undefined ? POSITION_ORDER[pb] : 99;
          cmp = (oa - ob) * dirMult;
        } else if (state.sortBy === 'evaluation') {
          const ea = getPlayerEvaluationScore(a);
          const eb = getPlayerEvaluationScore(b);
          cmp = (ea - eb) * dirMult;
          if (cmp === 0) {
            const ta = Number(a.total) || 0;
            const tb = Number(b.total) || 0;
            cmp = (ta - tb) * dirMult;
          }
        } else if (state.sortBy === 'total') {
          const ta = Number(a.total);
          const tb = Number(b.total);
          const na = Number.isFinite(ta) ? ta : -Infinity;
          const nb = Number.isFinite(tb) ? tb : -Infinity;
          cmp = (na - nb) * dirMult;
        } else if (state.sortBy.startsWith('ability:')) {
          const abName = state.sortBy.slice('ability:'.length);
          const va = getAbilityRawValue(a, abName);
          const vb = getAbilityRawValue(b, abName);
          cmp = (va - vb) * dirMult;
        } else if (state.sortBy === 'sum') {
          if (state.sumAbilities.length > 0) {
            const sumFor = (p) =>
              state.sumAbilities.reduce((acc, ab) => {
                const v = getAbilityRawValue(p, ab);
                return acc + (Number.isFinite(v) ? v : 0);
              }, 0);
            cmp = (sumFor(a) - sumFor(b)) * dirMult;
          }
        }

        if (cmp !== 0) return cmp;
        return aObj.index - bObj.index;
      })
      .map((item) => item.player);
  }

  function updateSummaryBar(shownCount) {
    const parts = [];
    if (state.searchQuery.trim()) parts.push(`検索:${state.searchQuery.trim()}`);
    if (state.quickHand) {
      parts.push(state.typeTab === '投手' ? `${state.quickHand}投` : `${state.quickHand}打`);
    }
    if (state.throwFilter) parts.push(`${state.throwFilter}投`);
    if (state.batFilter) parts.push(`${state.batFilter}打`);
    if (state.positionFilter) parts.push(`ポジ:${state.positionFilter}`);
    if (state.evalMin > 0) {
      const opt = [...evalSelectEl.options].find((o) => Number(o.value) === state.evalMin);
      if (opt) parts.push(`評価:${opt.textContent}`);
    }
    const abKeys = Object.keys(state.abilityFilters);
    if (abKeys.length) {
      parts.push(`能力:${abKeys.length}件`);
    }

    let sortText = 'ポジション順';
    if (state.sortBy === 'evaluation') sortText = '総合評価';
    else if (state.sortBy === 'total') sortText = '総合数値';
    else if (state.sortBy.startsWith('ability:')) sortText = state.sortBy.slice('ability:'.length);
    else if (state.sortBy === 'sum') {
      sortText = state.sumAbilities.length ? state.sumAbilities.join('+') : '合計(未選択)';
    }
    const dirText = state.sortDir === 'desc' ? '降順' : '昇順';
    const filterText = parts.length ? parts.join(' / ') : '絞込なし';

    summaryTextEl.textContent = `${filterText} ｜ 並替:${sortText}(${dirText})`;
    countEl.textContent = `${shownCount}名`;
  }

  function buildPlayerCard(player) {
    const h = getHelpers();
    const plateCode = h ? h.getPlateFromApi(player) : 'i';

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'vlb-players-card';

    // 1段目：ポジション | プレート | 評価 + pt | 固定5能力
    const row1 = document.createElement('div');
    row1.className = 'vlb-players-row1';

    const posEl = document.createElement('span');
    posEl.className = 'vlb-players-pos-cell';
    posEl.textContent = formatCompactPosition(player);

    const plateWrap = document.createElement('div');
    plateWrap.className = 'vlb-players-plate';

    const plateImg = document.createElement('img');
    plateImg.src = `assets/${plateCode}.gif`;
    plateImg.alt = '';
    plateImg.loading = 'lazy';
    plateImg.onerror = () => {
      plateImg.style.display = 'none';
    };

    const plateName = document.createElement('span');
    plateName.className = 'vlb-players-plate-name';
    plateName.textContent = player.name || '';
    plateName.style.fontSize = `${estimatePlateFontSize(player.name)}px`;

    plateWrap.append(plateImg, plateName);

    const evalPtWrap = document.createElement('div');
    evalPtWrap.className = 'vlb-players-eval-pt';

    const tier = h ? h.getEvaluationTier(player.evaluation) : 'default';
    const evalEmblem = document.createElement('span');
    evalEmblem.className = `vlb-profile-eval-emblem vlb-profile-eval-emblem--${tier} vlb-players-eval-mini`;
    const evalText = document.createElement('span');
    evalText.className = 'vlb-profile-eval-text';
    evalText.textContent = player.evaluation ? String(player.evaluation).trim() : '—';
    evalEmblem.appendChild(evalText);

    const ptEl = document.createElement('span');
    ptEl.className = 'vlb-players-pt';
    ptEl.textContent = h ? h.formatExactPt(player.total) : `${player.total}pt`;

    evalPtWrap.append(evalEmblem, ptEl);

    const abilitiesBox = document.createElement('div');
    abilitiesBox.className = 'vlb-players-abilities';

    const abilityOrder = getActiveAbilities();
    abilityOrder.forEach((abName) => {
      const entry = player.abilities ? player.abilities[abName] : null;
      if (h && entry) {
        const { scaledScore } = h.computeAbilityGauge(abName, entry);
        const rankText = h.resolveAbilityRankText(entry, scaledScore);
        abilitiesBox.appendChild(h.createRankBadge(rankText, scaledScore, true));
      } else if (h) {
        abilitiesBox.appendChild(h.createRankBadge('', undefined, true));
      }
    });

    row1.append(posEl, plateWrap, evalPtWrap, abilitiesBox);
    card.appendChild(row1);

    // 2段目（全選手共通で常時表示）：頑丈・投打・特能
    const row2 = document.createElement('div');
    row2.className = 'vlb-players-row2';

    const durWrap = document.createElement('span');
    durWrap.className = 'vlb-players-dur-wrap';
    durWrap.appendChild(document.createTextNode('頑'));
    const durRank = player.durability ? String(player.durability).trim() : '';
    if (h) {
      durWrap.appendChild(h.createRankBadge(durRank, undefined, true));
    } else {
      const d = document.createElement('span');
      d.textContent = durRank || '—';
      durWrap.appendChild(d);
    }

    const handEl = document.createElement('span');
    handEl.className = 'vlb-players-hand';
    handEl.textContent = h ? h.formatThrowingAndBats(player.throwingHand, player.bats) : '—';

    row2.append(durWrap, handEl);

    const specialItems = getSpecialItemsForPlayer(player);
    specialItems.slice(0, MAX_LIST_SPECIALS).forEach((item) => {
      const chip = document.createElement('span');
      chip.className = `vlb-players-sp-chip vlb-profile-special-chip--${item.kind}`;
      chip.textContent = item.text;
      row2.appendChild(chip);
    });

    if (specialItems.length > MAX_LIST_SPECIALS) {
      const more = document.createElement('span');
      more.className = 'vlb-players-sp-chip vlb-players-sp-chip--more';
      more.textContent = `+${specialItems.length - MAX_LIST_SPECIALS}`;
      row2.appendChild(more);
    }

    card.appendChild(row2);

    card.addEventListener('click', () => {
      if (window.VLBProfile && typeof window.VLBProfile.open === 'function') {
        window.VLBProfile.open(player.name, plateCode);
      }
    });

    return card;
  }

  function renderList() {
    if (!listEl) return;

    if (state.loadError) {
      updateSummaryBar(0);
      listEl.innerHTML = '';
      const err = document.createElement('div');
      err.className = 'vlb-players-empty';
      err.textContent = state.loadError;
      listEl.appendChild(err);
      return;
    }

    if (!state.players) {
      updateSummaryBar(0);
      listEl.innerHTML = '';
      const loading = document.createElement('div');
      loading.className = 'vlb-players-empty';
      loading.textContent = '選手データを読み込んでいます…';
      listEl.appendChild(loading);
      return;
    }

    const list = filterAndSortPlayers();
    updateSummaryBar(list.length);
    listEl.innerHTML = '';

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'vlb-players-empty';
      empty.textContent = '条件に一致する選手が見つかりませんでした';
      listEl.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    list.forEach((player) => {
      frag.appendChild(buildPlayerCard(player));
    });
    listEl.appendChild(frag);
    listEl.scrollTop = 0;
    fitAllPlateNamesBatch();
  }

  function loadPlayersIfNeeded() {
    if (state.players) {
      renderList();
      return;
    }
    if (!window.VLBProfile || typeof window.VLBProfile.getPlayers !== 'function') {
      state.loadError = '選手データ読み込みモジュールが見つかりません';
      renderList();
      return;
    }
    state.loadError = '';
    renderList();
    window.VLBProfile.getPlayers()
      .then(({ list }) => {
        state.players = Array.isArray(list) ? list : [];
        state.loadError = '';
        renderList();
      })
      .catch((err) => {
        state.loadError = (err && err.message) || '選手データの取得に失敗しました';
        renderList();
      });
  }

  function setBottomNavActive(pageName) {
    document.querySelectorAll('.bottom-nav button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.page === pageName);
    });
  }

  function attachSharedSkyPanel(targetParent, beforeNode, inPlayers) {
    const skyPanel = document.getElementById('skyPanel');
    if (!skyPanel || !targetParent) return;
    if (inPlayers) {
      skyPanel.classList.add('vlb-sky-in-players');
    } else {
      skyPanel.classList.remove('vlb-sky-in-players');
    }
    if (skyPanel.parentElement !== targetParent) {
      targetParent.insertBefore(skyPanel, beforeNode || null);
    }
  }

  function showPlayersPage() {
    buildViewDom();
    const stadiumWrap = document.querySelector('.stadium-wrap');
    attachSharedSkyPanel(viewEl, shellEl, true);
    if (stadiumWrap) stadiumWrap.style.display = 'none';
    if (viewEl) viewEl.hidden = false;
    state.isOpen = true;
    setBottomNavActive('選手一覧');
    loadPlayersIfNeeded();
  }

  function showHomePage() {
    const stadiumWrap = document.querySelector('.stadium-wrap');
    attachSharedSkyPanel(stadiumWrap, stadiumWrap ? stadiumWrap.firstChild : null, false);
    if (stadiumWrap) stadiumWrap.style.display = '';
    if (viewEl) viewEl.hidden = true;
    state.isOpen = false;
    setBottomNavActive('ホーム');
  }

  function attachBottomNavInterceptor() {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;

    nav.addEventListener(
      'click',
      (event) => {
        const button = event.target && event.target.closest ? event.target.closest('button') : null;
        if (!button || !nav.contains(button)) return;

        const page = button.dataset.page;
        if (page === '選手一覧') {
          event.stopPropagation();
          showPlayersPage();
        } else if (page === 'ホーム') {
          event.stopPropagation();
          showHomePage();
        }
      },
      true
    );
  }

  function initPlayersPage() {
    attachBottomNavInterceptor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlayersPage);
  } else {
    initPlayersPage();
  }
})();

'use strict';
let selectedDifficulty = 1,
  metaProfile = null;
const META_KEY = 'autochess-meta-v1';
function enemyIcon(id, summonKind = null) {
  const t = W.byId(id),
    color =
      summonKind === 'fire'
        ? '#d68c59'
        : summonKind === 'lightning'
          ? '#dfc966'
          : summonKind === 'plague'
            ? '#98ad72'
            : t.color;
  let shape;
  if (id === 'E04' && !summonKind)
    shape =
      '<path d="M22 25L3 12L6 44L24 39M42 25L61 12L58 44L40 39" fill="' +
      color +
      '" stroke="#17151c" stroke-width="3"/><ellipse cx="32" cy="35" rx="15" ry="19" fill="' +
      color +
      '"/>';
  else if (id === 'E02' && !summonKind)
    shape =
      '<path d="M18 28L6 18M18 37L4 36M20 44L7 54M46 28L58 18M46 37L60 36M44 44L57 54" stroke="' +
      color +
      '" stroke-width="5"/><ellipse cx="32" cy="35" rx="19" ry="20" fill="' +
      color +
      '"/>';
  else if (id === 'E06')
    shape =
      '<rect x="11" y="14" width="42" height="43" rx="7" fill="' +
      color +
      '" stroke="#17151c" stroke-width="4"/><path d="M33 15L29 27L37 33L32 43" fill="none" stroke="#78634e" stroke-width="3"/>';
  else if (id === 'E01')
    shape =
      '<path d="M14 32Q12 9 32 10Q52 9 50 32L44 43V54H20V43Z" fill="' +
      color +
      '" stroke="#17151c" stroke-width="4"/><path d="M26 46V54M33 46V54M40 46V54" stroke="#17151c" stroke-width="3"/>';
  else if (id === 'E03')
    shape =
      '<path d="M17 29L4 19L13 42M47 29L60 19L51 42" fill="' +
      color +
      '"/><ellipse cx="32" cy="35" rx="20" ry="23" fill="' +
      color +
      '"/><path d="M18 18L32 5L46 18Z" fill="#6c7051"/>';
  else if (id === 'E07' || summonKind === 'fire')
    shape =
      '<path d="M13 50Q4 32 25 19L34 4L40 25L51 17Q65 43 50 54Z" fill="' +
      color +
      '" stroke="#17151c" stroke-width="3"/>';
  else if (id === 'E08')
    shape =
      '<path d="M9 52L12 27L20 32L20 10L31 24L43 8L44 31L56 24L55 54Z" fill="' +
      color +
      '" stroke="#17151c" stroke-width="3"/>';
  else
    shape =
      '<path d="M7 50Q5 27 23 25Q31 7 39 25Q60 28 57 51Q33 64 7 50Z" fill="' +
      color +
      '" stroke="#17151c" stroke-width="3"/>';
  return `<svg class="avatar" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="7" fill="#29272e"/>${shape}<circle cx="24" cy="34" r="3.5" fill="#1a1820"/><circle cx="40" cy="34" r="3.5" fill="#1a1820"/><path d="M28 44H36" stroke="#1a1820" stroke-width="3" stroke-linecap="round"/>${id === 'E99' ? '<circle cx="49" cy="13" r="9" fill="#f7db7f" stroke="#8a692d" stroke-width="2"/><path d="M49 7V19" stroke="#8a692d" stroke-width="2"/>' : ''}</svg>`;
}
function renderDifficultyChoices() {
  const active = W.difficulty(selectedDifficulty);
  $('difficultyChoices').innerHTML = W.difficulties
    .map(
      (d) =>
        `<button data-difficulty="${d.level}" aria-pressed="${selectedDifficulty === d.level}"><b>${d.level}</b><span>시작 HP ${d.startingHealth}</span><small>적 피해 ${d.damagePercent >= 0 ? '+' : ''}${d.damagePercent}%</small></button>`,
    )
    .join('');
  $('difficultySummary').textContent =
    '난이도 ' +
    active.level +
    ' · 시작 체력 ' +
    active.startingHealth +
    ' · 적이 가하는 피해 ' +
    (active.damagePercent >= 0 ? '+' : '') +
    active.damagePercent +
    '%';
}
function renderHome() {
  const saved = !!localStorage.getItem(KEY);
  $('homeContinueBtn').hidden = !saved;
  $('continueSummary').textContent = saved
    ? '난이도 ' +
      state.difficulty +
      ' · ' +
      P.label(state) +
      ' · HP ' +
      state.health +
      (battle ? ' · 전투 일시정지' : '')
    : '';
  $('metaLevel').textContent = '메타 레벨 ' + metaProfile.metaLevel;
  $('metaNote').textContent = '인게임 레벨과 별도 · 성장 규칙은 추후 적용';
}
function showHome(mode = 'menu') {
  if (typeof cancelPresentationEffects === 'function') cancelPresentationEffects();
  if (typeof finishDrag === 'function') finishDrag();
  if (typeof closeBattleOverlays === 'function') closeBattleOverlays();
  if (battle) combatView?.pause();
  else combatView?.reset();
  setRecruitOpen(false);
  hideItemDetail();
  if (battle) {
    clearInterval(timer);
    if (typeof stopCombatClock === 'function') stopCombatClock(true);
  }
  selected = null;
  selectedBattle = null;
  renderDetail();
  if ($('modal').open) $('modal').close();
  $('gameView').hidden = true;
  $('homeView').hidden = false;
  $('homeMenu').hidden = mode === 'difficulty';
  $('difficultyScreen').hidden = mode !== 'difficulty';
  renderHome();
  if (mode === 'difficulty') renderDifficultyChoices();
}
function enterGame() {
  performance.mark('autochess:enter');
  if (typeof warmCombatWorker === 'function') warmCombatWorker();
  $('homeView').hidden = true;
  $('gameView').hidden = false;
  render();
  requestAnimationFrame(() => {
    performance.mark('autochess:field');
    performance.measure('autochess:enter-to-field', 'autochess:enter', 'autochess:field');
  });
  if (battle) {
    combatView?.resume();
    runTimer();
  } else if (state.roundPhase === 'supply') showSupply();
  else if (state.roundPhase === 'augment') showAugment();
  else if (state.completionChoice === 'end') showCompletionSummary();
  else if (state.roundPhase === 'result' || state.done) showResult(state.lastResult);
}
function clearUnitSelection() {
  selected = null;
  selectedBattle = null;
  $('unitPopover').hidden = true;
  render();
}
function positionUnitPopover(x, y) {
  const el = $('unitPopover');
  if (el.hidden) return;
  const source = selectedBattle
    ? document.querySelector('#board [data-combat="' + selectedBattle + '"]')
    : document.querySelector('[data-unit-uid="' + selected + '"]');
  positionInfo(el, x, y, source?.getBoundingClientRect());
}
function renderShell() {
  const d = W.difficulty(state.difficulty);
  $('runModifiers').innerHTML =
    `<span>난이도 ${d.level} · 적 피해 ${d.damagePercent >= 0 ? '+' : ''}${d.damagePercent}%</span><span class="streak-info">${state.winStreak || 0}연승 · 다음 승리 보너스 +${Math.min(P.config.rewards.streakCap, (state.winStreak || 0) + 1)}G</span>`;
}
function setupShell() {
  try {
    const parsed = JSON.parse(localStorage.getItem(META_KEY));
    metaProfile =
      parsed && parsed.version === 1 && Number.isInteger(parsed.metaLevel) && parsed.metaLevel >= 1
        ? parsed
        : W.newProfile();
  } catch {
    metaProfile = W.newProfile();
  }
  localStorage.setItem(META_KEY, JSON.stringify(metaProfile));
  selectedDifficulty = state.difficulty;
  $('homeNewBtn').onclick = () => showHome('difficulty');
  $('homeBackBtn').onclick = () => showHome();
  $('homeContinueBtn').onclick = enterGame;
  $('homeBtn').onclick = () => showHome();
  $('resetBtn').onclick = () => showHome('difficulty');
  $('difficultyChoices').addEventListener('click', (e) => {
    const button = e.target.closest('[data-difficulty]');
    if (button) {
      selectedDifficulty = Number(button.dataset.difficulty);
      renderDifficultyChoices();
    }
  });
  $('confirmDifficultyBtn').onclick = () => {
    resetRun();
    enterGame();
  };
  $('closeUnitPopover').onclick = clearUnitSelection;
  document.addEventListener('click', (e) => {
    const path = e.composedPath(),
      inField = path.some((n) => n?.id === 'board' || n?.id === 'bench'),
      inPopover = path.some((n) => n?.id === 'unitPopover');
    if (inField) {
      if (selectedUnit() && !dragAction?.active) positionUnitPopover(e.clientX, e.clientY);
      return;
    }
    if (!inPopover && (selected !== null || selectedBattle !== null)) clearUnitSelection();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('modal').open) clearUnitSelection();
  });
  const priorRules = $('rulesBtn').onclick;
  $('rulesBtn').onclick = () => {
    priorRules();
    $('modalContent').insertAdjacentHTML(
      'afterbegin',
      '<h3>난이도·적군·연승</h3><p>난이도1은 시작HP100 / 적 피해−40%, 난이도10은 시작HP50 / 적 피해+50%입니다. 짝수 난이도마다 시작HP가10 감소합니다. 피해 보정은 적의 공격·스킬·지속피해·소환수 공격에 적용하며 플레이어 패배HP 공식은 기존대로입니다.<br>전투당10%로 적1명이 보물 슬라임으로 바뀝니다. 처치 시 아이템40% 또는3~5G60% 중1종을 즉시 지급합니다. 일반3/1G, 보스5/3G이며 승리마다 연승 보너스+1G(최대5G), 패배 시 초기화, 보급은 연승 유지입니다. 이자와 기존 보스 추가 보상도 유지합니다.<br>시작화면의 메타레벨은 별도 로컬 데이터 기반만 마련했습니다. 능력치·뽑기와 메타 성장 지급 규칙은 아직 비활성입니다.</p>',
    );
  };
  showHome();
}

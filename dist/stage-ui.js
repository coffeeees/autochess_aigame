'use strict';
const roundIcons = {
  SUPPLY: '<path d="M3 9h18v11H3zM4 9V5h16v4M2 9h20M10 9v5h4V9"/>',
  BATTLE: '<path d="m4 3 16 16m0-16L4 19M3 3l1 5 4-4zM21 3l-1 5-4-4zM2 16l6 6m8-6 6 6"/>',
  BOSS: '<path d="M6 8 2 3l1 9 4 3m11-7 4-5-1 9-4 3M6 8q6-5 12 0v8l-6 6-6-6zM8 12l3 1m5-1-3 1M10 17h4"/>',
};
const roundAssets = {
  SUPPLY: 'assets/ui/stage_supply_chest_64.png',
  BATTLE: 'assets/ui/stage_battle_swords_64.png',
  BOSS: 'assets/ui/stage_boss_mask_64.png',
};
function roundIcon(type) {
  return '<img class="reference-stage-icon" src="' + roundAssets[type] + '" alt="">';
}
function renderProgression() {
  const type = P.roundType(state.stage, state.round),
    phase = state.roundPhase,
    locked = !!battle || state.done || phase !== 'prepare',
    required = P.config.level.requirements[state.level];
  $('levelLabel').textContent = 'Lv. ' + state.level;
  $('levelCapacity').textContent = '배치 ' + P.capacity(state) + '명';
  $('levelAction').textContent =
    state.level >= 10
      ? 'MAX LEVEL'
      : locked
        ? '준비 단계에서 구매'
        : state.gold < 4
          ? '4G 필요'
          : '4G · +4XP';
  $('buyXpBtn').setAttribute(
    'aria-label',
    '레벨 ' + state.level + ' · ' + state.xp + ' XP · 4G로 4XP 구매',
  );
  $('xpLabel').textContent = state.level >= 10 ? 'MAX' : state.xp + ' / ' + required + ' XP';
  $('buyXpBtn').disabled = locked || state.level >= 10 || state.gold < 4;
  const percent = state.level >= 10 ? 100 : Math.min(100, (state.xp / required) * 100);
  $('xpFill').style.height = percent + '%';
  $('xpTrack').setAttribute('aria-valuemin', '0');
  $('xpTrack').setAttribute('aria-valuemax', state.level >= 10 ? '100' : String(required));
  $('xpTrack').setAttribute('aria-valuenow', state.level >= 10 ? '100' : String(state.xp));
  $('xpTrack').setAttribute(
    'aria-valuetext',
    $('levelLabel').textContent + ' · ' + $('xpLabel').textContent,
  );
  $('stageLabel').textContent = 'STAGE ' + state.stage;
  $('stageNote').textContent =
    type === 'SUPPLY'
      ? '안전 보급 · 적 없음 / 피해 없음'
      : type === 'BOSS'
        ? '보스 전투 · 승리 시 추가 보상'
        : '일반 전투 · 승리 3G / 패배 1G';
  $('roundTrack').innerHTML = Array.from({ length: 5 }, (_, i) => {
    const n = i + 1,
      t = P.roundType(state.stage, n);
    return `<div aria-label="${state.stage}-${n} ${t}" class="round-step ${n === state.round ? 'current' : n < state.round ? 'completed' : 'upcoming'}" ${n === state.round ? 'aria-current="step"' : ''}><span class="node-orb" aria-hidden="true">${roundIcon(t)}</span><span>${t === 'SUPPLY' ? '▣' : t === 'BOSS' ? '♛' : '⚔'} ${t}</span></div>`;
  }).join('');
  $('fightBtn').textContent =
    phase === 'complete'
      ? '완료 기록'
      : phase === 'supply'
        ? '보급 선택'
        : phase === 'result'
          ? '결과 확인'
          : phase === 'augment'
            ? '증강 선택'
            : type === 'SUPPLY'
              ? '보급품 받기 →'
              : '전투 시작 →';
  $('fightBtn').disabled =
    !!battle ||
    (state.done && phase !== 'complete') ||
    (phase === 'prepare' &&
      type !== 'SUPPLY' &&
      (!deployed().length || deployed().length > P.capacity(state)));
  const emptyBattle = phase === 'prepare' && type !== 'SUPPLY' && !deployed().length;
  if (emptyBattle) $('fightBtn').textContent = '아군 배치 필요';
  $('fightBtn').title = emptyBattle ? '아군을 1명 이상 배치해야 전투를 시작할 수 있습니다.' : '';
  if (typeof observeLiquidXP === 'function') observeLiquidXP(state.level, state.xp, percent);
  if (typeof observeLevelEffects === 'function') observeLevelEffects(state.level);
  for (const id of ['rerollBtn', 'recruitBtn', 'sellBtn']) if (locked) $(id).disabled = true;
  if (locked && !battle)
    for (const el of document.querySelectorAll('#board .cell,#bench .bench-slot,#shop .recruit'))
      el.disabled = true;
  $('closeModal').disabled = false;
  if (!battle && phase === 'result') $('phase').textContent = '라운드 완료';
  if (combatView?.finishing) {
    $('fightBtn').disabled = true;
    $('fightBtn').textContent = '전투 마무리';
    $('phase').textContent = '전투 마무리';
  }
  renderInventory();
  renderShell();
  const augmentMarkup = state.augments.length
    ? state.augments
        .map((id) => {
          const a = P.augmentById(id);
          return `<button class="augment-tag augment-${a.tier || 'legacy'}" data-augment-peek="${a.id}" aria-label="${a.name} · ${a.text}" aria-expanded="false"><b>${a.icon} ${a.name}</b><small>${a.text}</small></button>`;
        })
        .join('')
    : '<p class="hint">1-3 · 3-3 · 5-3 진입 직전에 선택합니다.</p>';
  if ($('chosenAugments').innerHTML !== augmentMarkup)
    $('chosenAugments').innerHTML = augmentMarkup;
}
function showAugment() {
  setRecruitOpen(false);
  const pending = state.augmentState?.pendingPick;
  if (!pending) return;
  const tier = AutoAugments.tiers[pending.tier],
    candidates = P.availableAugments(state);
  showModal(
    `<section class="augment-selection augment-${pending.tier}" style="--augment-color:${tier.color}"><span class="eyebrow">증강 선택 ${pending.pick} / 3 · ${pending.node} 진입 전</span><h2>${tier.name} 증강</h2><p>같은 등급의 세 후보 중 하나를 선택하세요. 효과는 이번 원정 동안 유지됩니다.</p><p class="hint">아래 선택 버튼으로 확정합니다. 닫거나 새로고침해도 등급·후보는 바뀌지 않습니다.</p><div class="augment-choices">${candidates.map((a) => `<article class="augment-card"><strong>${a.icon}</strong><h3>${a.name}</h3><p>${a.text}</p><button data-augment="${a.id}">선택 확정</button></article>`).join('')}</div></section>`,
  );
  $('modal').scrollTop = 0;
}
function continueRound() {
  if (battle) return;
  if (state.done) {
    if (state.completionChoice === 'end') showCompletionSummary();
    else $('modal').close();
    return;
  }
  if (state.completionChoice === 'pending') {
    showResult(state.lastResult);
    return;
  }
  if (!P.advanceRound(state)) return;
  combatView?.reset();
  if (state.roundPhase === 'augment') {
    save();
    $('modal').close();
    render();
    showAugment();
    return;
  }
  V.enterShop(state);
  selected = null;
  save();
  $('modal').close();
  render();
  if (typeof showRoundTransition === 'function') showRoundTransition();
  notify('T36', P.label(state) + ' 준비 · ' + P.roundType(state.stage, state.round));
  if (state.roundPhase === 'augment') showAugment();
}
function setupStageUI() {
  $('buyXpBtn').onclick = () => {
    if (battle) return;
    const before = state.level;
    if (P.buyXp(state)) {
      save();
      render();
      notify(
        state.level > before ? 'T33' : 'T32',
        state.level > before
          ? '레벨 ' + state.level + ' 달성 · 배치 한도 증가'
          : '4G를 사용해 4XP를 획득했습니다.',
      );
    }
  };

  const previousRules = $('rulesBtn').onclick;
  $('rulesBtn').onclick = () => {
    previousRules();
    $('modalContent').insertAdjacentHTML(
      'afterbegin',
      `<section class="stage-rule-summary"><h3>스테이지·레벨·장비 규칙</h3><ul>${P.config.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul><pre class="rule-box">${esc(JSON.stringify(P.config, null, 2))}</pre></section>`,
    );
  };
  const previousGuide = $('guideBtn').onclick;
  $('guideBtn').onclick = () => {
    previousGuide();
    $('modalContent').insertAdjacentHTML(
      'afterbegin',
      '<h3>스테이지 진행</h3><p>1-1·1-2는 안전 보급입니다. 5번째 라운드는 항상 보스이며, 1-3·3-3·5-3 진입 직전에 증강을 선택합니다. 레벨3에서 시작해 배치 한도는 레벨과 같습니다. 4G로4XP를 구매하고 최대 레벨10까지 올릴 수 있습니다. 보관함의 아이템은 준비 단계에 장착·해제합니다. 전체 조합에서 최대3개의 추천을 선택하면 영입창에서 해당 조합만 강조합니다. 보유한3성 캐릭터는 상점에서 제외되며 판매하면 다시 등장할 수 있습니다.</p>',
    );
  };
}

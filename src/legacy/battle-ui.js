'use strict';
const battleUI = {
  bond: null,
  bondPinned: false,
  bondTimer: null,
  itemTimer: null,
  itemPinned: false,
  bondSignature: '',
};
function placeSidePeek(el, anchor, side) {
  if (!anchor || el.hidden) return;
  const floor = (document.querySelector('.game-hud')?.getBoundingClientRect().bottom || 70) + 9,
    bottom =
      (document.querySelector('.bench-deck')?.getBoundingClientRect().top || innerHeight) - 10;
  el.style.maxHeight = Math.max(90, bottom - floor) + 'px';
  const box = el.getBoundingClientRect(),
    gap = 13;
  let x = side === 'left' ? anchor.left - box.width - gap : anchor.right + gap;
  if (x < 8) x = anchor.right + gap;
  if (x + box.width > innerWidth - 8) x = anchor.left - box.width - gap;
  el.style.left = Math.max(8, Math.min(innerWidth - box.width - 8, x)) + 'px';
  el.style.top = Math.max(floor, Math.min(bottom - box.height, anchor.top - 4)) + 'px';
}
function closeBondPeek() {
  clearTimeout(battleUI.bondTimer);
  if (battleUI.bond)
    document
      .querySelector('[data-bond-peek="' + CSS.escape(battleUI.bond) + '"]')
      ?.setAttribute('aria-expanded', 'false');
  battleUI.bond = null;
  battleUI.bondPinned = false;
  battleUI.bondSignature = '';
  $('bondPeek').hidden = true;
}
function closeHudPanels() {
  for (const [id, button] of [
    ['settingsPopover', 'settingsBtn'],
    ['morePopover', 'moreBtn'],
  ]) {
    $(id).hidden = true;
    $(button).setAttribute('aria-expanded', 'false');
  }
}
function closeBattleOverlays() {
  if (typeof closeAugmentPeek === 'function') closeAugmentPeek();
  closeHudPanels();
  closeBondPeek();
  battleUI.itemPinned = false;
  clearTimeout(battleUI.itemTimer);
  hideItemDetail();
}
function experimentalBondText(rule, tier) {
  if (!rule) return '실험용 세부 효과 없음';
  return Object.entries(rule)
    .filter(([k]) => k !== 'scope')
    .map(([k, value]) => {
      const n = value * tier,
        point = ['CTC', 'CTH', 'DOD'].includes(k),
        ratio = Math.abs(value) < 1;
      return (
        k + ' ' + (n > 0 ? '+' : '') + (ratio ? Math.round(n * 100) + '%' : n + (point ? '%p' : ''))
      );
    })
    .join(' · ');
}
function showBondPeek(id, pinned = false) {
  if (dragAction?.active) return;
  const bond = currentBonds().find((b) => b.id === id);
  if (!bond) return;
  clearTimeout(battleUI.bondTimer);
  const wasPinned = battleUI.bond === id && battleUI.bondPinned;
  battleUI.bond = id;
  battleUI.bondPinned = pinned || wasPinned;
  const el = $('bondPeek'),
    experimental = true,
    signature =
      id +
      ':' +
      bond.count +
      ':' +
      bond.tier +
      ':' +
      experimental +
      ':' +
      (state.recommendedBonds || []).includes(id);
  el.hidden = false;
  if (signature !== battleUI.bondSignature) {
    battleUI.bondSignature = signature;
    const members = D.roster.filter((t) => D.hasBond(t, bond.name));
    el.innerHTML = `<div class="peek-head"><h3>유대 ${esc(bond.name)}</h3><button data-close-bond-peek aria-label="조합 상세 닫기">×</button></div><p>${esc(bond.concept)}</p><button class="peek-recommend ${(state.recommendedBonds || []).includes(id) ? 'chosen' : ''}" data-recommend-bond="${esc(id)}" aria-pressed="${(state.recommendedBonds || []).includes(id)}">${(state.recommendedBonds || []).includes(id) ? '★ 추천 해제' : '☆ 이 조합 추천'} · ${(state.recommendedBonds || []).length}/3</button><p class="peek-state">현재 ${bond.count}명 · ${bond.threshold ? bond.threshold + '명 단계 활성' : '단계 미달성'}</p><ul class="peek-stages">${bond.stages.map((stage, i) => `<li class="${stage.achieved ? 'achieved' : ''}"><b>(${stage.threshold}명) ${stage.achieved ? '✓ 달성' : '미달성'}</b>${!stage.reachable ? ' · 🔒' : ''}${'<br>' + esc(bond.effects[i]) + ' <small>임시 v1</small>'}</li>`).join('')}</ul><b class="peek-state">소속 동료 · ${members.length}명</b><div class="peek-members">${members.map((t) => `<button data-peek-inspect="${t.id}" data-peek-bond="${esc(id)}" aria-label="${esc(t.name)} ${t.cost}G ${t.playable ? '' : '미해금'} 상세" title="${esc(t.name)} · ${t.cost}G${t.playable ? '' : ' · 미해금'}">${t.playable ? icon(t.id) : `<span class="peek-draft">${t.id} 🔒</span>`}<small>${esc(t.name.split(' ').at(-1))}</small></button>`).join('')}</div><button class="peek-all" data-peek-members="${esc(id)}">캐릭터 목록 자세히 보기 ↗</button><p class="hint">🔒 미해금 동료는 상세 정보만 확인할 수 있습니다.</p>`;
  }
  const anchor = document.querySelector('[data-bond-peek="' + CSS.escape(id) + '"]');
  anchor?.setAttribute('aria-expanded', 'true');
  placeSidePeek(el, anchor?.getBoundingClientRect(), 'right');
}
function deferBondClose() {
  clearTimeout(battleUI.bondTimer);
  battleUI.bondTimer = setTimeout(() => {
    if (battleUI.bondPinned) return;
    const peek = $('bondPeek'),
      row =
        battleUI.bond &&
        document.querySelector('[data-bond-peek="' + CSS.escape(battleUI.bond) + '"]');
    if (
      peek.matches(':hover') ||
      peek.contains(document.activeElement) ||
      row?.matches(':hover') ||
      row?.contains(document.activeElement)
    )
      return;
    closeBondPeek();
  }, 190);
}
function showItemPeek(button) {
  if (!button || dragAction?.active) return;
  clearTimeout(battleUI.itemTimer);
  if (selectedItem !== button.dataset.itemUid) battleUI.itemPinned = false;
  selectedItem = button.dataset.itemUid;
  renderItemDetail();
  raiseItemTooltip(button);
  placeSidePeek($('itemPopover'), button.getBoundingClientRect(), 'left');
}
function deferItemClose() {
  clearTimeout(battleUI.itemTimer);
  battleUI.itemTimer = setTimeout(() => {
    if (battleUI.itemPinned || dragAction?.active) return;
    const peek = $('itemPopover'),
      button =
        selectedItem &&
        document.querySelector('[data-item-uid="' + CSS.escape(selectedItem) + '"]');
    if (
      peek.matches(':hover') ||
      peek.contains(document.activeElement) ||
      button?.matches(':hover') ||
      button?.contains(document.activeElement)
    )
      return;
    hideItemDetail();
  }, 190);
}
function syncSidePanels() {
  if (
    matchMedia('(max-width:720px)').matches &&
    $('bondPanel').classList.contains('panel-expanded') &&
    $('inventoryPanel').classList.contains('panel-expanded')
  )
    $('bondPanel').classList.remove('panel-expanded');
  const small = matchMedia('(max-width:980px)').matches;
  for (const [id, toggle, label] of [
    ['bondPanel', 'toggleBonds', '조합'],
    ['inventoryPanel', 'toggleInventory', '아이템'],
  ]) {
    const panel = $(id),
      open = small
        ? panel.classList.contains('panel-expanded')
        : !panel.classList.contains('is-collapsed');
    $(toggle).setAttribute('aria-expanded', String(open));
    $(toggle).setAttribute('aria-label', label + ' 패널 ' + (open ? '접기' : '펼치기'));
  }
}
function changeRecommendedBond(id) {
  const result = V.toggleRecommendation(state, id);
  if (result.ok) {
    save();
    render();
    $('recommendFeedback').textContent = '';
  } else {
    $('recommendFeedback').textContent = '';
    notify('T34', result.message);
  }
}
function renderBattleUI() {
  $('augmentRack').hidden = !state.augments.length;
  $('gameView').style.setProperty('--augment-space', state.augments.length ? '38px' : '0px');
  $('gameView').classList.toggle('is-in-combat', !!battle);
  if (typeof positionCombatDamage === 'function') positionCombatDamage();
  $('recommendTray').innerHTML = (state.recommendedBonds || [])
    .map(
      (id) =>
        `<button data-recommend-bond="${esc(id)}" title="${esc(id)} 추천 해제">★ ${esc(id)} ×</button>`,
    )
    .join('');
  $('hudDifficulty').textContent = '난이도 ' + state.difficulty;
  $('bondCount').textContent = '(' + currentBonds().filter((b) => b.count > 0).length + ')';
  $('inventoryTotal').textContent =
    '(' + state.inventory.filter((i) => i.equippedTo === null).length + ')';
  if (battleUI.bond) showBondPeek(battleUI.bond);
  if (!selectedItem) battleUI.itemPinned = false;
  else if (!$('itemPopover').hidden) {
    const anchor = document.querySelector('[data-item-uid="' + CSS.escape(selectedItem) + '"]');
    placeSidePeek($('itemPopover'), anchor?.getBoundingClientRect(), 'left');
  }
}
function setupBattleUI() {
  if (typeof ResizeObserver !== 'undefined') {
    const storageObserver = new ResizeObserver(() => positionCombatDamage());
    storageObserver.observe($('inventoryPanel'));
  }
  $('startupLogBtn')?.addEventListener('click', () => {
    const data = {
      version: AutoPatchNotes.current,
      timeOrigin: performance.timeOrigin,
      exportedAt: Date.now(),
      longTasks: globalThis.AutoStartup?.longTasks || [],
      speed,
      viewport: { width: innerWidth, height: innerHeight },
      hidden: document.hidden,
      marks: performance
        .getEntriesByType('mark')
        .filter((e) => e.name.startsWith('autochess:'))
        .map((e) => ({ name: e.name, ms: e.startTime })),
      worker: globalThis.AutoCombatStartup || null,
    };
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      ),
      link = document.createElement('a');
    link.href = url;
    link.download = 'AUTOCHESS-startup-' + AutoPatchNotes.current + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('settingsPatchBtn').onclick = () => {
    closeHudPanels();
    $('patchBtn').click();
  };
  for (const [button, id] of [
    ['settingsBtn', 'settingsPopover'],
    ['moreBtn', 'morePopover'],
  ])
    $(button).onclick = () => {
      const open = $(id).hidden;
      closeHudPanels();
      if (open) {
        $(id).hidden = false;
        $(button).setAttribute('aria-expanded', 'true');
        $(id).querySelector('button,input')?.focus({ preventScroll: true });
      }
    };
  for (const [id, button] of [
    ['bondPanel', 'toggleBonds'],
    ['inventoryPanel', 'toggleInventory'],
  ])
    $(button).onclick = () => {
      const panel = $(id);
      if (matchMedia('(max-width:980px)').matches) {
        panel.classList.remove('is-collapsed');
        panel.classList.toggle('panel-expanded');
        if (matchMedia('(max-width:720px)').matches && panel.classList.contains('panel-expanded'))
          $(id === 'bondPanel' ? 'inventoryPanel' : 'bondPanel').classList.remove('panel-expanded');
      } else panel.classList.toggle('is-collapsed');
      closeBondPeek();
      hideItemDetail();
      syncSidePanels();
      if (typeof positionCombatDamage === 'function') positionCombatDamage();
    };
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch' || dragAction?.active) return;
    const bond = e.target.closest('[data-bond-peek]'),
      item = e.target.closest('[data-item-uid]');
    if (bond && !bond.contains(e.relatedTarget)) showBondPeek(bond.dataset.bondPeek);
    if (item && !item.contains(e.relatedTarget)) showItemPeek(item);
    if (e.target.closest('#bondPeek')) clearTimeout(battleUI.bondTimer);
    if (e.target.closest('#itemPopover')) clearTimeout(battleUI.itemTimer);
  });
  document.addEventListener('pointerout', (e) => {
    if (
      e.target.closest('[data-bond-peek],#bondPeek') &&
      !e.target.closest('#bondPeek')?.contains(e.relatedTarget)
    )
      deferBondClose();
    if (
      e.target.closest('[data-item-uid],#itemPopover') &&
      !e.target.closest('#itemPopover')?.contains(e.relatedTarget)
    )
      deferItemClose();
  });
  document.addEventListener('focusin', (e) => {
    const bond = e.target.closest('[data-bond-peek]'),
      item = e.target.closest('[data-item-uid]');
    if (bond) showBondPeek(bond.dataset.bondPeek);
    if (item) showItemPeek(item);
  });
  document.addEventListener('focusout', (e) => {
    if (e.target.closest('[data-bond-peek],#bondPeek')) deferBondClose();
    if (e.target.closest('[data-item-uid],#itemPopover')) deferItemClose();
  });
  document.addEventListener('click', (e) => {
    if (suppressDragClick()) return;
    const recommendation = e.target.closest('[data-recommend-bond]');
    if (recommendation) {
      changeRecommendedBond(recommendation.dataset.recommendBond);
      return;
    }
    const path = e.composedPath();
    if (e.target.closest('[data-close-hud]')) closeHudPanels();
    else if (
      !path.some((n) =>
        ['settingsPopover', 'morePopover', 'settingsBtn', 'moreBtn'].includes(n?.id),
      )
    )
      closeHudPanels();
    const bond = e.target.closest('[data-bond-peek]');
    if (bond) {
      if (battleUI.bondPinned && battleUI.bond === bond.dataset.bondPeek) closeBondPeek();
      else showBondPeek(bond.dataset.bondPeek, true);
      return;
    }
    if (e.target.closest('[data-close-bond-peek]')) closeBondPeek();
    const members = e.target.closest('[data-peek-members]'),
      inspectButton = e.target.closest('[data-peek-inspect]');
    if (members) {
      showBondMembers(members.dataset.peekMembers);
      return;
    }
    if (inspectButton) {
      inspect(inspectButton.dataset.peekInspect, inspectButton.dataset.peekBond);
      return;
    }
    if (!path.some((n) => n?.id === 'bondPeek')) closeBondPeek();
    if (e.target.closest('[data-item-uid]')) {
      battleUI.itemPinned = true;
      const clicked = e.target.closest('[data-item-uid]'),
        button =
          document.querySelector('[data-item-uid="' + CSS.escape(clicked.dataset.itemUid) + '"]') ||
          clicked;
      placeSidePeek($('itemPopover'), button.getBoundingClientRect(), 'left');
    } else if (!path.some((n) => n?.id === 'itemPopover') || e.target.closest('#closeItemPopover'))
      battleUI.itemPinned = false;
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-unit-uid],[data-item-uid]')) closeBondPeek();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('modal').open) closeBattleOverlays();
    const row = e.target.closest('[data-bond-peek]');
    if (row && e.target === row && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      showBondPeek(row.dataset.bondPeek, true);
    }
  });
  window.addEventListener('resize', () => {
    syncSidePanels();
    if (battleUI.bond) showBondPeek(battleUI.bond);
    if (selectedItem && !$('itemPopover').hidden) {
      const button = document.querySelector('[data-item-uid="' + CSS.escape(selectedItem) + '"]');
      placeSidePeek($('itemPopover'), button?.getBoundingClientRect(), 'left');
    }
  });
  syncSidePanels();
  renderBattleUI();
  if (typeof setupAugmentRack === 'function') setupAugmentRack();
}

const augmentView = { id: null, pinned: false, timer: null };
function closeAugmentPeek() {
  clearTimeout(augmentView.timer);
  if (augmentView.id)
    document
      .querySelector('[data-augment-peek="' + CSS.escape(augmentView.id) + '"]')
      ?.setAttribute('aria-expanded', 'false');
  augmentView.id = null;
  augmentView.pinned = false;
  $('augmentPeek').hidden = true;
}
function showAugmentPeek(id, pinned = false) {
  const def = P.augmentById(id),
    anchor = document.querySelector('[data-augment-peek="' + CSS.escape(id) + '"]');
  if (!def || !anchor || dragAction?.active) return;
  clearTimeout(augmentView.timer);
  if (augmentView.id !== id) augmentView.pinned = false;
  augmentView.id = id;
  augmentView.pinned = pinned || augmentView.pinned;
  const el = $('augmentPeek'),
    tier = def.tier ? AutoAugments.tiers[def.tier].name : '이전 증강';
  el.hidden = false;
  el.innerHTML = `<div class="peek-head"><h3>${esc(def.icon)} ${esc(def.name)}</h3><button data-close-augment-peek aria-label="증강 상세 닫기">×</button></div><span class="augment-tier-label augment-${def.tier || 'legacy'}">${esc(tier)}</span><p>${esc(def.text)}</p><small class="hint">이번 원정에 적용 중</small>`;
  anchor.setAttribute('aria-expanded', 'true');
  const box = el.getBoundingClientRect(),
    a = anchor.getBoundingClientRect(),
    floor = (document.querySelector('.game-hud')?.getBoundingClientRect().bottom || 70) + 8;
  el.style.left = Math.max(8, Math.min(innerWidth - box.width - 8, a.left)) + 'px';
  el.style.top = Math.max(floor, a.top - box.height - 10) + 'px';
}
function deferAugmentClose() {
  clearTimeout(augmentView.timer);
  augmentView.timer = setTimeout(() => {
    if (augmentView.pinned) return;
    const el = $('augmentPeek'),
      anchor =
        augmentView.id &&
        document.querySelector('[data-augment-peek="' + CSS.escape(augmentView.id) + '"]');
    if (
      el.matches(':hover') ||
      el.contains(document.activeElement) ||
      anchor?.matches(':hover') ||
      anchor?.contains(document.activeElement)
    )
      return;
    closeAugmentPeek();
  }, 190);
}
function positionCombatDamage() {
  const panel = $('combatDamagePanel');
  if (!panel) return;
  panel.hidden = !battle;
  if (!battle) {
    $('inventoryPanel').style.maxHeight = '';
    return;
  }
  const inventoryNode = $('inventoryPanel'),
    benchLimit = document.querySelector('.bench-deck').getBoundingClientRect(),
    inventoryTop = inventoryNode.getBoundingClientRect().top;
  inventoryNode.style.maxHeight =
    Math.max(180, benchLimit.top - inventoryTop - 62 - (innerWidth <= 980 ? 100 : 116)) + 'px';
  const inventory = inventoryNode.getBoundingClientRect(),
    stage = document.querySelector('.battle-stage').getBoundingClientRect(),
    bench = document.querySelector('.bench-deck').getBoundingClientRect(),
    height = Math.max(40, Math.min(220, bench.top - inventory.bottom - 62));
  const field = document.querySelector('.battle-art')?.getBoundingClientRect(),
    right = innerWidth - inventory.right,
    available = field ? inventory.right - field.right - 12 : inventory.width;
  panel.style.width = Math.max(inventory.width, Math.min(280, available)) + 'px';
  panel.style.right = right + 'px';
  panel.style.top = Math.min(inventory.bottom + 10, bench.top - height - 52) - stage.top + 'px';
  panel.style.maxHeight = height + 'px';
  panel.style.setProperty('--damage-height', height + 'px');
}
function setupAugmentRack() {
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const button = e.target.closest('[data-augment-peek]');
    if (button && !button.contains(e.relatedTarget)) showAugmentPeek(button.dataset.augmentPeek);
    if (e.target.closest('#augmentPeek')) clearTimeout(augmentView.timer);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest('[data-augment-peek],#augmentPeek')) deferAugmentClose();
  });
  document.addEventListener('focusin', (e) => {
    const button = e.target.closest('[data-augment-peek]');
    if (button) showAugmentPeek(button.dataset.augmentPeek);
  });
  document.addEventListener('focusout', (e) => {
    if (e.target.closest('[data-augment-peek],#augmentPeek')) deferAugmentClose();
  });
  document.addEventListener('click', (e) => {
    if (suppressDragClick()) return;
    const button = e.target.closest('[data-augment-peek]');
    if (button) {
      if (augmentView.id === button.dataset.augmentPeek && augmentView.pinned) closeAugmentPeek();
      else showAugmentPeek(button.dataset.augmentPeek, true);
      return;
    }
    if (
      e.target.closest('[data-close-augment-peek]') ||
      !e.composedPath().some((n) => n?.id === 'augmentPeek')
    )
      closeAugmentPeek();
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-unit-uid],[data-item-uid]')) closeAugmentPeek();
  });
  window.addEventListener('resize', () => {
    positionCombatDamage();
    if (augmentView.id) showAugmentPeek(augmentView.id);
  });
}

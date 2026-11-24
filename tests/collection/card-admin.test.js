// v0.23.0 시작 화면 컬렉션·관리자 + 카드 꾸미기(요청서 AUTOCHESS_COLLECTION_ADMIN_UPDATE_2026-11-25).
// 그림 저장(IndexedDB)과 업로드·새로고침 유지는 브라우저에서 확인했다(패치노트 테스트 기록). 여기서는 순수 규칙과 화면 전환.
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import S from '../../src/core/card-settings.ts';
import D from '../../src/core/data/units.js';
import { createStore } from '../../src/ui/store.ts';
import { adminModules } from '../../src/ui/components/admin/modules.ts';

const bytes = (...xs) => new Uint8Array([...xs, ...Array(16).fill(0)]);
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

test('업로드 형식은 파일 앞부분으로만 판정: PNG·JPG·WebP만, SVG·HTML·스크립트·빈 파일·10MB 초과는 거절', () => {
  a.equal(S.sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'png');
  a.equal(S.sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0)), 'jpeg');
  a.equal(S.sniffImage(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP'))), 'webp');
  for (const text of [
    '<svg xmlns="http://www.w3.org/2000/svg">',
    '<!doctype html>',
    'alert(1)',
    'GIF89a',
  ])
    a.equal(S.sniffImage(new TextEncoder().encode(text)), null, text);
  a.equal(S.checkUpload(bytes(0x89, 0x50, 0x4e, 0x47), 0).ok, false);
  const big = S.checkUpload(bytes(0x89, 0x50, 0x4e, 0x47), S.limits.maxBytes + 1);
  a(!big.ok && big.error.includes('10MB'));
  const svg = S.checkUpload(new TextEncoder().encode('<svg>'), 100);
  a(!svg.ok && svg.error.includes('SVG'));
  a.deepEqual(S.checkUpload(bytes(0xff, 0xd8, 0xff), 2048), { ok: true, format: 'jpeg' });
});

test('그림 안내: 캐릭터 JPG·불투명 가장자리·큰 해상도는 경고(저장은 막지 않음), 배경 JPG는 경고 없음', () => {
  a.equal(S.imageWarnings('character', { format: 'jpeg', width: 600, height: 900 }).length, 1);
  a.equal(
    S.imageWarnings('character', { format: 'png', width: 600, height: 900, opaqueEdges: true })
      .length,
    1,
  );
  a.deepEqual(
    S.imageWarnings('character', { format: 'png', width: 600, height: 900, opaqueEdges: false }),
    [],
  );
  a.deepEqual(S.imageWarnings('background', { format: 'jpeg', width: 800, height: 1100 }), []);
  a.equal(S.imageWarnings('background', { format: 'png', width: 5000, height: 100 }).length, 1);
});

test('표시 이름 오버라이드는 카드에만: 공백 정리·12자 제한·원래 이름이나 빈 값이면 없음, 원본 데이터는 그대로', () => {
  const original = D.byId('C01').name;
  a.equal(S.normalizeName('C01', '  새   이름  '), '새 이름');
  a.equal(S.normalizeName('C01', ''), null);
  a.equal(S.normalizeName('C01', original), null);
  a.equal([...S.normalizeName('C01', '가'.repeat(30))].length, 12);
  a.equal(S.cardName('C01', { displayNameOverride: '카드 이름' }), '카드 이름');
  a.equal(S.cardName('C01', null), original);
  a.equal(D.byId('C01').name, original, '원본 이름 그대로');
  a.equal(S.nameScale('녹스'), 1);
  a(S.nameScale('아주긴이름열두글자까지') < 0.6 && S.nameScale('가'.repeat(40)) === 0.5);
  a.equal(S.isEmptySettings(S.emptySettings('C01')), true);
  a.equal(S.isCharacterId('C45') && !S.isCharacterId('C46'), true);
});

test('시작 화면 → 관리자 → 시작 화면, 시작 화면 → 컬렉션 → 닫기: 원정·메타 저장을 바꾸지 않는다', () => {
  const data = new Map();
  const store = createStore({
    storage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
    newSeed: () => 3,
    setTimer: () => 0,
    clearTimer: () => {},
  });
  store.load();
  store.actions.startRun();
  store.actions.showHome();
  const saved = JSON.stringify([...data]);
  store.actions.showAdmin();
  a.equal(store.getState().view, 'admin');
  store.actions.showHome();
  a.equal(store.getState().view, 'home');
  store.actions.openOverlay({ kind: 'collection', card: null });
  store.actions.dismissTop();
  a.equal(store.getState().overlay, null);
  a.equal(store.getState().view, 'home');
  a.equal(JSON.stringify([...data]), saved);
  a(store.getState().run, '진행 중 원정 유지');
});

test('관리자 메뉴 등록표: 캐릭터 설정만 동작, 나머지는 자리만(비활성)', () => {
  a.deepEqual(
    adminModules.filter((m) => m.ready).map((m) => m.id),
    ['characters'],
  );
  for (const id of ['combat', 'items', 'augments', 'economy'])
    a.equal(adminModules.find((m) => m.id === id)?.ready, false, id);
});

test('카드 꾸미기 저장소는 원정·메타 저장과 다른 IndexedDB이고, 서버로 보내는 코드가 없다', () => {
  const src = fs.readFileSync('src/ui/cardAssetStore.ts', 'utf8');
  a(src.includes("DB_NAME = 'autochess-card-assets'"));
  for (const word of ['fetch(', 'XMLHttpRequest', 'localStorage.', 'sessionStorage.'])
    a(!src.includes(word), word);
  const home = fs.readFileSync('src/ui/components/Home.tsx', 'utf8');
  a(home.includes('<b>컬렉션</b>') && home.includes('<b>관리자</b>'));
  for (const kept of ['<b>게임시작</b>', '<b>능력치</b>', '<b>뽑기</b>', '이어하기 →'])
    a(home.includes(kept), kept);
});

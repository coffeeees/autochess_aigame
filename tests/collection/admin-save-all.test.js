// v0.26.3 관리자 한꺼번에 저장: 캐릭터마다 저장하지 않고 여러 캐릭터를 고친 뒤 오른쪽 위 「저장(N명)」(Ctrl+S)으로 한 번에.
// 실제 흐름(여러 캐릭터 편집·이동해도 유지·능력치 오류면 아무것도 저장 안 함·새로고침 유지·모두 취소·나가기 확인)은 브라우저로 확인했다.
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';

test('저장 버튼은 관리자 오른쪽 위 하나(저장(N명)·모두 취소·Ctrl+S), 캐릭터 편집 칸에는 저장 버튼이 없다', () => {
  const page = fs.readFileSync('src/ui/components/admin/AdminPage.tsx', 'utf8');
  a(
    page.includes('styles.saveBar') &&
      page.includes('모두 취소') &&
      page.includes("e.key.toLowerCase() === 's'"),
  );
  a(page.includes('controls.current?.saveAll()'));
  const cs = fs.readFileSync('src/ui/components/admin/CharacterSettings.tsx', 'utf8');
  const actions = cs.slice(
    cs.indexOf('<div class={styles.actions}>'),
    cs.indexOf('<section class={styles.preview}'),
  );
  a(!/>\s*저장\s*</.test(actions), '편집 칸 저장 버튼 없음');
  a(actions.includes('이 캐릭터 변경 취소'));
  // 캐릭터별 편집 내용은 이동해도 남고(확인 없이 이동), 저장은 오류가 하나라도 있으면 전부 막는다
  a(cs.includes('const [drafts, setDrafts]') && cs.includes('const saveAll = async'));
  a(cs.includes('능력치 입력 오류가 있어 저장하지 않았습니다'));
  a(!cs.includes("setConfirm({ kind: 'switch'"), '캐릭터 이동 때 확인 창 없음');
});

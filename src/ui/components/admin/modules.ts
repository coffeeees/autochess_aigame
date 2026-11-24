// 관리자 메뉴 등록표(v0.23.0). 새 관리 기능은 여기에 항목을 더하고 AdminPage의 panels에 화면을 연결한다.
// 지금은 「캐릭터 설정」만 동작하고, 나머지는 자리만 있는 비활성 메뉴다(설정 기능 없음).
export interface AdminModule {
  id: string;
  label: string;
  description: string;
  ready: boolean;
}

export const adminModules: readonly AdminModule[] = [
  {
    id: 'characters',
    label: '캐릭터 설정',
    description: '컬렉션 카드의 표시 이름·배경·인물 그림',
    ready: true,
  },
  { id: 'combat', label: '전투 수치', description: '준비 중', ready: false },
  { id: 'items', label: '아이템', description: '준비 중', ready: false },
  { id: 'augments', label: '증강', description: '준비 중', ready: false },
  { id: 'economy', label: '확률·재화', description: '준비 중', ready: false },
];

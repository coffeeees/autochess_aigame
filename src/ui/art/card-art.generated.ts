// 게임에 반영된 카드 꾸미기(관리자 내보내기 → tools/import-admin-export.py가 만든다). 손으로 고치지 않는다.
// 캐릭터마다 표시 이름·배경·인물 그림(배포 경로)·원본/배포본 해시. 비어 있으면 모든 카드가 원래 이름·플레이스홀더.
import type { BakedCardArt } from './cards.ts';

export const bakedCardArt: Readonly<Record<string, BakedCardArt>> = {};

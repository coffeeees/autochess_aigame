// 공통 알림(notices.ts가 허용한 ID만 여기에 온다, 3초 표시).
import type { Notice } from '../store.ts';
import styles from './NoticeToast.module.css';

export function NoticeToast({ notice }: { notice: Notice | null }) {
  return (
    <p class={styles.toast} role="status" aria-live="polite" data-visible={!!notice}>
      {notice?.text}
    </p>
  );
}

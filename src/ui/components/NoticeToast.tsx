// The shared notice (only ids allowed by notices.ts reach here; 3 seconds).
import type { Notice } from '../store.ts';
import styles from './NoticeToast.module.css';

export function NoticeToast({ notice }: { notice: Notice | null }) {
  return (
    <p class={styles.toast} role="status" aria-live="polite" data-visible={!!notice}>
      {notice?.text}
    </p>
  );
}

import { useSyncStatus } from '../hooks/useSync';
import { sync } from '../sync/engine';

/** Shown only when the cloud backup is failing, so data loss is never silent. */
export function SyncBanner() {
  const s = useSyncStatus();
  if (s.state !== 'error') return null;
  return (
    <div className="sync-banner" role="alert">
      <span className="grow">
        <b>Backup failed.</b> {s.error ?? 'Could not save to the cloud.'}
      </span>
      <button onClick={() => void sync.flush(true)}>Retry</button>
    </div>
  );
}

import { useRef, useState } from 'react';
import { Button, Field, Icon, NumberInput, Screen, Segmented } from '../components/ui';
import { DISCLAIMER } from '../data/disclaimer';
import { exportAll, importAll, resetAll, saveProfile } from '../db/repo';
import { waistUnit } from '../lib/units';
import { ALL_EQUIPMENT, type Equipment, type ThemePreference, type UserProfile } from '../types';
import { useSyncStatus } from '../hooks/useSync';
import { sync } from '../sync/engine';

export function Settings({ profile, onBack }: { profile: UserProfile; onBack: () => void }) {
  const [p, setP] = useState<UserProfile>(profile);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const syncStatus = useSyncStatus();
  const [inspect, setInspect] = useState<{ name: string; local: number; remote: number }[] | null>(null);
  const [copied, setCopied] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteMsg, setPasteMsg] = useState('');

  const update = (patch: Partial<UserProfile>) => {
    setP((cur) => ({ ...cur, ...patch }));
    setSaved(false);
  };
  const toggleEq = (id: Equipment) => update({ equipment: p.equipment.includes(id) ? p.equipment.filter((e) => e !== id) : [...p.equipment, id] });

  const save = async () => {
    await saveProfile(p);
    setSaved(true);
  };

  const doExport = async () => {
    const bundle = await exportAll();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transformation-backup-${bundle.exportedAt.slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    await importAll(JSON.parse(text));
    window.location.hash = '#/home';
  };

  return (
    <Screen title="Settings" onBack={onBack} noNav>
      <div className="stack" style={{ gap: 18 }}>
        <Field label="Name (optional)">
          <input className="input" value={p.name ?? ''} onChange={(e) => update({ name: e.target.value })} />
        </Field>
        <Field label="Units">
          <Segmented options={[{ value: 'lb', label: 'lb / in' }, { value: 'kg', label: 'kg / cm' }]} value={p.units} onChange={(units) => update({ units })} />
        </Field>
        <div className="row">
          <Field label="Starting weight">
            <NumberInput value={p.startWeight} onChange={(v) => update({ startWeight: Number(v) || 0 })} suffix={p.units} step={0.1} />
          </Field>
          <Field label="Goal weight">
            <NumberInput value={p.goalWeight} onChange={(v) => update({ goalWeight: Number(v) || 0 })} suffix={p.units} step={0.1} />
          </Field>
        </div>
        <Field label="Starting waist">
          <NumberInput value={p.startWaist ?? ''} onChange={(v) => update({ startWaist: v === '' ? undefined : Number(v) })} suffix={waistUnit(p.units)} step={0.1} />
        </Field>
        <Field label="Program start date" hint="Changing this shifts your week and phase.">
          <input className="input" type="date" value={p.programStartDate} onChange={(e) => e.target.value && update({ programStartDate: e.target.value })} />
        </Field>
        <Field label="Default rest between sets">
          <Segmented
            options={[60, 90, 120].map((s) => ({ value: String(s), label: `${s}s` }))}
            value={String(p.defaultRestSeconds)}
            onChange={(v) => update({ defaultRestSeconds: Number(v) })}
          />
        </Field>
        <Field label="Appearance">
          <Segmented<ThemePreference>
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={p.theme}
            onChange={(theme) => update({ theme })}
          />
        </Field>
        <div>
          <div className="field-label" style={{ marginBottom: 8 }}>
            Equipment
          </div>
          <div className="check-list">
            {ALL_EQUIPMENT.map((e) => {
              const on = p.equipment.includes(e.id);
              return (
                <button key={e.id} className={`check-item ${on ? 'on' : ''}`} onClick={() => toggleEq(e.id)} aria-pressed={on}>
                  <span className="box">{on && <Icon name="check" size={16} />}</span>
                  <span className="lbl">{e.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <Button size="lg" full onClick={() => void save()}>
          {saved ? 'Saved' : 'Save changes'}
        </Button>

        <div className="section">
          <div className="section-title">
            <h2>Your data</h2>
          </div>
          <div className="card flat" style={{ marginBottom: 12 }}>
            <b>Manual backup (always works)</b>
            <p className="small muted" style={{ margin: '4px 0 10px' }}>
              Copies everything except photos as text. Paste it into Notes or a message to yourself. Restore by pasting it back here.
            </p>
            <div className="row">
              <Button
                variant="secondary"
                className="grow"
                onClick={async () => {
                  try {
                    const bundle = await exportAll();
                    await navigator.clipboard.writeText(JSON.stringify(bundle));
                    setCopied(`Copied ${bundle.sessions.length} workouts, ${bundle.weights.length} weigh-ins, ${(bundle.foodEntries ?? []).length} foods`);
                  } catch (e) {
                    setCopied(`Copy failed: ${String((e as Error)?.message ?? e)}`);
                  }
                }}
              >
                Copy backup
              </Button>
              <Button variant="secondary" className="grow" onClick={() => setPasteOpen((v) => !v)}>
                Paste backup
              </Button>
            </div>
            {copied && (
              <div className="tiny muted" style={{ marginTop: 6 }}>
                {copied}
              </div>
            )}
            {pasteOpen && (
              <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                <textarea className="input" placeholder="Paste the backup text here" value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
                <Button
                  disabled={!pasteText.trim()}
                  onClick={async () => {
                    try {
                      await importAll(JSON.parse(pasteText.trim()));
                      setPasteMsg('Restored. Reloading…');
                      setTimeout(() => window.location.reload(), 600);
                    } catch (e) {
                      setPasteMsg(`Could not read that backup: ${String((e as Error)?.message ?? e)}`);
                    }
                  }}
                >
                  Restore from pasted text
                </Button>
                {pasteMsg && <div className="tiny muted">{pasteMsg}</div>}
              </div>
            )}
          </div>
          {syncStatus.state === 'off' ? (
            <p className="small muted" style={{ marginBottom: 12 }}>
              Cloud backup is off: {syncStatus.reason}. Everything is stored in this browser only.
            </p>
          ) : (
            <div className="notice" style={{ marginBottom: 12 }}>
              <b>Cloud backup: {syncStatus.state === 'error' ? 'FAILED' : !syncStatus.verified ? 'unverified' : syncStatus.state === 'syncing' || syncStatus.pending ? 'saving…' : 'on and verified'}</b> ({syncStatus.backend})
              <div className="tiny" style={{ marginTop: 4 }}>
                Workouts, weights, food and steps are saved privately to your claude.ai account and restored when you open the app, even if Safari clears local data. Photos stay on this phone only.
                {syncStatus.lastPush && ` Last saved ${new Date(syncStatus.lastPush).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`}
                {syncStatus.error && ` ${syncStatus.error}`}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <Button size="sm" variant="secondary" onClick={() => void sync.flush(true)}>
                  Save now
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void sync.inspect().then(setInspect)}>
                  Check backup
                </Button>
              </div>
              {inspect && (
                <table className="tiny" style={{ marginTop: 8, borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    {inspect.map((r) => (
                      <tr key={r.name}>
                        <td style={{ padding: '2px 0' }}>{r.name}</td>
                        <td className="num" style={{ textAlign: 'right' }}>{r.local} on phone</td>
                        <td className="num" style={{ textAlign: 'right', color: r.remote < r.local ? 'var(--warn)' : undefined }}>{r.remote} backed up</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          <div className="row">
            <Button variant="secondary" className="grow" onClick={() => void doExport()}>
              Export backup
            </Button>
            <Button variant="secondary" className="grow" onClick={() => fileRef.current?.click()}>
              Import backup
            </Button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])} />
          </div>
          {!confirmReset ? (
            <Button variant="danger" full style={{ marginTop: 8 }} onClick={() => setConfirmReset(true)}>
              Reset all data
            </Button>
          ) : (
            <div className="card flat" style={{ marginTop: 8 }}>
              <b>Delete everything on this device?</b>
              <p className="small muted">Workouts, weights and photos cannot be recovered.</p>
              <div className="row" style={{ marginTop: 10 }}>
                <Button variant="secondary" className="grow" onClick={() => setConfirmReset(false)}>
                  Keep
                </Button>
                <Button
                  variant="primary"
                  className="grow"
                  onClick={async () => {
                    await sync.clearRemote().catch(() => undefined);
                    await resetAll();
                    window.location.hash = '#/';
                    window.location.reload();
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
        <p className="disclaimer">{DISCLAIMER}</p>
      </div>
    </Screen>
  );
}

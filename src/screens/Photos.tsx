import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { Button, Icon, Screen, Segmented, Sheet } from '../components/ui';
import { addPhoto, deletePhoto, listPhotos } from '../db/repo';
import { daysBetween, formatDate, todayISO } from '../lib/dates';
import type { PhotoView, ProgressPhoto, UserProfile } from '../types';

const VIEWS: { value: PhotoView; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
];

function useObjectUrls(photos: ProgressPhoto[]): Record<string, string> {
  const urls = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, URL.createObjectURL(p.blob)])), [photos]);
  useEffect(() => () => Object.values(urls).forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

async function shrink(file: File, max = 1400): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { blob: file, width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
  return { blob: blob ?? file, width: w, height: h };
}

export function Photos({ profile, onBack }: { profile: UserProfile; onBack: () => void }) {
  const photos = useLiveQuery(listPhotos, []) ?? [];
  const [view, setView] = useState<PhotoView>('front');
  const [date, setDate] = useState(todayISO());
  const [open, setOpen] = useState<ProgressPhoto | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [cut, setCut] = useState(50);
  const fileRef = useRef<HTMLInputElement>(null);
  const urls = useObjectUrls(photos);
  const list = photos.filter((p) => p.view === view);

  const monthOf = (d: string) => Math.floor(Math.max(0, daysBetween(profile.programStartDate, d)) / 30.44) + 1;

  const onFile = async (file: File) => {
    const { blob, width, height } = await shrink(file);
    await addPhoto(date, view, blob, width, height);
    if (fileRef.current) fileRef.current.value = '';
  };

  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]));
  const [a, b] = compare.map((id) => photos.find((p) => p.id === id)).filter(Boolean) as ProgressPhoto[];

  return (
    <>
      <Screen title="Progress photos" onBack={onBack}>
        <div className="stack">
          <p className="small muted">Same spot, same lighting, same pose each time. Photos never leave this phone.</p>
          <Segmented options={VIEWS} value={view} onChange={setView} />
          <div className="card row">
            <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Photo date" style={{ flex: 1 }} />
            <Button onClick={() => fileRef.current?.click()}>
              <Icon name="camera" size={20} /> Add {view}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
          </div>

          {a && b && (
            <div className="card">
              <div className="section-title">
                <h2>Compare</h2>
                <button className="link" style={{ color: 'var(--accent)', fontWeight: 600 }} onClick={() => setCompare([])}>
                  Clear
                </button>
              </div>
              <div className="compare" style={{ ['--cut' as string]: `${cut}%` }}>
                <img src={urls[a.id]} alt={`Before, ${formatDate(a.date)}`} />
                <img className="after" src={urls[b.id]} alt={`After, ${formatDate(b.date)}`} />
                <div className="handle" />
                <span className="tag" style={{ left: 10 }}>
                  Month {monthOf(a.date)} · {formatDate(a.date)}
                </span>
                <span className="tag" style={{ right: 10 }}>
                  Month {monthOf(b.date)} · {formatDate(b.date)}
                </span>
                <input type="range" min={0} max={100} value={cut} onChange={(e) => setCut(Number(e.target.value))} aria-label="Comparison slider" />
              </div>
            </div>
          )}

          {list.length ? (
            <>
              <p className="tiny muted">Tap a photo to view or delete. Tap two to compare side by side.</p>
              <div className="photo-grid">
                {list.map((p) => (
                  <button key={p.id} className={`photo-tile ${compare.includes(p.id) ? 'sel' : ''}`} onClick={() => (compare.length ? toggleCompare(p.id) : setOpen(p))} onContextMenu={(e) => e.preventDefault()}>
                    <img src={urls[p.id]} alt={`${p.view} view, ${formatDate(p.date)}`} loading="lazy" />
                    <span className="cap">
                      Month {monthOf(p.date)} · {formatDate(p.date)}
                    </span>
                  </button>
                ))}
              </div>
              {list.length > 1 && !compare.length && (
                <Button variant="secondary" full onClick={() => setCompare([list[0].id, list[list.length - 1].id])}>
                  Compare first and latest
                </Button>
              )}
            </>
          ) : (
            <div className="notice">No {view} photos yet. A month-one photo is the one you’ll be most glad you took.</div>
          )}
        </div>
      </Screen>

      <Sheet open={!!open} onClose={() => setOpen(null)} full>
        {open && (
          <div className="stack">
            <div className="row between">
              <div>
                <div className="eyebrow">{open.view} · Month {monthOf(open.date)}</div>
                <b>{formatDate(open.date, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</b>
              </div>
              <button className="icon-btn" onClick={() => setOpen(null)} aria-label="Close">
                <Icon name="x" />
              </button>
            </div>
            <img src={urls[open.id]} alt="" style={{ width: '100%', borderRadius: 16 }} />
            <div className="row">
              <Button
                variant="secondary"
                className="grow"
                onClick={() => {
                  setCompare([open.id]);
                  setOpen(null);
                }}
              >
                Compare with…
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (confirm('Delete this photo?')) {
                    await deletePhoto(open.id);
                    setOpen(null);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Sheet>
      <BottomNav active="progress" />
    </>
  );
}

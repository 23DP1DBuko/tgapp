import { useEffect, useState } from 'react';
import { listBroadcasts } from '../../lib/firebase/broadcasts';
import type { Broadcast } from '../../types/broadcast';

export function BroadcastAdminPanel() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await listBroadcasts(20);
      setItems(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load broadcasts.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <article className="rounded-[32px] border border-white/10 bg-[var(--shop-panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
            Broadcast History
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--shop-muted)]">
            See the last broadcasts sent to Telegram subscribers and how many
            chats received them.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-full border border-white/14 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-[var(--shop-muted)]">
          Loading broadcasts...
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-2xl bg-[var(--shop-red)]/18 px-4 py-3 text-sm text-[var(--shop-cream)]">
          {error}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="mt-4 text-sm text-[var(--shop-muted)]">
          No broadcasts have been logged yet.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
          {items.map((b) => (
            <section
              key={b.id}
              className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">
                    {b.createdAt
                      ? new Date(b.createdAt).toLocaleString()
                      : 'Unknown time'}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--shop-cream)]">
                    {b.text}
                  </p>
                </div>
                <div className="text-right text-xs text-[var(--shop-muted)]">
                  <p>
                    Sent:{' '}
                    <span className="font-semibold text-[var(--shop-cream)]">
                      {b.sentCount}
                    </span>
                  </p>
                  <p>
                    Failed:{' '}
                    <span className="font-semibold text-[var(--shop-cream)]">
                      {b.failedCount}
                    </span>
                  </p>
                  <p className="mt-1">
                    Reason:{' '}
                    <span className="font-medium">{b.reason || '—'}</span>
                  </p>
                  <p className="mt-1">
                    Admin:{' '}
                    <span className="font-medium">
                      {b.createdBy ?? '—'}
                    </span>
                  </p>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
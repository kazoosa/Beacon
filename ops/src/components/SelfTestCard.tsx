import { Icon } from "./Icon";

type Status = "ok" | "warn" | "error" | "unconfigured";

interface ServiceData {
  status: Status;
  data?: Record<string, unknown>;
  error?: string;
}

interface TestEvent {
  title: string;
  time: string;
  group: string;
  ok: boolean;
  detail: string;
}

/**
 * Self-test card. Shows a passing/failing summary at the top, then
 * lists every individual test grouped by category with detail copy
 * and per-test duration. Failing tests get a red dot and the error
 * text. The "Re-run" button triggers a refetch of the parent's ops
 * payload — same code path as the auto-refresh interval.
 */
export function SelfTestCard({
  service,
  onRerun,
  rerunning,
}: {
  service: ServiceData | undefined;
  onRerun: () => void;
  rerunning: boolean;
}) {
  const passing = Number(service?.data?.passing ?? 0);
  const failing = Number(service?.data?.failing ?? 0);
  const total = Number(service?.data?.total ?? 0);
  const totalMs = Number(service?.data?.totalMs ?? 0);
  const tests = (service?.data?._tests as TestEvent[] | undefined) ?? [];

  const grouped = new Map<string, TestEvent[]>();
  for (const t of tests) {
    const list = grouped.get(t.group) ?? [];
    list.push(t);
    grouped.set(t.group, list);
  }

  const headlineTone =
    failing > 0 ? "neg" : passing === total && total > 0 ? "pos" : "muted";

  return (
    <div className={`selftest-card ${failing > 0 ? "has-fail" : ""}`}>
      <div className="selftest-head">
        <div className="selftest-summary">
          <div className={`selftest-headline tone-${headlineTone}`}>
            {service?.status === "unconfigured"
              ? "Not configured"
              : failing === 0 && total > 0
                ? "All systems pass"
                : failing > 0
                  ? `${failing} failing`
                  : "Awaiting first run"}
          </div>
          <div className="selftest-sub">
            {total > 0
              ? `${passing}/${total} passing · ${totalMs} ms`
              : "Live API smoke battery against the deployed backend"}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onRerun}
          disabled={rerunning}
        >
          <Icon.RefreshCw className={rerunning ? "spin" : ""} />
          {rerunning ? "Running…" : "Re-run"}
        </button>
      </div>

      {tests.length === 0 ? (
        <div className="selftest-empty">
          {service?.error ?? "No tests have run yet."}
        </div>
      ) : (
        <div className="selftest-groups">
          {[...grouped.entries()].map(([group, items]) => {
            const failed = items.filter((t) => !t.ok).length;
            return (
              <div key={group} className="selftest-group">
                <div className="selftest-group-head">
                  <span className="selftest-group-title">{group}</span>
                  <span
                    className={`selftest-group-count ${failed > 0 ? "fail" : ""}`}
                  >
                    {items.length - failed}/{items.length}
                  </span>
                </div>
                <ul className="selftest-list">
                  {items.map((t, i) => (
                    <li
                      key={i}
                      className={`selftest-row ${t.ok ? "ok" : "fail"}`}
                    >
                      <span className="selftest-icon" aria-hidden>
                        {t.ok ? <Icon.CheckCircle /> : <Icon.XCircle />}
                      </span>
                      <div className="selftest-text">
                        <div className="selftest-name">
                          {t.title.replace(/^[✔✘]\s*/, "")}
                        </div>
                        <div className="selftest-detail">{t.detail}</div>
                      </div>
                      <div className="selftest-duration">{t.time}</div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

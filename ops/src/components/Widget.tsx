type Status = "ok" | "warn" | "error" | "unconfigured";

interface Props {
  title: string;
  status?: Status;
  extLink?: string;
  data?: {
    status?: Status;
    message?: string;
    data?: Record<string, unknown>;
    error?: string;
  };
}

const STATUS_COLORS: Record<Status, string> = {
  ok: "status-green",
  warn: "status-amber",
  error: "status-red",
  unconfigured: "status-gray",
};

export function Widget({ title, status = "unconfigured", extLink, data }: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <span className={`status-dot ${STATUS_COLORS[status]}`} />
          {title}
        </span>
        {extLink && (
          <a className="ext-link" href={extLink} target="_blank" rel="noreferrer">
            open ↗
          </a>
        )}
      </div>

      {status === "unconfigured" && (
        <div className="sublabel">
          {data?.message ?? "API key not configured — add it in Vercel env vars."}
        </div>
      )}

      {data?.error && <div className="error">{data.error}</div>}

      {data?.data && <DataTable data={data.data} />}
    </div>
  );
}

function DataTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);

  const events = data._events as
    | Array<{ title: string; time?: string }>
    | undefined;

  return (
    <div>
      {/* Hero value — surfaces the most important top-level metric */}
      {typeof data._hero === "string" && (
        <>
          <div className="hero">{data._hero}</div>
          {typeof data._heroSub === "string" && (
            <div className="sublabel">{data._heroSub}</div>
          )}
        </>
      )}

      {/* Generic KV pairs */}
      <div style={{ marginTop: data._hero ? 12 : 0 }}>
        {entries
          .filter(([k]) => !k.startsWith("_"))
          .map(([k, v]) => (
            <div className="kv" key={k}>
              <span className="kv-key">{k}</span>
              <span className="kv-val">{formatVal(v)}</span>
            </div>
          ))}
      </div>

      {/* Event list */}
      {events && events.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {events.slice(0, 5).map((ev, i) => (
            <div className="event-row" key={i}>
              <span className="event-title">{ev.title}</span>
              {ev.time && <span className="event-time">{ev.time}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return v.toLocaleString();
  if (v instanceof Date) return v.toLocaleString();
  return String(v);
}

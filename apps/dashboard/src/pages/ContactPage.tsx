import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { BeaconMark } from "../components/BeaconMark";
import { APP_NAME } from "../lib/brand";
import { unauthedFetch } from "../lib/api";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "sending" });
    try {
      await unauthedFetch<{ ok: boolean; message?: string }>("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message, website }),
      });
      setStatus({ kind: "ok" });
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      setStatus({
        kind: "error",
        message: (err as Error).message ?? "Something went wrong.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-bg-base text-fg-primary">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-bg-base/80 border-b border-border-subtle">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <BeaconMark size={22} />
            <span>{APP_NAME}</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to site
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted mb-3">
          Contact
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">
          Get in touch
        </h1>
        <p className="text-fg-secondary mb-10">
          Bug reports, feature requests, broker connection issues — anything
          related to {APP_NAME}. We read every message and reply within 1–2
          business days.
        </p>

        {status.kind === "ok" ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-6 text-emerald-200">
            <div className="font-semibold mb-1">Message sent</div>
            <div className="text-sm opacity-90">
              Thanks for reaching out — we'll be in touch soon.
            </div>
            <button
              type="button"
              onClick={() => setStatus({ kind: "idle" })}
              className="mt-4 text-sm underline underline-offset-4 hover:no-underline"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            {/* Honeypot — hidden from real users, bots will fill it. */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "-10000px",
                width: 1,
                height: 1,
                overflow: "hidden",
              }}
            >
              <label>
                Website
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Your name"
                value={name}
                onChange={setName}
                required
                autoComplete="name"
              />
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                required
                autoComplete="email"
              />
            </div>

            <Field label="Subject" value={subject} onChange={setSubject} required />

            <div>
              <label className="block text-sm font-medium mb-1.5">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={7}
                className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-fg-primary/20"
              />
            </div>

            {status.kind === "error" && (
              <div
                role="alert"
                className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300"
              >
                {status.message}
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-2">
              <a
                href="mailto:kazoosa8@gmail.com"
                className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary transition-colors"
              >
                <Mail className="w-4 h-4" />
                Or email kazoosa8@gmail.com
              </a>
              <button
                type="submit"
                disabled={status.kind === "sending"}
                className="btn-primary"
              >
                {status.kind === "sending" ? "Sending…" : "Send message"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-sm placeholder-fg-muted focus:outline-none focus:ring-2 focus:ring-fg-primary/20"
      />
    </div>
  );
}

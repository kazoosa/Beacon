import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../lib/theme";
import { APP_NAME } from "../lib/brand";
import { BeaconMark } from "../components/BeaconMark";
import { IconSun, IconMoon } from "../components/Icon";

export function LandingPage() {
  return (
    <div className="landing">
      <LandingNav />
      <Hero />
      <SupportedBrokers />
      <Features />
      <ProductShowcase />
      <HowItWorks />
      <Pricing />
      <SecuritySection />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ---------------------------------------------------------------- Nav */

function LandingNav() {
  const { resolvedTheme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="landing-nav">
      <div className="landing-container landing-nav-inner">
        <Link to="/" className="landing-brand">
          <BeaconMark size={24} />
          <span>{APP_NAME}</span>
        </Link>
        <nav className={`landing-nav-links ${menuOpen ? "open" : ""}`}>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#security">Security</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="landing-nav-actions">
          <button
            className="landing-icon-btn"
            onClick={toggle}
            aria-label="Toggle theme"
            title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
          >
            {resolvedTheme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
          </button>
          <Link to="/login" className="landing-btn landing-btn-ghost">
            Sign in
          </Link>
          <Link to="/register" className="landing-btn landing-btn-primary">
            Get started
          </Link>
          <button
            className="landing-menu-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------- Hero */

function Hero() {
  return (
    <section className="landing-hero">
      <div className="landing-container landing-hero-inner">
        <div className="landing-hero-badge">
          <span className="dot" />
          Free forever for 1 brokerage
        </div>
        <h1 className="landing-hero-title">
          Every brokerage.
          <br />
          <span className="gradient-text">One dashboard.</span>
        </h1>
        <p className="landing-hero-sub">
          Beacon pulls your holdings, transactions, and dividends from Fidelity, Schwab, Vanguard,
          Robinhood, and 30+ brokerages into one clean portfolio view. Built for the investor who's
          tired of juggling tabs.
        </p>
        <div className="landing-hero-cta">
          <Link to="/register" className="landing-btn landing-btn-primary landing-btn-lg">
            Start free — no card required
          </Link>
          <Link to="/login" className="landing-btn landing-btn-secondary landing-btn-lg">
            Try the demo →
          </Link>
        </div>
        <div className="landing-hero-meta">
          <span>✓ No credit card</span>
          <span>✓ Read-only access</span>
          <span>✓ Cancel anytime</span>
        </div>
      </div>
      <DashboardPreview />
    </section>
  );
}

/* Mock dashboard rendered as real HTML for the hero */
function DashboardPreview() {
  return (
    <div className="landing-container">
      <div className="hero-preview">
        <div className="hero-preview-chrome">
          <span className="hp-dot hp-red" />
          <span className="hp-dot hp-amber" />
          <span className="hp-dot hp-green" />
          <span className="hp-url">app.beacon.finance/overview</span>
        </div>
        <div className="hero-preview-body">
          <div className="hp-hero">
            <div>
              <div className="hp-label">Portfolio value</div>
              <div className="hp-bignum">$284,612.38</div>
              <div className="hp-delta">+ $1,284.22 <span className="hp-pct">+0.45%</span> today</div>
            </div>
            <div className="hp-kpis">
              <div><div className="hp-label">Unrealized P/L</div><div className="hp-num hp-pos">+$42,118</div></div>
              <div><div className="hp-label">YTD dividends</div><div className="hp-num hp-pos">+$3,240</div></div>
              <div><div className="hp-label">Holdings</div><div className="hp-num">47</div></div>
              <div><div className="hp-label">Brokerages</div><div className="hp-num">4</div></div>
            </div>
          </div>

          <div className="hp-grid">
            <div className="hp-card">
              <div className="hp-card-title">Top holdings</div>
              {[
                { t: "VTI", n: "Vanguard Total Stock Market", v: "$48,292", d: "+12.4%" },
                { t: "VXUS", n: "Vanguard Total International", v: "$31,120", d: "+8.1%" },
                { t: "AAPL", n: "Apple Inc.", v: "$22,418", d: "+24.6%" },
                { t: "MSFT", n: "Microsoft Corporation", v: "$18,910", d: "+18.2%" },
              ].map((h) => (
                <div key={h.t} className="hp-row">
                  <span className="hp-ticker">{h.t}</span>
                  <span className="hp-name">{h.n}</span>
                  <span className="hp-val">{h.v}</span>
                  <span className="hp-delta2 hp-pos">{h.d}</span>
                </div>
              ))}
            </div>
            <div className="hp-card">
              <div className="hp-card-title">Allocation</div>
              <div className="hp-donut">
                <svg viewBox="0 0 36 36" width="100%">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="4" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#7c6aff" strokeWidth="4"
                    strokeDasharray="42 88" strokeDashoffset="0" transform="rotate(-90 18 18)" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#34d399" strokeWidth="4"
                    strokeDasharray="28 88" strokeDashoffset="-42" transform="rotate(-90 18 18)" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#60a5fa" strokeWidth="4"
                    strokeDasharray="18 88" strokeDashoffset="-70" transform="rotate(-90 18 18)" />
                </svg>
                <div className="hp-donut-center">
                  <div className="hp-label">Stocks</div>
                  <div className="hp-num hp-bold">48%</div>
                </div>
              </div>
              <div className="hp-legend">
                <div><span className="hp-sw" style={{ background: "#7c6aff" }} />Stocks · 48%</div>
                <div><span className="hp-sw" style={{ background: "#34d399" }} />ETFs · 32%</div>
                <div><span className="hp-sw" style={{ background: "#60a5fa" }} />Bonds · 20%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- Supported brokers */

function SupportedBrokers() {
  const brokers = [
    "Fidelity",
    "Charles Schwab",
    "Vanguard",
    "Robinhood",
    "Webull",
    "Interactive Brokers",
    "E*TRADE",
    "TD Ameritrade",
    "Merrill",
    "Alpaca",
    "M1 Finance",
    "Wealthsimple",
  ];
  return (
    <section className="landing-brokers">
      <div className="landing-container">
        <div className="landing-brokers-label">Works with your brokerage</div>
        <div className="landing-brokers-grid">
          {brokers.map((b) => (
            <span key={b} className="landing-broker-chip">{b}</span>
          ))}
          <span className="landing-broker-chip muted">and 20+ more</span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Features */

function Features() {
  const features = [
    {
      title: "Unified holdings view",
      body:
        "Every share, across every broker, in one table. See what you actually own — not four different views of it.",
      icon: <IconGrid />,
    },
    {
      title: "Automatic sync",
      body:
        "Connect once via bank-grade auth and your holdings update automatically. No more manual spreadsheets.",
      icon: <IconRefresh />,
    },
    {
      title: "Dividend intelligence",
      body:
        "Monthly income, YTD totals, forward 12-month forecast, and a per-ticker breakdown of your top payers.",
      icon: <IconCoin />,
    },
    {
      title: "Allocation breakdown",
      body:
        "By security, by brokerage, by asset class. See exactly where your risk sits before the market decides for you.",
      icon: <IconPieSmall />,
    },
    {
      title: "Performance tracking",
      body:
        "Day, YTD, total return. Benchmark against the S&P 500 or set your own custom index to compare against.",
      icon: <IconTrend />,
    },
    {
      title: "CSV import fallback",
      body:
        "Don't see your broker? Download a CSV from any institution and upload — Beacon parses it automatically.",
      icon: <IconUpload />,
    },
  ];

  return (
    <section id="features" className="landing-section">
      <div className="landing-container">
        <SectionHeader
          eyebrow="Features"
          title="Everything you expect. Plus the parts everyone else missed."
          sub="Beacon does what Mint, Personal Capital, and Snowball promised — and a few things they never figured out."
        />
        <div className="feature-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-body">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------- Product showcase */

function ProductShowcase() {
  const highlights = [
    {
      eyebrow: "Holdings",
      title: "See every position, instantly.",
      body:
        "Consolidated holdings across every brokerage, deduped by ticker, sorted by whatever you care about: value, P/L %, weight, ticker. Expand any row to see which accounts actually hold it.",
      image: <ShowcaseHoldings />,
    },
    {
      eyebrow: "Dividends",
      title: "Income that actually adds up.",
      body:
        "YTD and lifetime totals, a 12-month bar chart, top payers by dollar — and a forward forecast of what's coming in the next 12 months so you can plan, not guess.",
      image: <ShowcaseDividends />,
    },
    {
      eyebrow: "Allocation",
      title: "Know what you own, not just what you have.",
      body:
        "Three donut charts in one glance: by security, by brokerage, by asset class. When tech is 40% of your portfolio, Beacon tells you — before the market does.",
      image: <ShowcaseAllocation />,
    },
  ];

  return (
    <section className="landing-section showcase">
      <div className="landing-container">
        {highlights.map((h, i) => (
          <div key={i} className={`showcase-row ${i % 2 === 1 ? "reverse" : ""}`}>
            <div className="showcase-copy">
              <div className="showcase-eyebrow">{h.eyebrow}</div>
              <h2 className="showcase-title">{h.title}</h2>
              <p className="showcase-body">{h.body}</p>
            </div>
            <div className="showcase-image">{h.image}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------- How it works */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Sign up in 30 seconds",
      body: "Email and password. No credit card, no phone number, no annoying onboarding quiz.",
    },
    {
      n: "02",
      title: "Connect your brokerages",
      body:
        "Auto-sync via read-only OAuth (your credentials never touch our servers), or upload CSV for brokers we don't auto-cover. Most people are set up in under 5 minutes.",
    },
    {
      n: "03",
      title: "See everything. Forever.",
      body:
        "Beacon keeps itself up to date. Open the dashboard any time to see your positions, dividends, and allocation.",
    },
  ];

  return (
    <section id="how-it-works" className="landing-section howitworks">
      <div className="landing-container">
        <SectionHeader
          eyebrow="How it works"
          title="From zero to full portfolio view in under 5 minutes."
          sub="No lengthy setup. No account verification. No hidden steps."
        />
        <div className="howitworks-grid">
          {steps.map((s, i) => (
            <div key={i} className="howitworks-card">
              <div className="howitworks-num">{s.n}</div>
              <h3 className="howitworks-title">{s.title}</h3>
              <p className="howitworks-body">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- Pricing */

function Pricing() {
  const tiers = [
    {
      name: "Free",
      price: "$0",
      cadence: "forever",
      blurb: "For trying out Beacon with one account.",
      features: [
        "1 brokerage (via CSV upload)",
        "Holdings + dividends views",
        "Basic allocation breakdown",
        "Dark + light themes",
        "No credit card required",
      ],
      cta: "Get started",
      ctaLink: "/register",
      accent: false,
    },
    {
      name: "Pro",
      price: "$8",
      cadence: "per month",
      annual: "or $69/year",
      blurb: "For investors with real portfolios across multiple accounts.",
      features: [
        "Unlimited brokerages (auto-sync)",
        "Everything in Free, plus:",
        "Dividend forecast + calendar",
        "Watchlist + price alerts",
        "Capital gains report",
        "Sector + geography allocation",
        "Performance vs S&P 500",
        "Per-ticker notes & research",
        "Read-only share link",
        "CSV export",
        "Email support",
      ],
      cta: "Start Pro",
      ctaLink: "/register",
      accent: true,
      badge: "Most popular",
    },
    {
      name: "Elite",
      price: "$15",
      cadence: "per month",
      annual: "or $129/year",
      blurb: "For serious investors who want AI-powered insights.",
      features: [
        "Everything in Pro, plus:",
        "AI portfolio analysis",
        "AI rebalance recommendations",
        "Monthly AI portfolio letter",
        "Natural-language queries",
        "AI tax-loss harvesting plan",
        "Plaid auto-sync (Fidelity, Schwab, Vanguard)",
        "Wash-sale detection",
        "Tax-lot accounting (FIFO/LIFO)",
        "Custom benchmarks",
        "Priority support",
      ],
      cta: "Start Elite",
      ctaLink: "/register",
      accent: false,
    },
  ];

  return (
    <section id="pricing" className="landing-section pricing">
      <div className="landing-container">
        <SectionHeader
          eyebrow="Pricing"
          title="Start free. Upgrade when you outgrow it."
          sub="No surprise fees. Cancel anytime. Every paid plan has a 14-day refund window."
        />
        <div className="pricing-grid">
          {tiers.map((t) => (
            <div key={t.name} className={`pricing-card ${t.accent ? "accent" : ""}`}>
              {t.badge && <div className="pricing-badge">{t.badge}</div>}
              <div className="pricing-name">{t.name}</div>
              <div className="pricing-price">
                <span className="pricing-dollar">{t.price}</span>
                <span className="pricing-cadence">{t.cadence}</span>
              </div>
              {t.annual && <div className="pricing-annual">{t.annual}</div>}
              <div className="pricing-blurb">{t.blurb}</div>
              <Link
                to={t.ctaLink}
                className={`landing-btn ${t.accent ? "landing-btn-primary" : "landing-btn-secondary"} pricing-cta`}
              >
                {t.cta}
              </Link>
              <div className="pricing-divider" />
              <ul className="pricing-features">
                {t.features.map((f, i) => (
                  <li key={i}>
                    <IconCheck /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- Security */

function SecuritySection() {
  const points = [
    {
      title: "Read-only access",
      body: "Beacon can see your positions and transactions. We cannot trade, transfer, or withdraw anything. Ever.",
    },
    {
      title: "Never your password",
      body:
        "Brokerage credentials go directly to SnapTrade / Plaid via OAuth. Beacon never sees or stores them.",
    },
    {
      title: "Bank-grade encryption",
      body: "TLS 1.3 in transit. AES-256 at rest. Passwords hashed with bcrypt — not even we can read them.",
    },
    {
      title: "Data portability",
      body: "Export your full portfolio to CSV any time. Delete your account with one click — everything is removed.",
    },
  ];
  return (
    <section id="security" className="landing-section security">
      <div className="landing-container">
        <div className="security-inner">
          <div>
            <SectionHeader
              eyebrow="Security"
              title="Your money is your business. Your data is too."
              align="left"
            />
            <p className="security-body">
              Beacon is built with the same security standards as the brokerages it connects to. We never
              touch your passwords. We never move your money. You can pull your data out, or nuke your
              entire account, in one click — whenever you want.
            </p>
          </div>
          <div className="security-grid">
            {points.map((p) => (
              <div key={p.title} className="security-card">
                <div className="security-icon"><IconShield /></div>
                <div>
                  <h4 className="security-title">{p.title}</h4>
                  <p className="security-body-sm">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- FAQ */

function FAQ() {
  const items = [
    {
      q: "Which brokerages does Beacon support?",
      a: "Via auto-sync: Fidelity, Schwab, Vanguard, Robinhood, Webull, Alpaca, Interactive Brokers, E*TRADE, Wealthsimple, M1 Finance, SoFi, Public, and 20+ more. For anything else, you can upload a CSV — we support the standard export format from every major broker.",
    },
    {
      q: "Can Beacon see my login credentials?",
      a: "No. Auto-sync goes through SnapTrade or Plaid (for Elite users), which use OAuth — your credentials go straight from your browser to the brokerage. Beacon never sees, stores, or has access to them.",
    },
    {
      q: "Can Beacon move money or place trades?",
      a: "No. We request read-only access explicitly. Beacon can see your positions and transactions, nothing more.",
    },
    {
      q: "What does the Free tier actually get me?",
      a: "One brokerage via CSV upload, the core holdings view, dividends view, and basic allocation. Enough to see if Beacon is for you. No time limit, no credit card — just a natural upgrade path when you add a second account.",
    },
    {
      q: "How do you make money?",
      a: "Subscriptions only — Pro is $8/month, Elite is $15/month. We don't sell your data. We don't show ads. We're not an affiliate program in disguise.",
    },
    {
      q: "Is there a refund policy?",
      a: "Yes. 14-day full refund, no questions asked, on any paid plan.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. One click in settings. Your data stays exportable for 30 days after cancel in case you change your mind.",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="landing-section faq">
      <div className="landing-container">
        <SectionHeader
          eyebrow="FAQ"
          title="Answers to the questions people actually ask."
        />
        <div className="faq-list">
          {items.map((it, i) => (
            <div key={i} className={`faq-item ${open === i ? "open" : ""}`}>
              <button
                className="faq-q"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span>{it.q}</span>
                <span className="faq-toggle">{open === i ? "−" : "+"}</span>
              </button>
              {open === i && <div className="faq-a">{it.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- Final CTA */

function FinalCTA() {
  return (
    <section className="landing-section final-cta">
      <div className="landing-container">
        <div className="final-cta-inner">
          <h2 className="final-cta-title">
            Start tracking your whole portfolio today.
          </h2>
          <p className="final-cta-sub">
            Free forever for one brokerage. Upgrade when you're ready.
          </p>
          <div className="final-cta-buttons">
            <Link to="/register" className="landing-btn landing-btn-primary landing-btn-lg">
              Get started free
            </Link>
            <Link to="/login" className="landing-btn landing-btn-secondary landing-btn-lg">
              Try demo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Footer */

function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-container landing-footer-inner">
        <div className="landing-footer-brand">
          <Link to="/" className="landing-brand">
            <BeaconMark size={22} />
            <span>{APP_NAME}</span>
          </Link>
          <p className="landing-footer-tagline">
            The portfolio dashboard for people who own more than one brokerage.
          </p>
        </div>
        <div className="landing-footer-cols">
          <div>
            <div className="landing-footer-heading">Product</div>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#how-it-works">How it works</a>
            <a href="#security">Security</a>
          </div>
          <div>
            <div className="landing-footer-heading">Company</div>
            <a href="#">About</a>
            <a href="#">Blog</a>
            <a href="#">Contact</a>
          </div>
          <div>
            <div className="landing-footer-heading">Legal</div>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Security</a>
          </div>
          <div>
            <div className="landing-footer-heading">Account</div>
            <Link to="/login">Sign in</Link>
            <Link to="/register">Get started</Link>
          </div>
        </div>
      </div>
      <div className="landing-container landing-footer-bottom">
        <span>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</span>
        <span className="landing-footer-note">
          Beacon is a tracking tool and not a registered broker-dealer or investment advisor. Not financial
          advice.
        </span>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------- Helpers */

function SectionHeader({
  eyebrow,
  title,
  sub,
  align,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  align?: "left";
}) {
  return (
    <div className={`section-header ${align === "left" ? "align-left" : ""}`}>
      {eyebrow && <div className="section-eyebrow">{eyebrow}</div>}
      <h2 className="section-title">{title}</h2>
      {sub && <p className="section-sub">{sub}</p>}
    </div>
  );
}

/* ---------------------------------------------------------- Icons */

const svgBase = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconGrid() {
  return (
    <svg {...svgBase}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg {...svgBase}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
  );
}
function IconCoin() {
  return (
    <svg {...svgBase}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 10h5a2 2 0 1 1 0 4H9a2 2 0 1 0 0 4h6" />
    </svg>
  );
}
function IconPieSmall() {
  return (
    <svg {...svgBase}>
      <path d="M21 15.5A9 9 0 1 1 8.5 3" />
      <path d="M21 12A9 9 0 0 0 12 3v9z" />
    </svg>
  );
}
function IconTrend() {
  return (
    <svg {...svgBase}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg {...svgBase}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg {...svgBase}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* -------------------------------------------- Showcase mini-previews */

function ShowcaseHoldings() {
  return (
    <div className="sc-preview">
      <div className="sc-preview-head">
        <span className="sc-preview-title">Holdings · 47 positions</span>
      </div>
      {[
        { t: "VTI", n: "Vanguard Total Stock Market", v: "$48,292", p: "+12.4%" },
        { t: "VXUS", n: "Vanguard Total International", v: "$31,120", p: "+8.1%" },
        { t: "AAPL", n: "Apple Inc.", v: "$22,418", p: "+24.6%" },
        { t: "MSFT", n: "Microsoft Corporation", v: "$18,910", p: "+18.2%" },
        { t: "NVDA", n: "NVIDIA Corporation", v: "$15,402", p: "+142.8%" },
      ].map((h) => (
        <div key={h.t} className="sc-row">
          <span className="sc-tick">{h.t}</span>
          <span className="sc-name">{h.n}</span>
          <span className="sc-val">{h.v}</span>
          <span className="sc-pos">{h.p}</span>
        </div>
      ))}
    </div>
  );
}

function ShowcaseDividends() {
  const heights = [18, 24, 32, 26, 38, 42, 34, 46, 52, 44, 50, 58];
  return (
    <div className="sc-preview">
      <div className="sc-preview-head">
        <div>
          <div className="sc-preview-title">YTD income</div>
          <div className="sc-bignum hp-pos">+$3,240</div>
        </div>
        <span className="sc-pill">+18% vs last year</span>
      </div>
      <div className="sc-bars">
        {heights.map((h, i) => (
          <div key={i} className="sc-bar" style={{ height: `${h}px` }} />
        ))}
      </div>
      <div className="sc-bars-labels">
        <span>J</span><span>F</span><span>M</span><span>A</span><span>M</span><span>J</span>
        <span>J</span><span>A</span><span>S</span><span>O</span><span>N</span><span>D</span>
      </div>
    </div>
  );
}

function ShowcaseAllocation() {
  return (
    <div className="sc-preview">
      <div className="sc-preview-head">
        <span className="sc-preview-title">Allocation</span>
      </div>
      <div className="sc-alloc">
        {[
          { l: "Technology", p: 38, c: "#7c6aff" },
          { l: "Financial Services", p: 18, c: "#34d399" },
          { l: "Healthcare", p: 14, c: "#60a5fa" },
          { l: "Consumer", p: 12, c: "#fbbf24" },
          { l: "Energy", p: 8, c: "#f87171" },
          { l: "Other", p: 10, c: "#a78bfa" },
        ].map((s) => (
          <div key={s.l} className="sc-alloc-row">
            <span className="sc-alloc-label">{s.l}</span>
            <div className="sc-alloc-bar">
              <div className="sc-alloc-fill" style={{ width: `${s.p}%`, background: s.c }} />
            </div>
            <span className="sc-alloc-pct">{s.p}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

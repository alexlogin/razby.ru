import Link from "next/link";
import { ArrowRight, CheckCircle2, Play, ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { RazbyLogo } from "@/components/razby-logo";
import { getLocalizedModules, getLocalizedPublicTools, t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";

const heroRows = [
  ["@sg_parser_01", "8.7", "Active", "EU pool"],
  ["@sg_warm_12", "6.9", "Warming", "Mobile mix"],
  ["@sg_dialog_04", "5.2", "Risk", "US slow"],
];

export default async function HomePage() {
  const locale = await getRequestLocale();
  const modules = getLocalizedModules(locale);
  const publicTools = getLocalizedPublicTools(locale);

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" aria-label="Razby home">
            <RazbyLogo />
          </Link>
          <nav className="nav" aria-label="Primary navigation">
            <a href="#modules">{t(locale, "home.nav.modules")}</a>
            <a href="#workflow">{t(locale, "home.nav.workflow")}</a>
            <a href="#tools">{t(locale, "home.nav.tools")}</a>
            <Link href="/login">{t(locale, "home.nav.login")}</Link>
          </nav>
          <LanguageSwitcher compact />
          <Link className="button" href="/dashboard">
            {t(locale, "common.startWorkspace")} <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <section className="container hero">
        <div className="hero-copy">
          <h1>{t(locale, "home.hero.title")}</h1>
          <p>{t(locale, "home.hero.subtitle")}</p>
          <div className="hero-actions">
            <Link className="button" href="/dashboard">
              {t(locale, "common.openWorkspace")} <ArrowRight size={16} />
            </Link>
            <a className="button secondary" href="#workflow">
              <Play size={16} /> {t(locale, "common.howItWorks")}
            </a>
          </div>
          <div className="proof-strip" aria-label="Razby metrics">
            <div className="proof">
              <strong>14</strong>
              <span>{t(locale, "home.proof.modules")}</span>
            </div>
            <div className="proof">
              <strong>GGR</strong>
              <span>{t(locale, "home.proof.ggr")}</span>
            </div>
            <div className="proof">
              <strong>24/7</strong>
              <span>{t(locale, "home.proof.logs")}</span>
            </div>
          </div>
        </div>

        <div className="product-frame" aria-label="Razby dashboard preview">
          <div className="product-frame-header">
            <div className="window-dots">
              <span />
              <span />
              <span />
            </div>
            <span className="status">Dashboard</span>
          </div>
          <div className="product-frame-body">
            <aside className="mini-sidebar">
              {["Accounts", "Parsers", "AI Comments", "Warm-up", "Protection", "GGR"].map((item, index) => (
                <div className={`mini-nav-item ${index === 0 ? "active" : ""}`} key={item}>
                  <CheckCircle2 size={15} /> {item}
                </div>
              ))}
            </aside>
            <div className="preview-main">
              <div className="metrics-grid">
                <div className="metric-card">
                  <span>Accounts</span>
                  <strong>248</strong>
                </div>
                <div className="metric-card">
                  <span>Healthy</span>
                  <strong>91%</strong>
                </div>
                <div className="metric-card">
                  <span>Leads</span>
                  <strong>8.4K</strong>
                </div>
                <div className="metric-card">
                  <span>Runs</span>
                  <strong>126</strong>
                </div>
              </div>
              <table className="table-preview">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>GGR</th>
                    <th>Status</th>
                    <th>Proxy</th>
                  </tr>
                </thead>
                <tbody>
                  {heroRows.map((row) => (
                    <tr key={row[0]}>
                      <td>{row[0]}</td>
                      <td>{row[1]}</td>
                      <td>
                        <span className={`status ${row[2] === "Risk" ? "risk" : row[2] === "Warming" ? "warn" : ""}`}>
                          {row[2]}
                        </span>
                      </td>
                      <td>{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="card" style={{ marginTop: 16 }}>
                <h3>{t(locale, "home.activity.title")}</h3>
                <p className="muted">{t(locale, "home.activity.text")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="workflow">
        <div className="container">
          <div className="section-head">
            <h2>{t(locale, "home.workflow.title")}</h2>
            <p>{t(locale, "home.workflow.subtitle")}</p>
          </div>
          <div className="feature-grid">
            {[
              ["1", t(locale, "home.workflow.step1.title"), t(locale, "home.workflow.step1.text")],
              ["2", t(locale, "home.workflow.step2.title"), t(locale, "home.workflow.step2.text")],
              ["3", t(locale, "home.workflow.step3.title"), t(locale, "home.workflow.step3.text")],
            ].map(([number, title, description]) => (
              <article className="feature-card" key={title}>
                <div className="feature-icon">{number}</div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="modules">
        <div className="container">
          <div className="section-head">
            <h2>{t(locale, "home.modules.title")}</h2>
            <p>{t(locale, "home.modules.subtitle")}</p>
          </div>
          <div className="module-grid">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Link className="module-card" href={`/dashboard/modules/${module.slug}`} key={module.slug}>
                  <div className="module-card-head">
                    <span className="feature-icon">
                      <Icon size={19} />
                    </span>
                    <span className="status">{module.price}</span>
                  </div>
                  <div>
                    <h3>{module.title}</h3>
                    <p className="muted">{module.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section" id="tools">
        <div className="container">
          <div className="section-head">
            <h2>{t(locale, "home.tools.title")}</h2>
            <p>{t(locale, "home.tools.subtitle")}</p>
          </div>
          <div className="feature-grid">
            {publicTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link className="feature-card" href="/dashboard/tools" key={tool.slug}>
                  <span className="feature-icon">
                    <Icon size={19} />
                  </span>
                  <h3>{tool.title}</h3>
                  <p>{tool.description}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="card" style={{ display: "flex", justifyContent: "space-between", gap: 24, alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0 }}>{t(locale, "home.cta.title")}</h2>
              <p className="muted">{t(locale, "home.cta.text")}</p>
            </div>
            <Link className="button" href="/dashboard">
              {t(locale, "home.cta.button")} <ShieldCheck size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

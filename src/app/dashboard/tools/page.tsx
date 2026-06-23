import { Map, ShieldCheck } from "lucide-react";
import { ProxyChecker } from "@/components/proxy-checker";
import { t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";

export default async function ToolsPage() {
  const locale = await getRequestLocale();

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Tools</h1>
          <p>{t(locale, "page.tools.subtitle")}</p>
        </div>
      </div>
      <div className="dashboard-grid">
        <ProxyChecker />
        <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <section className="card">
            <h2>
              <Map size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />
              {t(locale, "tools.channelMap")}
            </h2>
            <p className="muted">{t(locale, "tools.channelMapText")}</p>
            <div className="stat-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <div className="stat">
                <span>Channels</span>
                <strong>500K</strong>
              </div>
              <div className="stat">
                <span>Categories</span>
                <strong>598</strong>
              </div>
            </div>
          </section>
          <section className="card">
            <h2>
              <ShieldCheck size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />
              {t(locale, "tools.limits")}
            </h2>
            <p className="muted">{t(locale, "tools.limitsText")}</p>
          </section>
        </aside>
      </div>
    </>
  );
}

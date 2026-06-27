"use client";

import { useState } from "react";
import { Cable, Play } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type ProxyRun = {
  result?: {
    summary?: string;
    rows?: Array<Record<string, string | number | boolean>>;
    stats?: Record<string, string | number | boolean>;
  };
};

export function ProxyChecker() {
  const { t } = useI18n();
  const [proxies, setProxies] = useState("socks5://127.0.0.1:1080\nhost:port:user:pass");
  const [run, setRun] = useState<ProxyRun | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/proxies/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proxies }),
    });
    const data = await response.json();
    setRun(data.run ?? null);
    setLoading(false);
  }

  return (
    <section className="card">
      <h2>
        <Cable size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />
        {t("proxy.title")}
      </h2>
      <form className="form-grid" onSubmit={submit}>
        <label className="field full">
          <span>{t("proxy.input")}</span>
          <textarea className="textarea" value={proxies} onChange={(event) => setProxies(event.target.value)} />
        </label>
        <button className="button" type="submit" disabled={loading}>
          <Play size={16} /> {loading ? t("proxy.checking") : t("proxy.check")}
        </button>
      </form>
      {run?.result ? (
        <div style={{ marginTop: 18 }}>
          <p className="muted">{run.result.summary}</p>
          <table className="data-table">
            <tbody>
              {(run.result.rows ?? []).map((row, index) => (
                <tr key={index}>
                  {Object.entries(row).map(([key, value]) => (
                    <td key={key}>
                      <strong>{key}</strong>
                      <div className="muted">{String(value)}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Bot, CheckCircle2, Play, Route, Search, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type Scenario = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  settings: Record<string, unknown>;
};

type ScenarioResult = {
  campaign: Scenario;
  runs: Array<{
    id: string;
    moduleSlug: string;
    status: string;
    summary: string | null;
    stats: Record<string, string | number | boolean>;
    nextActions: string[];
  }>;
  nextActions: string[];
};

type FormState = {
  name: string;
  offer: string;
  channelLink: string;
  trafficSource: string;
  accountPersona: string;
  accountCount: number;
  proxyStrategy: string;
  keywords: string;
  seedSources: string;
  minMembers: number;
  language: string;
  activeOnly: string;
  prompt: string;
  responseProbability: number;
  contextMessages: number;
  maxReplies: number;
  stopAfterLink: string;
  approval: string;
};

const defaultForm: FormState = {
  name: "Telegram traffic system",
  offer: "Опишите продукт, кому он нужен и какой результат человек должен получить после перехода.",
  channelLink: "https://t.me/+razby_offer",
  trafficSource: "Reels / YouTube Shorts / закуп рекламы",
  accountPersona: "Эксперт по росту Telegram-проектов",
  accountCount: 12,
  proxyStrategy: "GEO аккаунта совпадает с прокси",
  keywords: "telegram marketing, продвижение канала, ai traffic",
  seedSources: "@competitor_channel\n@industry_chat",
  minMembers: 500,
  language: "Auto",
  activeOnly: "Только активные",
  prompt:
    "Отвечай на языке собеседника, коротко и по делу. Сначала помоги мыслью по теме, потом мягко переведи в канал только если запрос релевантен.",
  responseProbability: 5,
  contextMessages: 10,
  maxReplies: 2,
  stopAfterLink: "Остановить диалог",
  approval: "С подтверждением",
};

const workflowCopy = {
  ru: {
    error: "Не удалось собрать сценарий. Проверьте поля и попробуйте ещё раз.",
    stages: [
      ["Источник", "Откуда идёт первый трафик"],
      ["Telegram-ресурс", "Канал, бот или чат как точка прогрева"],
      ["Поиск аудиторий", "Каналы и чаты по нише"],
      ["AI-диалоги", "Персона, промпт, вероятность и link handoff"],
      ["Защита", "Лимиты, подтверждение и live-readiness"],
    ],
    labels: ["Название сценария", "Оффер и итоговая цель", "Источник трафика", "Telegram-ресурс / ссылка", "Персона аккаунтов", "Количество аккаунтов", "Прокси и GEO-стратегия", "Ключевые слова ниш", "Минимум участников", "Seed-каналы и чаты", "Язык", "Активность источников", "Промпт AI-чата", "Вероятность ответа, %", "Контекст сообщений", "Ответов на человека", "После ссылки", "Публикация"],
    activeOnly: ["Только активные", "Все найденные"],
    stopAfterLink: ["Остановить диалог", "Продолжать мягко"],
    approval: ["С подтверждением", "Автоматически"],
    readiness: "Готовность сценария",
    building: "Собираю...",
    build: "Собрать workflow",
    launchTitle: "Источник → Telegram → AI → оффер",
    launchText: "Сценарий повторяет референсную логику из видео, но запускается через ваши модули.",
    checks: ["Кампания создаётся в Campaigns", "Channel Parser даёт карту источников", "Neurochatting готовит AI-черновики", "Live-режим требует readiness"],
    resultTitle: "Сценарий собран",
    resultText: "Кампания {name} создана, тестовые запуски завершены.",
    recentEmpty: "Пока нет собранных сценариев.",
  },
  en: {
    error: "Could not build the scenario. Check fields and try again.",
    stages: [
      ["Source", "Where first traffic comes from"],
      ["Telegram asset", "Channel, bot or chat as the warm-up point"],
      ["Audience search", "Channels and chats by niche"],
      ["AI dialogs", "Persona, prompt, probability and link handoff"],
      ["Protection", "Limits, approval and live readiness"],
    ],
    labels: ["Scenario name", "Offer and final goal", "Traffic source", "Telegram asset / link", "Account persona", "Account count", "Proxy and GEO strategy", "Niche keywords", "Minimum members", "Seed channels and chats", "Language", "Source activity", "AI chat prompt", "Reply probability, %", "Message context", "Replies per person", "After link", "Publishing"],
    activeOnly: ["Active only", "All found"],
    stopAfterLink: ["Stop dialog", "Continue softly"],
    approval: ["With approval", "Automatically"],
    readiness: "Scenario readiness",
    building: "Building...",
    build: "Build workflow",
    launchTitle: "Source → Telegram → AI → offer",
    launchText: "The scenario follows the reference logic from the videos, but runs through your modules.",
    checks: ["Campaign is created in Campaigns", "Channel Parser builds the source map", "Neurochatting prepares AI drafts", "Live mode requires readiness"],
    resultTitle: "Scenario built",
    resultText: "Campaign {name} created, test runs completed.",
    recentEmpty: "No workflows built yet.",
  },
  es: {
    error: "No se pudo construir el escenario. Revisa los campos e inténtalo de nuevo.",
    stages: [
      ["Fuente", "De dónde viene el primer tráfico"],
      ["Recurso Telegram", "Canal, bot o chat como punto de calentamiento"],
      ["Búsqueda de audiencia", "Canales y chats por nicho"],
      ["Diálogos IA", "Persona, prompt, probabilidad y link handoff"],
      ["Protección", "Límites, aprobación y live readiness"],
    ],
    labels: ["Nombre del escenario", "Oferta y objetivo final", "Fuente de tráfico", "Recurso Telegram / link", "Persona de cuentas", "Cantidad de cuentas", "Proxy y estrategia GEO", "Keywords del nicho", "Mínimo de miembros", "Canales y chats seed", "Idioma", "Actividad de fuentes", "Prompt del chat IA", "Probabilidad de respuesta, %", "Contexto de mensajes", "Respuestas por persona", "Después del link", "Publicación"],
    activeOnly: ["Solo activos", "Todos encontrados"],
    stopAfterLink: ["Detener diálogo", "Continuar suavemente"],
    approval: ["Con aprobación", "Automáticamente"],
    readiness: "Readiness del escenario",
    building: "Construyendo...",
    build: "Crear workflow",
    launchTitle: "Fuente → Telegram → IA → oferta",
    launchText: "El escenario sigue la lógica del video, pero se ejecuta con tus módulos.",
    checks: ["La campaña se crea en Campaigns", "Channel Parser crea el mapa de fuentes", "Neurochatting prepara borradores IA", "Live mode requiere readiness"],
    resultTitle: "Escenario creado",
    resultText: "Campaña {name} creada, runs de prueba completados.",
    recentEmpty: "Aún no hay workflows creados.",
  },
  pt: {
    error: "Não foi possível montar o cenário. Revise os campos e tente novamente.",
    stages: [
      ["Fonte", "De onde vem o primeiro tráfego"],
      ["Recurso Telegram", "Canal, bot ou chat como ponto de aquecimento"],
      ["Busca de audiência", "Canais e chats por nicho"],
      ["Diálogos IA", "Persona, prompt, probabilidade e link handoff"],
      ["Proteção", "Limites, aprovação e live readiness"],
    ],
    labels: ["Nome do cenário", "Oferta e objetivo final", "Fonte de tráfego", "Recurso Telegram / link", "Persona das contas", "Quantidade de contas", "Proxy e estratégia GEO", "Keywords do nicho", "Mínimo de membros", "Canais e chats seed", "Idioma", "Atividade das fontes", "Prompt do chat IA", "Probabilidade de resposta, %", "Contexto de mensagens", "Respostas por pessoa", "Depois do link", "Publicação"],
    activeOnly: ["Apenas ativos", "Todos encontrados"],
    stopAfterLink: ["Parar diálogo", "Continuar suavemente"],
    approval: ["Com aprovação", "Automaticamente"],
    readiness: "Readiness do cenário",
    building: "Montando...",
    build: "Criar workflow",
    launchTitle: "Fonte → Telegram → IA → oferta",
    launchText: "O cenário segue a lógica dos vídeos, mas roda pelos seus módulos.",
    checks: ["A campanha é criada em Campaigns", "Channel Parser cria o mapa de fontes", "Neurochatting prepara rascunhos IA", "Live mode requer readiness"],
    resultTitle: "Cenário criado",
    resultText: "Campanha {name} criada, runs de teste concluídos.",
    recentEmpty: "Ainda não há workflows criados.",
  },
};

const stageIcons = [Route, UsersRound, Search, Bot, ShieldCheck];

export function ScenarioBuilder({ initialScenarios }: { initialScenarios: Scenario[] }) {
  const { dateLocale, locale } = useI18n();
  const copy = workflowCopy[locale];
  const stages = copy.stages.map(([title, detail], index) => ({ title, detail, icon: stageIcons[index] }));
  const [form, setForm] = useState<FormState>(defaultForm);
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readinessScore = useMemo(() => {
    const required = [form.name, form.offer, form.channelLink, form.keywords, form.prompt];
    return Math.round((required.filter((item) => String(item).trim().length > 8).length / required.length) * 100);
  }, [form]);

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const response = await fetch("/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : copy.error);
      return;
    }

    setResult(data);
    setScenarios((current) => [data.campaign, ...current.filter((item) => item.id !== data.campaign.id)].slice(0, 5));
  }

  return (
    <div className="workflow-grid">
      <section className="card workflow-builder">
        <div className="workflow-stage-list">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <div className="workflow-stage" key={stage.title}>
                <span className="feature-icon">
                  <Icon size={17} />
                </span>
                <div>
                  <strong>
                    {index + 1}. {stage.title}
                  </strong>
                  <span>{stage.detail}</span>
                </div>
              </div>
            );
          })}
        </div>

        <form className="form-grid workflow-form" onSubmit={submit}>
          <label className="field full">
            <span>{copy.labels[0]}</span>
            <input className="input" value={form.name} onChange={(event) => updateField("name", event.target.value)} />
          </label>

          <label className="field full">
            <span>{copy.labels[1]}</span>
            <textarea className="textarea" value={form.offer} onChange={(event) => updateField("offer", event.target.value)} />
          </label>

          <label className="field">
            <span>{copy.labels[2]}</span>
            <input className="input" value={form.trafficSource} onChange={(event) => updateField("trafficSource", event.target.value)} />
          </label>
          <label className="field">
            <span>{copy.labels[3]}</span>
            <input className="input" value={form.channelLink} onChange={(event) => updateField("channelLink", event.target.value)} />
          </label>

          <label className="field">
            <span>{copy.labels[4]}</span>
            <input className="input" value={form.accountPersona} onChange={(event) => updateField("accountPersona", event.target.value)} />
          </label>
          <label className="field">
            <span>{copy.labels[5]}</span>
            <input className="input" type="number" min={1} max={500} value={form.accountCount} onChange={(event) => updateField("accountCount", Number(event.target.value))} />
          </label>

          <label className="field full">
            <span>{copy.labels[6]}</span>
            <input className="input" value={form.proxyStrategy} onChange={(event) => updateField("proxyStrategy", event.target.value)} />
          </label>

          <label className="field">
            <span>{copy.labels[7]}</span>
            <input className="input" value={form.keywords} onChange={(event) => updateField("keywords", event.target.value)} />
          </label>
          <label className="field">
            <span>{copy.labels[8]}</span>
            <input className="input" type="number" min={100} max={1000000} value={form.minMembers} onChange={(event) => updateField("minMembers", Number(event.target.value))} />
          </label>

          <label className="field full">
            <span>{copy.labels[9]}</span>
            <textarea className="textarea compact" value={form.seedSources} onChange={(event) => updateField("seedSources", event.target.value)} />
          </label>

          <label className="field">
            <span>{copy.labels[10]}</span>
            <select className="select" value={form.language} onChange={(event) => updateField("language", event.target.value)}>
              <option>Auto</option>
              <option>RU</option>
              <option>EN</option>
              <option>ES</option>
              <option>PT</option>
            </select>
          </label>
          <label className="field">
            <span>{copy.labels[11]}</span>
            <select className="select" value={form.activeOnly} onChange={(event) => updateField("activeOnly", event.target.value)}>
              <option value="Только активные">{copy.activeOnly[0]}</option>
              <option value="Все найденные">{copy.activeOnly[1]}</option>
            </select>
          </label>

          <label className="field full">
            <span>{copy.labels[12]}</span>
            <textarea className="textarea" value={form.prompt} onChange={(event) => updateField("prompt", event.target.value)} />
          </label>

          <label className="field">
            <span>{copy.labels[13]}</span>
            <input className="input" type="number" min={1} max={100} value={form.responseProbability} onChange={(event) => updateField("responseProbability", Number(event.target.value))} />
          </label>
          <label className="field">
            <span>{copy.labels[14]}</span>
            <input className="input" type="number" min={1} max={50} value={form.contextMessages} onChange={(event) => updateField("contextMessages", Number(event.target.value))} />
          </label>
          <label className="field">
            <span>{copy.labels[15]}</span>
            <input className="input" type="number" min={1} max={20} value={form.maxReplies} onChange={(event) => updateField("maxReplies", Number(event.target.value))} />
          </label>
          <label className="field">
            <span>{copy.labels[16]}</span>
            <select className="select" value={form.stopAfterLink} onChange={(event) => updateField("stopAfterLink", event.target.value)}>
              <option value="Остановить диалог">{copy.stopAfterLink[0]}</option>
              <option value="Продолжать мягко">{copy.stopAfterLink[1]}</option>
            </select>
          </label>
          <label className="field">
            <span>{copy.labels[17]}</span>
            <select className="select" value={form.approval} onChange={(event) => updateField("approval", event.target.value)}>
              <option value="С подтверждением">{copy.approval[0]}</option>
              <option value="Автоматически">{copy.approval[1]}</option>
            </select>
          </label>

          <div className="scenario-submit">
            <div>
              <span className="muted small">{copy.readiness}</span>
              <strong>{readinessScore}%</strong>
            </div>
            <button className="button" type="submit" disabled={saving || readinessScore < 60}>
              <Play size={16} /> {saving ? copy.building : copy.build}
            </button>
          </div>
        </form>
      </section>

      <aside className="workflow-side">
        <section className="card">
          <h2>Launch plan</h2>
          <div className="launch-metric">
            <Sparkles size={18} />
            <div>
              <strong>{copy.launchTitle}</strong>
              <span>{copy.launchText}</span>
            </div>
          </div>
          <div className="check-list">
            <span>
              <CheckCircle2 size={15} /> {copy.checks[0]}
            </span>
            <span>
              <CheckCircle2 size={15} /> {copy.checks[1]}
            </span>
            <span>
              <CheckCircle2 size={15} /> {copy.checks[2]}
            </span>
            <span>
              <CheckCircle2 size={15} /> {copy.checks[3]}
            </span>
          </div>
          {error ? <p className="notice">{error}</p> : null}
        </section>

        {result ? (
          <section className="card result-card">
            <h2>{copy.resultTitle}</h2>
            <p className="muted">
              {copy.resultText.split("{name}")[0]}<strong>{result.campaign.name}</strong>{copy.resultText.split("{name}")[1]}
            </p>
            {result.runs.map((run) => (
              <div className="run-result" key={run.id}>
                <div>
                  <strong>{run.moduleSlug}</strong>
                  <span className="status">{run.status}</span>
                </div>
                <p>{run.summary}</p>
                <div className="pill-row">
                  {Object.entries(run.stats)
                    .slice(0, 4)
                    .map(([key, value]) => (
                      <span className="pill" key={key}>
                        {key}: {String(value)}
                      </span>
                    ))}
                </div>
              </div>
            ))}
            <div className="check-list">
              {result.nextActions.map((action) => (
                <span key={action}>
                  <CheckCircle2 size={15} /> {action}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="card">
          <h2>Recent workflows</h2>
          <div className="recent-list">
            {scenarios.map((scenario) => (
              <div className="recent-item" key={scenario.id}>
                <strong>{scenario.name}</strong>
                <span>
                  {scenario.status} · {new Date(scenario.createdAt).toLocaleDateString(dateLocale)}
                </span>
              </div>
            ))}
            {scenarios.length === 0 ? <p className="muted">{copy.recentEmpty}</p> : null}
          </div>
        </section>
      </aside>
    </div>
  );
}

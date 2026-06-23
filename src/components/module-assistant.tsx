"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { CheckCircle2, HelpCircle, ListChecks, PlayCircle, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { getLocalizedModule, type Locale } from "@/lib/i18n";
import type { ModuleCategory, RazbyModule } from "@/lib/modules";

type AssistantStep = {
  title: string;
  detail: string;
  href?: string;
};

const categorySteps: Record<Locale, Record<ModuleCategory, AssistantStep[]>> = {
  ru: {
    Аккаунты: [
      { title: "Добавьте аккаунты", detail: "Импортируйте session-аккаунты или внесите рабочие аккаунты вручную.", href: "/dashboard/accounts" },
      { title: "Привяжите прокси", detail: "Проверьте прокси и распределите их по аккаунтам перед нагрузкой.", href: "/dashboard/tools" },
      { title: "Запустите малый тест", detail: "Начните с небольшого лимита, затем смотрите health score и журнал запусков." },
    ],
    Парсинг: [
      { title: "Подготовьте источники", detail: "Укажите каналы, группы, чаты или ключевые слова, откуда нужно собрать базу." },
      { title: "Настройте фильтры", detail: "Задайте язык, активность, период и минимальные размеры источников." },
      { title: "Проверьте результат", detail: "После запуска откройте Leads и выгрузите чистый список.", href: "/dashboard/leads" },
    ],
    ИИ: [
      { title: "Подключите OpenRouter", detail: "В админке должен быть сохранён API-ключ для ИИ-ответов.", href: "/dashboard/admin" },
      { title: "Опишите оффер", detail: "Заполните промпт, тон, ссылку и условия передачи оператору." },
      { title: "Оставьте ручное подтверждение", detail: "Для первого запуска проверьте ответы вручную, затем можно ускорять сценарий." },
    ],
    Охваты: [
      { title: "Проверьте аккаунты", detail: "Перед масс-действиями прогоните GGR и убедитесь, что нет красных рисков.", href: "/dashboard/modules/ggr" },
      { title: "Задайте цели и темп", detail: "Укажите ссылки/цели, лимиты и осторожный темп для первого запуска." },
      { title: "Следите за статусами", detail: "После запуска проверьте успешность, ошибки и next actions в истории модуля." },
    ],
    Защита: [
      { title: "Выберите аккаунты", detail: "Проверьте все аккаунты, которые будут работать в парсинге, ИИ или охватах.", href: "/dashboard/accounts" },
      { title: "Настройте политику", detail: "Для старта используйте conservative или balanced, затем смотрите рекомендации." },
      { title: "Уберите рисковые аккаунты", detail: "Аккаунты с высоким риском отправьте в прогрев или резерв." },
    ],
    Инструменты: [
      { title: "Вставьте данные", detail: "Добавьте прокси, токены или другие входные данные в нужное поле." },
      { title: "Запустите проверку", detail: "Сначала сделайте тестовый прогон, затем сохраняйте рабочие значения." },
      { title: "Перенесите в модуль", detail: "Используйте проверенные данные в аккаунтах, кампаниях или workflow." },
    ],
  },
  en: {
    Аккаунты: [
      { title: "Add accounts", detail: "Import session accounts or add working accounts manually.", href: "/dashboard/accounts" },
      { title: "Attach proxies", detail: "Check proxies and assign them before any load.", href: "/dashboard/tools" },
      { title: "Run a small test", detail: "Start with a low limit, then check health score and run logs." },
    ],
    Парсинг: [
      { title: "Prepare sources", detail: "Add channels, groups, chats or keywords for collecting the base." },
      { title: "Tune filters", detail: "Set language, activity, period and minimum source size." },
      { title: "Check results", detail: "After launch, open Leads and export a clean list.", href: "/dashboard/leads" },
    ],
    ИИ: [
      { title: "Connect OpenRouter", detail: "An AI API key must be saved in Admin.", href: "/dashboard/admin" },
      { title: "Describe the offer", detail: "Fill prompt, tone, link and operator handoff rules." },
      { title: "Keep manual approval", detail: "Review the first replies manually, then speed up the scenario." },
    ],
    Охваты: [
      { title: "Check accounts", detail: "Run GGR before mass actions and confirm there are no red risks.", href: "/dashboard/modules/ggr" },
      { title: "Set targets and pace", detail: "Add links or targets, limits and a careful first-run pace." },
      { title: "Watch statuses", detail: "After launch, inspect success, errors and next actions in history." },
    ],
    Защита: [
      { title: "Choose accounts", detail: "Check every account that will work in parsing, AI or reach.", href: "/dashboard/accounts" },
      { title: "Set policy", detail: "Start with conservative or balanced, then inspect recommendations." },
      { title: "Remove risky accounts", detail: "Move high-risk accounts to warm-up or reserve." },
    ],
    Инструменты: [
      { title: "Paste data", detail: "Add proxies, tokens or other input data to the right field." },
      { title: "Run a check", detail: "Do a test pass first, then save working values." },
      { title: "Move into a module", detail: "Use checked data in accounts, campaigns or workflow." },
    ],
  },
  es: {
    Аккаунты: [
      { title: "Añade cuentas", detail: "Importa sesiones o agrega cuentas manualmente.", href: "/dashboard/accounts" },
      { title: "Asigna proxies", detail: "Verifica proxies y distribúyelos antes de la carga.", href: "/dashboard/tools" },
      { title: "Lanza una prueba pequeña", detail: "Empieza con límite bajo y revisa health score y logs." },
    ],
    Парсинг: [
      { title: "Prepara fuentes", detail: "Agrega canales, grupos, chats o keywords para reunir la base." },
      { title: "Ajusta filtros", detail: "Define idioma, actividad, período y tamaño mínimo." },
      { title: "Revisa resultados", detail: "Después del run abre Leads y exporta la lista limpia.", href: "/dashboard/leads" },
    ],
    ИИ: [
      { title: "Conecta OpenRouter", detail: "Debe existir una API key de IA guardada en Admin.", href: "/dashboard/admin" },
      { title: "Describe la oferta", detail: "Completa prompt, tono, link y reglas de handoff." },
      { title: "Mantén aprobación manual", detail: "Revisa las primeras respuestas antes de acelerar el escenario." },
    ],
    Охваты: [
      { title: "Revisa cuentas", detail: "Ejecuta GGR antes de acciones masivas y evita riesgos rojos.", href: "/dashboard/modules/ggr" },
      { title: "Define objetivos y ritmo", detail: "Agrega links, límites y ritmo cuidadoso para el primer run." },
      { title: "Observa estados", detail: "Revisa éxito, errores y next actions en el historial." },
    ],
    Защита: [
      { title: "Elige cuentas", detail: "Revisa las cuentas que trabajarán en parsing, IA o alcance.", href: "/dashboard/accounts" },
      { title: "Configura política", detail: "Empieza con conservative o balanced y mira recomendaciones." },
      { title: "Retira cuentas de riesgo", detail: "Envía cuentas de alto riesgo a warm-up o reserva." },
    ],
    Инструменты: [
      { title: "Pega datos", detail: "Añade proxies, tokens u otros datos de entrada." },
      { title: "Ejecuta check", detail: "Primero haz una prueba y luego guarda valores funcionales." },
      { title: "Pásalo al módulo", detail: "Usa datos verificados en cuentas, campañas o workflow." },
    ],
  },
  pt: {
    Аккаунты: [
      { title: "Adicione contas", detail: "Importe sessões ou cadastre contas manualmente.", href: "/dashboard/accounts" },
      { title: "Atribua proxies", detail: "Verifique proxies e distribua antes da carga.", href: "/dashboard/tools" },
      { title: "Rode um teste pequeno", detail: "Comece com limite baixo e revise health score e logs." },
    ],
    Парсинг: [
      { title: "Prepare fontes", detail: "Adicione canais, grupos, chats ou keywords para montar a base." },
      { title: "Ajuste filtros", detail: "Defina idioma, atividade, período e tamanho mínimo." },
      { title: "Revise resultados", detail: "Depois do run abra Leads e exporte a lista limpa.", href: "/dashboard/leads" },
    ],
    ИИ: [
      { title: "Conecte OpenRouter", detail: "Uma API key de IA precisa estar salva no Admin.", href: "/dashboard/admin" },
      { title: "Descreva a oferta", detail: "Preencha prompt, tom, link e regras de handoff." },
      { title: "Mantenha aprovação manual", detail: "Revise as primeiras respostas antes de acelerar o cenário." },
    ],
    Охваты: [
      { title: "Verifique contas", detail: "Rode GGR antes de ações em massa e evite riscos vermelhos.", href: "/dashboard/modules/ggr" },
      { title: "Defina metas e ritmo", detail: "Adicione links, limites e ritmo cuidadoso para o primeiro run." },
      { title: "Acompanhe status", detail: "Revise sucesso, erros e next actions no histórico." },
    ],
    Защита: [
      { title: "Escolha contas", detail: "Revise contas que trabalharão em parsing, IA ou alcance.", href: "/dashboard/accounts" },
      { title: "Configure política", detail: "Comece com conservative ou balanced e veja recomendações." },
      { title: "Remova contas de risco", detail: "Mova contas de alto risco para warm-up ou reserva." },
    ],
    Инструменты: [
      { title: "Cole dados", detail: "Adicione proxies, tokens ou outros dados no campo certo." },
      { title: "Rode verificação", detail: "Faça um teste primeiro e depois salve valores funcionais." },
      { title: "Use no módulo", detail: "Use dados verificados em contas, campanhas ou workflow." },
    ],
  },
};

function getCurrentModule(pathname: string, locale: Locale) {
  const match = pathname.match(/^\/dashboard\/modules\/([^/]+)/);
  return match ? getLocalizedModule(decodeURIComponent(match[1]), locale) : undefined;
}

function moduleFieldStep(module: RazbyModule, locale: Locale, translate: (key: string, values?: Record<string, string | number>) => string): AssistantStep {
  const labels = module.fields.map((field) => field.label).join(", ");
  return {
    title: translate("assistant.moduleFields"),
    detail: labels ? translate("assistant.requiredBlocks", { fields: labels }) : translate("assistant.checkSettings"),
  };
}

function generalSteps(pathname: string, locale: Locale): AssistantStep[] {
  if (pathname.includes("/workflow")) {
    const copy = {
      ru: ["Выберите сценарий", "Соберите цепочку: источники, обработка, ИИ, охваты и контроль.", "Проверьте зависимости", "Убедитесь, что аккаунты, прокси и ключи уже настроены.", "Запустите поэтапно", "Сначала один аккаунт и малый лимит, затем масштабирование."],
      en: ["Choose scenario", "Build the chain: sources, processing, AI, reach and control.", "Check dependencies", "Make sure accounts, proxies and keys are configured.", "Launch step by step", "Start with one account and a small limit, then scale."],
      es: ["Elige escenario", "Construye la cadena: fuentes, procesamiento, IA, alcance y control.", "Revisa dependencias", "Asegura cuentas, proxies y keys configuradas.", "Lanza por etapas", "Empieza con una cuenta y límite pequeño, luego escala."],
      pt: ["Escolha cenário", "Monte a cadeia: fontes, processamento, IA, alcance e controle.", "Revise dependências", "Garanta contas, proxies e chaves configuradas.", "Lance por etapas", "Comece com uma conta e limite pequeno, depois escale."],
    }[locale];
    return [
      { title: copy[0], detail: copy[1] },
      { title: copy[2], detail: copy[3], href: "/dashboard/settings" },
      { title: copy[4], detail: copy[5] },
    ];
  }

  if (pathname.includes("/settings") || pathname.includes("/admin")) {
    const copy = {
      ru: ["Заполните ключи", "Добавьте OpenRouter, Telegram, email и worker-настройки.", "Проверьте readiness", "Все критичные пункты должны быть ok перед live-запуском.", "Сделайте тест", "Запустите один модуль в малом объёме и проверьте Audit."],
      en: ["Fill keys", "Add OpenRouter, Telegram, email and worker settings.", "Check readiness", "Critical checks must be ok before live launch.", "Run a test", "Launch one module at small volume and inspect Audit."],
      es: ["Rellena keys", "Añade OpenRouter, Telegram, email y worker.", "Revisa readiness", "Los puntos críticos deben estar ok antes del live.", "Haz una prueba", "Lanza un módulo pequeño y revisa Audit."],
      pt: ["Preencha chaves", "Adicione OpenRouter, Telegram, email e worker.", "Revise readiness", "Checks críticos precisam estar ok antes do live.", "Faça um teste", "Rode um módulo pequeno e revise Audit."],
    }[locale];
    return [
      { title: copy[0], detail: copy[1], href: "/dashboard/admin" },
      { title: copy[2], detail: copy[3], href: "/dashboard/settings" },
      { title: copy[4], detail: copy[5], href: "/dashboard/audit" },
    ];
  }

  const copy = {
    ru: ["Начните с аккаунтов", "Добавьте один рабочий аккаунт и назначьте прокси.", "Проверьте качество", "Запустите GGR и защиту, чтобы не нагружать плохой аккаунт.", "Запустите нужный модуль", "Откройте модуль, заполните поля и начните с минимального лимита."],
    en: ["Start with accounts", "Add one working account and assign a proxy.", "Check quality", "Run GGR and protection before loading weak accounts.", "Launch a module", "Open a module, fill fields and start with the minimum limit."],
    es: ["Empieza con cuentas", "Añade una cuenta activa y asigna proxy.", "Revisa calidad", "Ejecuta GGR y protección antes de cargar cuentas débiles.", "Lanza un módulo", "Abre un módulo, completa campos y empieza con límite mínimo."],
    pt: ["Comece com contas", "Adicione uma conta ativa e atribua proxy.", "Revise qualidade", "Rode GGR e proteção antes de carregar contas fracas.", "Lance um módulo", "Abra um módulo, preencha campos e comece com limite mínimo."],
  }[locale];
  return [
    { title: copy[0], detail: copy[1], href: "/dashboard/accounts" },
    { title: copy[2], detail: copy[3], href: "/dashboard/modules/ggr" },
    { title: copy[4], detail: copy[5] },
  ];
}

export function ModuleAssistant() {
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);

  const { title, subtitle, steps } = useMemo(() => {
    const module = getCurrentModule(pathname, locale);

    if (!module) {
      return {
        title: t("assistant.title"),
        subtitle: t("assistant.subtitle"),
        steps: generalSteps(pathname, locale),
      };
    }

    return {
      title: module.title,
      subtitle: module.outcome,
      steps: [moduleFieldStep(module, locale, t), ...categorySteps[locale][module.category]],
    };
  }, [locale, pathname, t]);

  return (
    <div className={`assistant-widget ${open ? "open" : ""}`}>
      {open ? (
        <section className="assistant-panel" aria-label={t("assistant.title")}>
          <div className="assistant-head">
            <div>
              <span className="muted small">{t("assistant.next")}</span>
              <h2>{title}</h2>
            </div>
            <button className="icon-button" type="button" aria-label={t("assistant.close")} onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <p className="muted">{subtitle}</p>
          <div className="assistant-steps">
            {steps.map((step, index) => (
              <div className="assistant-step" key={`${step.title}-${index}`}>
                <span className="assistant-step-number">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                  {step.href ? (
                    <Link className="assistant-link" href={step.href}>
                      {t("assistant.link")}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div className="assistant-footer">
            <CheckCircle2 size={16} />
            <span>{t("assistant.footer")}</span>
          </div>
        </section>
      ) : null}
      <button className="assistant-toggle" type="button" onClick={() => setOpen((value) => !value)}>
        {open ? <ListChecks size={18} /> : <HelpCircle size={18} />}
        <span>{t("assistant.toggle")}</span>
        <PlayCircle size={16} />
      </button>
    </div>
  );
}

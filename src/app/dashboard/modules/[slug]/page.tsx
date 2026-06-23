import { notFound } from "next/navigation";
import { ModuleWorkbench } from "@/components/module-workbench";
import { getLocalizedModule } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const module = getLocalizedModule(slug, locale);

  if (!module) {
    notFound();
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>{module.title}</h1>
          <p>{module.description}</p>
        </div>
        <span className="status">{module.price}</span>
      </div>
      <ModuleWorkbench
        slug={module.slug}
        title={module.title}
        description={module.description}
        outcome={module.outcome}
        fields={module.fields}
        metrics={module.metrics}
      />
    </>
  );
}

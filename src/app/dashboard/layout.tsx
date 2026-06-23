import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getCurrentUser } from "@/lib/auth";
import { ensureWorkspace } from "@/lib/workspace";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  await ensureWorkspace(user.id);

  return (
    <DashboardShell user={{ name: user.name, email: user.email }}>
      {children}
    </DashboardShell>
  );
}

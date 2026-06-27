import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { IntegrationsManager } from "@/components/admin/IntegrationsManager";

export default async function AdminIntegrationsPage() {
  const session = await getServerSession(authOptions);
  if (session!.user.role !== "admin") redirect("/");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Admin — Integrations</h1>
      <IntegrationsManager />
    </div>
  );
}

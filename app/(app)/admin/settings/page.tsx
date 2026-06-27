import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { connectDB } from "@/lib/db/connection";
import Organization from "@/lib/db/models/Organization";
import { OrgSettingsForm } from "@/components/admin/OrgSettingsForm";
import { UsersManager } from "@/components/admin/UsersManager";

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  if (session!.user.role !== "admin") redirect("/");

  await connectDB();
  const org = await Organization.findById(session!.user.organizationId).lean();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Admin — Settings</h1>
      <OrgSettingsForm
        initialAvgStoryPoints={org?.settings.avgStoryPoints ?? 5}
        initialHolidays={(org?.holidays ?? []).map((h) => ({ date: h.date.toISOString().slice(0, 10), name: h.name }))}
        initialLocalAuthEnabled={org?.settings.localAuthEnabled ?? true}
      />
      <UsersManager />
    </div>
  );
}

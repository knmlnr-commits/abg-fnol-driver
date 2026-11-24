import { TenantShell } from "@/components/TenantShell";
import { Wizard } from "@/components/Wizard";
import { themeForIncident } from "@/lib/server/themes";

export const dynamic = "force-dynamic";

/** The driver's personal link: the wizard while in draft, the confirmation after submit. */
export default async function IncidentPage({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;
  return (
    <TenantShell theme={await themeForIncident(token)}>
      <Wizard token={token} />
    </TenantShell>
  );
}

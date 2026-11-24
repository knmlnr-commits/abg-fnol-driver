import { DocRequest } from "@/components/DocRequest";
import { TenantShell } from "@/components/TenantShell";
import { themeForIncident } from "@/lib/server/themes";

export const dynamic = "force-dynamic";

/** Document request link sent by a handler to the driver or the rental station. */
export default async function DocRequestPage({ params }: PageProps<"/d/[token]">) {
  const { token } = await params;
  return (
    <TenantShell theme={await themeForIncident(token)}>
      <DocRequest token={token} />
    </TenantShell>
  );
}

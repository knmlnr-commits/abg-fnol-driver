import { TenantShell } from "@/components/TenantShell";
import { LoginForm } from "@/components/admin/LoginForm";
import { mockLoginAvailable } from "@/lib/server/adminAuth";
import { defaultTheme } from "@/lib/server/themes";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  return (
    <TenantShell theme={await defaultTheme()}>
      <LoginForm available={mockLoginAvailable()} />
    </TenantShell>
  );
}

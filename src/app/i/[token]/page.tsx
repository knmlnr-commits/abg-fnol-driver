import { Wizard } from "@/components/Wizard";

export const dynamic = "force-dynamic";

/** The driver's personal link: the wizard while in draft, the confirmation after submit. */
export default async function IncidentPage({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;
  return <Wizard token={token} />;
}

import { DocRequest } from "@/components/DocRequest";

export const dynamic = "force-dynamic";

/** Document request link sent by a handler to the driver or the rental station. */
export default async function DocRequestPage({ params }: PageProps<"/d/[token]">) {
  const { token } = await params;
  return <DocRequest token={token} />;
}

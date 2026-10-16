import { notFound } from "next/navigation";
import { StatusPageView } from "@/components/status-page/view";
import { loadStatusPage } from "@/lib/status-page/data";

export const revalidate = 60;

// Özel alan adıyla gelen istekler (middleware /status/_d/<host> adresine yeniden yazar)
export default async function CustomDomainStatusPage({ params }: { params: { host: string } }) {
  const host = decodeURIComponent(params.host).toLowerCase();
  const data = await loadStatusPage({ customDomain: host });
  if (!data) notFound();
  return <StatusPageView data={data} />;
}

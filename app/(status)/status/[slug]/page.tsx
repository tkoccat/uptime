import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatusPageView } from "@/components/status-page/view";
import { loadStatusPage } from "@/lib/status-page/data";

// Dakikada bir yenilenen statik sayfa: yoğun ziyarette veritabanını yormaz
export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await loadStatusPage({ slug: params.slug.toLowerCase() });
  return data ? { title: data.title } : {};
}

export default async function StatusPage({ params }: { params: { slug: string } }) {
  const data = await loadStatusPage({ slug: params.slug.toLowerCase() });
  if (!data) notFound();
  return <StatusPageView data={data} />;
}

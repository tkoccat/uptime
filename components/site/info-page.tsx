// Hakkında, güvenlik, iletişim gibi bilgi sayfalarının ortak çerçevesi
export function InfoPage({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-16">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        {lead && <p className="text-lg text-muted-foreground">{lead}</p>}
      </header>
      <div className="space-y-4 leading-7">{children}</div>
    </main>
  );
}

export function InfoH2({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-4 text-xl font-semibold">{children}</h2>;
}

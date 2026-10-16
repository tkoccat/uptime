import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";

export default async function AuditPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  await requireAdmin();

  const rows = await prisma.auditLog.findMany({
    where: { action: { startsWith: "admin." } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true } } },
  });
  const fmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" });

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">Every change made from this panel (last 100).</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border text-sm">
          {rows.map((r) => (
            <li key={r.id} className="space-y-1 p-3">
              <p className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{r.action.replace("admin.", "")}</span>
                <span className="text-muted-foreground">
                  {r.user?.email ?? "(deleted admin)"} · {fmt.format(r.createdAt)}
                </span>
              </p>
              {r.metadata != null && (
                <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(r.metadata, null, 2).slice(0, 1500)}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

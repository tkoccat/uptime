import type { Plan } from "@prisma/client";
import { setRequestLocale } from "next-intl/server";
import { AdminFlash, selectClass } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { listUsers } from "@/lib/admin/users";

const PLANS = ["FREE", "PRO", "BUSINESS"] as const;

export default async function UsersPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { q?: string; plan?: string; page?: string; ok?: string; error?: string };
}) {
  setRequestLocale(locale);
  await requireAdmin();

  const plan = PLANS.find((p) => p === searchParams.plan) as Plan | undefined;
  const { users, total, page, pages } = await listUsers({ q: searchParams.q, plan, page: Number(searchParams.page) || 1 });
  const fmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
  const qs = (p: number) => `?${new URLSearchParams({ ...(searchParams.q ? { q: searchParams.q } : {}), ...(plan ? { plan } : {}), page: String(p) })}`;

  return (
    <>
      <h1 className="text-2xl font-semibold">Users</h1>
      <AdminFlash ok={searchParams.ok} error={searchParams.error} />

      <form className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="q" className="text-sm font-medium">
            Search email
          </label>
          <Input id="q" name="q" defaultValue={searchParams.q ?? ""} placeholder="name@example.com" />
        </div>
        <div className="space-y-1">
          <label htmlFor="plan" className="text-sm font-medium">
            Plan
          </label>
          <select id="plan" name="plan" defaultValue={plan ?? ""} className={selectClass}>
            <option value="">All</option>
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Filter</Button>
      </form>

      <p className="text-sm text-muted-foreground">{total} users</p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary">
            <tr>
              {["Email", "Plan", "Monitors", "Status", "Joined"].map((h) => (
                <th key={h} className="p-3" scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id}>
                <th className="p-3 font-medium" scope="row">
                  <Link href={`/admin/users/${u.id}`} className="underline">
                    {u.email}
                  </Link>
                </th>
                <td className="p-3">
                  {u.plan}
                  {u.planLocked ? " (locked)" : ""}
                </td>
                <td className="p-3">{u._count.monitors}</td>
                <td className="p-3">{u.suspendedAt ? "Suspended" : "Active"}</td>
                <td className="p-3">{fmt.format(u.createdAt)}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={5}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/admin/users${qs(page - 1)}`} className="underline">
              ← Previous
            </Link>
          )}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={`/admin/users${qs(page + 1)}`} className="underline">
              Next →
            </Link>
          )}
        </div>
      )}
    </>
  );
}

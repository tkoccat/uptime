import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; info?: string };
}) {
  return (
    <AuthShell
      title="Reset your password"
      description="We'll email you a reset link."
      error={searchParams.error}
      info={searchParams.info}
    >
      <form action={requestPasswordReset} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <Button type="submit" className="w-full">
          Send reset link
        </Button>
      </form>
      <Link href="/login" className="text-sm underline">
        Back to sign in
      </Link>
    </AuthShell>
  );
}

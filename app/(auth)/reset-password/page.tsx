import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "../actions";

export default function ResetPasswordPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <AuthShell title="Choose a new password" error={searchParams.error}>
      <form action={updatePassword} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <Button type="submit" className="w-full">
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}

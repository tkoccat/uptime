import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signInWithGoogle } from "../actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; info?: string; next?: string };
}) {
  return (
    <AuthShell title="Sign in" error={searchParams.error} info={searchParams.info}>
      <form action={signIn} className="space-y-3">
        <input type="hidden" name="next" value={searchParams.next ?? ""} />
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          Continue with Google
        </Button>
      </form>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="underline">
          Forgot password?
        </Link>
        <Link href="/register" className="underline">
          Create account
        </Link>
      </div>
    </AuthShell>
  );
}

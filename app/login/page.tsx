import { LockIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const ERRORS: Record<string, string> = {
  invalid: "Incorrect password.",
  rate: "Too many attempts. Try again in 15 minutes.",
  config: "DASHBOARD_PASSWORD or SESSION_SECRET is not configured on the server.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
            <LockIcon />
          </div>
          <CardTitle>OpenAI Usage Dashboard</CardTitle>
          <CardDescription>Enter the dashboard password to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Plain form post: works even if client JS fails to hydrate. */}
          <form method="post" action="/api/login">
            <FieldGroup>
              {message && (
                <Alert variant="destructive">
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}
              <Field data-invalid={error === "invalid" || undefined}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  autoFocus
                  aria-invalid={error === "invalid" || undefined}
                />
              </Field>
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

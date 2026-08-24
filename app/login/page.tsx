// Creator sign-in via Supabase magic link. Implements: TRD-5.1, Plan Stage 0.
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-3xl font-bold">Kept</h1>
      <p className="mt-2 text-ink-muted">Record a conversation. Every commitment becomes a tracked task.</p>
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-bg p-3 text-danger">
          Sign-in link didn’t work: {error}. Request a new one.
        </p>
      ) : null}
      <LoginForm next={next ?? "/"} />
    </main>
  );
}

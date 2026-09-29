import { signIn } from '@/auth';

/*
 * T-203 — Página de login.
 *
 * Formulário com Server Action invoca `signIn('google')`. Usuário é
 * redirecionado pelo OAuth → callback do Auth.js → callback `signIn`
 * (validação de allowlist) → de volta aqui se foi negado, ou para a
 * home protegida se passou.
 */

interface LoginPageProps {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, next } = await searchParams;
  const errorMsg =
    error === 'AccessDenied'
      ? 'Acesso restrito a gestores autorizados. Se acha que é engano, fale com o responsável pelo painel.'
      : error
        ? 'Não foi possível concluir o login. Tenta de novo.'
        : null;

  async function handleSignIn() {
    'use server';
    await signIn('google', { redirectTo: next ?? '/' });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border p-8">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Dashboard de Vendas</h1>
          <p className="text-sm text-muted-foreground">
            Acesso restrito a gestores. Entre com a conta Google autorizada.
          </p>
        </header>

        <form action={handleSignIn}>
          <button
            type="submit"
            className="w-full rounded border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Entrar com Google
          </button>
        </form>

        {errorMsg && (
          <p
            role="alert"
            className="rounded border border-border bg-muted p-3 text-xs text-foreground"
          >
            {errorMsg}
          </p>
        )}
      </div>
    </main>
  );
}

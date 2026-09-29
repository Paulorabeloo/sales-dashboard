import { redirect } from 'next/navigation';

import { auth, signOut } from '@/auth';
import { Nav } from '@/components/nav/Nav';
import { maskEmail } from '@/lib/auth/allowlist';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const masked = maskEmail(session.user.email);

  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-56 flex-shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="border-b border-border px-5 py-4">
          <div className="text-base font-semibold tracking-tight">Dashboard de Vendas</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Matrículas
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Nav />
        </div>
        <div className="border-t border-border px-5 py-3 text-xs">
          <div className="mb-2 truncate tabular text-muted-foreground">{masked}</div>
          <form action={handleSignOut}>
            <button
              type="submit"
              className="w-full rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
          <div className="text-sm font-semibold tracking-tight">Dashboard de Vendas</div>
          <div className="flex items-center gap-3 text-xs">
            <span className="tabular text-muted-foreground">{masked}</span>
            <form action={handleSignOut}>
              <button
                type="submit"
                className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                Sair
              </button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

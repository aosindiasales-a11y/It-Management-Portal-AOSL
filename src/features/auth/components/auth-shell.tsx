import { LoginHero } from "@/features/auth/components/login-hero";

/** The split layout (form card + 3D hero) shared by every auth page. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-5">
      <div className="bg-login-page relative flex items-center justify-center overflow-hidden bg-background px-6 py-12 lg:col-span-2">
        {children}
      </div>
      <div className="relative hidden overflow-hidden lg:col-span-3 lg:block">
        <LoginHero />
      </div>
    </main>
  );
}

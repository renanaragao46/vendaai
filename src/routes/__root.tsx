import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="text-center"><h1 className="text-6xl font-bold">404</h1><p className="mt-3 text-muted-foreground">Página não encontrada.</p><Link to="/" className="mt-5 inline-block text-primary underline">Voltar ao início</Link></div></div>;
}
function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "root_error" }); }, [error]);
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="text-center"><h1 className="text-xl font-semibold">Não foi possível carregar</h1><p className="mt-2 text-sm text-muted-foreground">Tente novamente.</p><button className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={() => { router.invalidate(); reset(); }}>Tentar novamente</button></div></div>;
}
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { title: "Projeto de Vida" }, { name: "description", content: "Painel privado de planejamento e execução." }], links: [{ rel: "stylesheet", href: appCss }, { rel: "preconnect", href: "https://fonts.googleapis.com" }, { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }, { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap" }] }),
  shellComponent: RootShell, component: RootComponent, notFoundComponent: NotFoundComponent, errorComponent: ErrorComponent,
});
function RootShell({ children }: { children: ReactNode }) {
  return <html lang="pt-BR"><head><HeadContent /></head><body className="font-sans antialiased">{children}<Scripts /></body></html>;
}
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      return () => data.subscription.unsubscribe();
    } catch (error) {
      console.error("[Auth] Listener indisponível", error);
      reportLovableError(error, { boundary: "root_auth_listener" });
    }
  }, [router, queryClient]);
  return <QueryClientProvider client={queryClient}><Outlet /><Toaster richColors position="top-right" /></QueryClientProvider>;
}

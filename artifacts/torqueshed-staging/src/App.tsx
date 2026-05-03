import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthScreen from "@/components/AuthScreen";

const queryClient = new QueryClient();
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const clerkProxyUrl = (import.meta.env.VITE_CLERK_PROXY_URL as string | undefined) || undefined;

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthScreen} />
      <Route path="/sso-callback" component={AuthScreen} />
      <Route component={NotFound} />
    </Switch>
  );
}

function MissingClerkConfig() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-orange-50 p-4">
      <div className="max-w-md rounded-lg border border-orange-200 bg-white p-6 text-sm text-gray-700">
        <h1 className="text-lg font-bold text-gray-900">TorqueShed (staging)</h1>
        <p className="mt-2">
          <code>VITE_CLERK_PUBLISHABLE_KEY</code> is not set. This staging app requires the
          throwaway TorqueShed-staging Clerk publishable key to validate the cross-product
          SSO flow.
        </p>
      </div>
    </div>
  );
}

function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (!clerkPubKey) {
    return <MissingClerkConfig />;
  }
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInFallbackRedirectUrl={`${base}/`}
      signUpFallbackRedirectUrl={`${base}/`}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={base}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;

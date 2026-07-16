import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppProvider } from "@/lib/app-store";
import { Toaster } from "@/components/ui/sonner";
import { LaGueriteChat } from "@/components/la-guerite-chat";
import { OfflineBanner } from "@/components/offline-banner";
import { OnboardingTour } from "@/components/onboarding-tour";
import { registerPwa } from "@/lib/pwa";

// Chaque page est chargée à la demande (code-splitting) : le navigateur ne
// télécharge que le code de l'écran réellement visité, ce qui accélère
// nettement le premier chargement sur connexion lente.
const AuthPage = lazy(() => import("@/pages/Auth"));
const MarchePage = lazy(() => import("@/pages/Marche"));
const CartePage = lazy(() => import("@/pages/Carte"));
const BoutiquePage = lazy(() => import("@/pages/Boutique"));
const ProduitPage = lazy(() => import("@/pages/Produit"));
const CreerBoutiquePage = lazy(() => import("@/pages/CreerBoutique"));
const PublierPage = lazy(() => import("@/pages/Publier"));
const MessagesPage = lazy(() => import("@/pages/Messages"));
const ComptePage = lazy(() => import("@/pages/Compte"));
const AdminPage = lazy(() => import("@/pages/Admin"));
const RechargePage = lazy(() => import("@/pages/Recharge"));
const SuggestionsPage = lazy(() => import("@/pages/Suggestions"));
const CguPage = lazy(() => import("@/pages/Cgu"));

const queryClient = new QueryClient();

function FullScreenLoader() {
  return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Chargement…</div>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        <Suspense fallback={<FullScreenLoader />}>
          <Routes location={location}>
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <MarchePage />
                </RequireAuth>
              }
            />
            <Route
              path="/carte"
              element={
                <RequireAuth>
                  <CartePage />
                </RequireAuth>
              }
            />
            <Route
              path="/boutique/:id"
              element={
                <RequireAuth>
                  <BoutiquePage />
                </RequireAuth>
              }
            />
            <Route
              path="/produit/:id"
              element={
                <RequireAuth>
                  <ProduitPage />
                </RequireAuth>
              }
            />
            <Route
              path="/creer-boutique"
              element={
                <RequireAuth>
                  <CreerBoutiquePage />
                </RequireAuth>
              }
            />
            <Route
              path="/publier"
              element={
                <RequireAuth>
                  <PublierPage />
                </RequireAuth>
              }
            />
            <Route
              path="/messages"
              element={
                <RequireAuth>
                  <MessagesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/messages/:id"
              element={
                <RequireAuth>
                  <MessagesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/compte"
              element={
                <RequireAuth>
                  <ComptePage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminPage />
                </RequireAuth>
              }
            />
            <Route
              path="/recharge"
              element={
                <RequireAuth>
                  <RechargePage />
                </RequireAuth>
              }
            />
            <Route
              path="/suggestions"
              element={
                <RequireAuth>
                  <SuggestionsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/cgu"
              element={
                <RequireAuth>
                  <CguPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function AuthedExtras() {
  const { session } = useAuth();
  if (!session) return null;
  return <OnboardingTour />;
}

export default function App() {
  useEffect(() => {
    registerPwa();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <OfflineBanner />
            <AppRoutes />
            <LaGueriteChat />
            <AuthedExtras />
            <Toaster position="top-center" theme="dark" />
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

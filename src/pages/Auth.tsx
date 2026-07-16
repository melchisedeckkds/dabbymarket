import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-store";
import { ShieldCheck, Loader2, Eye, EyeOff, Gift } from "lucide-react";

export default function AuthPage() {
  const nav = useNavigate();
  const { signIn, signUp } = useAuth();
  const { t } = useApp();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const digits = phone.replace(/\D/g, "");
  const willBeAdmin = digits.endsWith("696430723");

  async function submit() {
    if (digits.length < 8) return toast.error(t("auth_invalidPhone"));
    if (password.length < 6) return toast.error(t("auth_passwordTooShort"));
    if (mode === "signup" && name.trim().length < 2) return toast.error(t("auth_nameRequired"));

    setLoading(true);
    const full = "+237" + digits.replace(/^237/, "");
    const result =
      mode === "signup" ? await signUp(full, password, name.trim()) : await signIn(full, password);
    setLoading(false);

    if (result.error) {
      toast.error(mode === "signup" ? t("auth_signupFailed") : t("auth_loginFailed"), { description: result.error });
      return;
    }
    if (mode === "signup") {
      toast.success(t("auth_welcomeToast"));
    } else {
      toast.success(t("auth_backToast"));
    }
    nav("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      {/* Carte centrée */}
      <div className="flex w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-gray-100">
        
        {/* ===== PARTIE GAUCHE : LOGO ===== */}
        <div className="hidden w-1/2 flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-white to-amber-50/50 p-12 lg:flex">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center text-center"
          >
            {/* Logo image */}
            <img
              src="/logo-auth.png"
              alt="DABBY MARKET"
              className="h-64 w-auto object-contain drop-shadow-xl"
            />
            
          </motion.div>
        </div>

        {/* ===== PARTIE DROITE : FORMULAIRE ===== */}
        <div className="flex w-full flex-col justify-center p-8 sm:p-12 lg:w-1/2">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Logo mobile */}
            <div className="mb-6 text-center lg:hidden">
              <img
                src="/logo-auth.png"
                alt="DABBY MARKET"
                className="mx-auto h-16 w-auto object-contain"
              />
            </div>

            {/* Titre du formulaire */}
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === "signup" ? "Créer un compte" : "Bienvenue"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {mode === "signup" 
                ? "Rejoignez la communauté Dabby Market" 
                : "Connectez-vous pour accéder à votre compte"}
            </p>

            {/* Champs du formulaire */}
            <div className="mt-6 space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="text-xs font-semibold text-gray-600">{t("auth_name")}</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre nom complet"
                    className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-colors focus:border-amber-400 focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-600">{t("auth_phone")}</label>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 transition-colors focus-within:border-amber-400 focus-within:bg-white">
                  <span className="text-sm font-semibold text-gray-500">+237</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    inputMode="tel"
                    placeholder="6 96 43 07 23"
                    className="w-full bg-transparent py-3 text-sm outline-none"
                  />
                </div>
                {willBeAdmin && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700">
                    <ShieldCheck size={13} /> {t("auth_adminRecognized")}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">{t("auth_password")}</label>
                <div className="relative mt-1.5">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-11 text-sm outline-none transition-colors focus:border-amber-400 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Bouton de soumission */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={submit}
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition-opacity disabled:opacity-60"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {mode === "signup" ? "Créer mon compte" : "Se connecter"}
              </motion.button>
            </div>

            {/* Lien pour basculer entre login et signup */}
            <div className="mt-6 text-center">
              {mode === "login" ? (
                <p className="text-sm text-gray-500">
                  Pas encore de compte ?{" "}
                  <button
                    onClick={() => setMode("signup")}
                    className="font-semibold text-amber-600 transition-colors hover:text-amber-700"
                  >
                    Créer un compte
                  </button>
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  Déjà un compte ?{" "}
                  <button
                    onClick={() => setMode("login")}
                    className="font-semibold text-amber-600 transition-colors hover:text-amber-700"
                  >
                    Se connecter
                  </button>
                </p>
              )}
            </div>

            {/* Footer */}
            <p className="mt-8 text-center text-[10px] text-gray-300">
              © {new Date().getFullYear()} Dabby Market — {t("auth_tagline")}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
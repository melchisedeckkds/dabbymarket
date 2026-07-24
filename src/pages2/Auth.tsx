import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-store";
import { COUNTRY_CODES } from "@/lib/country-codes";
import { ShieldCheck, Loader2, Eye, EyeOff, Sparkles, Store, Zap, MessageCircle } from "lucide-react";

export default function AuthPage() {
  const nav = useNavigate();
  const { signIn, signUp } = useAuth();
  const { t } = useApp();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [countryDial, setCountryDial] = useState(COUNTRY_CODES[0].dial);
  const [customDial, setCustomDial] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const digits = phone.replace(/\D/g, "");
  const dial = countryDial === "+" ? customDial.replace(/[^\d+]/g, "") : countryDial;
  const willBeAdmin = dial === "+237" && digits.endsWith("696430723");

  async function submit() {
    if (digits.length < 6) return toast.error(t("auth_invalidPhone"));
    if (!dial || dial === "+") return toast.error(t("auth_invalidPhone"));
    if (password.length < 6) return toast.error(t("auth_passwordTooShort"));
    if (mode === "signup" && name.trim().length < 2) return toast.error(t("auth_nameRequired"));

    setLoading(true);
    const dialDigitsOnly = dial.replace(/\D/g, "");
    const localDigits = digits.startsWith(dialDigitsOnly) ? digits.slice(dialDigitsOnly.length) : digits;
    const full = `${dial}${localDigits}`;
    const result =
      mode === "signup" ? await signUp(full, password, name.trim()) : await signIn(full, password);
    setLoading(false);

    if (result.error) {
      toast.error(mode === "signup" ? t("auth_signupFailed") : t("auth_loginFailed"), { description: result.error });
      return;
    }
    if (mode === "signup") toast.success(t("auth_welcomeToast"));
    else toast.success(t("auth_backToast"));
    nav("/");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-amber-50 via-white to-amber-100/40 p-4">
      {/* Aurores dorées de fond */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 h-96 w-96 rounded-full bg-amber-400/25 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-yellow-200/25 blur-3xl" />
      {/* Grille subtile */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #d4af37 1px, transparent 1px), linear-gradient(to bottom, #d4af37 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative flex w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white/90 shadow-[0_25px_80px_-15px_rgba(212,175,55,0.35)] ring-1 ring-amber-200/40 backdrop-blur-xl">
        {/* ===== GAUCHE : Vitrine premium ===== */}
        <div className="relative hidden w-1/2 flex-col overflow-hidden bg-gradient-to-br from-amber-100 via-white to-amber-50 p-10 lg:flex">
          <span className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-amber-300/40 to-transparent blur-2xl" />
          <span className="absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-gradient-to-tr from-amber-400/30 to-transparent blur-2xl" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative flex flex-1 flex-col items-center justify-center text-center"
          >
            <div className="relative">
              <div className="absolute inset-0 -m-6 rounded-full bg-gradient-to-br from-amber-300/40 to-yellow-200/30 blur-2xl" />
              <img
                src="/logo-auth.png"
                alt="DABBY MARKET"
                className="relative h-56 w-auto object-contain drop-shadow-[0_15px_35px_rgba(212,175,55,0.4)]"
              />
            </div>
            <p className="mt-8 max-w-xs text-sm font-medium text-amber-900/70">
              Le marché de quartier, en version numérique.
            </p>
          </motion.div>

          <div className="relative mt-8 grid grid-cols-3 gap-2">
            {[
              { icon: Store, label: "Boutiques locales" },
              { icon: Zap, label: "Boosts Pépites" },
              { icon: MessageCircle, label: "Chat direct" },
            ].map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}
                className="rounded-2xl border border-amber-200/60 bg-white/70 p-3 text-center shadow-sm backdrop-blur"
              >
                <f.icon size={18} className="mx-auto text-amber-600" />
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-900/80">{f.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ===== DROITE : Formulaire ===== */}
        <div className="relative flex w-full flex-col justify-center p-8 sm:p-12 lg:w-1/2">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            {/* Logo mobile */}
            <div className="mb-6 flex justify-center lg:hidden">
              <div className="relative">
                <div className="absolute inset-0 -m-3 rounded-full bg-amber-300/30 blur-xl" />
                <img src="/logo-auth.png" alt="DABBY MARKET" className="relative h-16 w-auto object-contain" />
              </div>
            </div>

            {/* Badge mode */}
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">
              <Sparkles size={11} />
              {mode === "signup" ? "Nouveau compte" : "Connexion"}
            </div>

            <h2 className="text-[26px] font-black leading-tight text-gray-900">
              {mode === "signup" ? (
                <>Créez votre <span className="text-amber-600">compte</span></>
              ) : (
                <>Ravi de vous <span className="text-amber-600">revoir</span></>
              )}
            </h2>
            <p className="mt-1.5 text-sm text-gray-500">
              {mode === "signup"
                ? "Rejoignez la communauté Dabby Market en quelques secondes."
                : "Connectez-vous pour retrouver vos boutiques et vos Pépites."}
            </p>

            <div className="mt-6 space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-500">{t("auth_name")}</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre nom complet"
                    className="mt-1.5 w-full rounded-2xl border-2 border-amber-100 bg-amber-50/40 px-4 py-3.5 text-sm font-medium text-amber-950 outline-none transition-all placeholder:text-amber-300 focus:border-amber-500 focus:bg-white focus:shadow-lg focus:shadow-amber-500/10"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-500">{t("auth_phone")}</label>
                <div className="mt-1.5 flex items-center gap-2 rounded-2xl border-2 border-amber-100 bg-amber-50/40 px-2 transition-all focus-within:border-amber-500 focus-within:bg-white focus-within:shadow-lg focus-within:shadow-amber-500/10">
                  <select
                    value={countryDial}
                    onChange={(e) => setCountryDial(e.target.value)}
                    className="max-w-[92px] shrink-0 bg-transparent py-3.5 text-sm font-bold text-gray-700 outline-none"
                    aria-label={t("auth_country")}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.dial}>
                        {c.flag} {c.dial === "+" ? "" : c.dial}
                      </option>
                    ))}
                  </select>
                  {countryDial === "+" && (
                    <input
                      value={customDial}
                      onChange={(e) => setCustomDial(e.target.value)}
                      inputMode="tel"
                      placeholder="+..."
                      className="w-14 shrink-0 border-l border-amber-200 bg-transparent py-3 pl-2 text-sm font-semibold outline-none"
                    />
                  )}
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    inputMode="tel"
                    placeholder="6 97 97 97 97"
                    className="w-full min-w-0 border-l border-amber-200 bg-transparent py-3.5 pl-2 text-sm font-medium text-amber-950 outline-none placeholder:text-amber-300"
                  />
                </div>
                {willBeAdmin && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 flex items-center gap-2 rounded-xl border border-amber-400/60 bg-gradient-to-r from-amber-100 to-yellow-50 px-3 py-2 text-[11px] font-black text-amber-700 shadow-sm"
                  >
                    <ShieldCheck size={14} /> {t("auth_adminRecognized")}
                  </motion.div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-500">{t("auth_password")}</label>
                <div className="relative mt-1.5">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border-2 border-amber-100 bg-amber-50/40 px-4 py-3.5 pr-11 text-sm font-medium text-amber-950 outline-none transition-all placeholder:text-amber-300 focus:border-amber-500 focus:bg-white focus:shadow-lg focus:shadow-amber-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full text-amber-500 transition-all hover:bg-amber-50 hover:text-amber-700"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.01 }}
                onClick={submit}
                disabled={loading}
                className="shine relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 py-4 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-amber-500/30 transition-opacity disabled:opacity-60"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {mode === "signup" ? "Créer mon compte" : "Se connecter"}
              </motion.button>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/70">
                {mode === "login" ? "Ou" : "Déjà inscrit ?"}
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
            </div>

            <div className="mt-4 text-center">
              {mode === "login" ? (
                <p className="text-sm text-gray-500">
                  Pas encore de compte ?{" "}
                  <button onClick={() => setMode("signup")} className="font-black text-amber-600 underline-offset-4 transition-colors hover:text-amber-700 hover:underline">
                    Créer un compte
                  </button>
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  Déjà un compte ?{" "}
                  <button onClick={() => setMode("login")} className="font-black text-amber-600 underline-offset-4 transition-colors hover:text-amber-700 hover:underline">
                    Se connecter
                  </button>
                </p>
              )}
            </div>

            <p className="mt-10 text-center text-[10px] font-medium text-gray-400">
              © {new Date().getFullYear()} Dabby Market — {t("auth_tagline")}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

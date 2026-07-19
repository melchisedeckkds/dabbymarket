import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Pepite } from "@/components/pepite";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-store";
import { ShieldCheck, Loader2, MapPin, MessageCircle, Store, Eye, EyeOff } from "lucide-react";

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
    <div className="flex min-h-screen bg-background">
      {/* Volet gauche — présentation de marque, visible uniquement sur grand écran */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1a1204] via-background to-background p-12 lg:flex xl:w-[45%]">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl gold-gradient text-lg font-black">D</div>
          <span className="text-lg font-bold tracking-tight">
            Dabby<span className="gold-text">Market</span>
          </span>
        </div>

        <div className="relative">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl font-black leading-tight xl:text-5xl"
          >
            {t("auth_heroTitle1")} <span className="gold-text">{t("auth_heroTitle2")}</span>
            <br /> {t("auth_heroTitle3")}
          </motion.h1>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            {t("auth_heroDesc")}
          </p>

          <div className="mt-8 space-y-3">
            {[
              { icon: MapPin, text: t("auth_feature1") },
              { icon: Store, text: t("auth_feature2") },
              { icon: MessageCircle, text: t("auth_feature3") },
            ].map(({ icon: Icon, text }, i) => (
              <motion.div
                key={text}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3 backdrop-blur"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Icon size={17} />
                </div>
                <p className="text-sm">{text}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-muted-foreground">© DabbyMarket</p>
      </div>

      {/* Volet droit — formulaire */}
      <div className="mx-auto flex w-full flex-col justify-center p-6 lg:w-1/2 lg:max-w-lg lg:px-16 xl:w-[55%]">
        <div className="text-center lg:hidden">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl gold-gradient text-2xl font-black shadow-lg shadow-primary/30">
            D
          </div>
          <h1 className="mt-4 text-2xl font-bold">
            Dabby<span className="text-primary">Market</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth_tagline")}</p>
        </div>

        <div className="hidden lg:block">
          <h2 className="text-2xl font-bold">{mode === "signup" ? t("auth_joinTitle") : t("auth_welcomeBack")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? t("auth_joinDesc") : t("auth_welcomeBackDesc")}
          </p>
        </div>

        <div className="mt-8 flex rounded-xl border border-border bg-card p-1 text-sm font-semibold lg:mt-6">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 rounded-lg py-2 transition-colors ${mode === "login" ? "gold-gradient" : "text-muted-foreground"}`}
          >
            {t("auth_login")}
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg py-2 transition-colors ${mode === "signup" ? "gold-gradient" : "text-muted-foreground"}`}
          >
            {t("auth_signup")}
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          {mode === "signup" && (
            <div className="mb-3">
              <label className="text-xs font-semibold text-muted-foreground">{t("auth_name")}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth_namePlaceholder")}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>
          )}

          <label className="text-xs font-semibold text-muted-foreground">{t("auth_phone")}</label>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 transition-colors focus-within:border-primary">
            <span className="text-sm font-semibold text-muted-foreground">+237</span>
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
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary">
              <ShieldCheck size={13} /> {t("auth_adminRecognized")}
            </div>
          )}

          <label className="mt-3 block text-xs font-semibold text-muted-foreground">{t("auth_password")}</label>
          <div className="relative mt-1.5">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="w-full rounded-xl border border-border bg-background px-3 py-3 pr-11 text-sm outline-none transition-colors focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? t("auth_hidePassword") : t("auth_showPassword")}
              className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={submit}
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-3.5 text-sm font-bold shine disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === "signup" ? t("auth_submitSignup") : t("auth_submitLogin")}
          </motion.button>
        </div>

        {mode === "signup" && (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-primary/10 p-3 text-sm text-primary">
            <Pepite size={18} />
            <span className="font-semibold">{t("auth_pepitesOffered")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

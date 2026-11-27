import LogoMark from "@/components/logo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrent, getSettings } from "@/lib/auth";
import LoginForm from "./form";
import LangSwitch from "@/components/lang-switch";
import { getI18n } from "@/i18n/server";
import { splitBrand } from "@/components/brand";

/** Split-screen login: a navy brand panel (a strip on phones) beside a white form panel. */
export default async function LoginPage() {
  const { t } = await getI18n();
  const cur = await getCurrent();
  if (cur) redirect(cur.user.role === "teacher" ? "/t" : "/");
  const s = await getSettings();
  const { main, tagline } = splitBrand(s.platformName);
  return (
    <div className="login-shell md:flex md:items-center md:justify-center md:px-8 md:py-10">
    <div className="relative z-10 flex min-h-dvh flex-col bg-white md:min-h-[560px] md:w-full md:max-w-4xl md:flex-row md:overflow-hidden md:rounded-3xl md:border md:border-slate-200 md:shadow-[0_20px_60px_rgb(19_38_95/0.18)]">
      <aside className="login-panel relative flex shrink-0 flex-col justify-between gap-4 overflow-hidden px-6 py-6 text-white md:w-1/2 md:px-12 md:py-12">
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-800 md:h-20 md:w-20 md:rounded-3xl"><LogoMark className="h-9 w-9 md:h-12 md:w-12" /></div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight md:text-3xl">{main}</h1>
            {tagline && <p className="mt-1 text-sm text-blue-100 md:text-base">{tagline}</p>}
          </div>
        </div>
        <div aria-hidden="true" className="login-eqs hidden md:block">
          <span style={{ top: "34%", left: "8%" }}>f′(x) = lim (f(x+h) − f(x)) / h</span>
          <span style={{ top: "52%", left: "28%" }}>∫ x² dx = x³/3 + C</span>
          <span style={{ top: "68%", left: "6%" }}>a² + b² = c²</span>
        </div>
        <p className="relative hidden max-w-xs text-lg text-blue-50 md:block">
          {t("خطوة بخطوة،")} <b className="text-amber-400">{t("كل مسألة لها حل.")}</b><br />{t("دروسك وواجباتك في مكان واحد.")}
        </p>
      </aside>
      <main className="flex flex-1 items-start justify-center px-6 py-8 md:items-center md:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-900">{t("تسجيل الدخول")}</h2>
            <LangSwitch />
          </div>
          <LoginForm />
          <div className="mt-4 text-center text-sm">
            <Link href="/forgot" className="text-blue-800 underline">{t("نسيت كلمة المرور؟")}</Link>
          </div>
        </div>
      </main>
    </div>
    </div>
  );
}

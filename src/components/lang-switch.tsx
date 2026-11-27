import { setLang } from "@/app/actions/lang";
import { getLang } from "@/i18n/server";

/** One button that switches the interface to the other language. */
export default async function LangSwitch({ className = "btn-light" }: { className?: string }) {
  const lang = await getLang();
  const next = lang === "ar" ? "en" : "ar";
  return (
    <form action={setLang.bind(null, next)}>
      <button className={className} lang={next} title={next === "en" ? "Switch to English" : "التبديل إلى العربية"}>
        <span className="sm:hidden">{next === "en" ? "EN" : "ع"}</span>
        <span className="hidden sm:inline">{next === "en" ? "English" : "العربية"}</span>
      </button>
    </form>
  );
}

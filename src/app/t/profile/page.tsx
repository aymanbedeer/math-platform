import { requireTeacher } from "@/lib/auth";
import ProfileForm from "@/components/profile-form";
import PasswordForm from "@/components/password-form";
import { getI18n } from "@/i18n/server";

export default async function TeacherProfile() {
  const { t } = await getI18n();
  const me = await requireTeacher();
  return (
    <>
      <h1 className="h1">{t("ملفي الشخصي")}</h1>
      <div className="grid items-start gap-4 lg:grid-cols-2">
      <section id="profile" className="card">
        <h2 className="mb-3 font-bold">{t("بياناتي الشخصية")}</h2>
        <ProfileForm fullName={me.fullName} email={me.email} phone={me.phone} canEditName />
      </section>
      <section className="card">
        <h2 className="mb-3 font-bold">{t("تغيير كلمة مرورك")}</h2>
        <PasswordForm />
      </section>
      </div>
    </>
  );
}

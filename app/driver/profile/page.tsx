import { requireDriver } from "@/lib/current-driver";
import { DriverProfileForm } from "./DriverProfileForm";

export default async function DriverProfilePage() {
  const { driver } = await requireDriver();
  if (!driver) return null;

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        My Profile
      </h1>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <DriverProfileForm
          driverId={driver.id}
          fullName={driver.full_name}
          phone={driver.phone}
          email={driver.email}
          status={driver.status}
        />
      </div>
    </>
  );
}

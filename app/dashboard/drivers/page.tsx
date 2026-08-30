import { requireProfile } from "@/lib/current-profile";
import { AddDriverForm } from "./AddDriverForm";
import { DriverRow, type Driver } from "./DriverRow";

export default async function DriversPage() {
  const { supabase, profile } = await requireProfile();

  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, full_name, phone, email, status, user_id, created_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Drivers</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Everyone who can be assigned to a load.
          </p>
        </div>
        {profile?.company_id && (
          <AddDriverForm companyId={profile.company_id} />
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!drivers || drivers.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            No drivers yet. Add your first one above.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Actions</th>
                <th className="px-6 py-3 font-medium">Portal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {drivers.map((driver) => (
                <DriverRow key={driver.id} driver={driver as Driver} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

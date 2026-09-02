import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Every read the /admin dashboard needs, in one place. All of it goes
 * through the service-role client (`createAdminClient()`), which bypasses
 * RLS on purpose — this is trusted, server-only code whose entire job is
 * to look across every tenant at once, which no company-scoped query
 * could ever do. Nothing here is exported to the browser; the /admin
 * pages are Server Components that render the already-reduced numbers.
 *
 * No schema changes back any of this (ROADMAP §101) — it's all derivable
 * from `companies`, `plans`, `drivers`, `profiles`, and `loads` as they
 * already exist.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

// Mirrors the subscription_status CHECK constraint on `companies`
// (migration 0009 / 0014).
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export type PlanRow = {
  id: string;
  key: string;
  name: string;
  driver_limit: number;
  monthly_price_cents: number | null;
  sort_order: number;
};

type CompanyRow = {
  id: string;
  name: string;
  plan_id: string;
  subscription_status: string;
  stripe_customer_id: string | null;
  created_at: string;
};

type OwnerContact = { name: string | null; email: string | null };

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

/**
 * user_id → email for every auth user, paged out of the Admin API (there
 * is no `email` column on `profiles`, so the owner-contact column has to
 * come from `auth.users`). Fine at this scale — a few hundred users at
 * most; revisit if the platform ever has tens of thousands.
 */
async function buildEmailMap(
  admin: ReturnType<typeof createAdminClient>
): Promise<Map<string, string>> {
  const emailById = new Map<string, string>();
  const perPage = 1000;
  let page = 1;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    for (const user of data.users) {
      if (user.email) emailById.set(user.id, user.email);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return emailById;
}

/**
 * company_id → the number of ACTIVE drivers. "Active" specifically,
 * because that's the count the plan's `driver_limit` is enforced
 * against in the database (`enforce_driver_limit`, migration 0009) —
 * so "8 / 10 drivers" on the companies table lines up with what the
 * tenant themselves would hit.
 */
function activeDriverCountByCompany(
  drivers: { company_id: string; status: string }[]
): Map<string, number> {
  const byCompany = new Map<string, number>();
  for (const driver of drivers) {
    if (driver.status !== "active") continue;
    byCompany.set(driver.company_id, (byCompany.get(driver.company_id) ?? 0) + 1);
  }
  return byCompany;
}

/** First owner-role profile for each company (earliest by created_at). */
function ownerProfileByCompany(
  profiles: {
    id: string;
    company_id: string;
    full_name: string | null;
    created_at: string;
  }[]
): Map<string, { id: string; full_name: string | null }> {
  const byCompany = new Map<
    string,
    { id: string; full_name: string | null; created_at: string }
  >();
  for (const profile of profiles) {
    const existing = byCompany.get(profile.company_id);
    if (!existing || profile.created_at < existing.created_at) {
      byCompany.set(profile.company_id, {
        id: profile.id,
        full_name: profile.full_name,
        created_at: profile.created_at,
      });
    }
  }
  return byCompany;
}

// ---------------------------------------------------------------------------
// 1. Overview
// ---------------------------------------------------------------------------

export type PlanTierBreakdownRow = {
  key: string;
  name: string;
  driverLimit: number;
  monthlyPriceCents: number | null;
  companyCount: number;
  activeDriverCount: number;
};

export type AdminOverview = {
  totalCompanies: number;
  statusCounts: Record<SubscriptionStatus, number>;
  /** Other/unrecognized subscription_status values, if any ever appear. */
  otherStatusCount: number;
  totalActiveDrivers: number;
  newCompaniesLast7Days: number;
  newCompaniesThisMonth: number;
  /** Cents/month across companies with subscription_status = 'active'. */
  mrrCents: number;
  /**
   * Active companies on a plan with no `monthly_price_cents` (the
   * "Custom / Enterprise" tier — quote-based, not in Stripe yet). They
   * are NOT in `mrrCents`; surfaced so the MRR figure is never a silent
   * undercount.
   */
  mrrExcludedActiveCompanies: number;
  planTiers: PlanTierBreakdownRow[];
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const admin = createAdminClient();

  const [companiesRes, plansRes, driversRes] = await Promise.all([
    admin
      .from("companies")
      .select("id, plan_id, subscription_status, created_at"),
    admin
      .from("plans")
      .select("id, key, name, driver_limit, monthly_price_cents, sort_order")
      .order("sort_order", { ascending: true }),
    admin.from("drivers").select("company_id, status"),
  ]);

  const companies = (companiesRes.data ?? []) as Pick<
    CompanyRow,
    "id" | "plan_id" | "subscription_status" | "created_at"
  >[];
  const plans = (plansRes.data ?? []) as PlanRow[];
  const drivers = (driversRes.data ?? []) as {
    company_id: string;
    status: string;
  }[];

  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const driversByCompany = activeDriverCountByCompany(drivers);

  const statusCounts: Record<SubscriptionStatus, number> = {
    trialing: 0,
    active: 0,
    past_due: 0,
    canceled: 0,
  };
  let otherStatusCount = 0;

  const nowMs = Date.now();
  const startOfMonthIso = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
  ).toISOString();

  let newCompaniesLast7Days = 0;
  let newCompaniesThisMonth = 0;
  let mrrCents = 0;
  let mrrExcludedActiveCompanies = 0;

  for (const company of companies) {
    const status = company.subscription_status as SubscriptionStatus;
    if (status in statusCounts) statusCounts[status] += 1;
    else otherStatusCount += 1;

    if (nowMs - new Date(company.created_at).getTime() <= WEEK_MS) {
      newCompaniesLast7Days += 1;
    }
    if (company.created_at >= startOfMonthIso) {
      newCompaniesThisMonth += 1;
    }

    if (status === "active") {
      const price = planById.get(company.plan_id)?.monthly_price_cents ?? null;
      if (price === null) mrrExcludedActiveCompanies += 1;
      else mrrCents += price;
    }
  }

  // Plan-tier breakdown — one row per plan, in sort_order.
  const companiesByPlan = new Map<string, string[]>();
  for (const company of companies) {
    const list = companiesByPlan.get(company.plan_id) ?? [];
    list.push(company.id);
    companiesByPlan.set(company.plan_id, list);
  }

  const planTiers: PlanTierBreakdownRow[] = plans.map((plan) => {
    const companyIds = companiesByPlan.get(plan.id) ?? [];
    const driverTotal = companyIds.reduce(
      (sum, companyId) => sum + (driversByCompany.get(companyId) ?? 0),
      0
    );
    return {
      key: plan.key,
      name: plan.name,
      driverLimit: plan.driver_limit,
      monthlyPriceCents: plan.monthly_price_cents,
      companyCount: companyIds.length,
      activeDriverCount: driverTotal,
    };
  });

  const totalActiveDrivers = Array.from(driversByCompany.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  return {
    totalCompanies: companies.length,
    statusCounts,
    otherStatusCount,
    totalActiveDrivers,
    newCompaniesLast7Days,
    newCompaniesThisMonth,
    mrrCents,
    mrrExcludedActiveCompanies,
    planTiers,
  };
}

/** Plan catalog (key + display name), in sort_order — for filter UIs. */
export async function getPlanCatalog(): Promise<
  { key: string; name: string }[]
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("plans")
    .select("key, name, sort_order")
    .order("sort_order", { ascending: true });
  return ((data ?? []) as { key: string; name: string }[]).map((p) => ({
    key: p.key,
    name: p.name,
  }));
}

// ---------------------------------------------------------------------------
// 2. Company list
// ---------------------------------------------------------------------------

export type AdminCompanyListRow = {
  id: string;
  name: string;
  createdAt: string;
  subscriptionStatus: string;
  planKey: string;
  planName: string;
  driverLimit: number | null;
  activeDrivers: number;
  owner: OwnerContact | null;
};

export async function getAdminCompanies(): Promise<AdminCompanyListRow[]> {
  const admin = createAdminClient();

  const [companiesRes, plansRes, driversRes, ownersRes, emailById] =
    await Promise.all([
      admin
        .from("companies")
        .select(
          "id, name, plan_id, subscription_status, stripe_customer_id, created_at"
        ),
      admin.from("plans").select("id, key, name, driver_limit, sort_order"),
      admin.from("drivers").select("company_id, status"),
      admin
        .from("profiles")
        .select("id, company_id, full_name, created_at")
        .eq("role", "owner"),
      buildEmailMap(admin),
    ]);

  const companies = (companiesRes.data ?? []) as CompanyRow[];
  const plans = (plansRes.data ?? []) as Pick<
    PlanRow,
    "id" | "key" | "name" | "driver_limit"
  >[];
  const drivers = (driversRes.data ?? []) as {
    company_id: string;
    status: string;
  }[];
  const owners = (ownersRes.data ?? []) as {
    id: string;
    company_id: string;
    full_name: string | null;
    created_at: string;
  }[];

  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const driversByCompany = activeDriverCountByCompany(drivers);
  const ownerByCompany = ownerProfileByCompany(owners);

  return companies.map((company) => {
    const plan = planById.get(company.plan_id);
    const owner = ownerByCompany.get(company.id);
    return {
      id: company.id,
      name: company.name,
      createdAt: company.created_at,
      subscriptionStatus: company.subscription_status,
      planKey: plan?.key ?? "unknown",
      planName: plan?.name ?? "—",
      driverLimit: plan?.driver_limit ?? null,
      activeDrivers: driversByCompany.get(company.id) ?? 0,
      owner: owner
        ? {
            name: owner.full_name,
            email: emailById.get(owner.id) ?? null,
          }
        : null,
    };
  });
}

// ---------------------------------------------------------------------------
// 3. Company detail
// ---------------------------------------------------------------------------

export type AdminCompanyDetail = {
  id: string;
  name: string;
  createdAt: string;
  subscriptionStatus: string;
  pastDueSince: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: {
    name: string;
    key: string;
    driverLimit: number | null;
    monthlyPriceCents: number | null;
  } | null;
  drivers: { name: string; status: string }[];
  activeDriverCount: number;
  loadsLast30Days: number;
  loadsAllTime: number;
  owner: OwnerContact | null;
};

export async function getAdminCompanyDetail(
  companyId: string
): Promise<AdminCompanyDetail | null> {
  const admin = createAdminClient();

  const { data: company } = await admin
    .from("companies")
    .select(
      "id, name, plan_id, subscription_status, past_due_since, stripe_customer_id, stripe_subscription_id, created_at"
    )
    .eq("id", companyId)
    .maybeSingle();

  if (!company) return null;

  const thirtyDaysAgoIso = new Date(
    Date.now() - MONTH_LOOKBACK_MS
  ).toISOString();

  const [planRes, driversRes, loads30Res, loadsAllRes, ownersRes] =
    await Promise.all([
      admin
        .from("plans")
        .select("key, name, driver_limit, monthly_price_cents")
        .eq("id", company.plan_id)
        .maybeSingle(),
      admin
        .from("drivers")
        .select("full_name, status")
        .eq("company_id", companyId)
        .order("status", { ascending: true })
        .order("full_name", { ascending: true }),
      admin
        .from("loads")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("created_at", thirtyDaysAgoIso),
      admin
        .from("loads")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId),
      admin
        .from("profiles")
        .select("id, full_name, created_at")
        .eq("company_id", companyId)
        .eq("role", "owner")
        .order("created_at", { ascending: true }),
    ]);

  const plan = planRes.data as {
    key: string;
    name: string;
    driver_limit: number;
    monthly_price_cents: number | null;
  } | null;

  const driverRows = (driversRes.data ?? []) as {
    full_name: string | null;
    status: string;
  }[];

  const owners = (ownersRes.data ?? []) as {
    id: string;
    full_name: string | null;
    created_at: string;
  }[];

  let ownerContact: OwnerContact | null = null;
  if (owners.length > 0) {
    const primaryOwner = owners[0];
    const { data: userData } = await admin.auth.admin.getUserById(
      primaryOwner.id
    );
    ownerContact = {
      name: primaryOwner.full_name,
      email: userData?.user?.email ?? null,
    };
  }

  return {
    id: company.id,
    name: company.name,
    createdAt: company.created_at,
    subscriptionStatus: company.subscription_status,
    pastDueSince: company.past_due_since ?? null,
    stripeCustomerId: company.stripe_customer_id ?? null,
    stripeSubscriptionId: company.stripe_subscription_id ?? null,
    plan: plan
      ? {
          name: plan.name,
          key: plan.key,
          driverLimit: plan.driver_limit,
          monthlyPriceCents: plan.monthly_price_cents,
        }
      : null,
    drivers: driverRows.map((driver) => ({
      name: driver.full_name ?? "—",
      status: driver.status,
    })),
    activeDriverCount: driverRows.filter((d) => d.status === "active").length,
    loadsLast30Days: loads30Res.count ?? 0,
    loadsAllTime: loadsAllRes.count ?? 0,
    owner: ownerContact,
  };
}

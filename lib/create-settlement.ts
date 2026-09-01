import type { SupabaseClient } from "@supabase/supabase-js";

export type SettlementLineType = "load_pay" | "deduction" | "reimbursement" | "advance_repayment";

export type SettlementLineItemInput = {
  loadId?: string | null;
  lineType: SettlementLineType;
  description: string;
  amount: number;
};

/** percentage_of_rate/per_mile/flat_per_load → human label. */
export const PAY_TYPE_LABEL: Record<string, string> = {
  percentage_of_rate: "Percentage of rate",
  per_mile: "Per mile",
  flat_per_load: "Flat per load",
};

/**
 * Computes what a driver earns on one load, given their configured pay
 * method — the client-side half of what create_settlement() (0019)
 * expects to already be resolved. Falls back to the load's own
 * dispatches.driver_pay when the driver has no pay_type set, so an
 * unconfigured driver's settlement looks exactly like the old flat
 * "mark paid" amount did.
 */
export function computeLoadPay(
  load: { client_rate: number; driver_pay: number },
  payType: string | null,
  payRate: number | null,
  miles: number | null
): number {
  if (payType === "percentage_of_rate" && payRate != null) {
    return Number(load.client_rate) * payRate;
  }
  if (payType === "per_mile" && payRate != null && miles != null) {
    return payRate * miles;
  }
  if (payType === "flat_per_load" && payRate != null) {
    return payRate;
  }
  return Number(load.driver_pay);
}

/**
 * The one place a settlement gets created — one call inserts the
 * settlement and every line item, and marks any selected outstanding
 * advances as repaid, via create_settlement_with_line_items() (0019).
 */
export async function createSettlement(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    driverId: string;
    lineItems: SettlementLineItemInput[];
    advanceIds: string[];
    notes?: string | null;
  }
) {
  return supabase.rpc("create_settlement", {
    p_company_id: input.companyId,
    p_driver_id: input.driverId,
    p_line_items: input.lineItems.map((li) => ({
      load_id: li.loadId || null,
      line_type: li.lineType,
      description: li.description,
      amount: li.amount,
    })),
    p_advance_ids: input.advanceIds,
    p_notes: input.notes || null,
  });
}

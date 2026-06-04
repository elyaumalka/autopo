import { differenceInHours, differenceInDays, parseISO } from "date-fns";

interface VehicleRates {
  half_day_rate?: number | null;
  daily_rate?: number | null;
  weekly_rate?: number | null;
  monthly_rate?: number | null;
  hourly_delay_rate?: number | null;
  km_limit?: number | null;
  extra_km_price?: number | null;
}

export type RentalRateType = "חצי יום" | "24 שעות" | "שבוע" | "חודש";

/**
 * Effective per-day rate for an EXTENSION, derived from the rental's own billing rate type
 * (so a monthly rental extends at monthlyRate/30, a weekly at weeklyRate/7), not the
 * vehicle's flat daily rate. Falls back to the vehicle daily rate when no billing info.
 */
export function getDailyRateFromBilling(
  billingRateType?: string | null,
  billingRateAmount?: number | null,
  fallbackDailyRate?: number | null,
): number {
  const amount = Number(billingRateAmount ?? 0);
  if (amount > 0) {
    switch (billingRateType) {
      case "חודשי": return Math.round((amount / 30) * 100) / 100;
      case "שבועי": return Math.round((amount / 7) * 100) / 100;
      case "יומי": return amount;
      default: return amount;
    }
  }
  return Number(fallbackDailyRate ?? 0);
}

export function getRateForType(vehicle: VehicleRates, rateType: RentalRateType): number {
  switch (rateType) {
    case "חצי יום": return Number(vehicle.half_day_rate ?? 0);
    case "24 שעות": return Number(vehicle.daily_rate ?? 0);
    case "שבוע": return Number(vehicle.weekly_rate ?? vehicle.daily_rate ? Number(vehicle.daily_rate) * 7 : 0);
    case "חודש": return Number(vehicle.monthly_rate ?? 0);
    default: return 0;
  }
}

/**
 * Tiered late-return fee:
 *  - up to 4 hours late  -> charged per hour (hourly delay rate)
 *  - more than 4 hours   -> half-day price
 *  - more than 6 hours   -> full-day price
 * Falls back to the hourly calculation when the relevant tier rate is missing.
 */
export function tieredDelayCost(
  delayHours: number,
  hourlyDelayRate: number,
  halfDayRate: number,
  dailyRate: number,
): number {
  if (delayHours <= 0) return 0;
  if (delayHours > 6 && dailyRate > 0) return Math.round(dailyRate);
  if (delayHours > 4 && halfDayRate > 0) return Math.round(halfDayRate);
  return Math.round(delayHours * (hourlyDelayRate || 0));
}

/**
 * Calculate rental cost based on rate type, dates, and times.
 * Handles proportional extra days and tiered late-return charges.
 */
export function calculateRentalCost(params: {
  rateType: RentalRateType;
  ratePerUnit: number;
  startDate: string;
  startTime?: string | null;
  endDate: string;
  endTime?: string | null;
  hourlyDelayRate?: number;
  halfDayRate?: number;
  dailyRate?: number;
}): { baseCost: number; delayHours: number; delayCost: number; totalRentalCost: number; breakdown: string } {
  const { rateType, ratePerUnit, startDate, startTime, endDate, endTime, hourlyDelayRate = 0, halfDayRate = 0, dailyRate = 0 } = params;

  if (!startDate || !endDate || !ratePerUnit) {
    return { baseCost: 0, delayHours: 0, delayCost: 0, totalRentalCost: 0, breakdown: "" };
  }

  const start = parseISO(`${startDate}T${startTime || "00:00"}`);
  const end = parseISO(`${endDate}T${endTime || "00:00"}`);
  const totalHours = differenceInHours(end, start);
  const totalDays = differenceInDays(parseISO(endDate), parseISO(startDate));

  let baseCost = 0;
  let delayHours = 0;
  let delayCost = 0;
  let breakdown = "";

  switch (rateType) {
    case "חצי יום": {
      // Half-day = up to 5 hours, each additional half-day is the same rate
      const halfDays = Math.max(1, Math.ceil(totalHours / 5));
      baseCost = halfDays * ratePerUnit;
      breakdown = `${halfDays} חצאי יום × ₪${ratePerUnit}`;
      break;
    }
    case "24 שעות": {
      // Full days, remainder hours checked for delay
      const fullDays = Math.max(1, totalDays);
      baseCost = fullDays * ratePerUnit;
      // Check for hourly delay beyond the planned return
      const expectedHours = fullDays * 24;
      if (totalHours > expectedHours) {
        delayHours = totalHours - expectedHours;
        delayCost = tieredDelayCost(delayHours, hourlyDelayRate, halfDayRate, dailyRate);
      }
      breakdown = `${fullDays} ימים × ₪${ratePerUnit}`;
      break;
    }
    case "שבוע": {
      const fullWeeks = Math.floor(totalDays / 7);
      const remainingDays = totalDays % 7;
      const dailyFromWeekly = ratePerUnit / 7;
      
      if (fullWeeks === 0) {
        baseCost = ratePerUnit; // Minimum 1 week
        breakdown = `שבוע 1 × ₪${ratePerUnit}`;
      } else {
        baseCost = fullWeeks * ratePerUnit;
        breakdown = `${fullWeeks} שבועות × ₪${ratePerUnit}`;
      }
      
      if (remainingDays > 0 && fullWeeks > 0) {
        const extraDayCost = Math.round(dailyFromWeekly * remainingDays);
        baseCost += extraDayCost;
        breakdown += ` + ${remainingDays} ימים × ₪${Math.round(dailyFromWeekly)}`;
      }
      
      // Late return (tiered)
      const expectedDayHours = totalDays * 24;
      if (totalHours > expectedDayHours) {
        delayHours = totalHours - expectedDayHours;
        delayCost = tieredDelayCost(delayHours, hourlyDelayRate, halfDayRate, dailyRate);
      }
      break;
    }
    case "חודש": {
      const fullMonths = Math.floor(totalDays / 30);
      const remainingDays = totalDays % 30;
      const dailyFromMonthly = ratePerUnit / 30;
      
      if (fullMonths === 0) {
        baseCost = ratePerUnit; // Minimum 1 month
        breakdown = `חודש 1 × ₪${ratePerUnit}`;
      } else {
        baseCost = fullMonths * ratePerUnit;
        breakdown = `${fullMonths} חודשים × ₪${ratePerUnit}`;
      }
      
      if (remainingDays > 0 && fullMonths > 0) {
        const extraDayCost = Math.round(dailyFromMonthly * remainingDays);
        baseCost += extraDayCost;
        breakdown += ` + ${remainingDays} ימים × ₪${Math.round(dailyFromMonthly)}`;
      }
      
      const expectedDayHours2 = totalDays * 24;
      if (totalHours > expectedDayHours2) {
        delayHours = totalHours - expectedDayHours2;
        delayCost = tieredDelayCost(delayHours, hourlyDelayRate, halfDayRate, dailyRate);
      }
      break;
    }
  }

  baseCost = Math.round(baseCost);
  delayCost = Math.round(delayCost);
  const totalRentalCost = baseCost + delayCost;

  if (delayHours > 0 && delayCost > 0) {
    const tierLabel = delayHours > 6 ? "מחיר יום מלא" : delayHours > 4 ? "מחיר חצי יום" : `${delayHours} שעות × ₪${hourlyDelayRate}`;
    breakdown += ` + איחור (${delayHours} ש'): ${tierLabel} = ₪${delayCost}`;
  }

  return { baseCost, delayHours, delayCost, totalRentalCost, breakdown };
}

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "../../packages/db/dist/index.js";
import { complianceRules, holidays } from "../../packages/db/dist/schema.js";

// Auto-load .env
if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") {
  for (const envPath of [".env", "../../.env", "../../../.env"]) {
    const resolved = resolve(process.cwd(), envPath);
    if (existsSync(resolved)) {
      try {
        process.loadEnvFile(resolved);
        if (process.env.DATABASE_URL) break;
      } catch {}
    }
  }
}

const SEED_HOLIDAYS = [
  { id: "hol_2026_rep_day", state: "ALL", date: "2026-01-26", name: "Republic Day" },
  { id: "hol_2026_ind_day", state: "ALL", date: "2026-08-15", name: "Independence Day" },
  { id: "hol_2026_gandhi", state: "ALL", date: "2026-10-02", name: "Mahatma Gandhi Jayanti" },
  { id: "hol_2026_diwali", state: "ALL", date: "2026-11-08", name: "Diwali" },
  { id: "hol_2026_ugadi_ka", state: "KA", date: "2026-03-19", name: "Ugadi" },
  { id: "hol_2026_rajyotsava_ka", state: "KA", date: "2026-11-01", name: "Kannada Rajyotsava" },
  { id: "hol_2026_mh_day", state: "MH", date: "2026-05-01", name: "Maharashtra Day" },
  { id: "hol_2026_ts_form", state: "TS", date: "2026-06-02", name: "Telangana Formation Day" },
  { id: "hol_2026_pongal_tn", state: "TN", date: "2026-01-14", name: "Pongal" },
];

const SEED_RULES = [
  // GST
  {
    id: "rule_gst_gstr1_monthly",
    formCode: "GSTR-1",
    name: "GSTR-1 Monthly Return",
    frequency: "monthly",
    dueFormula: { type: "fixed_day_next_month", day: 11 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://www.gst.gov.in",
    verified: false,
  },
  {
    id: "rule_gst_gstr1_qrmp",
    formCode: "GSTR-1-QRMP",
    name: "GSTR-1 Quarterly (QRMP)",
    frequency: "quarterly",
    dueFormula: { type: "quarterly_offset", monthOffset: 1, day: 13 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://www.gst.gov.in",
    verified: false,
  },
  {
    id: "rule_gst_gstr3b_monthly",
    formCode: "GSTR-3B",
    name: "GSTR-3B Monthly Summary Return",
    frequency: "monthly",
    dueFormula: { type: "fixed_day_next_month", day: 20 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://www.gst.gov.in",
    verified: false,
  },
  {
    id: "rule_gst_gstr9_annual",
    formCode: "GSTR-9",
    name: "GSTR-9 Annual Return",
    frequency: "annual",
    dueFormula: { type: "annual_fixed_date", month: 12, day: 31 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://www.gst.gov.in",
    verified: false,
  },
  // TDS
  {
    id: "rule_tds_monthly_challan",
    formCode: "CHALLAN-ITNS-281",
    name: "TDS / TCS Monthly Deposit",
    frequency: "monthly",
    dueFormula: { type: "fixed_day_next_month", day: 7, marchExceptionDay: 30 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://incometax.gov.in",
    verified: false,
  },
  {
    id: "rule_tds_form_24q",
    formCode: "FORM-24Q",
    name: "Quarterly TDS Return - Salary (24Q)",
    frequency: "quarterly",
    dueFormula: { type: "quarterly_offset", monthOffset: 1, day: 31, q4MonthOffset: 2, q4Day: 31 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://incometax.gov.in",
    verified: false,
  },
  {
    id: "rule_tds_form_26q",
    formCode: "FORM-26Q",
    name: "Quarterly TDS Return - Non-Salary (26Q)",
    frequency: "quarterly",
    dueFormula: { type: "quarterly_offset", monthOffset: 1, day: 31, q4MonthOffset: 2, q4Day: 31 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://incometax.gov.in",
    verified: false,
  },
  // Payroll (PF & ESI)
  {
    id: "rule_pf_ecr_monthly",
    formCode: "EPF-ECR",
    name: "EPF Monthly Payment & ECR Return",
    frequency: "monthly",
    dueFormula: { type: "fixed_day_next_month", day: 15 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://www.epfindia.gov.in",
    verified: false,
  },
  {
    id: "rule_esi_monthly_contribution",
    formCode: "ESIC-MONTHLY",
    name: "ESIC Monthly Contribution",
    frequency: "monthly",
    dueFormula: { type: "fixed_day_next_month", day: 15 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://www.esic.gov.in",
    verified: false,
  },
  // State Professional Tax
  {
    id: "rule_pt_karnataka_monthly",
    formCode: "PT-FORM-5A-KA",
    name: "Karnataka Professional Tax Monthly Return",
    frequency: "monthly",
    dueFormula: { type: "fixed_day_next_month", day: 20 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://ctax.kar.nic.in",
    verified: false,
  },
  {
    id: "rule_pt_maharashtra_monthly",
    formCode: "PT-FORM-III-B-MH",
    name: "Maharashtra Professional Tax Monthly Return",
    frequency: "monthly",
    dueFormula: { type: "last_day_next_month" },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://mahagst.gov.in",
    verified: false,
  },
  {
    id: "rule_pt_telangana_monthly",
    formCode: "PT-FORM-001-TS",
    name: "Telangana Professional Tax Monthly Return",
    frequency: "monthly",
    dueFormula: { type: "fixed_day_next_month", day: 10 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://tgct.gov.in",
    verified: false,
  },
  // Income Tax (Advance Tax)
  {
    id: "rule_it_advance_tax_q1",
    formCode: "ADVANCE-TAX-Q1",
    name: "Advance Tax 1st Installment (15%)",
    frequency: "annual",
    dueFormula: { type: "annual_fixed_date", month: 6, day: 15 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://incometax.gov.in",
    verified: false,
  },
  {
    id: "rule_it_advance_tax_q2",
    formCode: "ADVANCE-TAX-Q2",
    name: "Advance Tax 2nd Installment (45%)",
    frequency: "annual",
    dueFormula: { type: "annual_fixed_date", month: 9, day: 15 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://incometax.gov.in",
    verified: false,
  },
  {
    id: "rule_it_advance_tax_q3",
    formCode: "ADVANCE-TAX-Q3",
    name: "Advance Tax 3rd Installment (75%)",
    frequency: "annual",
    dueFormula: { type: "annual_fixed_date", month: 12, day: 15 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://incometax.gov.in",
    verified: false,
  },
  {
    id: "rule_it_advance_tax_q4",
    formCode: "ADVANCE-TAX-Q4",
    name: "Advance Tax 4th Installment (100%)",
    frequency: "annual",
    dueFormula: { type: "annual_fixed_date", month: 3, day: 15 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://incometax.gov.in",
    verified: false,
  },
  // ROC (MCA)
  {
    id: "rule_roc_dir3_kyc",
    formCode: "DIR-3-KYC",
    name: "Director KYC Annual Filing",
    frequency: "annual",
    dueFormula: { type: "annual_fixed_date", month: 9, day: 30 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://www.mca.gov.in",
    verified: false,
  },
  {
    id: "rule_roc_aoc4",
    formCode: "AOC-4",
    name: "Filing of Financial Statements with ROC",
    frequency: "event_based",
    dueFormula: { type: "days_after_event", event: "AGM", days: 30 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://www.mca.gov.in",
    verified: false,
  },
  {
    id: "rule_roc_mgt7",
    formCode: "MGT-7",
    name: "Annual Return to ROC",
    frequency: "event_based",
    dueFormula: { type: "days_after_event", event: "AGM", days: 60 },
    shiftOnHoliday: "next_working_day",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    version: 1,
    sourceUrl: "https://www.mca.gov.in",
    verified: false,
  },
];

export async function runSeeds() {
  console.log("[Seed] Starting idempotent seed loader...");

  // 1. Seed Holidays
  for (const h of SEED_HOLIDAYS) {
    await db
      .insert(holidays)
      .values(h)
      .onConflictDoUpdate({
        target: [holidays.state, holidays.date],
        set: { name: h.name, updatedAt: new Date() },
      });
  }
  console.log(`[Seed] Seeded ${SEED_HOLIDAYS.length} holidays.`);

  // 2. Seed Compliance Rules
  for (const r of SEED_RULES) {
    await db
      .insert(complianceRules)
      .values(r)
      .onConflictDoUpdate({
        target: complianceRules.id,
        set: {
          name: r.name,
          formCode: r.formCode,
          dueFormula: r.dueFormula,
          shiftOnHoliday: r.shiftOnHoliday,
          sourceUrl: r.sourceUrl,
          version: r.version,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`[Seed] Seeded ${SEED_RULES.length} compliance rules (verified = false).`);
  console.log("[Seed] Seeding completed successfully!");
}

// Direct execution
if (process.argv[1]?.includes("seeds")) {
  runSeeds().catch((err) => {
    console.error("[Seed Error]:", err);
    process.exit(1);
  });
}

import { readFileSync } from "node:fs";
import { join } from "node:path";

let cachedRecords = null;

function loadCrbRecords() {
  if (cachedRecords) return cachedRecords;

  const dataPath = join(process.cwd(), "..", "data", "loan checker", "crb_records.json");
  cachedRecords = JSON.parse(readFileSync(dataPath, "utf-8"));
  return cachedRecords;
}

export function lookupCrbRecord({ nationalId, msisdn } = {}) {
  const { records } = loadCrbRecords();
  const record =
    (nationalId && records.find((entry) => entry.national_id === nationalId)) ||
    (msisdn && records.find((entry) => entry.msisdn === msisdn));

  if (record) return record;

  return {
    record_found: false,
    national_id: nationalId ?? null,
    msisdn: msisdn ?? null,
    message: "No credit record found for this identifier.",
  };
}

export function crbFeatures(report) {
  if (!report?.record_found) {
    return {
      has_crb_record: 0,
      crb_score: null,
      band: null,
      n_loans: 0,
      n_active: 0,
      total_outstanding_rwf: 0,
      max_days_arrears_ever: 0,
      currently_in_arrears: 0,
      negative_listing: 0,
      n_inquiries_12m: 0,
      ever_written_off: 0,
    };
  }

  const summary = report.summary;
  return {
    has_crb_record: 1,
    crb_score: report.credit_score.score,
    band: report.credit_score.band,
    n_loans: summary.total_accounts,
    n_active: summary.active_accounts,
    total_outstanding_rwf: summary.total_outstanding_rwf,
    max_days_arrears_ever: summary.max_days_in_arrears_ever,
    currently_in_arrears: summary.accounts_currently_in_arrears > 0 ? 1 : 0,
    negative_listing: summary.negative_listing ? 1 : 0,
    n_inquiries_12m: report.inquiries_last_12m.length,
    ever_written_off: summary.written_off_accounts > 0 ? 1 : 0,
  };
}

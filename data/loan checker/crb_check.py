#!/usr/bin/env python3
"""Mock CRB lookup API for the demo — stands in for a real TransUnion Rwanda query.
In production this would be an authenticated bureau API call (borrower consent required
under Rwanda's Credit Reporting Law No 73/2018); for the demo it reads crb_records.json.

Usage in your scoring pipeline:

    from crb_check import check_crb
    report = check_crb(msisdn="2507XXXXXXXX")        # or national_id="1..."
    if report["record_found"]:
        features = crb_features(report)              # ready-made model features
    else:
        pass  # thin-file case -> rely on MoMo behavioural features only
"""

import json, os

_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crb_records.json")
_DB = json.load(open(_PATH))
_BY_NID = {r["national_id"]: r for r in _DB["records"]}
_BY_MSISDN = {r["msisdn"]: r for r in _DB["records"]}


def check_crb(national_id=None, msisdn=None):
    """Look up a person at the (mock) bureau. Returns their record, or record_found=False."""
    r = _BY_NID.get(national_id) or _BY_MSISDN.get(msisdn)
    if r:
        return r
    return {"record_found": False, "national_id": national_id, "msisdn": msisdn,
            "message": "No credit record found for this identifier."}


def crb_features(report):
    """Flatten a bureau report into numeric features for the scoring model.
    For record_found=False, returns has_crb_record=0 and neutral values —
    the model should then lean on MoMo behavioural features."""
    if not report.get("record_found"):
        return {"has_crb_record": 0, "crb_score": None, "n_loans": 0, "n_active": 0,
                "total_outstanding_rwf": 0, "max_days_arrears_ever": 0,
                "currently_in_arrears": 0, "negative_listing": 0,
                "n_inquiries_12m": 0, "ever_written_off": 0}
    s = report["summary"]
    return {
        "has_crb_record": 1,
        "crb_score": report["credit_score"]["score"],
        "n_loans": s["total_accounts"],
        "n_active": s["active_accounts"],
        "total_outstanding_rwf": s["total_outstanding_rwf"],
        "max_days_arrears_ever": s["max_days_in_arrears_ever"],
        "currently_in_arrears": 1 if s["accounts_currently_in_arrears"] > 0 else 0,
        "negative_listing": 1 if s["negative_listing"] else 0,
        "n_inquiries_12m": len(report["inquiries_last_12m"]),
        "ever_written_off": 1 if s["written_off_accounts"] > 0 else 0,
    }


if __name__ == "__main__":
    print("Demo — looking up all 5 farmers by msisdn:\n")
    for r in _DB["records"]:
        rep = check_crb(msisdn=r["msisdn"])
        print(f'{r["farmer_id"]} {r["full_name"]}')
        for k, v in crb_features(rep).items():
            print(f"    {k:26s} {v}")
        print()
    print("Unknown person:")
    print(" ", check_crb(national_id="1199970000000000"))

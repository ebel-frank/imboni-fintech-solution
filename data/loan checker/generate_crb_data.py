#!/usr/bin/env python3
"""Synthetic CRB (Credit Reference Bureau) records — TransUnion Rwanda style.
Joined to the 5 farmers in momo_transactions_synthetic.json by farmer_id/msisdn.
All national IDs, account refs and data are FICTIONAL. Umuhinzi Hackathon 2026 demo."""

import json, random

random.seed(11)

momo = json.load(open("momo_transactions_synthetic.json"))
F = {f["farmer_id"]: f for f in momo["farmers"]}

def nid(birth_year, gender_digit):
    """Fictional 16-digit Rwandan-style national ID: 1 + YYYY + G + 7 + 1 + 2 digits."""
    return f"1{birth_year}{gender_digit}{random.randint(0,9999999):07d}{random.randint(0,9)}{random.randint(0,99):02d}"

def ref(prefix):
    return f"{prefix}-{random.randint(100000, 999999)}"

BANDS = [(750, "A", "LOW RISK"), (650, "B", "MODERATE-LOW RISK"),
         (550, "C", "MODERATE RISK"), (400, "D", "HIGH RISK"), (200, "E", "VERY HIGH RISK")]

def band(score):
    for lo, b, label in BANDS:
        if score >= lo:
            return {"score": score, "range": "200-900", "band": b, "risk": label}
    return {"score": score, "range": "200-900", "band": "E", "risk": "VERY HIGH RISK"}

def summarize(accounts):
    active = [a for a in accounts if a["status"] == "OPEN"]
    order = ["PERFORMING", "WATCH", "SUBSTANDARD", "DOUBTFUL", "LOSS"]
    worst = max((a.get("worst_classification_ever", a["classification"]) for a in accounts),
                key=order.index, default="PERFORMING")
    return {
        "total_accounts": len(accounts),
        "active_accounts": len(active),
        "closed_accounts": len([a for a in accounts if a["status"] in ("CLOSED",)]),
        "written_off_accounts": len([a for a in accounts if a["status"] == "WRITTEN_OFF"]),
        "total_outstanding_rwf": sum(a["outstanding_balance_rwf"] for a in active),
        "accounts_currently_in_arrears": len([a for a in active if a["days_in_arrears"] > 0]),
        "max_days_in_arrears_ever": max((a["max_days_in_arrears"] for a in accounts), default=0),
        "worst_classification_ever": worst,
        "negative_listing": any(a["classification"] in ("SUBSTANDARD", "DOUBTFUL", "LOSS")
                                or a["status"] == "WRITTEN_OFF" for a in accounts),
    }

def acct(lender, lender_type, product, principal, disbursed, term, status,
         outstanding=0, arrears=0, max_arrears=0, classification="PERFORMING",
         worst_ever=None, closed=None, profile="NNNNNNNNNNNN", note=None, prefix="LN"):
    a = {
        "account_ref": ref(prefix), "lender": lender, "lender_type": lender_type,
        "product": product, "currency": "RWF", "principal_rwf": principal,
        "disbursement_date": disbursed, "term": term, "status": status,
        "outstanding_balance_rwf": outstanding, "days_in_arrears": arrears,
        "max_days_in_arrears": max_arrears, "classification": classification,
        "worst_classification_ever": worst_ever or classification,
        "date_closed": closed, "payment_profile_12m": profile,
    }
    if note: a["note"] = note
    return a

# payment_profile_12m: most recent month FIRST.
# C = paid on time | 1 = 1-29 days late | 2 = 30-59 | 3 = 60-89 | D = 90+/default | N = no account

records = []

# ---- F001 Mukamana — clean history, active loan current, score 782 ----
f = F["F001"]
accounts = [
    acct("MoKash (MTN Rwanda / NCBA)", "DIGITAL_MICROLOAN", "30-day mobile micro loan",
         15000, "2024-11-05", "30 days", "CLOSED", closed="2024-12-01",
         profile="NNNNNNNNNNNN", note="Repaid on time.", prefix="MK"),
    acct("MoKash (MTN Rwanda / NCBA)", "DIGITAL_MICROLOAN", "30-day mobile micro loan",
         30000, "2025-08-14", "30 days", "CLOSED", closed="2025-09-10",
         profile="NNNNNNNNNNCN", note="Repaid 4 days early.", prefix="MK"),
    acct("Umurenge SACCO — Nyagatare", "SACCO", "Agricultural input loan (installments)",
         150000, "2025-02-10", "10 months", "CLOSED", closed="2025-12-05",
         profile="NNNNNNNCCCCC", note="All installments on time.", prefix="SC"),
    acct("Umurenge SACCO — Nyagatare", "SACCO", "Agricultural loan (installments)",
         200000, "2025-11-20", "12 months", "OPEN", outstanding=90000,
         profile="CCCCCCCCNNNN", note="Current, never late.", prefix="SC"),
]
records.append({
    "farmer_id": "F001", "record_found": True, "full_name": f["name"],
    "national_id": nid(1987, 8), "msisdn": f["msisdn"],
    "credit_score": band(782), "summary": summarize(accounts), "accounts": accounts,
    "inquiries_last_12m": [
        {"date": "2025-11-15", "institution": "Umurenge SACCO — Nyagatare", "purpose": "Loan application"},
    ],
    "clearance_certificate_eligible": True,
})

# ---- F002 Nkurunziza — seasonal, one lean-season blip, score 701 ----
f = F["F002"]
accounts = [
    acct("Urwego Bank (MFI)", "MICROFINANCE_BANK", "Coffee input loan (installments)",
         120000, "2024-09-15", "10 months", "CLOSED", closed="2025-07-20",
         max_arrears=18, profile="NNNNNCC1CCCC",
         note="One installment 18 days late during lean season (Jan); recovered."),
    acct("MoKash (MTN Rwanda / NCBA)", "DIGITAL_MICROLOAN", "30-day mobile micro loan",
         25000, "2026-01-08", "30 days", "CLOSED", closed="2026-02-10",
         max_arrears=3, profile="NNNNN1NNNNNN", note="Repaid 3 days late.", prefix="MK"),
    acct("MoKash (MTN Rwanda / NCBA)", "DIGITAL_MICROLOAN", "30-day mobile micro loan",
         40000, "2026-06-20", "30 days", "OPEN", outstanding=43600,
         profile="CNNNNNNNNNNN", note="Not yet due (due 2026-07-20).", prefix="MK"),
]
records.append({
    "farmer_id": "F002", "record_found": True, "full_name": f["name"],
    "national_id": nid(1979, 7), "msisdn": f["msisdn"],
    "credit_score": band(701), "summary": summarize(accounts), "accounts": accounts,
    "inquiries_last_12m": [
        {"date": "2026-01-05", "institution": "MoKash (MTN Rwanda / NCBA)", "purpose": "Micro loan"},
        {"date": "2026-06-18", "institution": "MoKash (MTN Rwanda / NCBA)", "purpose": "Micro loan"},
    ],
    "clearance_certificate_eligible": True,
})

# ---- F003 Uwase — hit WATCH once, currently fine, score 618 ----
f = F["F003"]
accounts = [
    acct("MoKash (MTN Rwanda / NCBA)", "DIGITAL_MICROLOAN", "30-day mobile micro loan",
         10000, "2025-03-04", "30 days", "CLOSED", closed="2025-05-07",
         max_arrears=34, worst_ever="WATCH", profile="NNNNNNNNNNNN",
         note="Settled 34 days late — classified WATCH at the time.", prefix="MK"),
    acct("MoKash (MTN Rwanda / NCBA)", "DIGITAL_MICROLOAN", "30-day mobile micro loan",
         20000, "2025-11-10", "30 days", "CLOSED", closed="2025-12-22",
         max_arrears=12, profile="NNNNNNN1NNNN", note="Repaid 12 days late.", prefix="MK"),
    acct("MoKash (MTN Rwanda / NCBA)", "DIGITAL_MICROLOAN", "30-day mobile micro loan",
         25000, "2026-06-28", "30 days", "OPEN", outstanding=27250,
         profile="CNNNNNNNNNNN", note="Not yet due (due 2026-07-28).", prefix="MK"),
]
records.append({
    "farmer_id": "F003", "record_found": True, "full_name": f["name"],
    "national_id": nid(1990, 8), "msisdn": f["msisdn"],
    "credit_score": band(618), "summary": summarize(accounts), "accounts": accounts,
    "inquiries_last_12m": [
        {"date": "2025-11-08", "institution": "MoKash (MTN Rwanda / NCBA)", "purpose": "Micro loan"},
        {"date": "2026-04-02", "institution": "Duterimbere IMF", "purpose": "Loan application (declined)"},
        {"date": "2026-06-26", "institution": "MoKash (MTN Rwanda / NCBA)", "purpose": "Micro loan"},
    ],
    "clearance_certificate_eligible": True,
})

# ---- F004 Habimana — written-off MoKash loan, currently in arrears, score 396 ----
f = F["F004"]
accounts = [
    acct("MoKash (MTN Rwanda / NCBA)", "DIGITAL_MICROLOAN", "30-day mobile micro loan",
         15000, "2024-08-02", "30 days", "WRITTEN_OFF",
         max_arrears=185, classification="LOSS", closed="2025-02-15",
         profile="NNNNNNNNNNNN",
         note="Never repaid; written off 2025-02-15. Negative listing (retained up to 7 years per BNR rules).",
         prefix="MK"),
    acct("Umurenge SACCO — Bugesera", "SACCO", "Agricultural loan (installments)",
         100000, "2025-03-20", "12 months", "OPEN", outstanding=55000,
         arrears=42, max_arrears=42, classification="WATCH",
         profile="21CC1CCCNNNN", note="Currently 42 days in arrears.", prefix="SC"),
    acct("MoKash (MTN Rwanda / NCBA)", "DIGITAL_MICROLOAN", "30-day mobile micro loan",
         8000, "2026-03-15", "30 days", "CLOSED", closed="2026-05-02",
         max_arrears=18, profile="NN1NNNNNNNNN",
         note="Small limit after prior default; repaid 18 days late.", prefix="MK"),
]
records.append({
    "farmer_id": "F004", "record_found": True, "full_name": f["name"],
    "national_id": nid(1983, 7), "msisdn": f["msisdn"],
    "credit_score": band(396), "summary": summarize(accounts), "accounts": accounts,
    "inquiries_last_12m": [
        {"date": "2025-09-11", "institution": "Bank of Kigali", "purpose": "Loan application (declined)"},
        {"date": "2026-01-20", "institution": "Urwego Bank (MFI)", "purpose": "Loan application (declined)"},
        {"date": "2026-03-14", "institution": "MoKash (MTN Rwanda / NCBA)", "purpose": "Micro loan"},
        {"date": "2026-06-30", "institution": "Duterimbere IMF", "purpose": "Loan application"},
    ],
    "clearance_certificate_eligible": False,
})

# ---- F005 Mugisha — NOT FOUND at bureau (the unscored majority) ----
f = F["F005"]
records.append({
    "farmer_id": "F005", "record_found": False, "full_name": f["name"],
    "national_id": nid(2000, 7), "msisdn": f["msisdn"],
    "message": ("No credit record found for this identifier. This person has never taken a loan "
                "from any institution that reports to the bureau (bank, MFI, SACCO, or digital "
                "lender). Bureau risk is UNDETERMINED — traditionally treated as high risk, "
                "which is exactly the gap alternative (MoMo-based) scoring closes."),
    "credit_score": None, "summary": None, "accounts": [], "inquiries_last_12m": [],
    "clearance_certificate_eligible": False,
})

dataset = {
    "dataset": "synthetic_crb_records_v1",
    "disclaimer": ("Fully synthetic demo data modeled on Rwanda's credit reporting system "
                   "(TransUnion Rwanda, regulated by BNR under Law No 73/2018). All national IDs, "
                   "account references, scores and histories are fictional. Institution names are "
                   "used for realism only."),
    "report_date": "2026-07-11",
    "how_lookup_works": ("Real-world: lenders query the bureau by National ID with the borrower's "
                         "consent; individuals can self-check via USSD *707# (TransUnion Menyesha). "
                         "Demo: use crb_check.py -> check_crb(national_id=...) or "
                         "check_crb(msisdn=...). Returns the record, or record_found=False."),
    "score_convention": {"range": "200-900",
                         "bands": {"A": "750-900 low risk", "B": "650-749", "C": "550-649",
                                   "D": "400-549", "E": "200-399 very high risk"}},
    "classification_convention": {"PERFORMING": "0-30 days in arrears", "WATCH": "31-90",
                                  "SUBSTANDARD": "91-180", "DOUBTFUL": "181-360",
                                  "LOSS": ">360 days or written off"},
    "payment_profile_codes": {"C": "paid on time", "1": "1-29 days late", "2": "30-59 days late",
                              "3": "60-89 days late", "D": "90+ days / default",
                              "N": "no account that month",
                              "order": "most recent month first"},
    "records": records,
}

with open("crb_records.json", "w") as fh:
    json.dump(dataset, fh, indent=1)

for r in records:
    s = r["credit_score"]["score"] if r["credit_score"] else "N/A (not found)"
    neg = r["summary"]["negative_listing"] if r["summary"] else "-"
    print(f'{r["farmer_id"]} {r["full_name"]:22s} found={r["record_found"]!s:5s} '
          f'score={s!s:>16s} negative_listing={neg}')

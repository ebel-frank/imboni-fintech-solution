#!/usr/bin/env python3
"""Synthetic MTN MoMo transaction generator — 5 Rwandan farmer profiles, 12 months.
Umuhinzi Hackathon 2026 demo. All names, numbers and merchant codes are fictional.
Regenerate / rescale by editing frequencies below and re-running."""

import json, csv, random, calendar
from datetime import date

random.seed(42)

START = date(2025, 7, 12)   # trailing 12 months ending on hackathon day
END   = date(2026, 7, 11)

# ---------- helpers ----------

def rand_msisdn():
    return random.choice(["250788", "250789", "250790", "250791", "250792", "250793"]) \
        + f"{random.randint(0, 999999):06d}"

def rand_merchant():
    return str(random.randint(20000000, 49999999))

def transfer_fee(a):
    if a <= 1000: return 20
    if a <= 10000: return 100
    if a <= 150000: return 250
    return 1500

def months():
    y, m = START.year, START.month
    while (y, m) <= (END.year, END.month):
        yield y, m
        m += 1
        if m > 12:
            m, y = 1, y + 1

def mk_date(y, m, lo=1, hi=28):
    last = calendar.monthrange(y, m)[1]
    d = date(y, m, min(random.randint(lo, hi), last))
    return d if START <= d <= END else None

def sample_days(y, m, k, lo=1, hi=28):
    if k <= 0: return []
    pool = list(range(lo, min(hi, calendar.monthrange(y, m)[1]) + 1))
    out = []
    for day in random.sample(pool, min(k, len(pool))):
        d = date(y, m, day)
        if START <= d <= END:
            out.append(d)
    return sorted(out)

def r100(lo, hi):  return max(100,  int(round(random.randint(lo, hi), -2)))
def r500(lo, hi):  return max(500,  int(round(random.randint(lo, hi) / 500) * 500))
def r1000(lo, hi): return max(1000, int(round(random.randint(lo, hi) / 1000) * 1000))

# ---------- farmer model ----------

class Farmer:
    def __init__(self, fid, name, district, activity, hint):
        self.fid, self.name, self.district = fid, name, district
        self.activity, self.hint = activity, hint
        self.msisdn = rand_msisdn()
        self.tx, self.legend = [], {}

    def cp_phone(self, label):
        n = rand_msisdn(); self.legend[n] = label; return n

    def cp_merchant(self, label):
        n = rand_merchant(); self.legend[n] = label; return n

    def incoming(self, d, amount, sender):
        self.tx.append(dict(date=d.isoformat(), type="TRANSFER", amount_rwf=amount,
                            receiver=self.msisdn, sender=sender, fee_rwf=0))

    def out_transfer(self, d, amount, receiver):
        self.tx.append(dict(date=d.isoformat(), type="TRANSFER", amount_rwf=amount,
                            receiver=receiver, sender=self.msisdn, fee_rwf=transfer_fee(amount)))

    def out_payment(self, d, amount, merchant):
        self.tx.append(dict(date=d.isoformat(), type="PAYMENT", amount_rwf=amount,
                            receiver=merchant, sender=self.msisdn, fee_rwf=0))

    def finalize(self):
        self.tx.sort(key=lambda t: t["date"])
        txs = [dict(id=i, **t) for i, t in enumerate(self.tx, 1)]
        return dict(farmer_id=self.fid, name=self.name, msisdn=self.msisdn,
                    district=self.district, primary_activity=self.activity,
                    profile_hint=self.hint, counterparty_legend=self.legend,
                    n_transactions=len(txs), transactions=txs)

# ---------- shared behaviours ----------

def add_airtime(f, merchant, lo, hi):
    for y, m in months():
        for d in sample_days(y, m, random.randint(lo, hi)):
            f.out_payment(d, random.choice([500, 500, 1000, 1000, 1500, 2000, 3000]), merchant)

def add_shop(f, merchant, lo, hi, amin=1000, amax=8000):
    for y, m in months():
        for d in sample_days(y, m, random.randint(lo, hi)):
            f.out_payment(d, r100(amin, amax), merchant)

def add_cashpower(f, merchant, amin, amax, skip_prob=0.0):
    for y, m in months():
        if random.random() < skip_prob: continue
        d = mk_date(y, m, 1, 27)
        if d: f.out_payment(d, r500(amin, amax), merchant)

def add_ibimina(f, number, amount, skip_months=()):
    for y, m in months():
        if (y, m) in skip_months: continue
        d = mk_date(y, m, 5, 9)
        if d: f.out_transfer(d, amount, number)

def add_school(f, merchant, terms, amin, amax):
    for (y, m) in terms:
        d = mk_date(y, m, 5, 20)
        if d: f.out_payment(d, r1000(amin, amax), merchant)

def add_p2p_noise(f, out_lo, out_hi, in_lo, in_hi):
    for y, m in months():
        for d in sample_days(y, m, random.randint(out_lo, out_hi)):
            f.out_transfer(d, r100(500, 6000), rand_msisdn())
        for d in sample_days(y, m, random.randint(in_lo, in_hi)):
            f.incoming(d, r100(1000, 8000), rand_msisdn())

# ---------- the five profiles ----------

def farmer1():
    f = Farmer("F001", "Mukamana Josiane", "Nyagatare", "Dairy + maize",
               "strong recurring income, disciplined saver — model should score HIGH")
    dairy   = f.cp_phone("Dairy cooperative — monthly milk payment (same sender, day 3-6 each month)")
    trader  = f.cp_phone("Grain trader — seasonal maize sales")
    ibimina = f.cp_phone("Ibimina savings group — fixed RWF 5,000 monthly contribution")
    airtime = f.cp_merchant("Airtime top-up")
    power   = f.cp_merchant("Cash Power electricity")
    school  = f.cp_merchant("School fees")
    agro    = f.cp_merchant("Agro-dealer — seeds & fertilizer at planting")
    shop    = f.cp_merchant("Local shop / kiosk")
    rel     = f.cp_phone("Relative in Kigali — occasional support")

    for y, m in months():                                  # monthly milk payment
        d = mk_date(y, m, 3, 6)
        if d: f.incoming(d, r1000(42000, 62000), dairy)
    for (y, m, k, lo, hi) in [(2026, 2, 2, 60000, 120000), (2025, 7, 1, 50000, 90000),
                              (2026, 6, 1, 40000, 80000),  (2026, 7, 1, 60000, 110000)]:
        for d in sample_days(y, m, k, 5, 27):              # harvest spikes
            f.incoming(d, r1000(lo, hi), trader)
    add_ibimina(f, ibimina, 5000)
    add_airtime(f, airtime, 6, 9)
    add_cashpower(f, power, 2000, 5000)
    add_school(f, school, [(2025, 9), (2026, 1), (2026, 4)], 25000, 40000)
    for (y, m) in [(2025, 9), (2025, 10), (2026, 2), (2026, 3)]:
        d = mk_date(y, m, 3, 25)
        if d: f.out_payment(d, r1000(15000, 35000), agro)
    add_shop(f, shop, 6, 9)
    add_p2p_noise(f, 4, 7, 1, 2)
    for (y, m) in random.sample(list(months()), 4):
        d = mk_date(y, m, 1, 27)
        if d: f.incoming(d, r1000(10000, 20000), rel)
    return f

def farmer2():
    f = Farmer("F002", "Nkurunziza Emmanuel", "Huye", "Coffee + beans",
               "seasonal but disciplined — big Mar-Jul inflows, never misses ibimina")
    station = f.cp_phone("Coffee washing station — cherry payments Mar-Jul")
    veg     = f.cp_phone("Local buyer — small off-season sales")
    ibimina = f.cp_phone("Ibimina savings group — fixed RWF 3,000 monthly")
    airtime = f.cp_merchant("Airtime top-up")
    power   = f.cp_merchant("Cash Power electricity")
    school  = f.cp_merchant("School fees")
    agro    = f.cp_merchant("Agro-dealer")
    shop    = f.cp_merchant("Local shop")

    for y, m in months():
        if m in (3, 4, 5, 6):
            for d in sample_days(y, m, 3 if m in (4, 5) else 2):
                f.incoming(d, r1000(30000, 110000), station)
        elif m == 7:
            for d in sample_days(y, m, 1):
                f.incoming(d, r1000(25000, 60000), station)
        else:
            for d in sample_days(y, m, random.randint(1, 2)):
                f.incoming(d, r1000(5000, 15000), veg)
    add_ibimina(f, ibimina, 3000)
    add_airtime(f, airtime, 4, 7)
    add_cashpower(f, power, 1500, 3500)
    add_school(f, school, [(2025, 9), (2026, 1), (2026, 4)], 18000, 30000)
    for (y, m) in [(2025, 9), (2026, 2)]:
        d = mk_date(y, m, 3, 25)
        if d: f.out_payment(d, r1000(10000, 25000), agro)
    add_shop(f, shop, 4, 7, 800, 6000)
    add_p2p_noise(f, 2, 4, 0, 1)
    return f

def farmer3():
    f = Farmer("F003", "Uwase Claudine", "Musanze", "Vegetables (market gardening)",
               "frequent small sales, mostly steady but skips some savings months — MEDIUM")
    t1, t2, t3 = (f.cp_phone("Market trader A"), f.cp_phone("Market trader B"),
                  f.cp_phone("Market trader C"))
    ibimina = f.cp_phone("Ibimina savings group — RWF 4,000, skipped 3 months")
    airtime = f.cp_merchant("Airtime")
    power   = f.cp_merchant("Cash Power")
    school  = f.cp_merchant("School fees")
    shop    = f.cp_merchant("Local shop")
    agro    = f.cp_merchant("Agro-dealer")

    for y, m in months():
        k = random.randint(2, 3) if m in (7, 8) else random.randint(3, 5)   # dry-season dip
        for d in sample_days(y, m, k):
            f.incoming(d, r100(8000, 25000), random.choice([t1, t2, t3]))
    add_ibimina(f, ibimina, 4000, skip_months={(2025, 8), (2025, 12), (2026, 3)})
    add_airtime(f, airtime, 5, 8)
    add_cashpower(f, power, 1500, 4000, skip_prob=0.15)
    add_school(f, school, [(2025, 9), (2026, 1), (2026, 5)], 15000, 28000)
    for (y, m) in [(2025, 9), (2026, 2), (2026, 6)]:
        d = mk_date(y, m, 3, 25)
        if d: f.out_payment(d, r1000(8000, 18000), agro)
    add_shop(f, shop, 5, 8, 800, 6000)
    add_p2p_noise(f, 2, 5, 1, 2)
    return f

def farmer4():
    f = Farmer("F004", "Habimana Jean Bosco", "Bugesera", "Maize (single crop)",
               "income only at harvest, spends fast, silent months, no savings group — RISKY")
    trader  = f.cp_phone("Grain trader — harvest sales only")
    rel     = f.cp_phone("Relative — irregular remittances")
    airtime = f.cp_merchant("Airtime")
    shop    = f.cp_merchant("Local shop")
    school  = f.cp_merchant("School fees (paid late / partially)")

    for d in sample_days(2026, 2, 2, 5, 27):
        f.incoming(d, r1000(90000, 170000), trader)
    for d in sample_days(2025, 7, 1, 12, 27):
        f.incoming(d, r1000(70000, 130000), trader)
    for d in sample_days(2026, 7, 1, 1, 10):
        f.incoming(d, r1000(80000, 140000), trader)
    for (y, m) in random.sample(list(months()), 7):        # irregular remittances
        d = mk_date(y, m, 1, 27)
        if d: f.incoming(d, r1000(5000, 20000), rel)
    for d in sample_days(2026, 2, 2, 8, 28):               # spends fast after harvest
        f.out_transfer(d, r1000(20000, 60000), rand_msisdn())
    for d in sample_days(2025, 7, 1, 14, 28):
        f.out_transfer(d, r1000(15000, 40000), rand_msisdn())
    for y, m in months():
        if random.random() < 0.2:                          # silent months
            continue
        for d in sample_days(y, m, random.randint(1, 3)):
            f.out_payment(d, random.choice([500, 500, 1000, 1500]), airtime)
        for d in sample_days(y, m, random.randint(0, 2)):
            f.out_payment(d, r100(800, 5000), shop)
    add_school(f, school, [(2026, 2), (2026, 5)], 10000, 20000)   # late, one term missed
    add_p2p_noise(f, 1, 3, 0, 1)
    return f

def farmer5():
    f = Farmer("F005", "Mugisha Eric", "Gakenke", "Beans + maize (young farmer)",
               "THIN FILE — history only starts Feb 2026; promising coop pattern from May")
    coop    = f.cp_phone("Farmer cooperative — monthly produce payment, started May 2026")
    airtime = f.cp_merchant("Airtime")
    shop    = f.cp_merchant("Local shop")
    agro    = f.cp_merchant("Agro-dealer")
    first   = date(2026, 2, 9)

    for y, m in months():
        if (y, m) < (2026, 2): continue
        for d in sample_days(y, m, random.randint(2, 4)):
            if d >= first: f.out_payment(d, random.choice([500, 1000, 1500]), airtime)
        for d in sample_days(y, m, random.randint(1, 2)):
            if d >= first: f.out_payment(d, r100(800, 4000), shop)
        for d in sample_days(y, m, random.randint(0, 2)):
            if d >= first: f.incoming(d, r100(3000, 10000), rand_msisdn())
    for (y, m) in [(2026, 5), (2026, 6), (2026, 7)]:
        d = mk_date(y, m, 2, 6)
        if d and d >= first: f.incoming(d, r1000(25000, 35000), coop)
    d = mk_date(2026, 2, 10, 20)
    if d and d >= first: f.out_payment(d, r1000(8000, 15000), agro)
    return f

# ---------- build & write ----------

records = [fn().finalize() for fn in (farmer1, farmer2, farmer3, farmer4, farmer5)]

dataset = dict(
    dataset="synthetic_momo_transactions_v1",
    disclaimer=("Fully synthetic demo data generated for the Umuhinzi Digital Hackathon 2026. "
                "All names, phone numbers and merchant codes are fictional."),
    currency="RWF",
    period={"start": START.isoformat(), "end": END.isoformat()},
    conventions={
        "TRANSFER": "P2P mobile-money transfer between phone numbers (MSISDNs); sender pays a tiered fee.",
        "PAYMENT": "Merchant payment to an 8-digit merchant code; no fee.",
        "direction": "sender == farmer msisdn -> outgoing; receiver == farmer msisdn -> incoming.",
        "fee_tiers_rwf": {"<=1000": 20, "1001-10000": 100, "10001-150000": 250, ">150000": 1500},
        "warning": "profile_hint and counterparty_legend are ground truth for the team only — do NOT feed them to the model.",
    },
    farmers=records,
)

with open("momo_transactions_synthetic.json", "w") as fh:
    json.dump(dataset, fh, indent=1)

with open("momo_transactions_flat.csv", "w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["farmer_id", "date", "type", "amount_rwf", "receiver", "sender", "fee_rwf"])
    for r in records:
        for t in r["transactions"]:
            w.writerow([r["farmer_id"], t["date"], t["type"], t["amount_rwf"],
                        t["receiver"], t["sender"], t["fee_rwf"]])

total = 0
for r in records:
    tin  = sum(t["amount_rwf"] for t in r["transactions"] if t["receiver"] == r["msisdn"])
    tout = sum(t["amount_rwf"] for t in r["transactions"] if t["sender"]   == r["msisdn"])
    total += r["n_transactions"]
    print(f'{r["farmer_id"]} {r["name"]:22s} txns={r["n_transactions"]:4d}  '
          f'in=RWF {tin:>10,}  out=RWF {tout:>10,}')
print("TOTAL transactions:", total)

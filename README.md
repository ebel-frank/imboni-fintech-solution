# Imboni

AI-powered credit scoring and instant micro-lending for smallholder farmers in Rwanda who lack formal credit history.

## 1. Problem

Smallholder farmers make up roughly 69% of Rwandan households, but formal credit reaches only about 1 in 10 of them. Mobile money reach is high (85%+ of adults), but mobile money activity has never been converted into a usable credit signal for this group. Farmer income is seasonal and lumpy (tied to planting and harvest cycles), which generic urban-trader credit models misread as "inactive" or "risky." Existing tools in Rwanda (NAIS insurance, ADFinance's ADMobile, Cordaid's A-CAT) are either subsidy schemes or manual loan-officer calculators — none of them run a live, agri-aware ML model on mobile money data.

## 2. Solution

Imboni is a two-sided platform:

1. **Credit scoring engine** — builds a creditworthiness score for a farmer from their mobile money transaction history, using features tuned to agricultural seasonality (harvest-linked inflow spikes, input-purchase outflow patterns, cooperative membership) rather than generic urban spending patterns.
2. **Instant micro-loan agent** — lets a farmer request a small loan over USSD. An orchestration agent gathers the farmer's Imboni score, their Credit Reference Bureau (CRB) record, and their existing mobile-wallet loan exposure, then a deterministic underwriting model sets a credit limit (e.g. RWF 10,000) in real time. The loan is disbursed to the farmer's mobile money wallet and auto-debited after an agreed term (e.g. 30 days), backed by a guarantee facility from BRD-BDF (Development Bank of Rwanda / Business Development Fund) to de-risk default.

Everything is USSD-first — no smartphone or app download required, since feature phones dominate in rural Rwanda.

## 3. Users and stakeholders

- **Farmer** — end user, interacts entirely via USSD (no app).
- **MFI / SACCO loan officer** — consumes Imboni's score via a dashboard during Phase A (score-as-a-service), before Imboni originates loans directly.
- **Licensed lending partner** — an MFI, SACCO, or BRD-BDF entity that is legally the lender of record and CRB member while Imboni's license is pending. Imboni operates as their scoring/decisioning technology layer.
- **BRD-BDF** — provides a portfolio-level guarantee (covers an agreed percentage of loan-book losses) rather than a per-loan guarantee, since individual micro-loan tickets are far smaller than BDF's usual SME guarantee product.
- **Mobile network operators (MTN Rwanda, Airtel Rwanda)** — data source for mobile money transaction history and the collection API used for auto-debit repayment. Requires a formal commercial/API agreement, not just end-user consent.
- **Credit Reference Bureau (CRB)** — Rwanda's bureau (operated by TransUnion Rwanda, supervised by BNR). Only licensed financial institutions can query it directly, which is why Imboni operates under a licensed partner's membership until it secures its own license.
- **National Bank of Rwanda (BNR)** — regulator; Imboni's target entry point is the BNR Regulatory Sandbox (Regulation 41/2022) to test the model with real data under supervision before full licensing.
- **National Cyber Security Authority (NCSA)** — data protection regulator under Law 058/2021; Imboni must register as a data controller/processor and maintain an explicit, auditable consent trail.

## 4. Phased rollout

**Phase A — Score-as-a-service (build first)**
Imboni does not hold a lending license or touch farmer money. It licenses credit scores to MFIs/SACCOs, who make the actual lending decision. Low capital requirement, fastest path to a working pilot, and produces the real repayment-outcome data needed to prove the model.

**Phase B — Direct instant lending (once the model is proven)**
Imboni (via a licensed partner) originates small loans directly through the USSD loan-agent flow described in Section 2, using BRD-BDF as a guarantee backstop. This is the target end-state product, but it is gated on: (a) a licensed lending partner or Imboni's own license, (b) a working MTN/Airtel data-sharing agreement, and (c) a validated scoring model from Phase A.

Both phases share the same underlying consent, data ingestion, and scoring infrastructure — build that core once.

## 5. Core flows

### 5.1 Consent and onboarding (USSD)
1. Farmer dials a USSD code.
2. Menu explains what data will be used and for what purpose (plain language, no legalese — required for informed consent under Law 058/2021).
3. Farmer approves. The approval event, timestamp, phone number, and consent scope are recorded immutably (this is the legal evidence of consent, and must be retrievable on demand for NCSA/BNR audit).
4. Farmer completes a short profile: name, national ID, district/sector, primary crop, approximate plot size, cooperative/SACCO membership if any.

### 5.2 Data ingestion
Two channels, built in this order:
1. **SMS-forwarding (build first)** — after consent, the farmer forwards their MoMo transaction SMS alerts to a shortcode. A parser extracts transaction type, amount, counterparty, and timestamp. No telco agreement required; slower per-farmer onboarding but fastest to a working pilot.
2. **Telco/MFI data API (upgrade path)** — once a commercial agreement with MTN Rwanda or Airtel Rwanda (or a partner MFI's core banking bridge, e.g. ADFinance's ADMobile) is in place, pull transaction history directly and more completely. Design the ingestion layer with a clean interface so this channel can be swapped in without touching the scoring engine.

### 5.3 Scoring engine
- Feature engineering tuned to agricultural seasonality: transaction frequency/regularity, harvest-linked inflow spikes (tag against a crop calendar per primary crop), input-purchase outflow patterns before planting, savings behavior, cooperative/SACCO membership as a signal.
- Model: start with an interpretable model (logistic regression or gradient-boosted trees with feature-importance/SHAP explanations) rather than an opaque model — this matters for BNR sandbox review, MFI loan-officer trust, and consumer-protection scrutiny of any credit decision.
- Output: a numeric score plus a short human-readable explanation of the top contributing factors, exposed via API to MFI dashboards (Phase A) and the loan agent (Phase B).

### 5.4 Instant loan decision (USSD, Phase B)
1. Farmer dials a second USSD code to request a loan.
2. An orchestration agent gathers three inputs in parallel: (a) the farmer's Imboni score, (b) their CRB record (via the licensed partner's CRB membership), (c) their existing mobile-wallet loan exposure (e.g. MoKash-style products) to avoid debt-stacking.
3. A deterministic underwriting model (not a free-form LLM decision) combines these into a credit limit and presents it to the farmer (e.g. "You are eligible for RWF 10,000").
4. Farmer selects an amount up to the limit; funds are disbursed to their MoMo wallet.
5. After the agreed term (e.g. 30 days), the amount is auto-debited from the farmer's MoMo balance via the telco's collection API. If the balance is insufficient, the BRD-BDF portfolio guarantee covers the agreed percentage of the shortfall rather than an individual per-loan claim process.

**Important**: the "AI agent" in this flow should be an orchestrator (fetches data, calls the scoring/underwriting model, formats the response) — the actual credit-limit decision must be a deterministic, explainable model, not opaque LLM judgment, so that every decision can be justified to a regulator or an unhappy applicant.

## 6. Data model (core entities)

- **Farmer** — id, national ID, phone number, district/sector, primary crop, plot size estimate, cooperative/SACCO membership, consent status.
- **ConsentRecord** — farmer_id, scope, channel (USSD), timestamp, raw confirmation payload (immutable, for audit).
- **TransactionRecord** — farmer_id, source (SMS-forward / telco API), type, amount, counterparty, timestamp.
- **CreditScore** — farmer_id, score value, model version, top contributing factors, computed_at.
- **LoanApplication** — farmer_id, requested_at, score_snapshot, crb_snapshot, existing_loan_exposure_snapshot, decision, limit_offered.
- **Loan** — application_id, amount disbursed, disbursed_at, due_date, status, guarantee_reference (BRD-BDF).
- **RepaymentEvent** — loan_id, attempted_at, amount, status (success / partial / guarantee-triggered).
- **Partner** — MFI/SACCO or BRD-BDF entity, license status, CRB membership status, API credentials.

## 7. Suggested tech stack

- **Backend**: NestJS (TypeScript), matching existing team expertise. Modular structure: `consent`, `ingestion`, `scoring`, `loan-agent`, `partner-api`.
- **Database**: PostgreSQL with Prisma ORM.
- **USSD gateway**: Africa's Talking or a direct MTN/Airtel USSD short-code integration.
- **SMS parsing service**: dedicated worker/queue (e.g. BullMQ on Redis) to ingest and parse forwarded MoMo SMS content asynchronously.
- **ML/scoring service**: Python (scikit-learn / XGBoost) exposed via an internal API the NestJS backend calls, or a NestJS-native implementation if the model stays simple (logistic regression).
- **Partner dashboard**: React web app for MFI/SACCO loan officers to view scores and rationale (Phase A). A Flutter app is a reasonable alternative if a partner needs an offline-friendly mobile client.
- **Infrastructure**: Docker + Kubernetes, deployed on AWS, consistent with existing infrastructure experience.
- **Data protection**: register as a data controller with NCSA; encrypt transaction data at rest; maintain a 5-year audit trail for consent and lending decisions per Rwandan AML-adjacent record-keeping norms.

## 8. API sketch (indicative, not final)

```
POST   /consent/ussd-callback        # USSD gateway posts consent events here
POST   /ingestion/sms-webhook        # shortcode SMS-forwarding webhook
GET    /farmers/:id/score            # returns current score + explanation
POST   /loans/apply                  # triggered by loan-request USSD flow
GET    /loans/:id                    # loan status
POST   /loans/:id/repayment-attempt  # triggered by scheduled auto-debit job
GET    /partners/:id/farmers/scores  # MFI/SACCO dashboard data feed (Phase A)
```

## 9. Regulatory and compliance requirements

- **BNR Regulatory Sandbox** (Regulation 41/2022) — target entry point to test the scoring/lending model with real data under supervision before full licensing.
- **CRB access** — only available through a licensed partner's membership until Imboni holds its own license.
- **Data protection** — Law 058/2021, supervised by NCSA; explicit consent capture (Section 5.1), data controller registration, breach notification obligations.
- **AML/CDD** — Customer Due Diligence required for transactions above RWF 1,000,000 or flagged as suspicious; Suspicious Transaction Reports to Rwanda's Financial Intelligence Centre; 5-year record retention.
- **BRD-BDF guarantee structure** — pitch a portfolio-level guarantee (covering an agreed percentage of aggregate loan-book losses) rather than per-loan guarantees, since BDF's standard product is sized for SME loans, not sub-RWF-10,000 instant micro-loans.

## 10. Open questions and risks (flag to product owner before building)

- MTN Rwanda / Airtel Rwanda API access requires a formal commercial agreement — not guaranteed by end-user USSD consent alone. This is likely the longest lead-time item; start this conversation early and build the SMS-forwarding channel first so development isn't blocked on it.
- Which licensed entity (MFI, SACCO, or BRD-BDF directly) will act as lender-of-record and CRB member during Phase B, before Imboni has its own license.
- Exact terms of the BRD-BDF portfolio guarantee (percentage covered, trigger conditions, reporting cadence) need to be negotiated, not assumed.
- Crop calendar data for feature engineering (planting/harvest windows per crop per region) needs a reliable source — likely Rwanda's Ministry of Agriculture (MINAGRI) or RAB (Rwanda Agriculture Board).
- Default/over-indebtedness risk if auto-debit consistently fails — needs a policy decision (grace period, partial repayment handling, cap on repeat borrowing) before Phase B launch, to avoid the debt-stacking problems seen with similar mobile-loan products elsewhere in East Africa.

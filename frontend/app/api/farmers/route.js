import { getSessionUser } from "../../../lib/auth";
import { loadMomoDataset } from "../../../lib/data";

const scoreWeights = {
  incomeReliability: 0.3,
  cashflowHealth: 0.25,
  savingsDiscipline: 0.18,
  marketAccess: 0.15,
  digitalFootprint: 0.12,
};

function clamp(value, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function standardDeviation(values) {
  if (!values.length) return 0;
  const average = sum(values) / values.length;
  const variance = sum(values.map((value) => (value - average) ** 2)) / values.length;
  return Math.sqrt(variance);
}

function getMonthRange(startDate, endDate) {
  const months = [];
  const cursor = new Date(`${startDate.slice(0, 7)}-01T00:00:00.000Z`);
  const end = new Date(`${endDate.slice(0, 7)}-01T00:00:00.000Z`);

  while (cursor <= end) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

function getCounterpartyLabel(farmer, counterparty) {
  const legend = farmer.counterparty_legend || {};
  return legend[counterparty] ? `${legend[counterparty]} (${counterparty})` : counterparty;
}

function buildTransactions(farmer) {
  return farmer.transactions
    .map((transaction) => {
      const isIncoming = transaction.receiver === farmer.msisdn && transaction.sender !== farmer.msisdn;
      const counterparty = isIncoming ? transaction.sender : transaction.receiver;

      return {
        id: `${farmer.farmer_id}-${transaction.id}`,
        sequence: transaction.id,
        date: transaction.date,
        type: transaction.type,
        amount_rwf: transaction.amount_rwf,
        signed_amount_rwf: isIncoming
          ? transaction.amount_rwf
          : -(transaction.amount_rwf + transaction.fee_rwf),
        fee_rwf: transaction.fee_rwf,
        sender: transaction.sender,
        receiver: transaction.receiver,
        direction: isIncoming ? "incoming" : "outgoing",
        counterparty,
        counterpartyLabel: getCounterpartyLabel(farmer, counterparty),
        month: transaction.date.slice(0, 7),
      };
    })
    .sort((first, second) => second.date.localeCompare(first.date) || second.sequence - first.sequence);
}

function getRecurringOutgoing(transactions, monthRange) {
  const groups = new Map();

  transactions
    .filter(
      (transaction) =>
        transaction.direction === "outgoing" &&
        transaction.type === "TRANSFER" &&
        transaction.amount_rwf >= 2000
    )
    .forEach((transaction) => {
      const key = `${transaction.counterparty}:${transaction.amount_rwf}`;
      const existing = groups.get(key) || { count: 0, months: new Set() };
      existing.count += 1;
      existing.months.add(transaction.month);
      groups.set(key, existing);
    });

  const recurringGroups = Array.from(groups.values()).filter(
    (group) => group.count >= 3 && group.months.size >= 3
  );
  const recurringMonths = new Set();
  recurringGroups.forEach((group) => {
    group.months.forEach((month) => recurringMonths.add(month));
  });

  return {
    count: sum(recurringGroups.map((group) => group.count)),
    groupCount: recurringGroups.length,
    monthCount: Math.min(recurringMonths.size, monthRange.length),
  };
}

function buildMonthlyTrend(transactions, monthRange) {
  return monthRange.map((month) => {
    const monthTransactions = transactions.filter((transaction) => transaction.month === month);
    const incoming = monthTransactions.filter((transaction) => transaction.direction === "incoming");
    const outgoing = monthTransactions.filter((transaction) => transaction.direction === "outgoing");
    const incomingAmount = sum(incoming.map((transaction) => transaction.amount_rwf));
    const outgoingAmount = sum(
      outgoing.map((transaction) => transaction.amount_rwf + transaction.fee_rwf)
    );

    return {
      month,
      incoming_rwf: incomingAmount,
      outgoing_rwf: outgoingAmount,
      net_rwf: incomingAmount - outgoingAmount,
    };
  });
}

function getTopCounterparties(transactions) {
  const counterparties = new Map();

  transactions.forEach((transaction) => {
    const existing = counterparties.get(transaction.counterparty) || {
      id: transaction.counterparty,
      label: transaction.counterpartyLabel,
      count: 0,
      amount_rwf: 0,
    };

    existing.count += 1;
    existing.amount_rwf += Math.abs(transaction.signed_amount_rwf);
    counterparties.set(transaction.counterparty, existing);
  });

  return Array.from(counterparties.values())
    .sort((first, second) => second.amount_rwf - first.amount_rwf)
    .slice(0, 4);
}

function getBand(score) {
  if (score >= 760) return "Excellent";
  if (score >= 680) return "Strong";
  if (score >= 600) return "Watch";
  return "Build";
}

function getLoanRecommendation(score, averageMonthlyIncoming) {
  if (score < 600) {
    return "Savings-first path: review again after three stable income months.";
  }

  const multiplier = score >= 760 ? 2.2 : score >= 680 ? 1.45 : 0.8;
  const limit = Math.max(25000, Math.round((averageMonthlyIncoming * multiplier) / 1000) * 1000);
  return `Suggested seasonal credit ceiling: RWF ${limit.toLocaleString("en-US")}.`;
}

function buildScore(farmer, transactions, monthlyTrend, monthRange, metrics) {
  const incomingTransactions = transactions.filter((transaction) => transaction.direction === "incoming");
  const outgoingTransactions = transactions.filter((transaction) => transaction.direction === "outgoing");
  const monthlyIncoming = monthlyTrend.map((month) => month.incoming_rwf);
  const activeIncomeMonths = monthlyIncoming.filter((value) => value > 0).length;
  const averageIncoming = sum(monthlyIncoming) / Math.max(monthRange.length, 1);
  const incomingDeviation = standardDeviation(monthlyIncoming);
  const incomeStability = averageIncoming > 0 ? clamp(100 - (incomingDeviation / averageIncoming) * 45) : 0;
  const activeIncomeRatio = activeIncomeMonths / Math.max(monthRange.length, 1);
  const recurring = getRecurringOutgoing(transactions, monthRange);
  const incomingCounterparties = new Set(incomingTransactions.map((transaction) => transaction.counterparty));
  const totalCounterparties = new Set(transactions.map((transaction) => transaction.counterparty));
  const activeDays = new Set(transactions.map((transaction) => transaction.date));
  const netRatio = metrics.totalIncoming > 0 ? metrics.netFlow / metrics.totalIncoming : -1;

  const incomeReliability = Math.round(
    clamp(
      activeIncomeRatio * 45 +
        incomeStability * 0.35 +
        clamp((incomingTransactions.length / Math.max(monthRange.length, 1) / 3.5) * 100) * 0.2
    )
  );

  const cashflowHealth = Math.round(clamp(45 + netRatio * 55));
  const savingsDiscipline = Math.round(
    clamp(
      (recurring.monthCount / Math.max(monthRange.length, 1)) * 70 +
        clamp((recurring.groupCount / 2) * 100) * 0.2 +
        clamp((recurring.count / 12) * 100) * 0.1
    )
  );
  const marketAccess = Math.round(
    clamp(
      incomingCounterparties.size * 18 +
        clamp((incomingTransactions.length / Math.max(monthRange.length, 1) / 4) * 100) * 0.35 +
        clamp((metrics.totalIncoming / 2000000) * 100) * 0.25 +
        activeIncomeRatio * 22
    )
  );
  const digitalFootprint = Math.round(
    clamp(
      clamp((activeDays.size / 140) * 100) * 0.45 +
        clamp((transactions.length / Math.max(monthRange.length, 1) / 18) * 100) * 0.35 +
        clamp((totalCounterparties.size / 8) * 100) * 0.2
    )
  );

  const weightedScore =
    incomeReliability * scoreWeights.incomeReliability +
    cashflowHealth * scoreWeights.cashflowHealth +
    savingsDiscipline * scoreWeights.savingsDiscipline +
    marketAccess * scoreWeights.marketAccess +
    digitalFootprint * scoreWeights.digitalFootprint;
  const value = Math.round(300 + weightedScore * 5.5);

  return {
    value,
    percent: Math.round(clamp(((value - 300) / 550) * 100)),
    band: getBand(value),
    loanRecommendation: getLoanRecommendation(value, metrics.averageMonthlyIncoming),
    signals: [
      {
        key: "incomeReliability",
        label: "Income reliability",
        value: incomeReliability,
        detail: `${activeIncomeMonths}/${monthRange.length} months with incoming value`,
      },
      {
        key: "cashflowHealth",
        label: "Cashflow health",
        value: cashflowHealth,
        detail: `Net flow ${metrics.netFlow >= 0 ? "positive" : "negative"}`,
      },
      {
        key: "savingsDiscipline",
        label: "Savings discipline",
        value: savingsDiscipline,
        detail: `${recurring.monthCount} months with recurring transfers`,
      },
      {
        key: "marketAccess",
        label: "Market access",
        value: marketAccess,
        detail: `${incomingCounterparties.size} income counterparties`,
      },
      {
        key: "digitalFootprint",
        label: "Digital footprint",
        value: digitalFootprint,
        detail: `${transactions.length} MoMo records, ${outgoingTransactions.length} outgoing`,
      },
    ],
  };
}

function enrichFarmer(farmer, period) {
  const monthRange = getMonthRange(period.start, period.end);
  const transactions = buildTransactions(farmer);
  const incomingTransactions = transactions.filter((transaction) => transaction.direction === "incoming");
  const outgoingTransactions = transactions.filter((transaction) => transaction.direction === "outgoing");
  const totalIncoming = sum(incomingTransactions.map((transaction) => transaction.amount_rwf));
  const totalOutgoing = sum(
    outgoingTransactions.map((transaction) => transaction.amount_rwf + transaction.fee_rwf)
  );
  const monthlyTrend = buildMonthlyTrend(transactions, monthRange);
  const metrics = {
    totalIncoming,
    totalOutgoing,
    totalFees: sum(transactions.map((transaction) => transaction.fee_rwf)),
    netFlow: totalIncoming - totalOutgoing,
    averageMonthlyIncoming: Math.round(totalIncoming / Math.max(monthRange.length, 1)),
    activeMonths: new Set(transactions.map((transaction) => transaction.month)).size,
  };

  return {
    farmer_id: farmer.farmer_id,
    name: farmer.name,
    msisdn: farmer.msisdn,
    district: farmer.district,
    primary_activity: farmer.primary_activity,
    n_transactions: farmer.n_transactions,
    metrics,
    monthlyTrend,
    topCounterparties: getTopCounterparties(transactions),
    score: buildScore(farmer, transactions, monthlyTrend, monthRange, metrics),
    transactions,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return globalThis.Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const sourceData = loadMomoDataset();
  const farmers = sourceData.farmers.map((farmer) => enrichFarmer(farmer, sourceData.period));
  const transactionCount = farmers.reduce((total, farmer) => total + farmer.transactions.length, 0);

  return globalThis.Response.json({
    dataset: {
      name: sourceData.dataset,
      disclaimer: sourceData.disclaimer,
      currency: sourceData.currency,
      period: sourceData.period,
      source: "data/momo_transactions_synthetic.json",
      farmerCount: farmers.length,
      transactionCount,
    },
    farmers,
  });
}

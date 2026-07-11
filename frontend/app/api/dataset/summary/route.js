import { loadMomoDataset } from "../../../../lib/data";

export async function GET() {
  const sourceData = loadMomoDataset();
  const transactionCount = sourceData.farmers.reduce(
    (total, farmer) => total + (farmer.transactions?.length ?? farmer.n_transactions ?? 0),
    0
  );

  const start = new Date(`${sourceData.period.start}T00:00:00`);
  const end = new Date(`${sourceData.period.end}T00:00:00`);
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1;

  return globalThis.Response.json({
    name: sourceData.dataset,
    disclaimer: sourceData.disclaimer,
    currency: sourceData.currency,
    period: sourceData.period,
    farmerCount: sourceData.farmers.length,
    transactionCount,
    monthCount: months,
    source: "data/momo_transactions_synthetic.json",
  });
}

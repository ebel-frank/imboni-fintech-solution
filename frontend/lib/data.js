import { readFileSync } from "node:fs";
import { join } from "node:path";

let cachedDataset = null;

export function loadMomoDataset() {
  if (cachedDataset) return cachedDataset;

  const dataPath = join(process.cwd(), "..", "data", "momo_transactions_synthetic.json");
  cachedDataset = JSON.parse(readFileSync(dataPath, "utf-8"));
  return cachedDataset;
}

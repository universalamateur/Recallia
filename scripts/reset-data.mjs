import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const dataFile = process.env.RECALLIA_DATA_FILE
  ? resolve(process.env.RECALLIA_DATA_FILE)
  : resolve(process.cwd(), "data", "recallia.json");

await rm(dataFile, { force: true });
console.log(`Reset local Recallia data at ${dataFile}`);

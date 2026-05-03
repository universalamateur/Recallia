import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const dataFile = process.env.RECALLIA_DATA_FILE
  ? resolve(process.env.RECALLIA_DATA_FILE)
  : resolve(process.cwd(), "data", "recallia.json");
const defaultCodexScratchDirectory = resolve(
  tmpdir(),
  "recallia-codex-scratch"
);

await rm(dataFile, { force: true });
console.log(`Reset local Recallia data at ${dataFile}`);

await rm(defaultCodexScratchDirectory, { recursive: true, force: true });
console.log(
  `Reset default Codex scratch directory at ${defaultCodexScratchDirectory}`
);

if (
  process.env.RECALLIA_CODEX_WORKING_DIRECTORY &&
  resolve(process.env.RECALLIA_CODEX_WORKING_DIRECTORY) !==
    defaultCodexScratchDirectory
) {
  console.log(
    "Custom RECALLIA_CODEX_WORKING_DIRECTORY is operator-managed and was not removed."
  );
}

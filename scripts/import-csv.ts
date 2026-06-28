import { readFileSync } from "node:fs";
import { parseWorkoutCsv, importWorkouts } from "../src/lib/import";

/**
 * CLI: import a Barbell Logic / TurnKey workout-history CSV.
 *   npm run import -- /path/to/history.csv [--append]
 */
async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npm run import -- <path-to-csv> [--append]");
    process.exit(1);
  }
  const replace = !process.argv.includes("--append");

  console.log(`Reading ${file}…`);
  const text = readFileSync(file, "utf8");
  const rows = parseWorkoutCsv(text);
  console.log(`Parsed ${rows.length} rows. Importing (${replace ? "replace" : "append"})…`);

  const summary = await importWorkouts(rows, { replace });
  console.log("Done ✅", summary);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

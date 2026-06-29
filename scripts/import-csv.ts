import { readFileSync } from "node:fs";
import { parseWorkoutCsv, importWorkouts } from "../src/lib/import";

/**
 * CLI: import a Barbell Logic / TurnKey workout-history CSV for a user.
 *   npm run import -- /path/to/history.csv [--append] [--user=<id>]
 * Defaults to user id 1 (the first admin).
 */
async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npm run import -- <path-to-csv> [--append] [--user=<id>]");
    process.exit(1);
  }
  const replace = !process.argv.includes("--append");
  const userArg = process.argv.find((a) => a.startsWith("--user="));
  const userId = userArg ? Number(userArg.split("=")[1]) : 1;

  console.log(`Reading ${file}…`);
  const text = readFileSync(file, "utf8");
  const rows = parseWorkoutCsv(text);
  console.log(
    `Parsed ${rows.length} rows. Importing for user ${userId} (${replace ? "replace" : "append"})…`,
  );

  const summary = await importWorkouts(rows, { replace, userId });
  console.log("Done ✅", summary);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

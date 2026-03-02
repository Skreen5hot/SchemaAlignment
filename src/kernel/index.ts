/**
 * CLI Entry Point
 *
 * Reads a CISM JSON file from the command line, invokes the kernel align(),
 * and writes the canonicalized result to stdout.
 *
 * Usage: node dist/kernel/index.js <cism-file.json>
 *
 * This file is the ONLY place where I/O occurs. The align function
 * itself is pure and deterministic.
 */

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { align } from "./transform.js";
import { stableStringify } from "./canonicalize.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    process.stderr.write(
      "Usage: node dist/kernel/index.js <cism-file.json>\n"
    );
    process.exit(1);
  }

  const inputPath = resolve(args[0]);

  try {
    const raw = await readFile(inputPath, "utf-8");
    const cism = JSON.parse(raw);
    const rawHash = "sha256:" + createHash("sha256").update(raw).digest("hex");
    const result = align(cism, rawHash);
    process.stdout.write(stableStringify(result, true) + "\n");
  } catch (error) {
    if (error instanceof SyntaxError) {
      process.stderr.write(`Invalid JSON in input file: ${error.message}\n`);
    } else if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      process.stderr.write(`File not found: ${inputPath}\n`);
    } else {
      process.stderr.write(
        `Error: ${error instanceof Error ? error.message : String(error)}\n`
      );
    }
    process.exit(1);
  }
}

main();

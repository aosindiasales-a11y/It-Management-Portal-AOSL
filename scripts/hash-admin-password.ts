/**
 * Prompts for the admin password on a masked terminal line (never echoed,
 * never a command-line argument, never written to shell history) and prints
 * only its bcrypt hash — the value to put in ADMIN_PASSWORD_HASH, locally
 * and in Vercel's project environment variables. The plaintext password is
 * held only in memory for this process and is never logged.
 *
 * Reads lines into a buffer rather than chaining readline.question() calls:
 * with piped/non-TTY stdin, Node can deliver several lines in one
 * synchronous burst, and question()'s one-shot listener (re-subscribed only
 * after the previous call's promise resolves, a microtask tick later)
 * silently misses any line already emitted in that burst.
 *
 * Run with: npm run admin:hash-password
 */
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";

const rl = createInterface({ input: process.stdin, output: process.stdout });
let masking = false;

// @ts-expect-error -- readline's public types don't expose _writeToOutput,
// but it's the standard, widely-used way to mask input on a real TTY.
const originalWriteToOutput = rl._writeToOutput?.bind(rl);
if (originalWriteToOutput) {
  // @ts-expect-error -- see above.
  rl._writeToOutput = (text: string) => {
    originalWriteToOutput(masking && text !== "\r\n" && text !== "\n" ? "*" : text);
  };
}

const lines: string[] = [];
rl.on("line", (line) => lines.push(line));

function waitForLine(index: number): Promise<string> {
  return new Promise((resolve) => {
    if (lines.length > index) {
      resolve(lines[index]!);
      return;
    }
    rl.on("line", function check() {
      if (lines.length > index) {
        rl.off("line", check);
        resolve(lines[index]!);
      }
    });
  });
}

async function readMaskedLine(prompt: string, index: number): Promise<string> {
  masking = true;
  process.stdout.write(prompt);
  const line = await waitForLine(index);
  masking = false;
  process.stdout.write("\n");
  return line;
}

async function main() {
  const password = await readMaskedLine("Admin password: ", 0);
  const confirm = await readMaskedLine("Confirm password: ", 1);
  rl.close();

  if (password !== confirm) {
    console.error("Passwords didn't match.");
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  console.log("\nADMIN_PASSWORD_HASH=" + hash);
  console.log("\nCopy the line above into your .env (local) and the Vercel project's environment variables.");
}

main();

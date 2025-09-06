import { expect, test } from "bun:test";

test("Bun environment is configured", () => {
  expect(Bun.version).toBeDefined();
  expect(parseFloat(Bun.version)).toBeGreaterThanOrEqual(1.1);
});

test("TypeScript compilation works", async () => {
  const proc = Bun.spawn(["bun", "run", "typecheck"]);
  const exitCode = await proc.exited;
  expect(exitCode).toBe(0);
});
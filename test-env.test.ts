import { test } from "bun:test"; test("env", () => { console.log("NODE_ENV:", process.env.NODE_ENV); console.log("BUN:", \!\!process.env.BUN); });

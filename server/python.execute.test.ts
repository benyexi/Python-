import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("python.execute", () => {
  it("executes simple print statement", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.python.execute({
      code: 'print("hello world")',
    });

    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe("hello world");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    expect(result.executionId).toBeDefined();
  });

  it("captures stderr for syntax errors", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.python.execute({
      code: "print(hello",
    });

    expect(result.success).toBe(false);
    expect(result.stderr).toContain("SyntaxError");
    expect(result.exitCode).not.toBe(0);
  });

  it("handles multi-line code", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.python.execute({
      code: `
x = 5
y = 10
print(x + y)
`,
    });

    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe("15");
  });

  it("rejects empty code", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.python.execute({ code: "" })
    ).rejects.toThrow();
  });

  it("handles runtime errors", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.python.execute({
      code: "x = 1 / 0",
    });

    expect(result.success).toBe(false);
    expect(result.stderr).toContain("ZeroDivisionError");
  });
});

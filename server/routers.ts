import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { exec } from "child_process";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  python: router({
    execute: publicProcedure
      .input(z.object({
        code: z.string().min(1).max(50000),
      }))
      .mutation(async ({ input }) => {
        const { code } = input;
        const executionId = randomUUID();
        const tempDir = join(tmpdir(), 'pyexec');
        const filePath = join(tempDir, `${executionId}.py`);

        try {
          await mkdir(tempDir, { recursive: true });
          await writeFile(filePath, code, 'utf-8');

          const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
            exec(
              `python3 "${filePath}"`,
              {
                timeout: 10000,
                maxBuffer: 1024 * 1024,
                env: {
                  ...process.env,
                  PYTHONIOENCODING: 'utf-8',
                  PYTHONDONTWRITEBYTECODE: '1',
                },
              },
              (error, stdout, stderr) => {
                if (error && 'killed' in error && error.killed) {
                  resolve({
                    stdout: stdout || '',
                    stderr: 'Execution timed out (10s limit)',
                    exitCode: 124,
                  });
                } else {
                  resolve({
                    stdout: stdout || '',
                    stderr: stderr || '',
                    exitCode: error ? (error as any).code || 1 : 0,
                  });
                }
              }
            );
          });

          return {
            success: result.exitCode === 0,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            executionId,
          };
        } catch (err: any) {
          return {
            success: false,
            stdout: '',
            stderr: err.message || 'Unknown execution error',
            exitCode: 1,
            executionId,
          };
        } finally {
          try {
            await unlink(filePath);
          } catch {}
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;

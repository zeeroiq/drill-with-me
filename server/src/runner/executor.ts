import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import {
  ExecutionOptions,
  ExecutionResult,
  TestCaseResult,
} from './types.js';
import { checkJavaSecurity } from './security.js';
import { defaultExecutionQueue, ExecutionQueue } from './queue.js';

const DEFAULT_COMPILE_TIMEOUT_MS = 20000;
const DEFAULT_EXEC_TIMEOUT_MS = 3000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536; // 64 KB

const TEST_RESULT_REGEX =
  /---TEST_RESULT_START---([\s\S]*?)---TEST_RESULT_END---/g;
const SUMMARY_REGEX = /---SUMMARY_START---([\s\S]*?)---SUMMARY_END---/;

/**
 * Strips the temporary directory path from error strings to prevent
 * leaking internal paths to the client and make error messages clean.
 */
export function cleanPath(output: string, dir: string): string {
  if (!output) return '';
  let realDir = dir;
  try {
    realDir = fs.realpathSync(dir);
  } catch {
    // ignore
  }

  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r1 = new RegExp(escapeRegex(dir) + '[/\\\\]?', 'g');
  const r2 = new RegExp(escapeRegex(realDir) + '[/\\\\]?', 'g');

  return output.replace(r2, '').replace(r1, '').trim();
}

/**
 * Kills the process group when detached: true is used.
 */
export function killProcessGroup(child: ChildProcess): void {
  if (child.pid && !child.killed) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {
        // already exited
      }
    }
  }
}

/**
 * Parses test case results and summary from Java standard output.
 */
function parseOutput(stdout: string): {
  results: TestCaseResult[];
  passedCount: number;
  totalCount: number;
  allPassed: boolean;
} {
  const results: TestCaseResult[] = [];
  let match: RegExpExecArray | null;

  while ((match = TEST_RESULT_REGEX.exec(stdout)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else if (typeof parsed === 'object' && parsed !== null) {
        results.push(parsed as TestCaseResult);
      }
    } catch {
      // malformed JSON chunk
    }
  }

  let passedCount = 0;
  let totalCount = 0;
  let summaryAllPassed: boolean | undefined = undefined;

  const summaryMatch = SUMMARY_REGEX.exec(stdout);
  if (summaryMatch) {
    try {
      const summary = JSON.parse(summaryMatch[1].trim());
      if (typeof summary.passedCount === 'number')
        passedCount = summary.passedCount;
      if (typeof summary.totalCount === 'number')
        totalCount = summary.totalCount;
      if (typeof summary.allPassed === 'boolean')
        summaryAllPassed = summary.allPassed;
    } catch {
      // ignore
    }
  }

  if (totalCount === 0 && results.length > 0) {
    totalCount = results.length;
    passedCount = results.filter((r) => r.passed).length;
  }

  const allPassed =
    summaryAllPassed !== undefined
      ? summaryAllPassed
      : totalCount > 0 && passedCount === totalCount;

  return { results, passedCount, totalCount, allPassed };
}

/**
 * Direct compilation and execution of untrusted Java code inside an isolated temp directory.
 */
export async function executeJavaRaw(
  solutionCode: string,
  harnessCode: string,
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  const compileTimeoutMs =
    options.compileTimeoutMs || DEFAULT_COMPILE_TIMEOUT_MS;
  const timeoutMs = options.timeoutMs || DEFAULT_EXEC_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes || DEFAULT_MAX_OUTPUT_BYTES;

  // Step 1: Pre-compile static security check
  const security = checkJavaSecurity(solutionCode);
  if (!security.safe) {
    return {
      verdict: 'SECURITY_VIOLATION',
      passedCount: 0,
      totalCount: 0,
      runtime_ms: 0,
      results: [],
      errorOutput:
        security.reason || 'Security violation: forbidden API or pattern detected',
    };
  }

  // Step 2: Create isolated temp directory
  const tempDir = path.join(os.tmpdir(), `java-exec-${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Step 3: Write Solution.java and Main.java
    let fullSolution = solutionCode;
    if (
      !fullSolution.includes('import java.util') &&
      !fullSolution.startsWith('package ')
    ) {
      fullSolution = `import java.util.*;\n${fullSolution}`;
    }

    fs.writeFileSync(
      path.join(tempDir, 'Solution.java'),
      fullSolution,
      'utf-8'
    );
    fs.writeFileSync(path.join(tempDir, 'Main.java'), harnessCode, 'utf-8');

    // Step 4: Compile with javac -encoding UTF-8 Solution.java Main.java
    const compileResult = await new Promise<{
      success: boolean;
      timedOut: boolean;
      stdout: string;
      stderr: string;
    }>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(
        'javac',
        ['-encoding', 'UTF-8', 'Solution.java', 'Main.java'],
        {
          cwd: tempDir,
          detached: true,
          shell: false,
        }
      );

      const timer = setTimeout(() => {
        timedOut = true;
        killProcessGroup(child);
      }, compileTimeoutMs);

      child.stdout?.on('data', (d) => {
        stdout += d.toString();
      });
      child.stderr?.on('data', (d) => {
        stderr += d.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          success: code === 0 && !timedOut,
          timedOut,
          stdout,
          stderr,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          timedOut: false,
          stdout,
          stderr: err.message,
        });
      });
    });

    if (!compileResult.success) {
      const err = compileResult.timedOut
        ? `Compilation timed out (${compileTimeoutMs}ms limit exceeded)`
        : cleanPath(
            compileResult.stderr ||
              compileResult.stdout ||
              'Compilation failed',
            tempDir
          );

      return {
        verdict: 'COMPILE_ERROR',
        passedCount: 0,
        totalCount: 0,
        runtime_ms: 0,
        results: [],
        errorOutput: err,
        stdout: cleanPath(compileResult.stdout, tempDir),
        stderr: cleanPath(compileResult.stderr, tempDir),
      };
    }

    // Step 5: Execute with java
    const execStartTime = performance.now();

    const execResult = await new Promise<{
      code: number | null;
      signal: string | null;
      timedOut: boolean;
      outputLimitExceeded: boolean;
      stdout: string;
      stderr: string;
    }>((resolve) => {
      let stdout = '';
      let stderr = '';
      let totalBytes = 0;
      let timedOut = false;
      let outputLimitExceeded = false;

      const jvmFlags = [
        '-Xms32m',
        '-Xmx128m',
        '-XX:ActiveProcessorCount=1',
        '-XX:+ExitOnOutOfMemoryError',
        'Main',
        ...(options.isSubmit === false ? ['--visible-only'] : []),
      ];

      const child = spawn('java', jvmFlags, {
        cwd: tempDir,
        detached: true,
        shell: false,
      });

      const timer = setTimeout(() => {
        timedOut = true;
        killProcessGroup(child);
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxOutputBytes) {
          outputLimitExceeded = true;
          killProcessGroup(child);
        } else {
          stdout += chunk.toString();
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxOutputBytes) {
          outputLimitExceeded = true;
          killProcessGroup(child);
        } else {
          stderr += chunk.toString();
        }
      });

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        resolve({
          code,
          signal,
          timedOut,
          outputLimitExceeded,
          stdout,
          stderr,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          code: 1,
          signal: null,
          timedOut: false,
          outputLimitExceeded: false,
          stdout,
          stderr: err.message,
        });
      });
    });

    const runtime_ms = Math.round(performance.now() - execStartTime);

    // Step 6: Determine verdict
    if (execResult.timedOut) {
      return {
        verdict: 'TIME_LIMIT_EXCEEDED',
        passedCount: 0,
        totalCount: 0,
        runtime_ms,
        results: [],
        errorOutput: `Time Limit Exceeded (${timeoutMs}ms exceeded)`,
      };
    }

    if (execResult.outputLimitExceeded) {
      return {
        verdict: 'OUTPUT_LIMIT_EXCEEDED',
        passedCount: 0,
        totalCount: 0,
        runtime_ms,
        results: [],
        errorOutput: `Output Limit Exceeded (>${maxOutputBytes} bytes)`,
      };
    }

    const { results, passedCount, totalCount, allPassed } = parseOutput(
      execResult.stdout
    );

    const cleanedStderr = cleanPath(execResult.stderr, tempDir);
    const cleanedStdout = cleanPath(execResult.stdout, tempDir);

    // If process exited with non-zero or crashed with an exception
    if (execResult.code !== 0) {
      return {
        verdict: 'RUNTIME_ERROR',
        passedCount,
        totalCount: totalCount > 0 ? totalCount : 1,
        runtime_ms,
        results,
        errorOutput:
          cleanedStderr ||
          cleanedStdout ||
          `Runtime error: process exited with code ${execResult.code}`,
        stdout: cleanedStdout,
        stderr: cleanedStderr,
      };
    }

    // Check if any test case recorded a runtime exception in errorMessage
    const hasException = results.some(
      (r) => r.errorMessage && /Exception|Error/i.test(r.errorMessage)
    );
    if (hasException) {
      const errItem = results.find(
        (r) => r.errorMessage && /Exception|Error/i.test(r.errorMessage)
      );
      return {
        verdict: 'RUNTIME_ERROR',
        passedCount,
        totalCount,
        runtime_ms,
        results,
        errorOutput: errItem?.errorMessage || 'Runtime error during test execution',
        stdout: cleanedStdout,
        stderr: cleanedStderr,
      };
    }

    // No test results produced despite 0 exit code
    if (results.length === 0) {
      return {
        verdict: 'RUNTIME_ERROR',
        passedCount: 0,
        totalCount: 0,
        runtime_ms,
        results: [],
        errorOutput:
          cleanedStderr || 'Execution finished without producing test results',
        stdout: cleanedStdout,
        stderr: cleanedStderr,
      };
    }

    // Normal test evaluation
    if (allPassed && passedCount === totalCount) {
      return {
        verdict: 'ACCEPTED',
        passedCount,
        totalCount,
        runtime_ms,
        results,
        stdout: cleanedStdout,
        stderr: cleanedStderr,
      };
    } else {
      return {
        verdict: 'WRONG_ANSWER',
        passedCount,
        totalCount,
        runtime_ms,
        results,
        stdout: cleanedStdout,
        stderr: cleanedStderr,
      };
    }
  } finally {
    // Step 8: Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Executes untrusted Java code queued under concurrency limits.
 */
export async function executeJava(
  solutionCode: string,
  harnessCode: string,
  options: ExecutionOptions = {},
  queue: ExecutionQueue = defaultExecutionQueue
): Promise<ExecutionResult> {
  return queue.run(() => executeJavaRaw(solutionCode, harnessCode, options));
}

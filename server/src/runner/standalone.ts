import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import { checkJavaCodeSafety, stripComments } from './security.js';
import { defaultExecutionQueue, ExecutionQueue } from './queue.js';
import { cleanPath, killProcessGroup, executeJava } from './executor.js';
import type { ExecutionOptions, ExecutionResult } from './types.js';

const DEFAULT_COMPILE_TIMEOUT_MS = 5000;
const DEFAULT_EXEC_TIMEOUT_MS = 3000;
const DEFAULT_MAX_OUTPUT_BYTES = 65536; // 64 KB

export type StandaloneTestStatus =
  | 'PASSED'
  | 'FAILED'
  | 'EXECUTED'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'OUTPUT_LIMIT_EXCEEDED';

export type StandaloneVerdict =
  | 'EXECUTED'
  | 'PASSED'
  | 'FAILED'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'SECURITY_VIOLATION'
  | 'OUTPUT_LIMIT_EXCEEDED';

export interface StandaloneTestCase {
  stdin?: string;
  expected_output?: string;
}

export interface StandaloneTestCaseResult {
  stdin: string;
  expectedOutput?: string;
  actualOutput: string;
  passed: boolean;
  status: StandaloneTestStatus;
  stdout: string;
  stderr: string;
  runtime_ms: number;
  errorMessage?: string;
}

export interface StandaloneExecutionOptions {
  timeoutMs?: number;
  compileTimeoutMs?: number;
  maxOutputBytes?: number;
}

export interface StandaloneExecutionResult {
  verdict: StandaloneVerdict;
  passedCount: number;
  totalCount: number;
  runtime_ms: number;
  results: StandaloneTestCaseResult[];
  errorOutput?: string;
  outputSummary?: string;
}

/**
 * Extracts the primary class name from Java code.
 * Follows Java naming rules:
 * 1. If public class declaration exists, its name must match the filename.
 * 2. If a class named Main exists, prefer it.
 * 3. Otherwise, use the first class declared.
 */
export function extractClassName(code: string): string | null {
  if (!code || typeof code !== 'string') return null;
  const stripped = stripComments(code);

  // 1. Look for public class declaration (mandatory match in Java)
  const publicClassMatch = stripped.match(
    /\bpublic\s+(?:final\s+|abstract\s+)*class\s+([A-Za-z0-9_$]+)\b(?:\s*<[^>]+>)?[\s\S]*?\{/
  );
  if (publicClassMatch) {
    return publicClassMatch[1];
  }

  // 2. Look for any class named Main
  const mainClassMatch = stripped.match(
    /\bclass\s+(Main)\b(?:\s*<[^>]+>)?[\s\S]*?\{/
  );
  if (mainClassMatch) {
    return mainClassMatch[1];
  }

  // 3. Fallback to first class declared with a class body
  const classMatch = stripped.match(
    /\bclass\s+([A-Za-z0-9_$]+)\b(?:\s*<[^>]+>)?[\s\S]*?\{/
  );
  if (classMatch) {
    return classMatch[1];
  }

  return null;
}

/**
 * Executes a single test case using the compiled Java class.
 */
async function runSingleTestCase(
  className: string,
  tempDir: string,
  stdin: string,
  timeoutMs: number,
  maxOutputBytes: number
): Promise<{
  code: number | null;
  signal: string | null;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
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
      className,
    ];

    const child: ChildProcess = spawn('java', jvmFlags, {
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

    if (child.stdin) {
      child.stdin.on('error', () => {
        // Suppress EPIPE errors if child exits before reading stdin
      });

      if (stdin) {
        child.stdin.write(stdin);
      }
      child.stdin.end();
    }

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        timedOut,
        outputLimitExceeded,
        stdout: cleanPath(stdout, tempDir),
        stderr: cleanPath(stderr, tempDir),
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        code: 1,
        signal: null,
        timedOut: false,
        outputLimitExceeded: false,
        stdout: cleanPath(stdout, tempDir),
        stderr: cleanPath(err.message, tempDir),
      });
    });
  });
}

/**
 * Direct execution of untrusted standalone Java code without concurrency queue.
 */
export async function executeStandaloneJavaRaw(
  code: string,
  testCases: StandaloneTestCase[] = [],
  options: StandaloneExecutionOptions = {}
): Promise<StandaloneExecutionResult> {
  const compileTimeoutMs = options.compileTimeoutMs ?? DEFAULT_COMPILE_TIMEOUT_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_EXEC_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

  // 1. Security static check via checkJavaCodeSafety
  const safety = checkJavaCodeSafety(code);
  if (!safety.safe) {
    return {
      verdict: 'SECURITY_VIOLATION',
      passedCount: 0,
      totalCount: 0,
      runtime_ms: 0,
      results: [],
      errorOutput: safety.reason || 'Security violation: forbidden API or pattern detected',
      outputSummary: 'Execution blocked by security policy',
    };
  }

  // 2. Parse/normalize class name
  const className = extractClassName(code);
  if (!className) {
    return {
      verdict: 'COMPILE_ERROR',
      passedCount: 0,
      totalCount: 0,
      runtime_ms: 0,
      results: [],
      errorOutput: 'Compilation error: No class declaration found in Java source code',
      outputSummary: 'Compilation failed: missing class declaration',
    };
  }

  // Create isolated temporary directory
  const tempDir = path.join(os.tmpdir(), `java-exec-${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const runStartTime = performance.now();

  try {
    // Auto-import java.util.* if not present and no package declared
    let sourceCode = code;
    if (!sourceCode.includes('import java.util') && !/^\s*package\s+/m.test(sourceCode)) {
      sourceCode = `import java.util.*;\n${sourceCode}`;
    }

    const javaFilePath = path.join(tempDir, `${className}.java`);
    fs.writeFileSync(javaFilePath, sourceCode, 'utf-8');

    // 3. Compile with javac -encoding UTF-8 ${className}.java
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
        ['-encoding', 'UTF-8', `${className}.java`],
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
            compileResult.stderr || compileResult.stdout || 'Compilation failed',
            tempDir
          );

      return {
        verdict: 'COMPILE_ERROR',
        passedCount: 0,
        totalCount: 0,
        runtime_ms: 0,
        results: [],
        errorOutput: err,
        outputSummary: 'Compilation failed',
      };
    }

    // 4. Test case normalization: default to 1 case with empty stdin, max 10 test cases
    const effectiveTestCases =
      !testCases || testCases.length === 0
        ? [{ stdin: '', expected_output: undefined }]
        : testCases.slice(0, 10);

    const results: StandaloneTestCaseResult[] = [];

    // 5. Run each test case
    for (const testCase of effectiveTestCases) {
      const tcStartTime = performance.now();
      const execResult = await runSingleTestCase(
        className,
        tempDir,
        testCase.stdin || '',
        timeoutMs,
        maxOutputBytes
      );
      const tcRuntime = Math.round(performance.now() - tcStartTime);

      let status: StandaloneTestStatus;
      let passed = false;
      let errorMessage: string | undefined = undefined;

      const expectedStr =
        testCase.expected_output !== undefined && testCase.expected_output !== null
          ? String(testCase.expected_output)
          : undefined;
      const hasExpected = expectedStr !== undefined && expectedStr.trim() !== '';

      if (execResult.timedOut) {
        status = 'TIME_LIMIT_EXCEEDED';
        passed = false;
        errorMessage = `Time Limit Exceeded (${timeoutMs}ms exceeded)`;
      } else if (execResult.outputLimitExceeded) {
        status = 'OUTPUT_LIMIT_EXCEEDED';
        passed = false;
        errorMessage = `Output Limit Exceeded (>${maxOutputBytes} bytes)`;
      } else if (execResult.code !== 0) {
        status = 'RUNTIME_ERROR';
        passed = false;
        errorMessage =
          execResult.stderr ||
          execResult.stdout ||
          `Process exited with code ${execResult.code}`;
      } else {
        // Code 0 execution
        if (hasExpected) {
          const trimmedActual = execResult.stdout.trim();
          const trimmedExpected = expectedStr!.trim();
          if (trimmedActual === trimmedExpected) {
            status = 'PASSED';
            passed = true;
          } else {
            status = 'FAILED';
            passed = false;
            errorMessage = `Expected "${trimmedExpected}", got "${trimmedActual}"`;
          }
        } else {
          status = 'EXECUTED';
          passed = true;
        }
      }

      results.push({
        stdin: testCase.stdin || '',
        expectedOutput: expectedStr,
        actualOutput: execResult.stdout.trim(),
        passed,
        status,
        stdout: execResult.stdout,
        stderr: execResult.stderr,
        runtime_ms: tcRuntime,
        errorMessage,
      });
    }

    const totalRuntimeMs = Math.round(performance.now() - runStartTime);

    // 6. Calculate overall verdict
    let overallVerdict: StandaloneVerdict;
    const hasTimeout = results.some((r) => r.status === 'TIME_LIMIT_EXCEEDED');
    const hasOutputLimit = results.some((r) => r.status === 'OUTPUT_LIMIT_EXCEEDED');
    const hasRuntimeError = results.some((r) => r.status === 'RUNTIME_ERROR');
    const hasFailed = results.some((r) => r.status === 'FAILED');

    if (hasTimeout) {
      overallVerdict = 'TIME_LIMIT_EXCEEDED';
    } else if (hasOutputLimit) {
      overallVerdict = 'OUTPUT_LIMIT_EXCEEDED';
    } else if (hasRuntimeError) {
      overallVerdict = 'RUNTIME_ERROR';
    } else if (hasFailed) {
      overallVerdict = 'FAILED';
    } else {
      const anyExpected = effectiveTestCases.some(
        (tc) => typeof tc.expected_output === 'string' && tc.expected_output.trim() !== ''
      );
      overallVerdict = anyExpected ? 'PASSED' : 'EXECUTED';
    }

    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;

    let errorOutput: string | undefined = undefined;
    if (overallVerdict === 'TIME_LIMIT_EXCEEDED') {
      errorOutput =
        results.find((r) => r.status === 'TIME_LIMIT_EXCEEDED')?.errorMessage ||
        'Time Limit Exceeded';
    } else if (overallVerdict === 'OUTPUT_LIMIT_EXCEEDED') {
      errorOutput =
        results.find((r) => r.status === 'OUTPUT_LIMIT_EXCEEDED')?.errorMessage ||
        'Output Limit Exceeded';
    } else if (overallVerdict === 'RUNTIME_ERROR') {
      errorOutput =
        results.find((r) => r.status === 'RUNTIME_ERROR')?.errorMessage ||
        'Runtime Error';
    } else if (overallVerdict === 'FAILED') {
      errorOutput =
        results.find((r) => r.status === 'FAILED')?.errorMessage ||
        'One or more test cases failed';
    }

    let outputSummary = '';
    if (overallVerdict === 'PASSED' || overallVerdict === 'FAILED') {
      outputSummary = `${passedCount}/${totalCount} test cases passed`;
    } else if (overallVerdict === 'EXECUTED') {
      outputSummary = `${totalCount} test case${totalCount === 1 ? '' : 's'} executed`;
    } else {
      outputSummary = `Execution stopped with ${overallVerdict}`;
    }

    return {
      verdict: overallVerdict,
      passedCount,
      totalCount,
      runtime_ms: totalRuntimeMs,
      results,
      errorOutput,
      outputSummary,
    };
  } finally {
    // 7. Always clean temp dir
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Executes untrusted standalone Java code queued under concurrency limits.
 */
export async function executeStandaloneJava(
  code: string,
  testCases: StandaloneTestCase[] = [],
  options: StandaloneExecutionOptions = {},
  queue: ExecutionQueue = defaultExecutionQueue
): Promise<StandaloneExecutionResult> {
  return queue.run(() => executeStandaloneJavaRaw(code, testCases, options));
}

/**
 * Dry-runs a problem harness and test cases against a reference solution.
 * Reuses executeJava to verify that the draft harness compiles and passes.
 */
export async function dryRunProblem(
  harnessCode: string,
  testCases: Array<{ input_payload?: string; expected_output: string }>,
  solutionCode: string,
  options?: ExecutionOptions
): Promise<ExecutionResult> {
  if (!solutionCode || typeof solutionCode !== 'string' || !solutionCode.trim()) {
    return {
      verdict: 'COMPILE_ERROR',
      passedCount: 0,
      totalCount: 0,
      runtime_ms: 0,
      results: [],
      errorOutput: 'Solution code is required',
    };
  }

  if (!harnessCode || typeof harnessCode !== 'string' || !harnessCode.trim()) {
    return {
      verdict: 'COMPILE_ERROR',
      passedCount: 0,
      totalCount: 0,
      runtime_ms: 0,
      results: [],
      errorOutput: 'Test harness code is required',
    };
  }

  return executeJava(solutionCode, harnessCode, {
    isSubmit: true,
    ...options,
  });
}

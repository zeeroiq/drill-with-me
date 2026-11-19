export type ExecutionVerdict =
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'SECURITY_VIOLATION'
  | 'OUTPUT_LIMIT_EXCEEDED';

export interface TestCaseResult {
  testIndex: number;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  errorMessage?: string;
}

export interface ExecutionResult {
  verdict: ExecutionVerdict;
  passedCount: number;
  totalCount: number;
  runtime_ms: number;
  results: TestCaseResult[];
  errorOutput?: string;
  stdout?: string;
  stderr?: string;
}

export interface ExecutionOptions {
  isSubmit?: boolean;
  timeoutMs?: number;
  compileTimeoutMs?: number;
  maxOutputBytes?: number;
}

export interface SecurityCheckResult {
  safe: boolean;
  reason?: string;
}

import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import type { CustomProblem, CustomProblemRun } from '../db/schema.js';
import { executeStandaloneJava, type StandaloneTestCase } from '../runner/index.js';
import '../types.js';

export const customProblemsRouter = Router();

// Payload limits
const MAX_STATEMENT_BYTES = 20 * 1024; // 20 KB
const MAX_CODE_BYTES = 50 * 1024; // 50 KB
const MAX_TEST_CASES = 10;
const MAX_TEST_CASE_BYTES = 16 * 1024; // 16 KB

// Rate limiting: 15 runs per minute per visitor/IP
const RUN_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_RUNS_PER_MINUTE = 15;
const runAttempts = new Map<string, number[]>();

export function resetCustomRunRateLimits(): void {
  runAttempts.clear();
}

function checkRunRateLimit(key: string): boolean {
  const now = Date.now();
  const windowStart = now - RUN_RATE_LIMIT_WINDOW_MS;
  const timestamps = (runAttempts.get(key) || []).filter((t) => t > windowStart);

  if (timestamps.length >= MAX_RUNS_PER_MINUTE) {
    return false;
  }

  timestamps.push(now);
  runAttempts.set(key, timestamps);
  return true;
}

function computeStatementHash(statement?: string | null): string | null {
  if (!statement || typeof statement !== 'string') return null;
  const trimmed = statement.trim().toLowerCase();
  if (!trimmed) return null;
  return crypto.createHash('sha256').update(trimmed).digest('hex');
}

function validatePayload(body: {
  problem_statement?: unknown;
  code?: unknown;
  custom_test_cases?: unknown;
}): string | null {
  if (
    typeof body.problem_statement === 'string' &&
    Buffer.byteLength(body.problem_statement, 'utf8') > MAX_STATEMENT_BYTES
  ) {
    return 'Problem statement exceeds 20KB limit';
  }

  if (
    typeof body.code === 'string' &&
    Buffer.byteLength(body.code, 'utf8') > MAX_CODE_BYTES
  ) {
    return 'Code exceeds 50KB limit';
  }

  if (body.custom_test_cases !== undefined) {
    if (!Array.isArray(body.custom_test_cases)) {
      return 'custom_test_cases must be an array';
    }
    if (body.custom_test_cases.length > MAX_TEST_CASES) {
      return 'Maximum 10 custom test cases allowed';
    }
    for (let i = 0; i < body.custom_test_cases.length; i++) {
      const tc = body.custom_test_cases[i];
      if (typeof tc !== 'object' || tc === null) {
        return `Test case #${i + 1} is invalid`;
      }
      if (
        typeof tc.stdin === 'string' &&
        Buffer.byteLength(tc.stdin, 'utf8') > MAX_TEST_CASE_BYTES
      ) {
        return `Test case #${i + 1} stdin exceeds 16KB limit`;
      }
      if (
        typeof tc.expected_output === 'string' &&
        Buffer.byteLength(tc.expected_output, 'utf8') > MAX_TEST_CASE_BYTES
      ) {
        return `Test case #${i + 1} expected_output exceeds 16KB limit`;
      }
    }
  }

  return null;
}

const DEFAULT_STARTER_CODE = `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Write your solution here
    }
}
`;

/**
 * POST /api/custom-problems
 * Creates a new custom problem tied to req.visitorId.
 */
customProblemsRouter.post('/', (req: Request, res: Response) => {
  const visitorId = req.visitorId;
  if (!visitorId) {
    res.status(400).json({ error: 'Visitor ID is required' });
    return;
  }

  const { title, problem_statement, code, custom_test_cases } = req.body || {};

  const validationError = validatePayload({ problem_statement, code, custom_test_cases });
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const id = uuidv4();
  const statementStr = typeof problem_statement === 'string' ? problem_statement : '';
  const statementHash = computeStatementHash(statementStr);
  const titleStr = typeof title === 'string' ? title.trim() : '';
  const codeStr = typeof code === 'string' ? code : DEFAULT_STARTER_CODE;
  const testCasesJson = Array.isArray(custom_test_cases)
    ? JSON.stringify(custom_test_cases)
    : '[]';

  const db = getDb();
  db.prepare(`
    INSERT INTO custom_problems (
      id, visitor_id, title, problem_statement, statement_hash, code, custom_test_cases_json, promoted_problem_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'), datetime('now'))
  `).run(id, visitorId, titleStr, statementStr, statementHash, codeStr, testCasesJson);

  res.status(201).json({ id });
});

/**
 * GET /api/custom-problems
 * Lists all custom problems belonging to the current visitor, ordered by updated_at DESC.
 */
customProblemsRouter.get('/', (req: Request, res: Response) => {
  const visitorId = req.visitorId;
  if (!visitorId) {
    res.status(400).json({ error: 'Visitor ID is required' });
    return;
  }

  const db = getDb();
  const problems = db.prepare(`
    SELECT 
      cp.id,
      cp.visitor_id,
      cp.title,
      cp.problem_statement,
      cp.statement_hash,
      cp.code,
      cp.custom_test_cases_json,
      cp.promoted_problem_id,
      cp.created_at,
      cp.updated_at,
      (SELECT COUNT(*) FROM custom_problem_runs cpr WHERE cpr.custom_problem_id = cp.id) as run_count
    FROM custom_problems cp
    WHERE cp.visitor_id = ?
    ORDER BY cp.updated_at DESC
  `).all(visitorId) as Array<CustomProblem & { run_count: number }>;

  const result = problems.map((p) => {
    let customTestCases: any[] = [];
    try {
      customTestCases = JSON.parse(p.custom_test_cases_json || '[]');
    } catch {
      customTestCases = [];
    }

    return {
      id: p.id,
      visitor_id: p.visitor_id,
      title: p.title,
      problem_statement: p.problem_statement,
      statement_hash: p.statement_hash,
      code: p.code,
      custom_test_cases: customTestCases,
      customTestCases,
      promoted_problem_id: p.promoted_problem_id,
      is_promoted: p.promoted_problem_id !== null,
      created_at: p.created_at,
      updated_at: p.updated_at,
      run_count: p.run_count,
    };
  });

  res.json(result);
});

/**
 * GET /api/custom-problems/:id
 * Fetches problem details only if requester is the owner (visitor_id === req.visitorId).
 */
customProblemsRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const visitorId = req.visitorId;

  if (!visitorId) {
    res.status(400).json({ error: 'Visitor ID is required' });
    return;
  }

  const db = getDb();
  const problem = db.prepare(`
    SELECT * FROM custom_problems WHERE id = ?
  `).get(id) as CustomProblem | undefined;

  if (!problem) {
    res.status(404).json({ error: 'Custom problem not found' });
    return;
  }

  if (problem.visitor_id !== visitorId) {
    res.status(403).json({ error: 'Forbidden: You do not own this custom problem' });
    return;
  }

  let customTestCases: any[] = [];
  try {
    customTestCases = JSON.parse(problem.custom_test_cases_json || '[]');
  } catch {
    customTestCases = [];
  }

  const runs = db.prepare(`
    SELECT 
      id,
      custom_problem_id,
      code,
      verdict,
      passed_count,
      total_count,
      runtime_ms,
      output_summary,
      error_output,
      created_at
    FROM custom_problem_runs
    WHERE custom_problem_id = ?
    ORDER BY id DESC
    LIMIT 20
  `).all(id) as CustomProblemRun[];

  res.json({
    id: problem.id,
    visitor_id: problem.visitor_id,
    title: problem.title,
    problem_statement: problem.problem_statement,
    statement_hash: problem.statement_hash,
    code: problem.code,
    custom_test_cases: customTestCases,
    customTestCases,
    promoted_problem_id: problem.promoted_problem_id,
    is_promoted: problem.promoted_problem_id !== null,
    created_at: problem.created_at,
    updated_at: problem.updated_at,
    runs,
  });
});

/**
 * PUT /api/custom-problems/:id
 * Auto-saves or updates problem. Enforces ownership check (visitor_id === req.visitorId).
 */
customProblemsRouter.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const visitorId = req.visitorId;

  if (!visitorId) {
    res.status(400).json({ error: 'Visitor ID is required' });
    return;
  }

  const db = getDb();
  const problem = db.prepare('SELECT * FROM custom_problems WHERE id = ?').get(id) as CustomProblem | undefined;

  if (!problem) {
    res.status(404).json({ error: 'Custom problem not found' });
    return;
  }

  if (problem.visitor_id !== visitorId) {
    res.status(403).json({ error: 'Forbidden: You do not own this custom problem' });
    return;
  }

  const { title, problem_statement, code, custom_test_cases } = req.body || {};

  const validationError = validatePayload({ problem_statement, code, custom_test_cases });
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const updatedTitle = typeof title === 'string' ? title.trim() : problem.title;
  const updatedStatement = typeof problem_statement === 'string' ? problem_statement : problem.problem_statement;
  const updatedHash = computeStatementHash(updatedStatement);
  const updatedCode = typeof code === 'string' ? code : problem.code;
  const updatedTestCasesJson = Array.isArray(custom_test_cases)
    ? JSON.stringify(custom_test_cases)
    : problem.custom_test_cases_json;

  db.prepare(`
    UPDATE custom_problems SET
      title = ?,
      problem_statement = ?,
      statement_hash = ?,
      code = ?,
      custom_test_cases_json = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(updatedTitle, updatedStatement, updatedHash, updatedCode, updatedTestCasesJson, id);

  res.json({ success: true });
});

/**
 * POST /api/custom-problems/:id/run
 * Executes code against custom test cases in Standalone Mode.
 * Enforces ownership check, rate limit, auto-saves optionally provided fields,
 * and logs to custom_problem_runs.
 */
customProblemsRouter.post('/:id/run', async (req: Request, res: Response) => {
  const { id } = req.params;
  const visitorId = req.visitorId;

  if (!visitorId) {
    res.status(400).json({ error: 'Visitor ID is required' });
    return;
  }

  const db = getDb();
  const problem = db.prepare('SELECT * FROM custom_problems WHERE id = ?').get(id) as CustomProblem | undefined;

  if (!problem) {
    res.status(404).json({ error: 'Custom problem not found' });
    return;
  }

  if (problem.visitor_id !== visitorId) {
    res.status(403).json({ error: 'Forbidden: You do not own this custom problem' });
    return;
  }

  // Rate limiting check
  const rateLimitKey = `${visitorId}:${req.ip || 'local'}`;
  if (!checkRunRateLimit(rateLimitKey)) {
    res.status(429).json({ error: 'Rate limit exceeded: Maximum 15 runs per minute allowed' });
    return;
  }

  const { title, problem_statement, code, custom_test_cases } = req.body || {};

  // Validate any provided fields
  const validationError = validatePayload({ problem_statement, code, custom_test_cases });
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  // Optional auto-save
  const hasUpdates =
    title !== undefined ||
    problem_statement !== undefined ||
    code !== undefined ||
    custom_test_cases !== undefined;

  let currentTitle = problem.title;
  let currentStatement = problem.problem_statement;
  let currentHash = problem.statement_hash;
  let currentCode = problem.code;
  let currentTestCasesJson = problem.custom_test_cases_json;

  if (hasUpdates) {
    currentTitle = typeof title === 'string' ? title.trim() : problem.title;
    currentStatement = typeof problem_statement === 'string' ? problem_statement : problem.problem_statement;
    currentHash = computeStatementHash(currentStatement);
    currentCode = typeof code === 'string' ? code : problem.code;
    currentTestCasesJson = Array.isArray(custom_test_cases)
      ? JSON.stringify(custom_test_cases)
      : problem.custom_test_cases_json;

    db.prepare(`
      UPDATE custom_problems SET
        title = ?,
        problem_statement = ?,
        statement_hash = ?,
        code = ?,
        custom_test_cases_json = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(currentTitle, currentStatement, currentHash, currentCode, currentTestCasesJson, id);
  }

  if (!currentCode || !currentCode.trim()) {
    res.status(400).json({ error: 'Code is required' });
    return;
  }

  // Parse test cases
  let testCasesToRun: StandaloneTestCase[] = [];
  try {
    testCasesToRun = JSON.parse(currentTestCasesJson || '[]');
  } catch {
    testCasesToRun = [];
  }

  try {
    const execResult = await executeStandaloneJava(currentCode, testCasesToRun);

    const outputSummary = execResult.outputSummary || (
      execResult.verdict === 'COMPILE_ERROR'
        ? execResult.errorOutput
        : `${execResult.passedCount}/${execResult.totalCount} passed (${execResult.runtime_ms}ms)`
    );

    // Record into custom_problem_runs
    const insertRun = db.prepare(`
      INSERT INTO custom_problem_runs (
        custom_problem_id,
        visitor_id,
        code,
        verdict,
        passed_count,
        total_count,
        runtime_ms,
        output_summary,
        error_output,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    insertRun.run(
      id,
      visitorId,
      currentCode,
      execResult.verdict,
      execResult.passedCount,
      execResult.totalCount,
      execResult.runtime_ms,
      outputSummary,
      execResult.errorOutput || null
    );

    res.json({
      verdict: execResult.verdict,
      passedCount: execResult.passedCount,
      passed_count: execResult.passedCount,
      totalCount: execResult.totalCount,
      total_count: execResult.totalCount,
      runtime_ms: execResult.runtime_ms,
      results: execResult.results,
      testResults: execResult.results,
      outputSummary,
      output_summary: outputSummary,
      errorOutput: execResult.errorOutput,
      error_output: execResult.errorOutput,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Execution error';
    res.status(500).json({ error: message, verdict: 'INTERNAL_ERROR' });
  }
});

export default customProblemsRouter;

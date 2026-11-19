import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { Problem } from '../db/schema.js';
import { executeJava } from '../runner/executor.js';
import { EXECUTION_TIMEOUT_MS, COMPILE_TIMEOUT_MS } from '../config.js';
import '../types.js';

export const executeRouter = Router();

/**
 * POST /api/problems/:slug/run
 * Runs user code against visible sample test cases without persisting in submissions table.
 */
executeRouter.post('/:slug/run', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { code } = req.body;

  if (typeof code !== 'string' || !code.trim()) {
    res.status(400).json({ error: 'Code is required' });
    return;
  }

  const db = getDb();
  const problem = db.prepare('SELECT * FROM problems WHERE slug = ? AND COALESCE(is_published, 1) = 1').get(slug) as Problem | undefined;

  if (!problem) {
    res.status(404).json({ error: 'Problem not found' });
    return;
  }

  try {
    const execResult = await executeJava(code, problem.test_harness_code, {
      isSubmit: false,
      timeoutMs: EXECUTION_TIMEOUT_MS,
      compileTimeoutMs: COMPILE_TIMEOUT_MS,
    });

    res.json({
      verdict: execResult.verdict,
      passedCount: execResult.passedCount,
      passed_count: execResult.passedCount,
      totalCount: execResult.totalCount,
      total_count: execResult.totalCount,
      runtime_ms: execResult.runtime_ms,
      testResults: execResult.results,
      results: execResult.results,
      test_cases: execResult.results.map((r) => ({
        passed: r.passed,
        input_display: r.input,
        expected_output: r.expected,
        actual_output: r.actual,
        error: r.errorMessage,
      })),
      compileErrors: execResult.verdict === 'COMPILE_ERROR' ? execResult.errorOutput : undefined,
      errorOutput: execResult.errorOutput,
      error_output: execResult.errorOutput,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Execution error';
    res.status(500).json({ error: message, verdict: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/problems/:slug/submit
 * Runs user code against all test cases (visible & hidden) and stores the result in submissions table.
 */
executeRouter.post('/:slug/submit', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { code } = req.body;
  const visitorId = req.visitorId;

  if (typeof code !== 'string' || !code.trim()) {
    res.status(400).json({ error: 'Code is required' });
    return;
  }

  if (!visitorId) {
    res.status(400).json({ error: 'Visitor ID is required' });
    return;
  }

  const db = getDb();
  const problem = db.prepare('SELECT * FROM problems WHERE slug = ? AND COALESCE(is_published, 1) = 1').get(slug) as Problem | undefined;

  if (!problem) {
    res.status(404).json({ error: 'Problem not found' });
    return;
  }

  try {
    const execResult = await executeJava(code, problem.test_harness_code, {
      isSubmit: true,
      timeoutMs: EXECUTION_TIMEOUT_MS,
      compileTimeoutMs: COMPILE_TIMEOUT_MS,
    });

    const insertSubmission = db.prepare(`
      INSERT INTO submissions (visitor_id, problem_id, code, verdict, passed_count, total_count, runtime_ms, error_output, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const info = insertSubmission.run(
      visitorId,
      problem.id,
      code,
      execResult.verdict,
      execResult.passedCount,
      execResult.totalCount,
      execResult.runtime_ms,
      execResult.errorOutput || null
    );

    const submissionId = Number(info.lastInsertRowid);

    res.json({
      submission_id: submissionId,
      submissionId: submissionId,
      verdict: execResult.verdict,
      isSolved: execResult.verdict === 'ACCEPTED',
      solved: execResult.verdict === 'ACCEPTED',
      passedCount: execResult.passedCount,
      passed_count: execResult.passedCount,
      totalCount: execResult.totalCount,
      total_count: execResult.totalCount,
      runtime_ms: execResult.runtime_ms,
      testResults: execResult.results,
      results: execResult.results,
      test_cases: execResult.results.map((r) => ({
        passed: r.passed,
        input_display: r.input,
        expected_output: r.expected,
        actual_output: r.actual,
        error: r.errorMessage,
      })),
      compileErrors: execResult.verdict === 'COMPILE_ERROR' ? execResult.errorOutput : undefined,
      errorOutput: execResult.errorOutput,
      error_output: execResult.errorOutput,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Submission error';
    res.status(500).json({ error: message, verdict: 'INTERNAL_ERROR' });
  }
});

export default executeRouter;

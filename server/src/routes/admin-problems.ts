import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { Problem, TestCase } from '../db/schema.js';
import { requireAdmin } from '../middleware/auth.js';
import { executeJava, dryRunProblem } from '../runner/index.js';
import { EXECUTION_TIMEOUT_MS, COMPILE_TIMEOUT_MS } from '../config.js';
import '../types.js';

export const adminProblemsRouter = Router();

// Apply admin authentication to all routes in this router
adminProblemsRouter.use(requireAdmin);

/**
 * GET /api/admin/problems
 * Returns all problems (published and drafts) ordered by id DESC.
 */
adminProblemsRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb();

  const problems = db.prepare(`
    SELECT 
      p.id, 
      p.slug, 
      p.title, 
      p.difficulty, 
      COALESCE(p.is_published, 1) AS is_published, 
      p.created_at, 
      p.updated_at,
      (SELECT COUNT(*) FROM test_cases tc WHERE tc.problem_id = p.id) AS testCasesCount,
      (SELECT COUNT(*) FROM submissions s WHERE s.problem_id = p.id) AS submissionsCount,
      (SELECT COUNT(*) FROM submissions s WHERE s.problem_id = p.id AND s.verdict = 'ACCEPTED') AS acceptedSubmissionsCount
    FROM problems p
    ORDER BY p.id DESC
  `).all() as Array<{
    id: number;
    slug: string;
    title: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    is_published: number;
    created_at: string;
    updated_at: string | null;
    testCasesCount: number;
    submissionsCount: number;
    acceptedSubmissionsCount: number;
  }>;

  const result = problems.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    is_published: p.is_published,
    isPublished: p.is_published === 1,
    created_at: p.created_at,
    updated_at: p.updated_at,
    testCasesCount: p.testCasesCount,
    submissionsCount: p.submissionsCount,
    acceptedSubmissionsCount: p.acceptedSubmissionsCount,
  }));

  res.json(result);
});

/**
 * POST /api/admin/problems/dry-run
 * Executes draft solution and harness against sandbox without saving to database.
 */
adminProblemsRouter.post('/dry-run', async (req: Request, res: Response) => {
  const { test_harness_code, solution_code, test_cases } = req.body || {};

  if (!test_harness_code || typeof test_harness_code !== 'string' || !test_harness_code.trim()) {
    res.status(400).json({ error: 'Test harness code is required' });
    return;
  }

  if (!solution_code || typeof solution_code !== 'string' || !solution_code.trim()) {
    res.status(400).json({ error: 'Solution code is required' });
    return;
  }

  try {
    const execResult = await executeJava(solution_code, test_harness_code, {
      isSubmit: true,
      timeoutMs: EXECUTION_TIMEOUT_MS,
      compileTimeoutMs: COMPILE_TIMEOUT_MS,
    });

    res.json({
      verdict: execResult.verdict,
      passedCount: execResult.passedCount,
      totalCount: execResult.totalCount,
      runtime_ms: execResult.runtime_ms,
      testResults: execResult.results,
      results: execResult.results,
      compilerErrors: execResult.verdict === 'COMPILE_ERROR' ? execResult.errorOutput : undefined,
      runtimeErrors: execResult.verdict === 'RUNTIME_ERROR' ? execResult.errorOutput : undefined,
      errorOutput: execResult.errorOutput,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Execution error';
    res.status(500).json({ error: message, verdict: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/admin/problems/:id
 * Returns full problem details including starter_code, test_harness_code, and test cases.
 */
adminProblemsRouter.get('/:id', (req: Request, res: Response) => {
  const idStr = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid problem ID' });
    return;
  }

  const db = getDb();
  const problem = db.prepare(`
    SELECT 
      id, 
      slug, 
      title, 
      difficulty, 
      description_md, 
      starter_code, 
      test_harness_code, 
      COALESCE(is_published, 1) AS is_published, 
      created_at, 
      updated_at
    FROM problems
    WHERE id = ?
  `).get(id) as Problem | undefined;

  if (!problem) {
    res.status(404).json({ error: 'Problem not found' });
    return;
  }

  const testCases = db.prepare(`
    SELECT id, input_display, input_payload, expected_output, is_hidden, sort_order
    FROM test_cases
    WHERE problem_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(id) as TestCase[];

  res.json({
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    description_md: problem.description_md,
    starter_code: problem.starter_code,
    test_harness_code: problem.test_harness_code,
    is_published: problem.is_published,
    isPublished: problem.is_published === 1,
    created_at: problem.created_at,
    updated_at: problem.updated_at,
    test_cases: testCases,
    testCases,
  });
});

/**
 * POST /api/admin/problems
 * Create a new problem with test cases in a single transaction.
 */
adminProblemsRouter.post('/', (req: Request, res: Response) => {
  const {
    title,
    slug,
    difficulty,
    description_md,
    starter_code,
    test_harness_code,
    is_published,
    test_cases,
    source_custom_problem_id,
  } = req.body || {};

  // Validation
  if (!title || typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  if (!slug || typeof slug !== 'string' || !slug.trim()) {
    res.status(400).json({ error: 'Slug is required' });
    return;
  }

  const normalizedSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
    res.status(400).json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' });
    return;
  }

  if (!difficulty || !['Easy', 'Medium', 'Hard'].includes(difficulty)) {
    res.status(400).json({ error: "Difficulty must be 'Easy', 'Medium', or 'Hard'" });
    return;
  }

  if (!description_md || typeof description_md !== 'string' || !description_md.trim()) {
    res.status(400).json({ error: 'Description is required' });
    return;
  }

  if (!starter_code || typeof starter_code !== 'string' || !starter_code.trim()) {
    res.status(400).json({ error: 'Starter code is required' });
    return;
  }

  if (!test_harness_code || typeof test_harness_code !== 'string' || !test_harness_code.trim()) {
    res.status(400).json({ error: 'Test harness code is required' });
    return;
  }

  if (!Array.isArray(test_cases) || test_cases.length === 0) {
    res.status(400).json({ error: 'At least one test case is required' });
    return;
  }

  for (let i = 0; i < test_cases.length; i++) {
    const tc = test_cases[i];
    if (tc.expected_output === undefined || tc.expected_output === null || typeof tc.expected_output !== 'string') {
      res.status(400).json({ error: `Test case #${i + 1} is missing expected_output` });
      return;
    }
  }

  const db = getDb();

  // Check unique slug
  const existing = db.prepare('SELECT id FROM problems WHERE slug = ?').get(normalizedSlug);
  if (existing) {
    res.status(400).json({ error: 'A problem with this slug already exists' });
    return;
  }

  const publishedVal = is_published === 0 || is_published === false ? 0 : 1;

  const createTransaction = db.transaction(() => {
    const insertProblem = db.prepare(`
      INSERT INTO problems (title, slug, difficulty, description_md, starter_code, test_harness_code, is_published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const problemInfo = insertProblem.run(
      title.trim(),
      normalizedSlug,
      difficulty,
      description_md.trim(),
      starter_code,
      test_harness_code,
      publishedVal
    );

    const problemId = Number(problemInfo.lastInsertRowid);

    const insertTestCase = db.prepare(`
      INSERT INTO test_cases (problem_id, input_display, input_payload, expected_output, is_hidden, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < test_cases.length; i++) {
      const tc = test_cases[i];
      insertTestCase.run(
        problemId,
        tc.input_display ?? '',
        tc.input_payload ?? '',
        tc.expected_output,
        tc.is_hidden ? 1 : 0,
        typeof tc.sort_order === 'number' ? tc.sort_order : i + 1
      );
    }

    if (source_custom_problem_id && typeof source_custom_problem_id === 'string') {
      db.prepare(`
        UPDATE custom_problems 
        SET promoted_problem_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(problemId, source_custom_problem_id);
    }

    return problemId;
  });

  try {
    const problemId = createTransaction();
    res.status(201).json({ success: true, id: problemId, slug: normalizedSlug });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/admin/problems/:id
 * Updates problem fields and atomically replaces test cases in a transaction.
 */
adminProblemsRouter.put('/:id', (req: Request, res: Response) => {
  const idStr = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid problem ID' });
    return;
  }

  const {
    title,
    slug,
    difficulty,
    description_md,
    starter_code,
    test_harness_code,
    is_published,
    test_cases,
  } = req.body || {};

  const db = getDb();
  const existing = db.prepare('SELECT id FROM problems WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Problem not found' });
    return;
  }

  // Validation
  if (!title || typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  if (!slug || typeof slug !== 'string' || !slug.trim()) {
    res.status(400).json({ error: 'Slug is required' });
    return;
  }

  const normalizedSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
    res.status(400).json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' });
    return;
  }

  // Check unique slug among other problems
  const slugOwner = db.prepare('SELECT id FROM problems WHERE slug = ? AND id != ?').get(normalizedSlug, id);
  if (slugOwner) {
    res.status(400).json({ error: 'A problem with this slug already exists' });
    return;
  }

  if (!difficulty || !['Easy', 'Medium', 'Hard'].includes(difficulty)) {
    res.status(400).json({ error: "Difficulty must be 'Easy', 'Medium', or 'Hard'" });
    return;
  }

  if (!description_md || typeof description_md !== 'string' || !description_md.trim()) {
    res.status(400).json({ error: 'Description is required' });
    return;
  }

  if (!starter_code || typeof starter_code !== 'string' || !starter_code.trim()) {
    res.status(400).json({ error: 'Starter code is required' });
    return;
  }

  if (!test_harness_code || typeof test_harness_code !== 'string' || !test_harness_code.trim()) {
    res.status(400).json({ error: 'Test harness code is required' });
    return;
  }

  if (!Array.isArray(test_cases) || test_cases.length === 0) {
    res.status(400).json({ error: 'At least one test case is required' });
    return;
  }

  for (let i = 0; i < test_cases.length; i++) {
    const tc = test_cases[i];
    if (tc.expected_output === undefined || tc.expected_output === null || typeof tc.expected_output !== 'string') {
      res.status(400).json({ error: `Test case #${i + 1} is missing expected_output` });
      return;
    }
  }

  const publishedVal = is_published === 0 || is_published === false ? 0 : 1;

  const updateTransaction = db.transaction(() => {
    db.prepare(`
      UPDATE problems SET
        title = ?,
        slug = ?,
        difficulty = ?,
        description_md = ?,
        starter_code = ?,
        test_harness_code = ?,
        is_published = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title.trim(),
      normalizedSlug,
      difficulty,
      description_md.trim(),
      starter_code,
      test_harness_code,
      publishedVal,
      id
    );

    db.prepare('DELETE FROM test_cases WHERE problem_id = ?').run(id);

    const insertTestCase = db.prepare(`
      INSERT INTO test_cases (problem_id, input_display, input_payload, expected_output, is_hidden, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < test_cases.length; i++) {
      const tc = test_cases[i];
      insertTestCase.run(
        id,
        tc.input_display ?? '',
        tc.input_payload ?? '',
        tc.expected_output,
        tc.is_hidden ? 1 : 0,
        typeof tc.sort_order === 'number' ? tc.sort_order : i + 1
      );
    }
  });

  try {
    updateTransaction();
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/admin/problems/:id
 * Safely deletes a problem and associated records in a transaction.
 */
adminProblemsRouter.delete('/:id', (req: Request, res: Response) => {
  const idStr = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid problem ID' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM problems WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Problem not found' });
    return;
  }

  const deleteTransaction = db.transaction(() => {
    // Nullify references in custom_problems
    db.prepare('UPDATE custom_problems SET promoted_problem_id = NULL WHERE promoted_problem_id = ?').run(id);
    // Delete submissions
    db.prepare('DELETE FROM submissions WHERE problem_id = ?').run(id);
    // Delete test cases
    db.prepare('DELETE FROM test_cases WHERE problem_id = ?').run(id);
    // Delete problem
    db.prepare('DELETE FROM problems WHERE id = ?').run(id);
  });

  try {
    deleteTransaction();
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    res.status(500).json({ error: message });
  }
});

export default adminProblemsRouter;

import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { CustomProblem, CustomProblemRun, Visitor, Problem } from '../db/schema.js';
import { requireAdmin } from '../middleware/auth.js';
import '../types.js';

export const adminCustomProblemsRouter = Router();

// Apply admin authentication to all routes in this router
adminCustomProblemsRouter.use(requireAdmin);

/**
 * GET /api/admin/custom-problems
 * Lists unique custom problems worked on anonymously with filtering, search, and sorting.
 */
adminCustomProblemsRouter.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { search, filter, sort, include_empty } = req.query;

  const conditions: string[] = [];
  const params: any[] = [];

  // Filter out empty untouched drafts unless requested
  if (include_empty !== 'true' && include_empty !== '1') {
    conditions.push(`(
      (cp.problem_statement IS NOT NULL AND TRIM(cp.problem_statement) != '')
      OR (SELECT COUNT(*) FROM custom_problem_runs cpr WHERE cpr.custom_problem_id = cp.id) > 0
    )`);
  }

  // Filter by promotion status
  if (filter === 'unpromoted') {
    conditions.push('cp.promoted_problem_id IS NULL');
  } else if (filter === 'promoted') {
    conditions.push('cp.promoted_problem_id IS NOT NULL');
  }

  // Search
  if (typeof search === 'string' && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push('(cp.title LIKE ? OR cp.problem_statement LIKE ? OR cp.visitor_id LIKE ?)');
    params.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Sort
  let orderBy = 'cp.updated_at DESC';
  if (sort === 'runs') {
    orderBy = 'run_count DESC, cp.updated_at DESC';
  } else if (sort === 'created') {
    orderBy = 'cp.created_at DESC';
  } else if (sort === 'last_run') {
    orderBy = 'last_run_at DESC, cp.updated_at DESC';
  }

  const query = `
    SELECT 
      cp.id,
      cp.visitor_id,
      cp.title,
      cp.problem_statement,
      cp.statement_hash,
      cp.promoted_problem_id,
      cp.created_at,
      cp.updated_at,
      (SELECT COUNT(*) FROM custom_problem_runs cpr WHERE cpr.custom_problem_id = cp.id) as run_count,
      (SELECT MAX(created_at) FROM custom_problem_runs cpr WHERE cpr.custom_problem_id = cp.id) as last_run_at
    FROM custom_problems cp
    ${whereClause}
    ORDER BY ${orderBy}
  `;

  const rows = db.prepare(query).all(...params) as Array<{
    id: string;
    visitor_id: string;
    title: string;
    problem_statement: string;
    statement_hash: string | null;
    promoted_problem_id: number | null;
    created_at: string;
    updated_at: string;
    run_count: number;
    last_run_at: string | null;
  }>;

  const result = rows.map((r) => ({
    id: r.id,
    title: r.title,
    problem_statement: r.problem_statement,
    statement_hash: r.statement_hash,
    visitor_id: r.visitor_id,
    run_count: r.run_count,
    last_run_at: r.last_run_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    promoted_problem_id: r.promoted_problem_id,
    is_promoted: r.promoted_problem_id !== null,
  }));

  res.json(result);
});

/**
 * GET /api/admin/custom-problems/:id
 * Returns full detail of an anonymous custom problem: statement, latest code,
 * custom test cases, visitor info, and run history.
 */
adminCustomProblemsRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const problem = db.prepare(`
    SELECT * FROM custom_problems WHERE id = ?
  `).get(id) as CustomProblem | undefined;

  if (!problem) {
    res.status(404).json({ error: 'Custom problem not found' });
    return;
  }

  let customTestCases: any[] = [];
  try {
    customTestCases = JSON.parse(problem.custom_test_cases_json || '[]');
  } catch {
    customTestCases = [];
  }

  const visitor = db.prepare(`
    SELECT id, ip_address, user_agent, first_seen_at, last_seen_at, visit_count
    FROM visitors
    WHERE id = ?
  `).get(problem.visitor_id) as Visitor | undefined;

  const runs = db.prepare(`
    SELECT 
      id,
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
  `).all(id) as CustomProblemRun[];

  let promotedProblem: Pick<Problem, 'id' | 'slug' | 'title'> | null = null;
  if (problem.promoted_problem_id) {
    const p = db.prepare('SELECT id, slug, title FROM problems WHERE id = ?').get(problem.promoted_problem_id) as Problem | undefined;
    if (p) {
      promotedProblem = { id: p.id, slug: p.slug, title: p.title };
    }
  }

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
    visitor: visitor || null,
    runs,
    promoted_problem: promotedProblem,
  });
});

export default adminCustomProblemsRouter;

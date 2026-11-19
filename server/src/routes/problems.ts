import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import type { Problem, Submission } from '../db/schema.js';
import '../types.js';

export const problemsRouter = Router();

/**
 * GET /api/problems
 * Returns all problems with visitor's status (solved, attempted, unsolved).
 */
problemsRouter.get('/', (req: Request, res: Response) => {
  const visitorId = req.visitorId;
  const db = getDb();

  const problems = db.prepare(`
    SELECT 
      p.id, 
      p.slug, 
      p.title, 
      p.difficulty,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM submissions s 
          WHERE s.problem_id = p.id 
            AND s.visitor_id = ? 
            AND s.verdict = 'ACCEPTED'
        ) THEN 'solved'
        WHEN EXISTS (
          SELECT 1 FROM submissions s 
          WHERE s.problem_id = p.id 
            AND s.visitor_id = ?
        ) THEN 'attempted'
        ELSE 'unsolved'
      END AS status
    FROM problems p
    WHERE COALESCE(p.is_published, 1) = 1
    ORDER BY p.id ASC
  `).all(visitorId, visitorId) as Array<{
    id: number;
    slug: string;
    title: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    status: 'solved' | 'attempted' | 'unsolved';
  }>;

  const result = problems.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    status: p.status,
    solvedStatus: p.status.toUpperCase() as 'SOLVED' | 'ATTEMPTED' | 'UNSOLVED',
    isSolved: p.status === 'solved',
    isAttempted: p.status === 'attempted' || p.status === 'solved',
  }));

  res.json(result);
});

/**
 * GET /api/problems/:slug
 * Returns problem details with sample test cases, omitting hidden cases and test harness code.
 */
problemsRouter.get('/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const visitorId = req.visitorId;
  const db = getDb();

  const problem = db.prepare(`
    SELECT id, slug, title, difficulty, description_md, starter_code
    FROM problems
    WHERE slug = ? AND COALESCE(is_published, 1) = 1
  `).get(slug) as Pick<Problem, 'id' | 'slug' | 'title' | 'difficulty' | 'description_md' | 'starter_code'> | undefined;

  if (!problem) {
    res.status(404).json({ error: 'Problem not found' });
    return;
  }

  const sampleCases = db.prepare(`
    SELECT id, input_display, expected_output
    FROM test_cases
    WHERE problem_id = ? AND is_hidden = 0
    ORDER BY sort_order ASC, id ASC
  `).all(problem.id) as Array<{
    id: number;
    input_display: string;
    expected_output: string;
  }>;

  const submissions = db.prepare(`
    SELECT verdict, code
    FROM submissions
    WHERE problem_id = ? AND visitor_id = ?
    ORDER BY id DESC
  `).all(problem.id, visitorId) as Array<{ verdict: string; code: string }>;

  let userStatus: 'solved' | 'attempted' | 'unsolved' = 'unsolved';
  let latestCode: string | null = null;

  if (submissions.length > 0) {
    latestCode = submissions[0].code;
    const hasAccepted = submissions.some((s) => s.verdict === 'ACCEPTED');
    userStatus = hasAccepted ? 'solved' : 'attempted';
  }

  res.json({
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    description_md: problem.description_md,
    starter_code: problem.starter_code,
    sample_cases: sampleCases,
    sampleCases: sampleCases,
    userStatus,
    solvedStatus: userStatus.toUpperCase(),
    latest_code: latestCode,
    latestCode: latestCode,
  });
});

/**
 * GET /api/problems/:slug/submissions
 * Returns user submissions for this problem.
 */
problemsRouter.get('/:slug/submissions', (req: Request, res: Response) => {
  const { slug } = req.params;
  const visitorId = req.visitorId;
  const db = getDb();

  const problem = db.prepare('SELECT id, slug, title FROM problems WHERE slug = ? AND COALESCE(is_published, 1) = 1').get(slug) as Pick<Problem, 'id' | 'slug' | 'title'> | undefined;

  if (!problem) {
    res.status(404).json({ error: 'Problem not found' });
    return;
  }

  const submissions = db.prepare(`
    SELECT 
      s.id,
      s.visitor_id,
      s.problem_id,
      s.code,
      s.verdict,
      s.passed_count,
      s.total_count,
      s.runtime_ms,
      s.error_output,
      s.created_at
    FROM submissions s
    WHERE s.problem_id = ? AND s.visitor_id = ?
    ORDER BY s.id DESC
  `).all(problem.id, visitorId) as Submission[];

  res.json(submissions.map((s) => ({
    id: s.id,
    visitor_id: s.visitor_id,
    problem_id: s.problem_id,
    problem_slug: problem.slug,
    problem_title: problem.title,
    code: s.code,
    verdict: s.verdict,
    passed_count: s.passed_count,
    total_count: s.total_count,
    runtime_ms: s.runtime_ms,
    error_output: s.error_output,
    created_at: s.created_at,
  })));
});

export default problemsRouter;

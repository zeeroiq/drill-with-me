import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';
import { ADMIN_USERNAME, ADMIN_PASSWORD_HASH } from '../config.js';
import { verifyPassword } from '../utils/crypto.js';
import {
  adminLoginRateLimiter,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  requireAdmin,
} from '../middleware/auth.js';
import { adminProblemsRouter } from './admin-problems.js';
import { adminCustomProblemsRouter } from './admin-custom-problems.js';
import type { PageVisit, CustomProblem } from '../db/schema.js';
import '../types.js';

export const adminRouter = Router();

// Sub-routers for problem management and custom problem review
adminRouter.use('/problems', adminProblemsRouter);
adminRouter.use('/custom-problems', adminCustomProblemsRouter);

/**
 * POST /api/admin/login
 * Admin login endpoint with rate limiting.
 */
adminRouter.post('/login', adminLoginRateLimiter, (req: Request, res: Response) => {
  const { username, password } = req.body || {};

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username ||
    !password
  ) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (username !== ADMIN_USERNAME) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const passwordValid = verifyPassword(password, ADMIN_PASSWORD_HASH);
  if (!passwordValid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  setAdminSessionCookie(res, username);
  res.json({ success: true, username });
});

/**
 * POST /api/admin/logout
 * Admin logout endpoint.
 */
adminRouter.post('/logout', (_req: Request, res: Response) => {
  clearAdminSessionCookie(res);
  res.json({ success: true });
});

/**
 * GET /api/admin/me
 * Check admin session status.
 */
adminRouter.get('/me', requireAdmin, (req: Request, res: Response) => {
  res.json({
    authenticated: true,
    username: req.admin?.username,
  });
});

/**
 * GET /api/admin/overview
 * Overview stats and per-problem metrics.
 */
adminRouter.get('/overview', requireAdmin, (_req: Request, res: Response) => {
  const db = getDb();

  const totalVisitorsRow = db.prepare('SELECT COUNT(*) as count FROM visitors').get() as { count: number };
  const totalPageVisitsRow = db.prepare('SELECT COUNT(*) as count FROM page_visits').get() as { count: number };
  const totalSubmissionsRow = db.prepare('SELECT COUNT(*) as count FROM submissions').get() as { count: number };
  const acceptedSubmissionsRow = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE verdict = 'ACCEPTED'").get() as { count: number };
  const totalCustomProblemsRow = db.prepare('SELECT COUNT(*) as count FROM custom_problems').get() as { count: number };
  const totalCustomRunsRow = db.prepare('SELECT COUNT(*) as count FROM custom_problem_runs').get() as { count: number };

  const totalVisitors = totalVisitorsRow?.count || 0;
  const totalPageVisits = totalPageVisitsRow?.count || 0;
  const totalSubmissions = totalSubmissionsRow?.count || 0;
  const acceptedCount = acceptedSubmissionsRow?.count || 0;
  const totalCustomProblems = totalCustomProblemsRow?.count || 0;
  const totalCustomRuns = totalCustomRunsRow?.count || 0;

  const acceptedRate =
    totalSubmissions > 0
      ? Math.round((acceptedCount / totalSubmissions) * 1000) / 10
      : 0;

  const problemRows = db.prepare(`
    SELECT 
      p.id,
      p.slug,
      p.title,
      p.difficulty,
      (SELECT COUNT(*) FROM submissions s WHERE s.problem_id = p.id) as attemptsCount,
      (SELECT COUNT(DISTINCT s.visitor_id) FROM submissions s WHERE s.problem_id = p.id AND s.verdict = 'ACCEPTED') as solvedCount
    FROM problems p
    ORDER BY p.id ASC
  `).all() as Array<{
    id: number;
    slug: string;
    title: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    attemptsCount: number;
    solvedCount: number;
  }>;

  const problemStats = problemRows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    attemptsCount: p.attemptsCount,
    attempts: p.attemptsCount,
    solvedCount: p.solvedCount,
    solves: p.solvedCount,
  }));

  res.json({
    totalVisitors,
    totalPageVisits,
    totalSubmissions,
    acceptedRate,
    totalCustomProblems,
    totalCustomRuns,
    stats: {
      totalVisitors,
      totalPageVisits,
      totalSubmissions,
      acceptedRate,
      totalCustomProblems,
      totalCustomRuns,
    },
    problemStats,
  });
});

/**
 * GET /api/admin/visitors
 * List visitors with searching and sorting.
 */
adminRouter.get('/visitors', requireAdmin, (req: Request, res: Response) => {
  const db = getDb();

  let sortCol = 'last_seen_at';
  let sortDir = 'DESC';

  const sortParam = (req.query.sort as string) || '';
  const orderParam = (req.query.order as string) || '';

  if (sortParam.includes(':')) {
    const [col, dir] = sortParam.split(':');
    if (['last_seen_at', 'first_seen_at', 'visit_count'].includes(col)) {
      sortCol = col;
    }
    if (dir && (dir.toUpperCase() === 'ASC' || dir.toUpperCase() === 'DESC')) {
      sortDir = dir.toUpperCase();
    }
  } else if (['last_seen_at', 'first_seen_at', 'visit_count'].includes(sortParam)) {
    sortCol = sortParam;
  }

  if (orderParam && ['ASC', 'DESC'].includes(orderParam.toUpperCase())) {
    sortDir = orderParam.toUpperCase();
  }

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  let query = `
    SELECT 
      v.id,
      v.ip_address,
      v.user_agent,
      v.first_seen_at,
      v.last_seen_at,
      v.visit_count,
      (SELECT COUNT(*) FROM submissions s WHERE s.visitor_id = v.id) as attemptedCount,
      (SELECT COUNT(DISTINCT s.problem_id) FROM submissions s WHERE s.visitor_id = v.id AND s.verdict = 'ACCEPTED') as solvedCount
    FROM visitors v
  `;

  const params: string[] = [];
  if (search) {
    query += ` WHERE v.id LIKE ? OR v.ip_address LIKE ? `;
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY v.${sortCol} ${sortDir}`;

  const rows = db.prepare(query).all(...params) as Array<{
    id: string;
    ip_address: string;
    user_agent: string;
    first_seen_at: string;
    last_seen_at: string;
    visit_count: number;
    attemptedCount: number;
    solvedCount: number;
  }>;

  const visitors = rows.map((v) => ({
    id: v.id,
    ip_address: v.ip_address,
    user_agent: v.user_agent,
    first_seen_at: v.first_seen_at,
    last_seen_at: v.last_seen_at,
    visit_count: v.visit_count,
    attemptedCount: v.attemptedCount,
    attempted_count: v.attemptedCount,
    solvedCount: v.solvedCount,
    solved_count: v.solvedCount,
  }));

  res.json(visitors);
});

/**
 * GET /api/admin/visitors/:id
 * Drilldown into a specific visitor's visits and submissions.
 */
adminRouter.get('/visitors/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const visitorRow = db.prepare(`
    SELECT 
      v.id,
      v.ip_address,
      v.user_agent,
      v.first_seen_at,
      v.last_seen_at,
      v.visit_count,
      (SELECT COUNT(*) FROM submissions s WHERE s.visitor_id = v.id) as attemptedCount,
      (SELECT COUNT(DISTINCT s.problem_id) FROM submissions s WHERE s.visitor_id = v.id AND s.verdict = 'ACCEPTED') as solvedCount
    FROM visitors v
    WHERE v.id = ?
  `).get(id) as {
    id: string;
    ip_address: string;
    user_agent: string;
    first_seen_at: string;
    last_seen_at: string;
    visit_count: number;
    attemptedCount: number;
    solvedCount: number;
  } | undefined;

  if (!visitorRow) {
    res.status(404).json({ error: 'Visitor not found' });
    return;
  }

  const pageVisits = db.prepare(`
    SELECT id, visitor_id, path, visited_at
    FROM page_visits
    WHERE visitor_id = ?
    ORDER BY visited_at DESC
    LIMIT 50
  `).all(id) as PageVisit[];

  const submissions = db.prepare(`
    SELECT 
      s.id,
      p.title as problem_title,
      p.slug as problem_slug,
      s.code,
      s.verdict,
      s.passed_count,
      s.total_count,
      s.runtime_ms,
      s.error_output,
      s.created_at
    FROM submissions s
    JOIN problems p ON s.problem_id = p.id
    WHERE s.visitor_id = ?
    ORDER BY s.id DESC
  `).all(id) as Array<{
    id: number;
    problem_title: string;
    problem_slug: string;
    code: string;
    verdict: string;
    passed_count: number;
    total_count: number;
    runtime_ms: number;
    error_output: string | null;
    created_at: string;
  }>;

  const customProblems = db.prepare(`
    SELECT 
      cp.id,
      cp.title,
      cp.problem_statement,
      cp.code,
      cp.custom_test_cases_json,
      cp.promoted_problem_id,
      cp.created_at,
      cp.updated_at,
      (SELECT COUNT(*) FROM custom_problem_runs cpr WHERE cpr.custom_problem_id = cp.id) as run_count
    FROM custom_problems cp
    WHERE cp.visitor_id = ?
    ORDER BY cp.updated_at DESC
  `).all(id) as Array<CustomProblem & { run_count: number }>;

  const formattedCustomProblems = customProblems.map((cp) => {
    let testCases = [];
    try {
      testCases = JSON.parse(cp.custom_test_cases_json || '[]');
    } catch {
      testCases = [];
    }
    return {
      id: cp.id,
      title: cp.title,
      problem_statement: cp.problem_statement,
      code: cp.code,
      custom_test_cases: testCases,
      customTestCases: testCases,
      promoted_problem_id: cp.promoted_problem_id,
      is_promoted: cp.promoted_problem_id !== null,
      run_count: cp.run_count,
      created_at: cp.created_at,
      updated_at: cp.updated_at,
    };
  });

  res.json({
    visitor: {
      id: visitorRow.id,
      ip_address: visitorRow.ip_address,
      user_agent: visitorRow.user_agent,
      first_seen_at: visitorRow.first_seen_at,
      last_seen_at: visitorRow.last_seen_at,
      visit_count: visitorRow.visit_count,
      attemptedCount: visitorRow.attemptedCount,
      attempted_count: visitorRow.attemptedCount,
      solvedCount: visitorRow.solvedCount,
      solved_count: visitorRow.solvedCount,
    },
    pageVisits,
    visits: pageVisits,
    submissions,
    customProblems: formattedCustomProblems,
    custom_problems: formattedCustomProblems,
  });
});

export default adminRouter;

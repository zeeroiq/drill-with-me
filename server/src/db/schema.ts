import type Database from 'better-sqlite3';

export type DatabaseInstance = Database.Database;

export interface Visitor {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  first_seen_at: string;
  last_seen_at: string;
  visit_count: number;
}

export interface PageVisit {
  id: number;
  visitor_id: string;
  path: string;
  visited_at: string;
}

export interface Problem {
  id: number;
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description_md: string;
  starter_code: string;
  test_harness_code: string;
  created_at: string;
  is_published: number;
  updated_at: string | null;
}

export interface TestCase {
  id: number;
  problem_id: number;
  input_display: string;
  input_payload: string;
  expected_output: string;
  is_hidden: number; // 0 or 1
  sort_order: number;
}

export type SubmissionVerdict =
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED';

export interface Submission {
  id: number;
  visitor_id: string;
  problem_id: number;
  code: string;
  verdict: SubmissionVerdict;
  passed_count: number;
  total_count: number;
  runtime_ms: number;
  error_output: string | null;
  created_at: string;
}

export interface CustomTestCaseItem {
  id?: string;
  stdin?: string;
  expected_output?: string;
}

export type CustomProblemVerdict =
  | 'EXECUTED'
  | 'PASSED'
  | 'FAILED'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'SECURITY_VIOLATION'
  | 'OUTPUT_LIMIT_EXCEEDED';

export interface CustomProblem {
  id: string;
  visitor_id: string;
  title: string;
  problem_statement: string;
  statement_hash: string | null;
  code: string;
  custom_test_cases_json: string;
  promoted_problem_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CustomProblemRun {
  id: number;
  custom_problem_id: string;
  visitor_id: string;
  code: string;
  verdict: CustomProblemVerdict;
  passed_count: number | null;
  total_count: number | null;
  runtime_ms: number | null;
  output_summary: string | null;
  error_output: string | null;
  created_at: string;
}

export function runMigrations(db: DatabaseInstance): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      ip_address TEXT,
      user_agent TEXT,
      first_seen_at TEXT,
      last_seen_at TEXT,
      visit_count INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS page_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT REFERENCES visitors(id),
      path TEXT,
      visited_at TEXT
    );

    CREATE TABLE IF NOT EXISTS problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      description_md TEXT NOT NULL,
      starter_code TEXT NOT NULL,
      test_harness_code TEXT NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER REFERENCES problems(id),
      input_display TEXT,
      input_payload TEXT,
      expected_output TEXT,
      is_hidden INTEGER DEFAULT 0,
      sort_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT REFERENCES visitors(id),
      problem_id INTEGER REFERENCES problems(id),
      code TEXT NOT NULL,
      verdict TEXT NOT NULL,
      passed_count INTEGER,
      total_count INTEGER,
      runtime_ms INTEGER,
      error_output TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS custom_problems (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL REFERENCES visitors(id),
      title TEXT NOT NULL DEFAULT '',
      problem_statement TEXT NOT NULL DEFAULT '',
      statement_hash TEXT,
      code TEXT NOT NULL DEFAULT '',
      custom_test_cases_json TEXT NOT NULL DEFAULT '[]',
      promoted_problem_id INTEGER REFERENCES problems(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_problem_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      custom_problem_id TEXT NOT NULL REFERENCES custom_problems(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL REFERENCES visitors(id),
      code TEXT NOT NULL,
      verdict TEXT NOT NULL,
      passed_count INTEGER,
      total_count INTEGER,
      runtime_ms INTEGER,
      output_summary TEXT,
      error_output TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_page_visits_visitor ON page_visits(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_visitor ON submissions(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_problem ON submissions(problem_id);
    CREATE INDEX IF NOT EXISTS idx_test_cases_problem ON test_cases(problem_id);
    CREATE INDEX IF NOT EXISTS idx_custom_problems_visitor ON custom_problems(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_custom_problems_updated ON custom_problems(updated_at);
    CREATE INDEX IF NOT EXISTS idx_custom_problems_hash ON custom_problems(statement_hash);
    CREATE INDEX IF NOT EXISTS idx_custom_problem_runs_cp ON custom_problem_runs(custom_problem_id);
    CREATE INDEX IF NOT EXISTS idx_custom_problem_runs_visitor ON custom_problem_runs(visitor_id);
  `);

  // Check and add columns to problems table if they don't already exist
  const problemColumns = db.prepare(`PRAGMA table_info(problems)`).all() as Array<{ name: string }>;
  const columnNames = new Set(problemColumns.map((col) => col.name));

  if (!columnNames.has('is_published')) {
    db.exec(`ALTER TABLE problems ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1;`);
  }
  if (!columnNames.has('updated_at')) {
    db.exec(`ALTER TABLE problems ADD COLUMN updated_at TEXT;`);
  }

  // Purge any historical /health entries from page_visits and orphan visitor records generated by probes
  db.exec(`
    DELETE FROM page_visits WHERE path = '/health' OR path LIKE '/health/%';
    DELETE FROM visitors
    WHERE id NOT IN (SELECT DISTINCT visitor_id FROM submissions)
      AND id NOT IN (SELECT DISTINCT visitor_id FROM custom_problems)
      AND id NOT IN (SELECT DISTINCT visitor_id FROM custom_problem_runs)
      AND id NOT IN (SELECT DISTINCT visitor_id FROM page_visits);
  `);
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import DatabaseConstructor from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { config } from '../src/config.js';
import { initDb, closeDb, getDb } from '../src/db/index.js';
import { runMigrations, type Problem, type TestCase } from '../src/db/schema.js';
import { seedProblems } from '../src/db/seed.js';
import { executeJava } from '../src/runner';

describe('Configuration', () => {
  it('loads valid configuration defaults', () => {
    expect(config.PORT).toBe(3000);
    expect(config.ADMIN_USERNAME).toBe('admin');
    expect(config.SESSION_SECRET).toBe('drill-with-me-super-secret-key-change-in-prod');
    expect(config.EXECUTION_TIMEOUT_MS).toBe(3000);
    expect(config.COMPILE_TIMEOUT_MS).toBe(5000);
    expect(config.MAX_CONCURRENT_RUNS).toBe(3);
    expect(config.SQLITE_DB_PATH).toBeDefined();
  });
});

describe('Database Layer & Seed Data', () => {
  let tempDir: string;
  let testDbPath: string;

  beforeEach(() => {
    closeDb();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drill-with-me-db-test-'));
    testDbPath = path.join(tempDir, 'test.db');
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('initializes db, runs pragmas, migrations, and seeds problems', () => {
    const db = initDb(testDbPath);
    expect(db).toBeDefined();

    // Check pragmas
    const foreignKeys = db.pragma('foreign_keys', { simple: true });
    expect(foreignKeys).toBe(1);

    const journalMode = db.pragma('journal_mode', { simple: true });
    expect(journalMode).toBe('wal');

    // Check tables exist
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('visitors');
    expect(tableNames).toContain('page_visits');
    expect(tableNames).toContain('problems');
    expect(tableNames).toContain('test_cases');
    expect(tableNames).toContain('submissions');

    // Check indexes exist
    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index'`)
      .all() as { name: string }[];
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain('idx_page_visits_visitor');
    expect(indexNames).toContain('idx_submissions_visitor');
    expect(indexNames).toContain('idx_submissions_problem');
    expect(indexNames).toContain('idx_test_cases_problem');

    // Check problems seeded
    const problems = db.prepare(`SELECT * FROM problems ORDER BY id ASC`).all() as Problem[];
    expect(problems).toHaveLength(5);

    const expectedSlugs = [
      'two-sum',
      'valid-palindrome',
      'valid-parentheses',
      'best-time-to-buy-and-sell-stock',
      'maximum-subarray',
    ];
    expect(problems.map((p) => p.slug)).toEqual(expectedSlugs);

    // Verify each problem's fields and test cases
    for (const prob of problems) {
      expect(prob.title).toBeTruthy();
      expect(['Easy', 'Medium', 'Hard']).toContain(prob.difficulty);
      expect(prob.description_md).toBeTruthy();
      expect(prob.starter_code).toContain('class Solution');
      expect(prob.test_harness_code).toContain('public class Main');
      expect(prob.test_harness_code).toContain('---TEST_RESULT_START---');
      expect(prob.test_harness_code).toContain('---SUMMARY_START---');

      const testCases = db
        .prepare(`SELECT * FROM test_cases WHERE problem_id = ? ORDER BY sort_order ASC`)
        .all(prob.id) as TestCase[];

      expect(testCases.length).toBeGreaterThanOrEqual(5);

      const visibleCases = testCases.filter((tc) => tc.is_hidden === 0);
      const hiddenCases = testCases.filter((tc) => tc.is_hidden === 1);

      expect(visibleCases).toHaveLength(2);
      expect(hiddenCases.length).toBeGreaterThanOrEqual(3);

      for (const tc of testCases) {
        expect(tc.input_display).toBeTruthy();
        expect(tc.input_payload).toBeTruthy();
        expect(tc.expected_output).toBeTruthy();
      }
    }
  });

  it('seeding is idempotent', () => {
    const db = initDb(testDbPath);

    // Call seedProblems multiple times
    seedProblems(db);
    seedProblems(db);

    const problems = db.prepare(`SELECT * FROM problems`).all();
    expect(problems).toHaveLength(5);

    const totalTestCases = db.prepare(`SELECT COUNT(*) as count FROM test_cases`).get() as { count: number };
    expect(totalTestCases.count).toBe(25);
  });

  it('supports visitor, page visit, and submission tracking', () => {
    const db = initDb(testDbPath);

    // Insert visitor
    const visitorId = 'v-123e4567-e89b-12d3-a456-426614174000';
    db.prepare(`
      INSERT INTO visitors (id, ip_address, user_agent, first_seen_at, last_seen_at, visit_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(visitorId, '127.0.0.1', 'Mozilla/5.0 Test', new Date().toISOString(), new Date().toISOString(), 1);

    // Insert page visit
    db.prepare(`
      INSERT INTO page_visits (visitor_id, path, visited_at)
      VALUES (?, ?, ?)
    `).run(visitorId, '/problems/two-sum', new Date().toISOString());

    // Insert submission
    const problem = db.prepare(`SELECT id FROM problems WHERE slug = 'two-sum'`).get() as { id: number };
    const submissionResult = db.prepare(`
      INSERT INTO submissions (visitor_id, problem_id, code, verdict, passed_count, total_count, runtime_ms, error_output, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      visitorId,
      problem.id,
      'class Solution { public int[] twoSum(int[] n, int t) { return new int[]{0,1}; } }',
      'ACCEPTED',
      5,
      5,
      120,
      null,
      new Date().toISOString()
    );

    expect(submissionResult.changes).toBe(1);

    // Query drill-down
    const visitorSubmissions = db.prepare(`
      SELECT s.*, p.title as problem_title, p.slug as problem_slug
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      WHERE s.visitor_id = ?
    `).all(visitorId);

    expect(visitorSubmissions).toHaveLength(1);
    expect((visitorSubmissions[0] as any).verdict).toBe('ACCEPTED');
    expect((visitorSubmissions[0] as any).problem_slug).toBe('two-sum');
  });

  it('compiles and runs Java test harness for Two Sum', () => {
    // Verify Java compiler and runtime are present
    try {
      execSync('javac -version', { stdio: 'pipe' });
      execSync('java -version', { stdio: 'pipe' });
    } catch {
      // If JDK not installed in environment, skip execution test
      return;
    }

    const db = initDb(testDbPath);
    const twoSum = db.prepare(`SELECT * FROM problems WHERE slug = 'two-sum'`).get() as Problem;

    const javaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'drill-with-me-harness-'));
    try {
      // 1. Test with starter code (should execute, fail all tests cleanly)
      fs.writeFileSync(path.join(javaTemp, 'Solution.java'), twoSum.starter_code);
      fs.writeFileSync(path.join(javaTemp, 'Main.java'), twoSum.test_harness_code);

      execSync('javac Solution.java Main.java', { cwd: javaTemp, stdio: 'pipe', timeout: 20000 });
      const starterOutput = execSync('java -Xms16m -Xmx64m Main', { cwd: javaTemp, encoding: 'utf-8', timeout: 20000 });

      expect(starterOutput).toContain('---TEST_RESULT_START---');
      expect(starterOutput).toContain('---TEST_RESULT_END---');
      expect(starterOutput).toContain('---SUMMARY_START---');
      expect(starterOutput).toContain('"passedCount": 0');
      expect(starterOutput).toContain('"totalCount": 5');
      expect(starterOutput).toContain('"allPassed": false');

      // 2. Test with correct Solution
      const acceptedSolution = `
        import java.util.HashMap;
        import java.util.Map;

        class Solution {
            public int[] twoSum(int[] nums, int target) {
                Map<Integer, Integer> map = new HashMap<>();
                for (int i = 0; i < nums.length; i++) {
                    int complement = target - nums[i];
                    if (map.containsKey(complement)) {
                        return new int[]{map.get(complement), i};
                    }
                    map.put(nums[i], i);
                }
                return new int[]{};
            }
        }
      `;
      fs.writeFileSync(path.join(javaTemp, 'Solution.java'), acceptedSolution);
      execSync('javac Solution.java Main.java', { cwd: javaTemp, stdio: 'pipe', timeout: 20000 });

      // Run full test suite (submit)
      const fullOutput = execSync('java -Xms16m -Xmx64m Main', { cwd: javaTemp, encoding: 'utf-8', timeout: 20000 });
      expect(fullOutput).toContain('"passedCount": 5');
      expect(fullOutput).toContain('"totalCount": 5');
      expect(fullOutput).toContain('"allPassed": true');

      // Run visible-only test suite (run code)
      const visibleOutput = execSync('java -Xms16m -Xmx64m Main --visible-only', { cwd: javaTemp, encoding: 'utf-8', timeout: 20000 });
      expect(visibleOutput).toContain('"passedCount": 2');
      expect(visibleOutput).toContain('"totalCount": 2');
      expect(visibleOutput).toContain('"allPassed": true');
    } finally {
      fs.rmSync(javaTemp, { recursive: true, force: true });
    }
  });

  it('compiles and runs Java test harness for all 5 problems with accepted solutions', () => {
    try {
      execSync('javac -version', { stdio: 'pipe' });
    } catch {
      return;
    }

    const db = initDb(testDbPath);
    const problems = db.prepare(`SELECT * FROM problems ORDER BY id ASC`).all() as Problem[];

    const solutions: Record<string, string> = {
      'two-sum': `
        import java.util.HashMap;
        class Solution {
            public int[] twoSum(int[] nums, int target) {
                HashMap<Integer, Integer> map = new HashMap<>();
                for (int i = 0; i < nums.length; i++) {
                    int comp = target - nums[i];
                    if (map.containsKey(comp)) return new int[]{map.get(comp), i};
                    map.put(nums[i], i);
                }
                return new int[]{};
            }
        }
      `,
      'valid-palindrome': `
        class Solution {
            public boolean isPalindrome(String s) {
                int left = 0, right = s.length() - 1;
                while (left < right) {
                    while (left < right && !Character.isLetterOrDigit(s.charAt(left))) left++;
                    while (left < right && !Character.isLetterOrDigit(s.charAt(right))) right--;
                    if (Character.toLowerCase(s.charAt(left)) != Character.toLowerCase(s.charAt(right))) return false;
                    left++;
                    right--;
                }
                return true;
            }
        }
      `,
      'valid-parentheses': `
        import java.util.Stack;
        class Solution {
            public boolean isValid(String s) {
                Stack<Character> stack = new Stack<>();
                for (char c : s.toCharArray()) {
                    if (c == '(') stack.push(')');
                    else if (c == '{') stack.push('}');
                    else if (c == '[') stack.push(']');
                    else if (stack.isEmpty() || stack.pop() != c) return false;
                }
                return stack.isEmpty();
            }
        }
      `,
      'best-time-to-buy-and-sell-stock': `
        class Solution {
            public int maxProfit(int[] prices) {
                int minPrice = Integer.MAX_VALUE;
                int maxProfit = 0;
                for (int p : prices) {
                    if (p < minPrice) minPrice = p;
                    else if (p - minPrice > maxProfit) maxProfit = p - minPrice;
                }
                return maxProfit;
            }
        }
      `,
      'maximum-subarray': `
        class Solution {
            public int maxSubArray(int[] nums) {
                int maxSoFar = nums[0];
                int currentMax = nums[0];
                for (int i = 1; i < nums.length; i++) {
                    currentMax = Math.max(nums[i], currentMax + nums[i]);
                    maxSoFar = Math.max(maxSoFar, currentMax);
                }
                return maxSoFar;
            }
        }
      `,
    };

    for (const prob of problems) {
      const javaTemp = fs.mkdtempSync(path.join(os.tmpdir(), `drill-with-me-harness-${prob.slug}-`));
      try {
        fs.writeFileSync(path.join(javaTemp, 'Solution.java'), solutions[prob.slug]);
        fs.writeFileSync(path.join(javaTemp, 'Main.java'), prob.test_harness_code);

        execSync('javac Solution.java Main.java', { cwd: javaTemp, stdio: 'pipe', timeout: 20000 });
        const output = execSync('java -Xms16m -Xmx64m Main', { cwd: javaTemp, encoding: 'utf-8', timeout: 20000 });

        expect(output).toContain('"passedCount": 5');
        expect(output).toContain('"totalCount": 5');
        expect(output).toContain('"allPassed": true');
      } finally {
        fs.rmSync(javaTemp, { recursive: true, force: true });
      }
    }
  });

  it('integrates seamlessly with runner.executeJava', async () => {
    try {
      execSync('javac -version', { stdio: 'pipe' });
    } catch {
      return;
    }

    const db = initDb(testDbPath);
    const prob = db.prepare(`SELECT * FROM problems WHERE slug = 'two-sum'`).get() as Problem;

    const solution = `
      import java.util.HashMap;
      public class Solution {
          public int[] twoSum(int[] nums, int target) {
              HashMap<Integer, Integer> map = new HashMap<>();
              for (int i = 0; i < nums.length; i++) {
                  int complement = target - nums[i];
                  if (map.containsKey(complement)) {
                      return new int[]{map.get(complement), i};
                  }
                  map.put(nums[i], i);
              }
              return new int[]{};
          }
      }
    `;

    const result = await executeJava(solution, prob.test_harness_code);
    expect(result.verdict).toBe('ACCEPTED');
    expect(result.passedCount).toBe(5);
    expect(result.totalCount).toBe(5);
    expect(result.results).toHaveLength(5);
  });
});

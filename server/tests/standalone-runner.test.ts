import { describe, it, expect } from 'vitest';
import DatabaseConstructor from 'better-sqlite3';
import {
  executeStandaloneJava,
  executeStandaloneJavaRaw,
  dryRunProblem,
  extractClassName,
} from '../src/runner/standalone.js';
import { runMigrations, type Problem } from '../src/db/schema.js';

describe('Standalone Java Execution Runner', () => {
  // 1. Normal stdin/stdout execution -> EXECUTED
  it('should return EXECUTED for normal execution with no expected output', async () => {
    const code = `
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String name = scanner.nextLine();
        System.out.println("Hello, " + name + "!");
    }
}
`;
    const result = await executeStandaloneJava(code, [
      { stdin: 'JavaDrill\n' },
    ]);

    expect(result.verdict).toBe('EXECUTED');
    expect(result.passedCount).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].status).toBe('EXECUTED');
    expect(result.results[0].actualOutput).toBe('Hello, JavaDrill!');
    expect(result.results[0].stdout.trim()).toBe('Hello, JavaDrill!');
    expect(result.runtime_ms).toBeGreaterThanOrEqual(0);
  });

  // 2. Stdin with matching expected output -> PASSED
  it('should return PASSED when actual output matches expected output', async () => {
    const code = `
import java.util.Scanner;

public class Adder {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        System.out.println(a + b);
    }
}
`;
    const result = await executeStandaloneJava(code, [
      { stdin: '15 27\n', expected_output: '42' },
    ]);

    expect(result.verdict).toBe('PASSED');
    expect(result.passedCount).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].status).toBe('PASSED');
    expect(result.results[0].actualOutput).toBe('42');
    expect(result.results[0].expectedOutput).toBe('42');
    expect(result.errorOutput).toBeUndefined();
  });

  // 3. Stdin with mismatching expected output -> FAILED
  it('should return FAILED when actual output does not match expected output', async () => {
    const code = `
import java.util.Scanner;

public class BrokenAdder {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        System.out.println(a - b); // logic error
    }
}
`;
    const result = await executeStandaloneJava(code, [
      { stdin: '10 5\n', expected_output: '15' },
    ]);

    expect(result.verdict).toBe('FAILED');
    expect(result.passedCount).toBe(0);
    expect(result.totalCount).toBe(1);
    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].status).toBe('FAILED');
    expect(result.results[0].actualOutput).toBe('5');
    expect(result.results[0].expectedOutput).toBe('15');
    expect(result.errorOutput).toContain('Expected "15", got "5"');
  });

  // 4. Compilation error -> COMPILE_ERROR
  it('should return COMPILE_ERROR on syntax error', async () => {
    const code = `
public class SyntaxError {
    public static void main(String[] args) {
        int a = 10 // missing semicolon
        System.out.println(a);
    }
}
`;
    const result = await executeStandaloneJava(code, [{ stdin: '' }]);

    expect(result.verdict).toBe('COMPILE_ERROR');
    expect(result.passedCount).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.results).toHaveLength(0);
    expect(result.errorOutput).toBeDefined();
    expect(result.errorOutput).toContain('error:');
  });

  // 5. Runtime exception (division by zero) -> RUNTIME_ERROR
  it('should return RUNTIME_ERROR on division by zero', async () => {
    const code = `
public class DivideByZero {
    public static void main(String[] args) {
        int a = 10;
        int b = 0;
        System.out.println(a / b);
    }
}
`;
    const result = await executeStandaloneJava(code, [{ stdin: '' }]);

    expect(result.verdict).toBe('RUNTIME_ERROR');
    expect(result.passedCount).toBe(0);
    expect(result.totalCount).toBe(1);
    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].status).toBe('RUNTIME_ERROR');
    expect(result.results[0].errorMessage).toContain('ArithmeticException');
    expect(result.errorOutput).toContain('ArithmeticException');
  });

  // 6. Infinite loop -> TIME_LIMIT_EXCEEDED
  it('should return TIME_LIMIT_EXCEEDED on infinite loop', async () => {
    const code = `
public class InfiniteLoop {
    public static void main(String[] args) {
        while (true) {
            // endless loop
        }
    }
}
`;
    const result = await executeStandaloneJava(
      code,
      [{ stdin: '' }],
      { timeoutMs: 1200 }
    );

    expect(result.verdict).toBe('TIME_LIMIT_EXCEEDED');
    expect(result.passedCount).toBe(0);
    expect(result.totalCount).toBe(1);
    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].status).toBe('TIME_LIMIT_EXCEEDED');
    expect(result.errorOutput).toContain('Time Limit Exceeded');
  }, 20000);

  // 7. Security violation -> SECURITY_VIOLATION
  it('should return SECURITY_VIOLATION for forbidden System.exit', async () => {
    const code = `
public class Malicious {
    public static void main(String[] args) {
        System.exit(0);
    }
}
`;
    const result = await executeStandaloneJava(code, [{ stdin: '' }]);

    expect(result.verdict).toBe('SECURITY_VIOLATION');
    expect(result.passedCount).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.results).toHaveLength(0);
    expect(result.errorOutput).toContain('System.exit() is forbidden');
  });

  it('should return SECURITY_VIOLATION for forbidden Runtime.getRuntime()', async () => {
    const code = `
public class Exploit {
    public static void main(String[] args) {
        Runtime.getRuntime().exec("whoami");
    }
}
`;
    const result = await executeStandaloneJava(code, [{ stdin: '' }]);

    expect(result.verdict).toBe('SECURITY_VIOLATION');
    expect(result.passedCount).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.results).toHaveLength(0);
    expect(result.errorOutput).toContain('Runtime.getRuntime() is forbidden');
  });

  // 8. Multiple test cases execution with mixed pass/fail
  it('should execute multiple test cases and report mixed pass/fail results', async () => {
    const code = `
import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        // Correctly adds for positive, but has a bug for negative numbers
        if (a < 0) {
            System.out.println(0);
        } else {
            System.out.println(a + b);
        }
    }
}
`;
    const testCases = [
      { stdin: '2 3\n', expected_output: '5' },     // Case 1: passes
      { stdin: '-2 5\n', expected_output: '3' },    // Case 2: fails (prints 0)
      { stdin: '10 20\n', expected_output: '30' },  // Case 3: passes
    ];

    const result = await executeStandaloneJava(code, testCases);

    expect(result.verdict).toBe('FAILED');
    expect(result.passedCount).toBe(2);
    expect(result.totalCount).toBe(3);
    expect(result.results).toHaveLength(3);

    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].status).toBe('PASSED');
    expect(result.results[0].actualOutput).toBe('5');

    expect(result.results[1].passed).toBe(false);
    expect(result.results[1].status).toBe('FAILED');
    expect(result.results[1].actualOutput).toBe('0');
    expect(result.results[1].expectedOutput).toBe('3');

    expect(result.results[2].passed).toBe(true);
    expect(result.results[2].status).toBe('PASSED');
    expect(result.results[2].actualOutput).toBe('30');
  });

  // 9. Class name extraction and missing class compilation error
  it('should report COMPILE_ERROR when no class declaration exists', async () => {
    const code = `
int a = 5;
System.out.println(a);
`;
    const result = await executeStandaloneJava(code, [{ stdin: '' }]);
    expect(result.verdict).toBe('COMPILE_ERROR');
    expect(result.errorOutput).toContain('No class declaration found');
  });

  it('should correctly extract class names in various formats', () => {
    expect(extractClassName('public class MyClass { }')).toBe('MyClass');
    expect(extractClassName('class Simple { }')).toBe('Simple');
    expect(extractClassName('// class Fake\npublic class Real { }')).toBe('Real');
    expect(extractClassName('class Helper {} class Main { public static void main(String[] args) {} }')).toBe('Main');
    expect(extractClassName('no class here')).toBeNull();
  });

  // 10. Default single test case when testCases array is empty
  it('should treat empty testCases as 1 default case with empty stdin', async () => {
    const code = `
public class Greeter {
    public static void main(String[] args) {
        System.out.println("No input needed");
    }
}
`;
    const result = await executeStandaloneJava(code, []);
    expect(result.verdict).toBe('EXECUTED');
    expect(result.passedCount).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.results[0].actualOutput).toBe('No input needed');
  });

  // 11. Dry run problem helper
  it('should dryRunProblem successfully with a valid harness and solution', async () => {
    const harnessCode = `
public class Main {
    public static void main(String[] args) {
        Solution sol = new Solution();
        int res = sol.multiply(3, 4);
        boolean passed = (res == 12);
        System.out.println("---TEST_RESULT_START---");
        System.out.println("{\\"testIndex\\":0,\\"passed\\":" + passed + ",\\"input\\":\\"3, 4\\",\\"expected\\":\\"12\\",\\"actual\\":\\"" + res + "\\"}");
        System.out.println("---TEST_RESULT_END---");
        System.out.println("---SUMMARY_START---");
        System.out.println("{\\"passedCount\\":" + (passed ? 1 : 0) + ",\\"totalCount\\":1,\\"allPassed\\":" + passed + "}");
        System.out.println("---SUMMARY_END---");
    }
}
`;
    const solutionCode = `
public class Solution {
    public int multiply(int a, int b) {
        return a * b;
    }
}
`;
    const result = await dryRunProblem(
      harnessCode,
      [{ input_payload: '3, 4', expected_output: '12' }],
      solutionCode
    );

    expect(result.verdict).toBe('ACCEPTED');
    expect(result.passedCount).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.results[0].passed).toBe(true);
  });
});

describe('Database Schema & Migrations for Custom Problems', () => {
  it('creates custom_problems and custom_problem_runs tables, alters problems, and is idempotent', () => {
    const db = new DatabaseConstructor(':memory:');
    db.pragma('foreign_keys = ON');

    // Run migrations first time
    runMigrations(db);

    // Verify problems table has is_published and updated_at
    const problemColumns = db.prepare('PRAGMA table_info(problems)').all() as Array<{ name: string }>;
    const colNames = problemColumns.map((c) => c.name);
    expect(colNames).toContain('is_published');
    expect(colNames).toContain('updated_at');

    // Verify custom_problems table exists
    const customProbColumns = db.prepare('PRAGMA table_info(custom_problems)').all() as Array<{ name: string }>;
    const cpColNames = customProbColumns.map((c) => c.name);
    expect(cpColNames).toContain('id');
    expect(cpColNames).toContain('visitor_id');
    expect(cpColNames).toContain('title');
    expect(cpColNames).toContain('problem_statement');
    expect(cpColNames).toContain('statement_hash');
    expect(cpColNames).toContain('code');
    expect(cpColNames).toContain('custom_test_cases_json');
    expect(cpColNames).toContain('promoted_problem_id');
    expect(cpColNames).toContain('created_at');
    expect(cpColNames).toContain('updated_at');

    // Verify custom_problem_runs table exists
    const runColumns = db.prepare('PRAGMA table_info(custom_problem_runs)').all() as Array<{ name: string }>;
    const runColNames = runColumns.map((c) => c.name);
    expect(runColNames).toContain('id');
    expect(runColNames).toContain('custom_problem_id');
    expect(runColNames).toContain('visitor_id');
    expect(runColNames).toContain('code');
    expect(runColNames).toContain('verdict');
    expect(runColNames).toContain('passed_count');
    expect(runColNames).toContain('total_count');
    expect(runColNames).toContain('runtime_ms');
    expect(runColNames).toContain('output_summary');
    expect(runColNames).toContain('error_output');
    expect(runColNames).toContain('created_at');

    // Verify indexes exist
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index'")
      .all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain('idx_custom_problems_visitor');
    expect(indexNames).toContain('idx_custom_problems_updated');
    expect(indexNames).toContain('idx_custom_problems_hash');
    expect(indexNames).toContain('idx_custom_problem_runs_cp');
    expect(indexNames).toContain('idx_custom_problem_runs_visitor');

    // Run migrations second time to verify idempotency
    expect(() => runMigrations(db)).not.toThrow();

    db.close();
  });
});

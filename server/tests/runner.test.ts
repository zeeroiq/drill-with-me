import { describe, it, expect } from 'vitest';
import { executeJava, executeJavaRaw } from '../src/runner/executor.js';
import { checkJavaSecurity, stripComments } from '../src/runner/security.js';
import { ExecutionQueue } from '../src/runner/queue.js';

const SAMPLE_HARNESS = `
public class Main {
    public static void main(String[] args) {
        Solution sol = new Solution();
        int passed = 0;
        int total = 2;
        
        // Test 1
        int res1 = sol.add(2, 3);
        boolean p1 = (res1 == 5);
        if (p1) passed++;
        System.out.println("---TEST_RESULT_START---");
        System.out.println("{\\"testIndex\\":0,\\"passed\\":" + p1 + ",\\"input\\":\\"2, 3\\",\\"expected\\":\\"5\\",\\"actual\\":\\"" + res1 + "\\"}");
        System.out.println("---TEST_RESULT_END---");

        // Test 2
        int res2 = sol.add(-1, 1);
        boolean p2 = (res2 == 0);
        if (p2) passed++;
        System.out.println("---TEST_RESULT_START---");
        System.out.println("{\\"testIndex\\":1,\\"passed\\":" + p2 + ",\\"input\\":\\"-1, 1\\",\\"expected\\":\\"0\\",\\"actual\\":\\"" + res2 + "\\"}");
        System.out.println("---TEST_RESULT_END---");

        System.out.println("---SUMMARY_START---");
        System.out.println("{\\"passedCount\\":" + passed + ",\\"totalCount\\":" + total + ",\\"allPassed\\":" + (passed == total) + "}");
        System.out.println("---SUMMARY_END---");
    }
}
`;

describe('Java Execution Runner', () => {
  // 1. Passing solution -> ACCEPTED
  it('should return ACCEPTED when all test cases pass', async () => {
    const solution = `
public class Solution {
    public int add(int a, int b) {
        return a + b;
    }
}
`;
    const result = await executeJava(solution, SAMPLE_HARNESS);
    expect(result.verdict).toBe('ACCEPTED');
    expect(result.passedCount).toBe(2);
    expect(result.totalCount).toBe(2);
    expect(result.results.length).toBe(2);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[1].passed).toBe(true);
    expect(result.runtime_ms).toBeGreaterThanOrEqual(0);
  });

  // 2. Wrong answer solution -> WRONG_ANSWER
  it('should return WRONG_ANSWER when logic is incorrect', async () => {
    const solution = `
public class Solution {
    public int add(int a, int b) {
        return a - b; // incorrect
    }
}
`;
    const result = await executeJava(solution, SAMPLE_HARNESS);
    expect(result.verdict).toBe('WRONG_ANSWER');
    expect(result.passedCount).toBe(0);
    expect(result.totalCount).toBe(2);
    expect(result.results[0].passed).toBe(false);
  });

  // 3. Syntax error -> COMPILE_ERROR
  it('should return COMPILE_ERROR when Java syntax is invalid', async () => {
    const solution = `
public class Solution {
    public int add(int a, int b) {
        return a + ; // syntax error
    }
}
`;
    const result = await executeJava(solution, SAMPLE_HARNESS);
    expect(result.verdict).toBe('COMPILE_ERROR');
    expect(result.errorOutput).toBeDefined();
    expect(result.errorOutput).toContain('error:');
    expect(result.passedCount).toBe(0);
  });

  // 4. Runtime exception -> RUNTIME_ERROR
  it('should return RUNTIME_ERROR on division by zero', async () => {
    const solution = `
public class Solution {
    public int add(int a, int b) {
        return a / 0; // ArithmeticException
    }
}
`;
    const result = await executeJava(solution, SAMPLE_HARNESS);
    expect(result.verdict).toBe('RUNTIME_ERROR');
    expect(result.errorOutput).toMatch(/ArithmeticException|\/ by zero/);
  });

  it('should return RUNTIME_ERROR on NullPointerException', async () => {
    const solution = `
public class Solution {
    public int add(int a, int b) {
        String s = null;
        return s.length(); // NullPointerException
    }
}
`;
    const result = await executeJava(solution, SAMPLE_HARNESS);
    expect(result.verdict).toBe('RUNTIME_ERROR');
    expect(result.errorOutput).toContain('NullPointerException');
  });

  // 5. Infinite loop -> TIME_LIMIT_EXCEEDED
  it('should return TIME_LIMIT_EXCEEDED on infinite loop', async () => {
    const solution = `
public class Solution {
    public int add(int a, int b) {
        while (true) {
            // infinite loop
        }
    }
}
`;
    const result = await executeJava(solution, SAMPLE_HARNESS, {
      timeoutMs: 1500,
    });
    expect(result.verdict).toBe('TIME_LIMIT_EXCEEDED');
    expect(result.errorOutput).toContain('Time Limit Exceeded');
  }, 30000);

  // 6. Security violation -> Rejected before compile
  it('should reject System.exit before compilation', async () => {
    const solution = `
public class Solution {
    public int add(int a, int b) {
        System.exit(0);
        return 0;
    }
}
`;
    const result = await executeJava(solution, SAMPLE_HARNESS);
    expect(result.verdict).toBe('SECURITY_VIOLATION');
    expect(result.errorOutput).toContain('System.exit');
  });

  it('should reject Runtime.getRuntime() before compilation', async () => {
    const solution = `
public class Solution {
    public int add(int a, int b) {
        try {
            Runtime.getRuntime().exec("ls");
        } catch (Exception e) {}
        return 0;
    }
}
`;
    const result = await executeJava(solution, SAMPLE_HARNESS);
    expect(result.verdict).toBe('SECURITY_VIOLATION');
    expect(result.errorOutput).toContain('Runtime');
  });

  it('should reject java.io.File access before compilation', async () => {
    const solution = `
import java.io.File;
public class Solution {
    public int add(int a, int b) {
        File f = new File("/tmp");
        return 0;
    }
}
`;
    const result = await executeJava(solution, SAMPLE_HARNESS);
    expect(result.verdict).toBe('SECURITY_VIOLATION');
    expect(result.errorOutput).toContain('File');
  });

  it('should reject java.net access before compilation', async () => {
    const solution = `
import java.net.Socket;
public class Solution {
    public int add(int a, int b) {
        Socket s = null;
        return 0;
    }
}
`;
    const result = await executeJava(solution, SAMPLE_HARNESS);
    expect(result.verdict).toBe('SECURITY_VIOLATION');
    expect(result.errorOutput).toContain('net');
  });

  it('should reject reflection and ClassLoader abuse', async () => {
    const solution = `
public class Solution {
    public int add(int a, int b) {
        try {
            Class<?> c = Class.forName("java.lang.Runtime");
        } catch (Exception e) {}
        return 0;
    }
}
`;
    const result = await executeJava(solution, SAMPLE_HARNESS);
    expect(result.verdict).toBe('SECURITY_VIOLATION');
    expect(result.errorOutput).toContain('reflection');
  });

  // Security comment stripping & evasion prevention
  it('should allow legitimate comments containing security keywords', async () => {
    const solution = `
public class Solution {
    // Note for reviewer: we do not use System.exit, ProcessBuilder, or Runtime.getRuntime here
    /* Also no java.io.File or java.net.Socket is needed */
    public int add(int a, int b) {
        return a + b;
    }
}
`;
    const check = checkJavaSecurity(solution);
    expect(check.safe).toBe(true);

    const result = await executeJava(solution, SAMPLE_HARNESS);
    expect(result.verdict).toBe('ACCEPTED');
  });

  it('should catch malicious calls obscured with comments', () => {
    const sneaky = `
public class Solution {
    public int add(int a, int b) {
        System./* clever comment */exit(0);
        return 0;
    }
}
`;
    const check = checkJavaSecurity(sneaky);
    expect(check.safe).toBe(false);
    expect(check.reason).toContain('System.exit');
  });

  it('should catch malicious calls encoded with unicode escapes', () => {
    const unicodeSneaky = `
public class Solution {
    public int add(int a, int b) {
        System\\u002eexit(0);
        return 0;
    }
}
`;
    const check = checkJavaSecurity(unicodeSneaky);
    expect(check.safe).toBe(false);
    expect(check.reason).toContain('System.exit');
  });

  // Output limit
  it('should terminate and return OUTPUT_LIMIT_EXCEEDED on excessive output', async () => {
    const solution = `
public class Solution {
    public int add(int a, int b) {
        for (int i = 0; i < 20000; i++) {
            System.out.println("Output spam line " + i + " aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        }
        return a + b;
    }
}
`;
    const result = await executeJava(solution, SAMPLE_HARNESS, {
      maxOutputBytes: 1024,
    });
    expect(result.verdict).toBe('OUTPUT_LIMIT_EXCEEDED');
  });

  // Queue concurrency
  it('should limit concurrency with ExecutionQueue', async () => {
    const queue = new ExecutionQueue({ maxConcurrent: 2, queueTimeoutMs: 5000 });
    let concurrentRunning = 0;
    let maxSeenConcurrent = 0;

    const task = async () => {
      return queue.run(async () => {
        concurrentRunning++;
        if (concurrentRunning > maxSeenConcurrent) {
          maxSeenConcurrent = concurrentRunning;
        }
        await new Promise((r) => setTimeout(r, 100));
        concurrentRunning--;
        return true;
      });
    };

    const results = await Promise.all([task(), task(), task(), task()]);
    expect(results.every(Boolean)).toBe(true);
    expect(maxSeenConcurrent).toBeLessThanOrEqual(2);
  });
});

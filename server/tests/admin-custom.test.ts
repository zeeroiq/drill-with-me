import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable, PassThrough } from 'node:stream';
import http from 'node:http';
import { app } from '../src/index.js';
import { initDb, closeDb } from '../src/db/index.js';
import { resetCustomRunRateLimits } from '../src/routes/custom-problems.js';

interface ResponseData<T = any> {
  status: number;
  headers: http.OutgoingHttpHeaders;
  body: string;
  json: () => Promise<T>;
  text: () => Promise<string>;
}

class TestClient {
  public cookies: Map<string, string> = new Map();

  async request<T = any>(
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string | object;
    } = {}
  ): Promise<ResponseData<T>> {
    const method = options.method?.toUpperCase() || 'GET';
    const reqHeaders: Record<string, string> = {
      host: 'localhost',
      'user-agent': 'TestAgent/1.0',
      ...(options.headers || {}),
    };

    if (this.cookies.size > 0) {
      const cookieHeader = Array.from(this.cookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      reqHeaders['cookie'] = cookieHeader;
    }

    let bodyBuffer: Buffer = Buffer.alloc(0);
    if (options.body) {
      if (typeof options.body === 'string') {
        bodyBuffer = Buffer.from(options.body);
        if (!reqHeaders['content-type']) {
          reqHeaders['content-type'] = 'application/json';
        }
      } else {
        bodyBuffer = Buffer.from(JSON.stringify(options.body));
        reqHeaders['content-type'] = 'application/json';
      }
      reqHeaders['content-length'] = bodyBuffer.length.toString();
    }

    const stream = Readable.from(bodyBuffer.length > 0 ? [bodyBuffer] : []);
    const req = Object.assign(stream, {
      method,
      url: path,
      headers: reqHeaders,
      socket: { remoteAddress: '127.0.0.1' },
      connection: { remoteAddress: '127.0.0.1' },
    });

    const socket = new PassThrough();
    const res = new http.ServerResponse(req as any);
    res.assignSocket(socket as any);

    return new Promise<ResponseData<T>>((resolve, reject) => {
      let rawOutput = '';
      socket.on('data', (chunk) => {
        rawOutput += chunk.toString();
      });

      res.on('finish', () => {
        const setCookie = res.getHeader('set-cookie');
        if (setCookie) {
          const cookieList = Array.isArray(setCookie) ? setCookie : [String(setCookie)];
          for (const c of cookieList) {
            const firstPart = c.split(';')[0];
            const eqIdx = firstPart.indexOf('=');
            if (eqIdx !== -1) {
              const name = firstPart.slice(0, eqIdx).trim();
              const val = firstPart.slice(eqIdx + 1).trim();
              if (c.includes('Max-Age=0') || !val) {
                this.cookies.delete(name);
              } else {
                this.cookies.set(name, val);
              }
            }
          }
        }

        let body = '';
        const bodyIdx = rawOutput.indexOf('\r\n\r\n');
        if (bodyIdx !== -1) {
          body = rawOutput.slice(bodyIdx + 4);
        } else {
          body = rawOutput;
        }

        resolve({
          status: res.statusCode,
          headers: res.getHeaders(),
          body,
          json: async () => (body ? JSON.parse(body) : ({} as T)),
          text: async () => body,
        });
      });

      res.on('error', reject);
      socket.on('error', reject);

      app.handle(req as any, res as any);
    });
  }
}

async function createAdminClient(): Promise<TestClient> {
  const client = new TestClient();
  const loginRes = await client.request('/api/admin/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' },
  });
  expect(loginRes.status).toBe(200);
  return client;
}

const SAMPLE_HARNESS = `
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Solution sol = new Solution();
        int res = sol.multiply(3, 4);
        boolean passed = res == 12;
        System.out.println("---TEST_RESULT_START---");
        System.out.println("{\\"testIndex\\":0,\\"passed\\":" + passed + ",\\"input\\":\\"3, 4\\",\\"expected\\":\\"12\\",\\"actual\\":\\"" + res + "\\"}");
        System.out.println("---TEST_RESULT_END---");
        System.out.println("---SUMMARY_START---");
        System.out.println("{\\"passedCount\\":" + (passed ? 1 : 0) + ",\\"totalCount\\":1,\\"allPassed\\":" + passed + "}");
        System.out.println("---SUMMARY_END---");
    }
}
`;

const SAMPLE_SOLUTION = `
class Solution {
    public int multiply(int a, int b) {
        return a * b;
    }
}
`;

beforeAll(() => {
  initDb();
  resetCustomRunRateLimits();
});

afterAll(() => {
  closeDb();
});

describe('Admin Problem Management & Anonymous Custom Problem Mode', () => {
  let createdProblemId: number;
  let promotedProblemId: number;
  const draftSlug = `draft-multiply-${Date.now()}`;
  let visitorAClient: TestClient;
  let visitorBClient: TestClient;
  let customProblemId: string;

  it('1. Draft problem is hidden from public GET /api/problems but visible in GET /api/admin/problems', async () => {
    const admin = await createAdminClient();

    // Admin creates draft problem with is_published = 0
    const createRes = await admin.request('/api/admin/problems', {
      method: 'POST',
      body: {
        title: 'Draft Multiply Problem',
        slug: draftSlug,
        difficulty: 'Easy',
        description_md: 'Multiply two numbers together.',
        starter_code: SAMPLE_SOLUTION,
        test_harness_code: SAMPLE_HARNESS,
        is_published: 0,
        test_cases: [
          {
            input_display: '3, 4',
            input_payload: '3 4',
            expected_output: '12',
            is_hidden: 0,
            sort_order: 1,
          },
        ],
      },
    });

    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.success).toBe(true);
    expect(created.id).toBeDefined();
    createdProblemId = created.id;

    // Admin GET /api/admin/problems sees draft
    const adminListRes = await admin.request('/api/admin/problems');
    expect(adminListRes.status).toBe(200);
    const adminProblems = await adminListRes.json();
    const foundInAdmin = adminProblems.find((p: any) => p.slug === draftSlug);
    expect(foundInAdmin).toBeDefined();
    expect(foundInAdmin.is_published).toBe(0);

    // Public visitor client
    const publicClient = new TestClient();
    const publicListRes = await publicClient.request('/api/problems');
    expect(publicListRes.status).toBe(200);
    const publicProblems = await publicListRes.json();
    const foundInPublic = publicProblems.find((p: any) => p.slug === draftSlug);
    expect(foundInPublic).toBeUndefined();

    // Public GET /api/problems/:slug returns 404
    const detailRes = await publicClient.request(`/api/problems/${draftSlug}`);
    expect(detailRes.status).toBe(404);

    // Public POST /api/problems/:slug/run returns 404
    const runRes = await publicClient.request(`/api/problems/${draftSlug}/run`, {
      method: 'POST',
      body: { code: SAMPLE_SOLUTION },
    });
    expect(runRes.status).toBe(404);
  });

  it('2. Admin dry-runs, updates, publishes problem, and anonymous visitor can then access it', async () => {
    const admin = await createAdminClient();

    // Admin dry-runs code against test harness
    const dryRunRes = await admin.request('/api/admin/problems/dry-run', {
      method: 'POST',
      body: {
        solution_code: SAMPLE_SOLUTION,
        test_harness_code: SAMPLE_HARNESS,
      },
    });

    expect(dryRunRes.status).toBe(200);
    const dryRunData = await dryRunRes.json();
    expect(dryRunData.verdict).toBe('ACCEPTED');
    expect(dryRunData.passedCount).toBe(1);
    expect(dryRunData.totalCount).toBe(1);

    // Admin updates and publishes problem (is_published = 1)
    const updateRes = await admin.request(`/api/admin/problems/${createdProblemId}`, {
      method: 'PUT',
      body: {
        title: 'Multiply Problem Published',
        slug: draftSlug,
        difficulty: 'Easy',
        description_md: 'Multiply two numbers together in Java.',
        starter_code: SAMPLE_SOLUTION,
        test_harness_code: SAMPLE_HARNESS,
        is_published: 1,
        test_cases: [
          {
            input_display: '3, 4',
            input_payload: '3 4',
            expected_output: '12',
            is_hidden: 0,
            sort_order: 1,
          },
        ],
      },
    });
    expect(updateRes.status).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.success).toBe(true);

    // Anonymous visitor now accesses public endpoints
    const publicClient = new TestClient();
    const publicListRes = await publicClient.request('/api/problems');
    const publicProblems = await publicListRes.json();
    const foundPublished = publicProblems.find((p: any) => p.slug === draftSlug);
    expect(foundPublished).toBeDefined();

    // Visitor views problem details
    const detailRes = await publicClient.request(`/api/problems/${draftSlug}`);
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.title).toBe('Multiply Problem Published');
    expect(detail.sampleCases.length).toBe(1);

    // Visitor runs code against published problem
    const runRes = await publicClient.request(`/api/problems/${draftSlug}/run`, {
      method: 'POST',
      body: { code: SAMPLE_SOLUTION },
    });
    expect(runRes.status).toBe(200);
    const runData = await runRes.json();
    expect(runData.verdict).toBe('ACCEPTED');
  });

  it('3. Anonymous visitor creates custom problem, auto-saves, and runs standalone Java code', async () => {
    visitorAClient = new TestClient();

    // First request assigns visitor_id cookie
    await visitorAClient.request('/api/problems');
    const visitorCookie = visitorAClient.cookies.get('visitor_id');
    expect(visitorCookie).toBeDefined();

    const initialCode = `
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int x = sc.nextInt();
            System.out.println(x * 3);
        }
    }
}
`;

    // Create custom problem
    const createRes = await visitorAClient.request('/api/custom-problems', {
      method: 'POST',
      body: {
        title: 'Triple A Number',
        problem_statement: 'Read an integer from standard input and print its triple.',
        code: initialCode,
        custom_test_cases: [
          { stdin: '4\n', expected_output: '12' },
          { stdin: '7\n', expected_output: '21' },
        ],
      },
    });

    expect(createRes.status).toBe(201);
    const createdData = await createRes.json();
    expect(createdData.id).toBeDefined();
    customProblemId = createdData.id;

    // List custom problems for Visitor A
    const listRes = await visitorAClient.request('/api/custom-problems');
    expect(listRes.status).toBe(200);
    const problems = await listRes.json();
    expect(problems.length).toBeGreaterThanOrEqual(1);
    const myProblem = problems.find((p: any) => p.id === customProblemId);
    expect(myProblem).toBeDefined();
    expect(myProblem.title).toBe('Triple A Number');
    expect(myProblem.custom_test_cases.length).toBe(2);

    // Auto-save updates via PUT
    const updatedCode = `
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        while (sc.hasNextInt()) {
            int val = sc.nextInt();
            System.out.println(val * 3);
        }
    }
}
`;
    const putRes = await visitorAClient.request(`/api/custom-problems/${customProblemId}`, {
      method: 'PUT',
      body: {
        title: 'Triple An Integer Updated',
        problem_statement: 'Read integers from standard input and print each multiplied by 3.',
        code: updatedCode,
        custom_test_cases: [
          { stdin: '5\n', expected_output: '15' },
          { stdin: '10\n', expected_output: '30' },
        ],
      },
    });
    expect(putRes.status).toBe(200);

    // Run standalone Java code
    const runRes = await visitorAClient.request(`/api/custom-problems/${customProblemId}/run`, {
      method: 'POST',
      body: {},
    });
    expect(runRes.status).toBe(200);
    const runResult = await runRes.json();
    expect(runResult.verdict).toBe('PASSED');
    expect(runResult.passedCount).toBe(2);
    expect(runResult.totalCount).toBe(2);
    expect(runResult.results.length).toBe(2);

    // Verify detail endpoint reflects run
    const detailRes = await visitorAClient.request(`/api/custom-problems/${customProblemId}`);
    expect(detailRes.status).toBe(200);
    const detailData = await detailRes.json();
    expect(detailData.title).toBe('Triple An Integer Updated');
    expect(detailData.runs.length).toBe(1);
    expect(detailData.runs[0].verdict).toBe('PASSED');
  });

  it("4. Ownership isolation: Visitor B cannot read, update, or run Visitor A's custom problem", async () => {
    visitorBClient = new TestClient();
    // Initialize Visitor B session with a distinct visitor_id
    await visitorBClient.request('/api/problems');

    const visitorACookie = visitorAClient.cookies.get('visitor_id');
    const visitorBCookie = visitorBClient.cookies.get('visitor_id');
    expect(visitorACookie).not.toBe(visitorBCookie);

    // Visitor B attempts GET
    const getRes = await visitorBClient.request(`/api/custom-problems/${customProblemId}`);
    expect(getRes.status).toBe(403);
    const getErr = await getRes.json();
    expect(getErr.error).toContain('Forbidden');

    // Visitor B attempts PUT
    const putRes = await visitorBClient.request(`/api/custom-problems/${customProblemId}`, {
      method: 'PUT',
      body: { title: 'Hacked Title' },
    });
    expect(putRes.status).toBe(403);

    // Visitor B attempts POST run
    const runRes = await visitorBClient.request(`/api/custom-problems/${customProblemId}/run`, {
      method: 'POST',
      body: {},
    });
    expect(runRes.status).toBe(403);
  });

  it('5. Admin can view anonymous custom problems and promote one to official problem', async () => {
    const admin = await createAdminClient();

    // Admin lists custom problems
    const listRes = await admin.request('/api/admin/custom-problems');
    expect(listRes.status).toBe(200);
    const adminCustomProblems = await listRes.json();
    const foundCustom = adminCustomProblems.find((cp: any) => cp.id === customProblemId);
    expect(foundCustom).toBeDefined();
    expect(foundCustom.run_count).toBeGreaterThanOrEqual(1);

    // Admin fetches detailed view
    const detailRes = await admin.request(`/api/admin/custom-problems/${customProblemId}`);
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.id).toBe(customProblemId);
    expect(detail.visitor).toBeDefined();
    expect(detail.runs.length).toBeGreaterThanOrEqual(1);

    // Admin promotes custom problem to official public problem
    const promoteSlug = `promoted-triple-${Date.now()}`;
    const promoteRes = await admin.request('/api/admin/problems', {
      method: 'POST',
      body: {
        title: 'Triple Number Official',
        slug: promoteSlug,
        difficulty: 'Easy',
        description_md: detail.problem_statement,
        starter_code: SAMPLE_SOLUTION,
        test_harness_code: SAMPLE_HARNESS,
        is_published: 1,
        source_custom_problem_id: customProblemId,
        test_cases: [
          {
            input_display: '5',
            input_payload: '5',
            expected_output: '15',
            is_hidden: 0,
            sort_order: 1,
          },
        ],
      },
    });

    expect(promoteRes.status).toBe(201);
    const promoteData = await promoteRes.json();
    expect(promoteData.success).toBe(true);
    expect(promoteData.id).toBeDefined();
    promotedProblemId = promoteData.id;

    // Verify custom problem now records promoted_problem_id
    const updatedCustomRes = await admin.request(`/api/admin/custom-problems/${customProblemId}`);
    const updatedCustom = await updatedCustomRes.json();
    expect(updatedCustom.promoted_problem_id).toBe(promoteData.id);
    expect(updatedCustom.is_promoted).toBe(true);
    expect(updatedCustom.promoted_problem?.slug).toBe(promoteSlug);

    // Verify filter=promoted returns it
    const filteredRes = await admin.request('/api/admin/custom-problems?filter=promoted');
    const filtered = await filteredRes.json();
    const foundPromoted = filtered.find((cp: any) => cp.id === customProblemId);
    expect(foundPromoted).toBeDefined();
  });

  it('6. Admin overview and visitor drilldown include custom problem metrics', async () => {
    const admin = await createAdminClient();

    // Overview stats
    const overviewRes = await admin.request('/api/admin/overview');
    expect(overviewRes.status).toBe(200);
    const overview = await overviewRes.json();
    expect(overview.totalCustomProblems).toBeGreaterThanOrEqual(1);
    expect(overview.totalCustomRuns).toBeGreaterThanOrEqual(1);

    // Visitor drilldown
    const visitorIdA = visitorAClient.cookies.get('visitor_id');
    expect(visitorIdA).toBeDefined();

    const visitorRes = await admin.request(`/api/admin/visitors/${visitorIdA}`);
    expect(visitorRes.status).toBe(200);
    const visitorData = await visitorRes.json();
    expect(visitorData.customProblems).toBeDefined();
    expect(Array.isArray(visitorData.customProblems)).toBe(true);
    const found = visitorData.customProblems.find((cp: any) => cp.id === customProblemId);
    expect(found).toBeDefined();
  });

  it('7. Enforces payload size limits on anonymous custom problems', async () => {
    const client = new TestClient();

    // Statement > 20KB
    const hugeStatement = 'A'.repeat(21 * 1024);
    const res1 = await client.request('/api/custom-problems', {
      method: 'POST',
      body: { problem_statement: hugeStatement },
    });
    expect(res1.status).toBe(400);
    const err1 = await res1.json();
    expect(err1.error).toContain('limit');

    // Code > 50KB
    const hugeCode = 'B'.repeat(51 * 1024);
    const res2 = await client.request('/api/custom-problems', {
      method: 'POST',
      body: { code: hugeCode },
    });
    expect(res2.status).toBe(400);

    // > 10 custom test cases
    const elevenCases = Array.from({ length: 11 }, (_, i) => ({
      stdin: `${i}`,
      expected_output: `${i}`,
    }));
    const res3 = await client.request('/api/custom-problems', {
      method: 'POST',
      body: { custom_test_cases: elevenCases },
    });
    expect(res3.status).toBe(400);
    const err3 = await res3.json();
    expect(err3.error).toContain('Maximum 10');
  });

  it('8. Safely deletes problem and unlinks promoted reference', async () => {
    const admin = await createAdminClient();

    // Delete the first created problem
    const delRes = await admin.request(`/api/admin/problems/${createdProblemId}`, {
      method: 'DELETE',
    });
    expect(delRes.status).toBe(200);
    const delData = await delRes.json();
    expect(delData.success).toBe(true);

    // Problem should now return 404
    const getRes = await admin.request(`/api/admin/problems/${createdProblemId}`);
    expect(getRes.status).toBe(404);

    // Delete promoted problem so database returns to clean state
    if (promotedProblemId) {
      const delPromoted = await admin.request(`/api/admin/problems/${promotedProblemId}`, {
        method: 'DELETE',
      });
      expect(delPromoted.status).toBe(200);
    }
  });
});

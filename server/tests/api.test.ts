import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable, PassThrough } from 'node:stream';
import http from 'node:http';
import { validate as uuidValidate } from 'uuid';
import { app } from '../src/index.js';
import { initDb, closeDb, getDb } from '../src/db/index.js';
import { resetLoginRateLimits } from '../src/middleware/auth.js';

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

const VALID_TWO_SUM_CODE = `
class Solution {
    public int[] twoSum(int[] nums, int target) {
        java.util.Map<Integer, Integer> map = new java.util.HashMap<>();
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

const WRONG_TWO_SUM_CODE = `
class Solution {
    public int[] twoSum(int[] nums, int target) {
        return new int[]{0, 0};
    }
}
`;

beforeAll(() => {
  initDb();
});

afterAll(() => {
  closeDb();
});

describe('API Integration Tests', () => {
  // 1. Health Check
  describe('GET /health', () => {
    it('returns 200 with DB connected and Java available', async () => {
      const client = new TestClient();
      const res = await client.request('/health');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('ok');
      expect(json.database).toBe('connected');
      expect(json.java).toBe('available');
      expect(json.timestamp).toBeDefined();
    });
  });

  // 2. Visitor Tracking Middleware
  describe('Visitor Tracking Middleware', () => {
    it('assigns a new visitor_id cookie when not present', async () => {
      const client = new TestClient();
      const res = await client.request('/health');
      expect(res.status).toBe(200);

      const visitorId = client.cookies.get('visitor_id');
      expect(visitorId).toBeDefined();
      expect(uuidValidate(visitorId!)).toBe(true);

      // Verify recorded in DB
      const db = getDb();
      const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(visitorId) as any;
      expect(visitor).toBeDefined();
      expect(visitor.visit_count).toBeGreaterThanOrEqual(1);
    });

    it('increments visit_count on subsequent requests with existing visitor_id', async () => {
      const client = new TestClient();
      await client.request('/health');
      const visitorId = client.cookies.get('visitor_id')!;

      const db = getDb();
      const v1 = db.prepare('SELECT visit_count FROM visitors WHERE id = ?').get(visitorId) as any;
      const count1 = v1.visit_count;

      await client.request('/health');
      const v2 = db.prepare('SELECT visit_count FROM visitors WHERE id = ?').get(visitorId) as any;
      expect(v2.visit_count).toBe(count1 + 1);
    });

    it('records page visits for non-static routes', async () => {
      const client = new TestClient();
      await client.request('/api/problems');
      const visitorId = client.cookies.get('visitor_id')!;

      const db = getDb();
      const visits = db.prepare('SELECT * FROM page_visits WHERE visitor_id = ?').all(visitorId) as any[];
      expect(visits.length).toBeGreaterThanOrEqual(1);
      expect(visits.some((v) => v.path === '/api/problems')).toBe(true);
    });
  });

  // 3. Problems List Endpoint
  describe('GET /api/problems', () => {
    it('returns the 5 seeded problems with initial unsolved status', async () => {
      const client = new TestClient();
      const res = await client.request('/api/problems');
      expect(res.status).toBe(200);

      const problems = await res.json();
      expect(Array.isArray(problems)).toBe(true);
      expect(problems.length).toBe(5);

      const slugs = problems.map((p: any) => p.slug);
      expect(slugs).toContain('two-sum');
      expect(slugs).toContain('valid-palindrome');
      expect(slugs).toContain('valid-parentheses');
      expect(slugs).toContain('best-time-to-buy-and-sell-stock');
      expect(slugs).toContain('maximum-subarray');

      for (const p of problems) {
        expect(p.id).toBeDefined();
        expect(p.title).toBeDefined();
        expect(p.difficulty).toBeDefined();
        expect(p.status).toBe('unsolved');
        expect(p.isSolved).toBe(false);
      }
    });
  });

  // 4. Problem Detail Endpoint
  describe('GET /api/problems/:slug', () => {
    it('returns problem detail with sample test cases and hides hidden test cases and test harness', async () => {
      const client = new TestClient();
      const res = await client.request('/api/problems/two-sum');
      expect(res.status).toBe(200);

      const p = await res.json();
      expect(p.slug).toBe('two-sum');
      expect(p.title).toBe('Two Sum');
      expect(p.difficulty).toBe('Easy');
      expect(p.description_md).toContain('Two Sum');
      expect(p.starter_code).toContain('class Solution');
      expect(p.test_harness_code).toBeUndefined(); // harness must be omitted!

      // sample cases must be visible cases only
      expect(Array.isArray(p.sample_cases)).toBe(true);
      expect(p.sample_cases.length).toBe(2);
      expect(p.sample_cases[0].input_display).toBeDefined();
      expect(p.sample_cases[0].expected_output).toBeDefined();
      expect(p.sample_cases[0].input_payload).toBeUndefined(); // omitted from public sample_cases

      expect(p.userStatus).toBe('unsolved');
    });

    it('returns 404 for non-existent problem slug', async () => {
      const client = new TestClient();
      const res = await client.request('/api/problems/non-existent-problem');
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Problem not found');
    });
  });

  // 5. Code Execution: Run against sample cases
  describe('POST /api/problems/:slug/run', () => {
    it('runs code against sample cases and returns ACCEPTED without creating submission', async () => {
      const client = new TestClient();
      const db = getDb();
      const subCountBefore = (db.prepare('SELECT COUNT(*) as c FROM submissions').get() as any).c;

      const res = await client.request('/api/problems/two-sum/run', {
        method: 'POST',
        body: JSON.stringify({ code: VALID_TWO_SUM_CODE }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.verdict).toBe('ACCEPTED');
      expect(json.passedCount).toBe(2);
      expect(json.totalCount).toBe(2);
      expect(json.testResults).toBeDefined();
      expect(json.testResults.length).toBe(2);

      // Verify NOT stored in submissions
      const subCountAfter = (db.prepare('SELECT COUNT(*) as c FROM submissions').get() as any).c;
      expect(subCountAfter).toBe(subCountBefore);
    });

    it('returns WRONG_ANSWER for incorrect logic on sample cases', async () => {
      const client = new TestClient();
      const res = await client.request('/api/problems/two-sum/run', {
        method: 'POST',
        body: JSON.stringify({ code: WRONG_TWO_SUM_CODE }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.verdict).toBe('WRONG_ANSWER');
      expect(json.passedCount).toBe(0);
    });

    it('returns 400 when code is missing', async () => {
      const client = new TestClient();
      const res = await client.request('/api/problems/two-sum/run', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Code is required');
    });
  });

  // 6. Code Submission: Submit against full test suite
  describe('POST /api/problems/:slug/submit', () => {
    it('submits valid code, passes all 5 test cases, and marks problem as solved', async () => {
      const client = new TestClient();
      const res = await client.request('/api/problems/two-sum/submit', {
        method: 'POST',
        body: JSON.stringify({ code: VALID_TWO_SUM_CODE }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.verdict).toBe('ACCEPTED');
      expect(json.passedCount).toBe(5);
      expect(json.totalCount).toBe(5);
      expect(json.submission_id).toBeDefined();

      // Check problem list reflects solved status for this visitor
      const listRes = await client.request('/api/problems');
      const list = await listRes.json();
      const twoSum = list.find((p: any) => p.slug === 'two-sum');
      expect(twoSum.status).toBe('solved');
      expect(twoSum.isSolved).toBe(true);

      // Check problem detail reflects solved status
      const detailRes = await client.request('/api/problems/two-sum');
      const detail = await detailRes.json();
      expect(detail.userStatus).toBe('solved');
      expect(detail.latestCode).toContain('twoSum');

      // Check submissions list
      const subsRes = await client.request('/api/problems/two-sum/submissions');
      const subs = await subsRes.json();
      expect(subs.length).toBeGreaterThanOrEqual(1);
      expect(subs[0].verdict).toBe('ACCEPTED');
      expect(subs[0].code).toContain('twoSum');
    });

    it('submits wrong code and marks problem as attempted', async () => {
      const client = new TestClient();
      const res = await client.request('/api/problems/valid-palindrome/submit', {
        method: 'POST',
        body: JSON.stringify({
          code: `
class Solution {
    public boolean isPalindrome(String s) {
        return false;
    }
}
`,
        }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.verdict).toBe('WRONG_ANSWER');

      const listRes = await client.request('/api/problems');
      const list = await listRes.json();
      const palindrome = list.find((p: any) => p.slug === 'valid-palindrome');
      expect(palindrome.status).toBe('attempted');
      expect(palindrome.isSolved).toBe(false);
      expect(palindrome.isAttempted).toBe(true);
    });
  });

  // 7. Admin Authentication & Protection
  describe('Admin Routes & Authentication', () => {
    it('returns 401 when accessing admin overview unauthenticated', async () => {
      const client = new TestClient();
      const res = await client.request('/api/admin/overview');
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 401 on login with invalid credentials', async () => {
      const client = new TestClient();
      const res = await client.request('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Invalid credentials');
    });

    it('returns 200 and sets admin_session cookie on valid login', async () => {
      const client = new TestClient();
      const res = await client.request('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.username).toBe('admin');
      expect(client.cookies.get('admin_session')).toBeDefined();

      // Check /api/admin/me
      const meRes = await client.request('/api/admin/me');
      expect(meRes.status).toBe(200);
      const me = await meRes.json();
      expect(me.authenticated).toBe(true);
      expect(me.username).toBe('admin');
    });

    it('returns overview statistics when authenticated as admin', async () => {
      const client = new TestClient();
      await client.request('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      });

      const res = await client.request('/api/admin/overview');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.totalVisitors).toBeGreaterThanOrEqual(1);
      expect(data.totalPageVisits).toBeGreaterThanOrEqual(1);
      expect(data.totalSubmissions).toBeGreaterThanOrEqual(1);
      expect(typeof data.acceptedRate).toBe('number');
      expect(Array.isArray(data.problemStats)).toBe(true);
      expect(data.problemStats.length).toBe(5);

      const twoSumStat = data.problemStats.find((p: any) => p.slug === 'two-sum');
      expect(twoSumStat).toBeDefined();
      expect(twoSumStat.attemptsCount).toBeGreaterThanOrEqual(1);
      expect(twoSumStat.solvedCount).toBeGreaterThanOrEqual(1);
    });

    it('returns visitor list with drilldown details', async () => {
      const client = new TestClient();
      await client.request('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      });

      const listRes = await client.request('/api/admin/visitors');
      expect(listRes.status).toBe(200);

      const visitors = await listRes.json();
      expect(Array.isArray(visitors)).toBe(true);
      expect(visitors.length).toBeGreaterThanOrEqual(1);

      const targetVisitor = visitors[0];
      expect(targetVisitor.id).toBeDefined();
      expect(targetVisitor.visit_count).toBeGreaterThanOrEqual(1);

      // Drilldown into target visitor
      const drillRes = await client.request(`/api/admin/visitors/${targetVisitor.id}`);
      expect(drillRes.status).toBe(200);

      const detail = await drillRes.json();
      expect(detail.visitor.id).toBe(targetVisitor.id);
      expect(Array.isArray(detail.pageVisits)).toBe(true);
      expect(Array.isArray(detail.submissions)).toBe(true);
    });

    it('logs out successfully and clears admin session', async () => {
      const client = new TestClient();
      await client.request('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      });

      const logoutRes = await client.request('/api/admin/logout', { method: 'POST' });
      expect(logoutRes.status).toBe(200);

      const overRes = await client.request('/api/admin/overview');
      expect(overRes.status).toBe(401);
    });

    it('rate limits login after 5 failed attempts in one minute', async () => {
      resetLoginRateLimits();
      const client = new TestClient();

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        const r = await client.request('/api/admin/login', {
          method: 'POST',
          body: JSON.stringify({ username: 'admin', password: 'bad' }),
        });
        expect(r.status).toBe(401);
      }

      // 6th attempt should be blocked with 429
      const blockedRes = await client.request('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'bad' }),
      });
      expect(blockedRes.status).toBe(429);
      const json = await blockedRes.json();
      expect(json.error).toContain('Too many login attempts');
      resetLoginRateLimits();
    });
  });
});

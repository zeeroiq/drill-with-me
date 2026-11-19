import http from 'node:http';
import { app } from '../server/dist/index.js';
import { initDb, closeDb } from '../server/dist/db/index.js';

async function runE2E() {
  console.log('--- Starting Live End-to-End Verification ---');

  // Initialize DB in test file
  initDb('./data/test-e2e.db');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Server listening on ${baseUrl}`);

  let visitorCookie = '';
  let adminCookie = '';

  // 1. Health check
  console.log('\n1. Checking GET /health ...');
  const resHealth = await fetch(`${baseUrl}/health`);
  const dataHealth = await resHealth.json();
  console.log(`Status: ${resHealth.status}`, dataHealth);
  if (dataHealth.status !== 'ok') throw new Error('Health check failed');

  // 2. Problem list & visitor cookie
  console.log('\n2. Checking GET /api/problems & visitor tracking ...');
  const resProblems = await fetch(`${baseUrl}/api/problems`);
  const setCookie = resProblems.headers.get('set-cookie');
  console.log(`Status: ${resProblems.status}, Set-Cookie: ${setCookie}`);
  if (setCookie && setCookie.includes('visitor_id=')) {
    visitorCookie = setCookie.split(';')[0];
    console.log(`Captured visitor cookie: ${visitorCookie}`);
  }
  const dataProblems = await resProblems.json();
  console.log(`Found ${dataProblems.length} problems. Slugs:`, dataProblems.map(p => p.slug));
  if (dataProblems.length !== 5) throw new Error('Expected 5 seeded problems');

  // 3. Problem detail
  console.log('\n3. Checking GET /api/problems/two-sum ...');
  const resTwoSum = await fetch(`${baseUrl}/api/problems/two-sum`, {
    headers: { Cookie: visitorCookie }
  });
  const dataTwoSum = await resTwoSum.json();
  console.log(`Problem: ${dataTwoSum.title}, Difficulty: ${dataTwoSum.difficulty}`);
  console.log(`Visible test cases: ${dataTwoSum.sample_cases?.length}`);
  if (!dataTwoSum.starter_code || dataTwoSum.sample_cases?.length !== 2) throw new Error('Problem detail mismatch');

  // 4. Run sample tests
  console.log('\n4. Checking POST /api/problems/two-sum/run with passing solution ...');
  const passingSolution = `
  import java.util.*;
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
  const resRun = await fetch(`${baseUrl}/api/problems/two-sum/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: visitorCookie
    },
    body: JSON.stringify({ code: passingSolution })
  });
  const dataRun = await resRun.json();
  console.log('Run result:', {
    verdict: dataRun.verdict,
    passedCount: dataRun.passedCount,
    totalCount: dataRun.totalCount,
    runtime_ms: dataRun.runtime_ms
  });
  if (dataRun.verdict !== 'ACCEPTED' || dataRun.passedCount !== 2) throw new Error('Run sample failed');

  // 5. Submit solution
  console.log('\n5. Checking POST /api/problems/two-sum/submit ...');
  const resSubmit = await fetch(`${baseUrl}/api/problems/two-sum/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: visitorCookie
    },
    body: JSON.stringify({ code: passingSolution })
  });
  const dataSubmit = await resSubmit.json();
  console.log('Submit result:', {
    verdict: dataSubmit.verdict,
    passedCount: dataSubmit.passedCount,
    totalCount: dataSubmit.totalCount,
    solved: dataSubmit.solved
  });
  if (dataSubmit.verdict !== 'ACCEPTED' || dataSubmit.passedCount !== 5 || !dataSubmit.solved) {
    throw new Error('Submit failed');
  }

  // 6. Verify problem status updated to solved
  console.log('\n6. Checking GET /api/problems for solved status ...');
  const resProblemsAfter = await fetch(`${baseUrl}/api/problems`, {
    headers: { Cookie: visitorCookie }
  });
  const dataProblemsAfter = await resProblemsAfter.json();
  const twoSumAfter = dataProblemsAfter.find(p => p.slug === 'two-sum');
  console.log(`Two Sum status for visitor: ${twoSumAfter?.status}`);
  if (twoSumAfter?.status !== 'solved') throw new Error('Expected solved status');

  // 7. Admin unauthenticated access
  console.log('\n7. Checking GET /api/admin/overview without auth (expect 401) ...');
  const resAdminUnauth = await fetch(`${baseUrl}/api/admin/overview`);
  console.log(`Status: ${resAdminUnauth.status}`);
  if (resAdminUnauth.status !== 401) throw new Error('Expected 401 for unauthenticated admin access');

  // 8. Admin login
  console.log('\n8. Checking POST /api/admin/login ...');
  const resLogin = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: visitorCookie },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  console.log(`Login status: ${resLogin.status}`);
  const cookies = resLogin.headers.getSetCookie ? resLogin.headers.getSetCookie() : [resLogin.headers.get('set-cookie')];
  console.log('Login Set-Cookies:', cookies);
  const adminCookieHeader = cookies.find(c => c && c.includes('admin_session='));
  if (adminCookieHeader) {
    adminCookie = adminCookieHeader.split(';')[0];
    console.log(`Admin session cookie acquired: ${adminCookie}`);
  } else {
    throw new Error('Admin login did not set session cookie');
  }

  // 9. Admin overview
  console.log('\n9. Checking GET /api/admin/overview with admin cookie ...');
  const resAdminOverview = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: { Cookie: `${visitorCookie}; ${adminCookie}` }
  });
  const dataOverview = await resAdminOverview.json();
  console.log('Admin Overview:', dataOverview);
  if (dataOverview.totalVisitors < 1 || dataOverview.totalSubmissions < 1) {
    throw new Error('Admin overview metrics missing expected activity');
  }

  // 10. Admin visitors list & drilldown
  console.log('\n10. Checking GET /api/admin/visitors ...');
  const resAdminVisitors = await fetch(`${baseUrl}/api/admin/visitors`, {
    headers: { Cookie: `${visitorCookie}; ${adminCookie}` }
  });
  const dataVisitors = await resAdminVisitors.json();
  console.log(`Found ${dataVisitors.length} visitors. First visitor:`, dataVisitors[0]);
  if (!dataVisitors.length) throw new Error('No visitors returned');

  const visitorId = dataVisitors[0].id;
  console.log(`\n11. Checking GET /api/admin/visitors/${visitorId} drilldown ...`);
  const resDrilldown = await fetch(`${baseUrl}/api/admin/visitors/${visitorId}`, {
    headers: { Cookie: `${visitorCookie}; ${adminCookie}` }
  });
  const dataDrilldown = await resDrilldown.json();
  console.log(`Visitor visits logged: ${dataDrilldown.pageVisits?.length}`);
  console.log(`Visitor submissions logged: ${dataDrilldown.submissions?.length}`);
  if (!dataDrilldown.submissions?.length) throw new Error('Drilldown missing submissions');

  // 12. Static SPA serving
  console.log('\n12. Checking GET / (static SPA serving) ...');
  const resSpa = await fetch(`${baseUrl}/`);
  const textSpa = await resSpa.text();
  console.log(`Status: ${resSpa.status}, Content-Type: ${resSpa.headers.get('content-type')}`);
  if (!textSpa.includes('<div id="root">') && !textSpa.includes('DrillWithMe')) {
    throw new Error('SPA index.html not served properly');
  }

  server.close();
  closeDb();
  console.log('\n========================================');
  console.log(' ALL END-TO-END VERIFICATIONS PASSED! ');
  console.log('========================================\n');
  process.exit(0);
}

runE2E().catch(err => {
  console.error('E2E Verification Failed:', err);
  process.exit(1);
});

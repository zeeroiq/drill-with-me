import http from 'node:http';
import { app } from '../server/dist/index.js';
import { initDb, closeDb, getDb } from '../server/dist/db/index.js';

async function runE2E() {
  console.log('--- Starting Custom Problem Mode & Admin Management Live E2E Verification ---');

  initDb('./data/test-custom-e2e.db');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Server listening on ${baseUrl}`);

  let visitorA = '';
  let visitorB = '';
  let adminCookie = '';

  // 1. Visitor A provisions a custom problem
  console.log('\n1. Visitor A creates a custom problem ...');
  const resInit = await fetch(`${baseUrl}/api/custom-problems`, { method: 'POST' });
  const setCookieA = resInit.headers.getSetCookie ? resInit.headers.getSetCookie() : [resInit.headers.get('set-cookie')];
  visitorA = setCookieA.find(c => c.includes('visitor_id=')).split(';')[0];
  const dataCustomProblem = await resInit.json();
  const customProblemId = dataCustomProblem.id;
  console.log(`Visitor A Cookie: ${visitorA}`);
  console.log(`Created Custom Problem ID: ${customProblemId}`);
  if (!customProblemId) throw new Error('Failed to create custom problem');

  // 2. Visitor A updates statement and adds custom test cases
  console.log('\n2. Visitor A updates title, statement, and custom test cases ...');
  const customCode = `
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (scanner.hasNextInt()) {
            int a = scanner.nextInt();
            int b = scanner.nextInt();
            System.out.println(a + b);
        }
    }
}
`;
  const customTestCases = [
    { stdin: '3 5\n', expected_output: '8' },
    { stdin: '10 20\n', expected_output: '30' },
  ];

  const resUpdate = await fetch(`${baseUrl}/api/custom-problems/${customProblemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: visitorA },
    body: JSON.stringify({
      title: 'Sum of Two Numbers (A+B)',
      problem_statement: '# Sum of Two Numbers\n\nGiven two space-separated integers, output their sum.',
      code: customCode,
      custom_test_cases: customTestCases,
    }),
  });
  const dataUpdate = await resUpdate.json();
  console.log('Update result:', dataUpdate);
  if (!dataUpdate.success) throw new Error('Failed to update custom problem');

  // 3. Visitor A runs standalone code
  console.log('\n3. Visitor A runs code against custom test cases ...');
  const resRun = await fetch(`${baseUrl}/api/custom-problems/${customProblemId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: visitorA },
    body: JSON.stringify({
      code: customCode,
      custom_test_cases: customTestCases,
    }),
  });
  const dataRun = await resRun.json();
  console.log('Run result:', {
    verdict: dataRun.verdict,
    passedCount: dataRun.passedCount,
    totalCount: dataRun.totalCount,
    runtime_ms: dataRun.runtime_ms,
    results: dataRun.results?.map(r => ({ stdin: r.stdin, expected: r.expectedOutput, actual: r.actualOutput, passed: r.passed }))
  });
  if (dataRun.verdict !== 'PASSED' || dataRun.passedCount !== 2) {
    throw new Error('Custom problem run did not pass');
  }

  // 4. Visitor B attempts to access/modify Visitor A's custom problem (Ownership isolation check)
  console.log("\n4. Checking ownership isolation: Visitor B attempts access to Visitor A's problem ...");
  const resVisB = await fetch(`${baseUrl}/api/problems`);
  const setCookieB = resVisB.headers.getSetCookie ? resVisB.headers.getSetCookie() : [resVisB.headers.get('set-cookie')];
  visitorB = setCookieB.find(c => c.includes('visitor_id=')).split(';')[0];

  const resDeniedGet = await fetch(`${baseUrl}/api/custom-problems/${customProblemId}`, {
    headers: { Cookie: visitorB },
  });
  console.log(`Visitor B GET status (expected 403): ${resDeniedGet.status}`);
  if (resDeniedGet.status !== 403) throw new Error('Ownership isolation failed on GET');

  const resDeniedPut = await fetch(`${baseUrl}/api/custom-problems/${customProblemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: visitorB },
    body: JSON.stringify({ title: 'Hacked by Visitor B' }),
  });
  console.log(`Visitor B PUT status (expected 403): ${resDeniedPut.status}`);
  if (resDeniedPut.status !== 403) throw new Error('Ownership isolation failed on PUT');

  const resDeniedRun = await fetch(`${baseUrl}/api/custom-problems/${customProblemId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: visitorB },
    body: JSON.stringify({ code: 'public class Main {}' }),
  });
  console.log(`Visitor B RUN status (expected 403): ${resDeniedRun.status}`);
  if (resDeniedRun.status !== 403) throw new Error('Ownership isolation failed on RUN');

  // 5. Admin logs in
  console.log('\n5. Admin logs in ...');
  const resLogin = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: visitorA },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  console.log('Login response status:', resLogin.status);
  const loginCookies = resLogin.headers.getSetCookie ? resLogin.headers.getSetCookie() : [resLogin.headers.get('set-cookie')];
  console.log('Login cookies:', loginCookies);
  const adminCookieEntry = loginCookies.find(c => c && c.includes('admin_session='));
  if (!adminCookieEntry) {
    const errText = await resLogin.text();
    throw new Error(`Admin login failed: ${resLogin.status} ${errText}`);
  }
  adminCookie = adminCookieEntry.split(';')[0];
  console.log(`Admin session acquired: ${adminCookie}`);

  // 6. Admin checks overview for custom metrics
  console.log('\n6. Checking admin overview for custom metrics ...');
  const resOverview = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: { Cookie: `${visitorA}; ${adminCookie}` },
  });
  const dataOverview = await resOverview.json();
  console.log('Overview metrics:', {
    totalVisitors: dataOverview.totalVisitors,
    totalCustomProblems: dataOverview.totalCustomProblems,
    totalCustomRuns: dataOverview.totalCustomRuns,
  });
  if (dataOverview.totalCustomProblems < 1 || dataOverview.totalCustomRuns < 1) {
    throw new Error('Admin overview missing custom problem metrics');
  }

  // 7. Admin checks anonymous custom problems list
  console.log('\n7. Checking admin custom problems list ...');
  const resAdminCP = await fetch(`${baseUrl}/api/admin/custom-problems`, {
    headers: { Cookie: `${visitorA}; ${adminCookie}` },
  });
  const dataAdminCP = await resAdminCP.json();
  console.log(`Found ${dataAdminCP.length} anonymous custom problems.`);
  const foundCP = dataAdminCP.find(p => p.id === customProblemId);
  if (!foundCP) throw new Error("Visitor A's custom problem not found in admin list");
  console.log('Found custom problem:', {
    id: foundCP.id,
    title: foundCP.title,
    run_count: foundCP.run_count,
    promoted_problem_id: foundCP.promoted_problem_id,
  });

  // 8. Admin tests dry-run endpoint
  console.log('\n8. Admin tests problem dry-run ...');
  const dryRunHarness = `
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Solution sol = new Solution();
        int res1 = sol.add(2, 3);
        System.out.println("---TEST_RESULT_START---");
        System.out.println("{\\"testIndex\\": 0, \\"passed\\": " + (res1 == 5) + ", \\"input\\": \\"2, 3\\", \\"expected\\": \\"5\\", \\"actual\\": \\"" + res1 + "\\"}");
        System.out.println("---TEST_RESULT_END---");
        
        System.out.println("---SUMMARY_START---");
        System.out.println("{\\"passedCount\\": " + (res1 == 5 ? 1 : 0) + ", \\"totalCount\\": 1, \\"allPassed\\": " + (res1 == 5) + "}");
        System.out.println("---SUMMARY_END---");
    }
}
`;
  const sampleSolution = `
class Solution {
    public int add(int a, int b) {
        return a + b;
    }
}
`;
  const resDryRun = await fetch(`${baseUrl}/api/admin/problems/dry-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `${visitorA}; ${adminCookie}` },
    body: JSON.stringify({
      test_harness_code: dryRunHarness,
      solution_code: sampleSolution,
      test_cases: [{ input_display: '2, 3', expected_output: '5' }],
    }),
  });
  const dataDryRun = await resDryRun.json();
  console.log('Dry run verdict:', dataDryRun.verdict, 'Passed:', dataDryRun.passedCount);
  if (dataDryRun.verdict !== 'ACCEPTED' || dataDryRun.passedCount !== 1) {
    throw new Error('Admin dry run failed');
  }

  // 9. Admin promotes Visitor A's custom problem to official public problem
  console.log('\n9. Admin promotes Visitor A custom problem to public problem ...');
  const promotedHarness = `
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Solution sol = new Solution();
        int t1 = sol.add(3, 5);
        int t2 = sol.add(10, 20);
        boolean p1 = (t1 == 8);
        boolean p2 = (t2 == 30);
        int passed = (p1 ? 1 : 0) + (p2 ? 1 : 0);

        System.out.println("---TEST_RESULT_START---");
        System.out.println("{\\"testIndex\\": 0, \\"passed\\": " + p1 + ", \\"input\\": \\"3, 5\\", \\"expected\\": \\"8\\", \\"actual\\": \\"" + t1 + "\\"}");
        System.out.println("---TEST_RESULT_END---");

        System.out.println("---TEST_RESULT_START---");
        System.out.println("{\\"testIndex\\": 1, \\"passed\\": " + p2 + ", \\"input\\": \\"10, 20\\", \\"expected\\": \\"30\\", \\"actual\\": \\"" + t2 + "\\"}");
        System.out.println("---TEST_RESULT_END---");

        System.out.println("---SUMMARY_START---");
        System.out.println("{\\"passedCount\\": " + passed + ", \\"totalCount\\": 2, \\"allPassed\\": " + (passed == 2) + "}");
        System.out.println("---SUMMARY_END---");
    }
}
`;
  const resPromote = await fetch(`${baseUrl}/api/admin/problems`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `${visitorA}; ${adminCookie}` },
    body: JSON.stringify({
      title: 'Sum of Two Numbers',
      slug: 'sum-of-two-numbers',
      difficulty: 'Easy',
      description_md: '# Sum of Two Numbers\n\nGiven two numbers, return their sum.',
      starter_code: 'class Solution {\n    public int add(int a, int b) {\n        return 0;\n    }\n}\n',
      test_harness_code: promotedHarness,
      is_published: 1,
      source_custom_problem_id: customProblemId,
      test_cases: [
        { input_display: '3, 5', expected_output: '8', is_hidden: 0, sort_order: 1 },
        { input_display: '10, 20', expected_output: '30', is_hidden: 0, sort_order: 2 },
      ],
    }),
  });
  const dataPromote = await resPromote.json();
  console.log('Promote response:', dataPromote);
  if (!dataPromote.success || !dataPromote.id) throw new Error('Failed to promote custom problem');
  const promotedOfficialId = dataPromote.id;

  // 10. Verify custom problem now links to promoted_problem_id
  console.log('\n10. Verifying custom problem shows promoted_problem_id ...');
  const resCheckPromoted = await fetch(`${baseUrl}/api/admin/custom-problems/${customProblemId}`, {
    headers: { Cookie: `${visitorA}; ${adminCookie}` },
  });
  const dataCheckPromoted = await resCheckPromoted.json();
  console.log('Promoted Problem ID on custom problem:', dataCheckPromoted.promoted_problem_id);
  if (dataCheckPromoted.promoted_problem_id !== promotedOfficialId) {
    throw new Error('Custom problem not linked to official problem ID');
  }

  // 11. Anonymous visitor verifies the new problem is immediately visible in public catalog
  console.log('\n11. Anonymous Visitor B checks public /api/problems for promoted problem ...');
  const resPubProblems = await fetch(`${baseUrl}/api/problems`, {
    headers: { Cookie: visitorB },
  });
  const dataPubProblems = await resPubProblems.json();
  const promotedInCatalog = dataPubProblems.find(p => p.slug === 'sum-of-two-numbers');
  console.log('Promoted problem in public catalog:', promotedInCatalog);
  if (!promotedInCatalog) throw new Error('Promoted problem not visible to public visitors');

  // 12. Visitor B runs and solves the newly promoted official problem
  console.log('\n12. Anonymous Visitor B submits solution for promoted problem ...');
  const correctSolution = `
class Solution {
    public int add(int a, int b) {
        return a + b;
    }
}
`;
  const resSubmitNew = await fetch(`${baseUrl}/api/problems/sum-of-two-numbers/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: visitorB },
    body: JSON.stringify({ code: correctSolution }),
  });
  const dataSubmitNew = await resSubmitNew.json();
  console.log('Submit result for new problem:', {
    verdict: dataSubmitNew.verdict,
    passedCount: dataSubmitNew.passedCount,
    totalCount: dataSubmitNew.totalCount,
    solved: dataSubmitNew.solved,
  });
  if (dataSubmitNew.verdict !== 'ACCEPTED' || !dataSubmitNew.solved) {
    throw new Error('Failed to submit solution for promoted problem');
  }

  server.close();
  closeDb();
  console.log('\n======================================================');
  console.log(' ALL CUSTOM PROBLEM MODE & ADMIN E2E TESTS PASSED! ');
  console.log('======================================================\n');
  process.exit(0);
}

runE2E().catch(err => {
  console.error('Custom Mode E2E Failed:', err);
  process.exit(1);
});

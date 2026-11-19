export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type Verdict =
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'COMPILE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'PASSED'
  | 'FAILED'
  | 'EXECUTED'
  | 'SECURITY_VIOLATION'
  | 'OUTPUT_LIMIT_EXCEEDED';

export interface ProblemListItem {
  id: number;
  slug: string;
  title: string;
  difficulty: Difficulty;
  solvedStatus?: 'SOLVED' | 'ATTEMPTED' | 'UNSOLVED';
  isSolved?: boolean;
  isAttempted?: boolean;
}

export interface ProblemDetail {
  id: number;
  slug: string;
  title: string;
  difficulty: Difficulty;
  description_md: string;
  starter_code: string;
  sample_cases?: {
    id: number;
    input_display: string;
    expected_output: string;
  }[];
  solvedStatus?: 'SOLVED' | 'ATTEMPTED' | 'UNSOLVED';
}

export interface TestCaseResult {
  id?: number;
  testIndex?: number;
  input?: string;
  input_display?: string;
  input_payload?: string;
  expected?: string;
  expected_output?: string;
  actual?: string;
  actual_output?: string;
  passed: boolean;
  status?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
  errorMessage?: string;
  runtime_ms?: number;
  stdin?: string;
  expectedOutput?: string;
  actualOutput?: string;
}

export interface ExecutionResult {
  verdict: Verdict;
  runtime_ms: number;
  passedCount?: number;
  passed_count?: number;
  totalCount?: number;
  total_count?: number;
  test_cases?: TestCaseResult[];
  testResults?: TestCaseResult[];
  results?: TestCaseResult[];
  stdout?: string;
  stderr?: string;
  compileErrors?: string;
  error_output?: string;
  errorOutput?: string;
  submission_id?: number;
  isSolved?: boolean;
}

export interface Submission {
  id: number;
  visitor_id?: string;
  problem_id: number;
  problem_slug?: string;
  problem_title?: string;
  code: string;
  verdict: Verdict;
  passed_count: number;
  total_count: number;
  runtime_ms: number;
  error_output?: string;
  created_at: string;
}

export interface AdminStats {
  totalVisitors: number;
  totalPageVisits: number;
  totalSubmissions: number;
  acceptedRate: number;
  totalCustomProblems?: number;
  totalCustomRuns?: number;
}

export interface ProblemStat {
  id: number;
  slug: string;
  title: string;
  difficulty: Difficulty;
  attempts: number;
  solves: number;
}

export interface AdminOverview {
  totalVisitors?: number;
  totalPageVisits?: number;
  totalSubmissions?: number;
  acceptedRate?: number;
  totalCustomProblems?: number;
  totalCustomRuns?: number;
  problemStats?: ProblemStat[];
  stats?: AdminStats;
}

export interface Visitor {
  id: string;
  ip_address: string;
  user_agent: string;
  first_seen_at: string;
  last_seen_at: string;
  visit_count: number;
  attemptedCount?: number;
  attempted_count?: number;
  solvedCount?: number;
  solved_count?: number;
}

export interface PageVisit {
  id: number;
  visitor_id: string;
  path: string;
  visited_at: string;
}

export interface VisitorDetailResponse {
  visitor: Visitor;
  pageVisits?: PageVisit[];
  visits?: PageVisit[];
  submissions: Submission[];
  customProblems?: CustomProblemItem[];
}

export interface CustomTestCase {
  id?: string | number;
  stdin: string;
  expected_output?: string;
  expectedOutput?: string;
}

export interface CustomProblemItem {
  id: string;
  visitor_id: string;
  title: string;
  problem_statement: string;
  statement_hash?: string;
  code: string;
  custom_test_cases_json?: string;
  custom_test_cases?: CustomTestCase[];
  customTestCases?: CustomTestCase[];
  promoted_problem_id: number | null;
  promoted_slug?: string | null;
  is_promoted?: boolean;
  created_at: string;
  updated_at: string;
  run_count?: number;
  last_run_at?: string | null;
}

export interface CustomProblemDetail extends CustomProblemItem {
  testCases?: CustomTestCase[];
  custom_test_cases?: CustomTestCase[];
  customTestCases?: CustomTestCase[];
  recentRuns?: CustomProblemRunItem[];
  runs?: CustomProblemRunItem[];
  visitor?: Visitor | null;
  promoted_problem?: { id: number; slug: string; title: string } | null;
}

export interface CustomProblemRunItem {
  id: number;
  custom_problem_id: string;
  visitor_id: string;
  code: string;
  verdict: Verdict;
  passed_count: number;
  total_count: number;
  runtime_ms: number;
  output_summary?: string;
  error_output?: string;
  created_at: string;
}

export interface AdminProblemItem {
  id: number;
  slug: string;
  title: string;
  difficulty: Difficulty;
  is_published: number;
  isPublished?: boolean;
  created_at: string;
  updated_at: string | null;
  testCasesCount: number;
  submissionsCount: number;
  acceptedSubmissionsCount: number;
}

export interface AdminTestCase {
  id?: number;
  problem_id?: number;
  input_display: string;
  input_payload?: string;
  expected_output: string;
  is_hidden: number; // 0 or 1
  sort_order: number;
}

export interface AdminProblemDetail extends AdminProblemItem {
  description_md: string;
  starter_code: string;
  test_harness_code: string;
  test_cases: AdminTestCase[];
}

const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers || {});

  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let errorMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson && typeof errJson.error === 'string') {
        errorMsg = errJson.error;
      } else if (errJson && typeof errJson.message === 'string') {
        errorMsg = errJson.message;
      }
    } catch {
      // ignore
    }
    const error = new Error(errorMsg);
    (error as unknown as { status: number }).status = res.status;
    throw error;
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return {} as T;
}

export const api = {
  // Public Problems
  async getProblems(): Promise<ProblemListItem[]> {
    const data = await request<ProblemListItem[] | { problems: ProblemListItem[] }>('/problems');
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.problems)) return data.problems;
    return [];
  },

  async getProblem(slug: string): Promise<ProblemDetail> {
    const data = await request<ProblemDetail | { problem: ProblemDetail }>(`/problems/${slug}`);
    if ('problem' in data && data.problem) return data.problem;
    return data as ProblemDetail;
  },

  async runCode(slug: string, code: string): Promise<ExecutionResult> {
    return request<ExecutionResult>(`/problems/${slug}/run`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async submitCode(slug: string, code: string): Promise<ExecutionResult> {
    return request<ExecutionResult>(`/problems/${slug}/submit`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async getProblemSubmissions(slug: string): Promise<Submission[]> {
    const data = await request<Submission[] | { submissions: Submission[] }>(`/problems/${slug}/submissions`);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.submissions)) return data.submissions;
    return [];
  },

  // Anonymous Custom Problems
  async createCustomProblem(data?: {
    title?: string;
    problem_statement?: string;
    code?: string;
    custom_test_cases?: CustomTestCase[];
  }): Promise<{ id: string }> {
    return request<{ id: string }>('/custom-problems', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  async getMyCustomProblems(): Promise<CustomProblemItem[]> {
    const data = await request<CustomProblemItem[]>('/custom-problems');
    return Array.isArray(data) ? data : [];
  },

  async getCustomProblem(id: string): Promise<CustomProblemDetail> {
    const data = await request<CustomProblemDetail>(`/custom-problems/${id}`);
    const cases = data.custom_test_cases || data.customTestCases || data.testCases || [];
    return {
      ...data,
      testCases: cases,
      custom_test_cases: cases,
      customTestCases: cases,
      runs: data.runs || data.recentRuns || [],
      recentRuns: data.runs || data.recentRuns || [],
    };
  },

  async updateCustomProblem(
    id: string,
    data: {
      title?: string;
      problem_statement?: string;
      code?: string;
      custom_test_cases?: CustomTestCase[];
    }
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/custom-problems/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async runCustomProblem(
    id: string,
    data?: {
      code?: string;
      custom_test_cases?: CustomTestCase[];
      title?: string;
      problem_statement?: string;
    }
  ): Promise<ExecutionResult> {
    return request<ExecutionResult>(`/custom-problems/${id}/run`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  // Admin Auth
  async checkAdminAuth(): Promise<{ authenticated: boolean; username?: string }> {
    try {
      const data = await request<{ authenticated: boolean; username?: string }>('/admin/me');
      return data;
    } catch {
      return { authenticated: false };
    }
  },

  async adminLogin(username: string, password: string): Promise<{ success: boolean; username?: string }> {
    return request<{ success: boolean; username?: string }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async adminLogout(): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/admin/logout', {
      method: 'POST',
    });
  },

  async getAdminOverview(): Promise<AdminOverview> {
    return request<AdminOverview>('/admin/overview');
  },

  async getAdminVisitors(): Promise<Visitor[]> {
    const data = await request<Visitor[] | { visitors: Visitor[] }>('/admin/visitors');
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.visitors)) return data.visitors;
    return [];
  },

  async getAdminVisitorDetail(visitorId: string): Promise<VisitorDetailResponse> {
    return request<VisitorDetailResponse>(`/admin/visitors/${visitorId}`);
  },

  // Admin Problem Management
  async getAdminProblems(): Promise<AdminProblemItem[]> {
    const data = await request<AdminProblemItem[]>('/admin/problems');
    return Array.isArray(data) ? data : [];
  },

  async getAdminProblem(id: number): Promise<AdminProblemDetail> {
    return request<AdminProblemDetail>(`/admin/problems/${id}`);
  },

  async createAdminProblem(data: {
    title: string;
    slug: string;
    difficulty: Difficulty;
    description_md: string;
    starter_code: string;
    test_harness_code: string;
    is_published?: number;
    test_cases: AdminTestCase[];
    source_custom_problem_id?: string;
  }): Promise<{ success: boolean; id: number; slug: string }> {
    return request<{ success: boolean; id: number; slug: string }>('/admin/problems', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAdminProblem(
    id: number,
    data: {
      title?: string;
      slug?: string;
      difficulty?: Difficulty;
      description_md?: string;
      starter_code?: string;
      test_harness_code?: string;
      is_published?: number;
      test_cases?: AdminTestCase[];
    }
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/admin/problems/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAdminProblem(id: number): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/admin/problems/${id}`, {
      method: 'DELETE',
    });
  },

  async dryRunAdminProblem(data: {
    test_harness_code: string;
    solution_code: string;
    test_cases: { input_payload?: string; input_display?: string; expected_output: string }[];
  }): Promise<ExecutionResult> {
    return request<ExecutionResult>('/admin/problems/dry-run', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Admin Anonymous Custom Problems
  async getAdminCustomProblems(params?: {
    search?: string;
    filter?: 'all' | 'unpromoted' | 'promoted';
    sort?: 'recent' | 'runs' | 'created';
  }): Promise<CustomProblemItem[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.filter) query.set('filter', params.filter);
    if (params?.sort) query.set('sort', params.sort);
    const qs = query.toString();
    const data = await request<CustomProblemItem[]>(`/admin/custom-problems${qs ? `?${qs}` : ''}`);
    return Array.isArray(data) ? data : [];
  },

  async getAdminCustomProblem(id: string): Promise<CustomProblemDetail> {
    return request<CustomProblemDetail>(`/admin/custom-problems/${id}`);
  },
};

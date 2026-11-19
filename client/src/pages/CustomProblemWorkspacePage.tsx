import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  api,
  CustomTestCase,
  CustomProblemItem,
  ExecutionResult,
  Verdict,
} from '../api/client';
import { MarkdownView } from '../components/MarkdownView';
import { JavaEditor } from '../components/JavaEditor';
import { formatRelativeTime } from '../lib/utils';
import {
  Play,
  RotateCcw,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronLeft,
  Loader2,
  Plus,
  Trash2,
  Edit3,
  Eye,
  Check,
  Code2,
  Terminal,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
} from 'lucide-react';

const DEFAULT_STARTER_CODE = `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Read standard input and print output
        if (scanner.hasNextLine()) {
            System.out.println(scanner.nextLine());
        }
    }
}
`;

const DEFAULT_TEST_CASE: CustomTestCase = {
  stdin: 'Hello Java 25',
  expected_output: 'Hello Java 25',
};

export const CustomProblemWorkspacePage: React.FC = () => {
  const { id: routeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  // Active problem ID (either route param or newly created)
  const [problemId, setProblemId] = useState<string | null>(routeId || null);

  // Loading and error states
  const [loading, setLoading] = useState<boolean>(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Problem form fields
  const [title, setTitle] = useState<string>('My Custom Problem');
  const [problemStatement, setProblemStatement] = useState<string>('');
  const [code, setCode] = useState<string>(DEFAULT_STARTER_CODE);
  const [testCases, setTestCases] = useState<CustomTestCase[]>([DEFAULT_TEST_CASE]);

  // Left pane tab: 'edit' or 'preview'
  const [statementTab, setStatementTab] = useState<'edit' | 'preview'>('edit');

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const isInitialLoadRef = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Recent problems list
  const [recentProblems, setRecentProblems] = useState<CustomProblemItem[]>([]);
  const [isRecentDropdownOpen, setIsRecentDropdownOpen] = useState<boolean>(false);
  const recentDropdownRef = useRef<HTMLDivElement>(null);

  // Right pane: Bottom panel state
  const [bottomTab, setBottomTab] = useState<'testcases' | 'results'>('testcases');
  const [activeTestCaseIdx, setActiveTestCaseIdx] = useState<number>(0);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState<boolean>(false);

  // Code execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [activeResultIdx, setActiveResultIdx] = useState<number>(0);

  // Close recent problems dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        recentDropdownRef.current &&
        !recentDropdownRef.current.contains(e.target as Node)
      ) {
        setIsRecentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch recent problems list for the visitor
  const loadRecentProblems = useCallback(async () => {
    try {
      const list = await api.getMyCustomProblems();
      setRecentProblems(list);
    } catch (err) {
      console.error('Failed to load recent problems:', err);
    }
  }, []);

  // Load or initialize custom problem session
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        setLoading(true);
        setInitError(null);
        isInitialLoadRef.current = true;

        if (routeId) {
          // Load specific custom problem by id
          const problem = await api.getCustomProblem(routeId);
          if (!isMounted) return;

          setProblemId(problem.id);
          setTitle(problem.title || 'Untitled Custom Problem');
          setProblemStatement(problem.problem_statement || '');
          setCode(problem.code || DEFAULT_STARTER_CODE);

          const parsedCases =
            problem.custom_test_cases && problem.custom_test_cases.length > 0
              ? problem.custom_test_cases
              : problem.testCases && problem.testCases.length > 0
              ? problem.testCases
              : [DEFAULT_TEST_CASE];

          setTestCases(parsedCases);
          setActiveTestCaseIdx(0);
        } else {
          // Route is /custom without id: create a new session
          const created = await api.createCustomProblem({
            title: 'My Custom Problem',
            problem_statement: '',
            code: DEFAULT_STARTER_CODE,
            custom_test_cases: [DEFAULT_TEST_CASE],
          });

          if (!isMounted) return;
          setProblemId(created.id);
          setTitle('My Custom Problem');
          setProblemStatement('');
          setCode(DEFAULT_STARTER_CODE);
          setTestCases([DEFAULT_TEST_CASE]);

          // Replace URL to /custom/:id so user has persistent URL
          navigate(`/custom/${created.id}`, { replace: true });
        }

        // Load visitor's recent problem history
        loadRecentProblems();
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to initialize workspace';
        setInitError(msg);
      } finally {
        if (isMounted) {
          setLoading(false);
          // Allow auto-save listener to take effect after initial load
          setTimeout(() => {
            isInitialLoadRef.current = false;
          }, 300);
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [routeId, navigate, loadRecentProblems]);

  // Debounced auto-save effect
  useEffect(() => {
    if (isInitialLoadRef.current || !problemId) {
      return;
    }

    setSaveStatus('unsaved');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        await api.updateCustomProblem(problemId, {
          title,
          problem_statement: problemStatement,
          code,
          custom_test_cases: testCases,
        });
        setSaveStatus('saved');
        // Refresh recent problem title in list
        loadRecentProblems();
      } catch (err) {
        console.error('Auto-save error:', err);
        setSaveStatus('error');
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, problemStatement, code, testCases, problemId, loadRecentProblems]);

  // Handle creating a new problem
  const handleCreateNew = async () => {
    try {
      setIsRecentDropdownOpen(false);
      setLoading(true);
      const created = await api.createCustomProblem({
        title: 'Untitled Custom Problem',
        problem_statement: '',
        code: DEFAULT_STARTER_CODE,
        custom_test_cases: [DEFAULT_TEST_CASE],
      });
      navigate(`/custom/${created.id}`);
    } catch (err) {
      console.error('Failed to create new custom problem:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset code to standalone Main starter template
  const handleResetCode = () => {
    if (
      window.confirm(
        'Reset code to default standalone Main starter template? Current edits will be replaced.'
      )
    ) {
      setCode(DEFAULT_STARTER_CODE);
    }
  };

  // Test cases management
  const handleAddTestCase = () => {
    if (testCases.length >= 10) return;
    const newCase: CustomTestCase = {
      stdin: '',
      expected_output: '',
    };
    const updated = [...testCases, newCase];
    setTestCases(updated);
    setActiveTestCaseIdx(updated.length - 1);
  };

  const handleDeleteTestCase = (idx: number) => {
    if (testCases.length <= 1) {
      alert('At least one test case is required.');
      return;
    }
    const updated = testCases.filter((_, i) => i !== idx);
    setTestCases(updated);
    if (activeTestCaseIdx >= updated.length) {
      setActiveTestCaseIdx(Math.max(0, updated.length - 1));
    }
  };

  const handleUpdateActiveTestCase = (field: 'stdin' | 'expected_output', value: string) => {
    const updated = [...testCases];
    if (updated[activeTestCaseIdx]) {
      updated[activeTestCaseIdx] = {
        ...updated[activeTestCaseIdx],
        [field]: value,
      };
      setTestCases(updated);
    }
  };

  // Run code against custom test cases
  const handleRunCode = async () => {
    if (!problemId || isRunning) return;

    try {
      setIsRunning(true);
      setIsBottomCollapsed(false);
      setBottomTab('results');
      setActiveResultIdx(0);

      // Cancel pending auto-save and immediately flush via run
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      setSaveStatus('saving');

      const res = await api.runCustomProblem(problemId, {
        code,
        custom_test_cases: testCases,
        title,
        problem_statement: problemStatement,
      });

      setExecutionResult(res);
      setSaveStatus('saved');
      loadRecentProblems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      setExecutionResult({
        verdict: 'INTERNAL_ERROR',
        runtime_ms: 0,
        passed_count: 0,
        total_count: testCases.length,
        error_output: msg,
      });
      setSaveStatus('error');
    } finally {
      setIsRunning(false);
    }
  };

  // Hotkey support: Ctrl+Enter / Cmd+Enter to run code
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunCode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Verdict badge renderer adhering to required color specs:
  // PASSED: emerald, FAILED: rose, EXECUTED: sky, COMPILE_ERROR: amber, RUNTIME_ERROR: purple, TIME_LIMIT_EXCEEDED: red
  const renderVerdictBadge = (verdict: Verdict) => {
    switch (verdict) {
      case 'PASSED':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs uppercase tracking-wide">
            <CheckCircle2 className="h-4 w-4" />
            <span>Passed</span>
          </div>
        );
      case 'FAILED':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-xs uppercase tracking-wide">
            <XCircle className="h-4 w-4" />
            <span>Failed</span>
          </div>
        );
      case 'EXECUTED':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-sky-500/15 border border-sky-500/30 text-sky-400 font-bold text-xs uppercase tracking-wide">
            <Terminal className="h-4 w-4" />
            <span>Executed</span>
          </div>
        );
      case 'COMPILE_ERROR':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs uppercase tracking-wide">
            <AlertTriangle className="h-4 w-4" />
            <span>Compile Error</span>
          </div>
        );
      case 'RUNTIME_ERROR':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-400 font-bold text-xs uppercase tracking-wide">
            <AlertTriangle className="h-4 w-4" />
            <span>Runtime Error</span>
          </div>
        );
      case 'TIME_LIMIT_EXCEEDED':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-red-600/15 border border-red-600/30 text-red-500 font-bold text-xs uppercase tracking-wide">
            <Clock className="h-4 w-4" />
            <span>Time Limit Exceeded</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wide">
            <span>{verdict}</span>
          </div>
        );
    }
  };

  // Status badge for per-test-case result cards
  const renderTestCaseStatusBadge = (status?: string, passed?: boolean) => {
    const s = (status || (passed ? 'PASSED' : 'FAILED')).toUpperCase();
    if (s === 'PASSED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3" />
          PASSED
        </span>
      );
    }
    if (s === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <XCircle className="h-3 w-3" />
          FAILED
        </span>
      );
    }
    if (s === 'EXECUTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
          <Terminal className="h-3 w-3" />
          EXECUTED
        </span>
      );
    }
    if (s === 'RUNTIME_ERROR') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
          <AlertTriangle className="h-3 w-3" />
          RUNTIME ERROR
        </span>
      );
    }
    if (s === 'TIME_LIMIT_EXCEEDED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-600/15 text-red-500 border border-red-600/30">
          <Clock className="h-3 w-3" />
          TLE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300">
        {s}
      </span>
    );
  };

  if (loading && !problemId) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center text-slate-400 gap-3 bg-[#0b0f19]">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
        <span className="text-sm font-mono">Initializing custom Java practice sandbox...</span>
      </div>
    );
  }

  if (initError && !problemId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <AlertTriangle className="h-10 w-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Workspace Error</h2>
          <p className="text-sm text-slate-400 mb-6">{initError}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-colors"
            >
              Create New Problem
            </button>
            <Link
              to="/"
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              Back to Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeTestCase = testCases[activeTestCaseIdx] || { stdin: '', expected_output: '' };
  const rawResults =
    executionResult?.results ||
    executionResult?.testResults ||
    executionResult?.test_cases ||
    [];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Navigation & Sub-header Bar */}
      <div className="h-12 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 transition-colors flex-shrink-0"
            title="Back to Catalog"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Problems</span>
          </Link>
          <span className="text-slate-700 flex-shrink-0">/</span>

          {/* Recent Problems Dropdown Menu */}
          <div className="relative flex-shrink-0" ref={recentDropdownRef}>
            <button
              onClick={() => setIsRecentDropdownOpen(!isRecentDropdownOpen)}
              className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 rounded-md transition-colors flex items-center gap-1.5"
            >
              <FolderOpen className="h-3.5 w-3.5 text-sky-400" />
              <span className="hidden md:inline">My Problems</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500/20 text-sky-300 font-mono">
                {recentProblems.length}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {isRecentDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-80 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl z-50 p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 px-2 pt-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Past Practice Sessions
                  </span>
                  <button
                    onClick={handleCreateNew}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    <span>New Problem</span>
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1">
                  {recentProblems.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No saved custom problems yet.
                    </div>
                  ) : (
                    recentProblems.map((p) => {
                      const isActive = p.id === problemId;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            setIsRecentDropdownOpen(false);
                            if (p.id !== problemId) {
                              navigate(`/custom/${p.id}`);
                            }
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                            isActive
                              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                              : 'hover:bg-slate-800/80 text-slate-300'
                          }`}
                        >
                          <div className="truncate flex-1">
                            <div className="font-semibold truncate">
                              {p.title || 'Untitled Problem'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {formatRelativeTime(p.updated_at)}
                            </div>
                          </div>
                          {p.run_count !== undefined && p.run_count > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono flex-shrink-0">
                              {p.run_count} run{p.run_count === 1 ? '' : 's'}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleCreateNew}
            className="p-1 text-slate-400 hover:text-sky-400 rounded hover:bg-slate-800 transition-colors flex-shrink-0 hidden sm:flex items-center gap-1 text-xs"
            title="Create fresh new custom problem"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">New Problem</span>
          </button>
        </div>

        {/* Global Controls & Run Code Button */}
        <div className="flex items-center gap-3">
          {/* Auto-Save Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono">
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-slate-400">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[11px]">Saved</span>
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-sky-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-[11px]">Saving...</span>
              </span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="flex items-center gap-1 text-amber-400/90">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[11px]">Unsaved changes</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-rose-400 text-[11px]">
                Save failed
              </span>
            )}
          </div>

          {/* Reset Code */}
          <button
            onClick={handleResetCode}
            className="p-1.5 sm:px-2.5 sm:py-1 text-xs font-medium text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors flex items-center gap-1"
            title="Reset code to default starter Main template"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Reset</span>
          </button>

          {/* Run Code Button */}
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="px-4 py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-sky-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Execute standalone Main against custom test cases (Ctrl+Enter)"
          >
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-white text-white" />
            )}
            <span>Run Code</span>
            <span className="hidden lg:inline text-[10px] opacity-75 font-mono ml-0.5">
              (Ctrl+Enter)
            </span>
          </button>
        </div>
      </div>

      {/* Main Split-Pane Layout */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* ========================================================= */}
        {/* LEFT PANE: Editable Title & Markdown Problem Statement     */}
        {/* ========================================================= */}
        <div className="w-full lg:w-1/2 flex flex-col h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/30">
          {/* Left Pane Top Bar: Title Input */}
          <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/70 flex flex-col gap-2 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Edit3 className="h-3 w-3 text-sky-400" />
                Problem Title
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Custom Sandbox Session
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter problem title... (e.g. Reverse Words in String)"
              className="w-full bg-slate-950/70 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-1.5 text-sm sm:text-base font-bold text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Statement Tab Selector */}
          <div className="flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900/60 flex-shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setStatementTab('edit')}
                className={`py-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                  statementTab === 'edit'
                    ? 'border-sky-500 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit Statement</span>
              </button>
              <button
                onClick={() => setStatementTab('preview')}
                className={`py-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                  statementTab === 'preview'
                    ? 'border-sky-500 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Markdown Preview</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
              GitHub-Flavored Markdown
            </span>
          </div>

          {/* Statement Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5">
            {statementTab === 'edit' ? (
              <div className="h-full flex flex-col">
                <textarea
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  placeholder={`Write your problem statement here in Markdown...\n\nExample:\n## Problem Description\nGiven standard input containing two integers, output their sum.\n\n### Input\nA single line containing two integers \`A\` and \`B\` separated by space.\n\n### Output\nPrint the sum of \`A\` and \`B\`.`}
                  className="w-full h-full min-h-[220px] p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl font-mono text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/70 focus:border-sky-500/70 resize-none leading-relaxed"
                />
              </div>
            ) : (
              <div className="max-w-none">
                {problemStatement.trim() ? (
                  <MarkdownView content={problemStatement} />
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    <FileText className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <span>No problem statement entered yet.</span>
                    <p className="text-slate-600 mt-1">
                      Switch to "Edit Statement" above to describe your problem.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT PANE: Monaco Editor + Custom Cases & Results        */}
        {/* ========================================================= */}
        <div className="w-full lg:w-1/2 flex flex-col h-1/2 lg:h-full bg-[#1e1e1e] min-h-0">
          {/* Editor Header Bar */}
          <div className="h-9 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-xs font-mono font-semibold text-slate-300">
                Main.java
              </span>
              <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded">
                Java (Standalone Main)
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
              <span className="hidden sm:inline text-slate-500">public class Main</span>
              <span>UTF-8 • Tab: 4</span>
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div
            className={`min-h-0 transition-all ${
              isBottomCollapsed ? 'flex-1' : 'h-[50%]'
            }`}
          >
            <JavaEditor value={code} onChange={setCode} />
          </div>

          {/* Bottom Panel: Custom Test Cases & Execution Results */}
          <div
            className={`border-t border-slate-800 bg-slate-950 flex flex-col transition-all ${
              isBottomCollapsed ? 'h-10' : 'h-[50%]'
            }`}
          >
            {/* Bottom Panel Header Bar */}
            <div className="h-10 px-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setBottomTab('testcases');
                    setIsBottomCollapsed(false);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                    bottomTab === 'testcases' && !isBottomCollapsed
                      ? 'bg-slate-800 text-sky-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Custom Test Cases</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700/60 text-slate-300 font-mono">
                    {testCases.length}/10
                  </span>
                </button>

                <button
                  onClick={() => {
                    setBottomTab('results');
                    setIsBottomCollapsed(false);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                    bottomTab === 'results' && !isBottomCollapsed
                      ? 'bg-slate-800 text-sky-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  <span>Execution Results</span>
                  {executionResult && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        executionResult.verdict === 'PASSED'
                          ? 'bg-emerald-400'
                          : executionResult.verdict === 'EXECUTED'
                          ? 'bg-sky-400'
                          : executionResult.verdict === 'COMPILE_ERROR'
                          ? 'bg-amber-400'
                          : 'bg-rose-500'
                      }`}
                    />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {executionResult && !isBottomCollapsed && (
                  <span className="text-[11px] font-mono text-slate-400 mr-2 hidden sm:inline">
                    {executionResult.runtime_ms} ms
                  </span>
                )}
                <button
                  onClick={() => setIsBottomCollapsed(!isBottomCollapsed)}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
                  title={isBottomCollapsed ? 'Expand panel' : 'Collapse panel'}
                >
                  {isBottomCollapsed ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Bottom Panel Content Area */}
            {!isBottomCollapsed && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* ---------------------------------------------------- */}
                {/* TAB 1: CUSTOM TEST CASES                              */}
                {/* ---------------------------------------------------- */}
                {bottomTab === 'testcases' && (
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Test Case Sub-tabs Selector */}
                    <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800/80 bg-slate-900/50 flex-shrink-0 overflow-x-auto">
                      {testCases.map((_, idx) => {
                        const isActive = activeTestCaseIdx === idx;
                        return (
                          <button
                            key={`tc-tab-${idx}`}
                            onClick={() => setActiveTestCaseIdx(idx)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                              isActive
                                ? 'bg-slate-800 text-white font-semibold border border-slate-700 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                          >
                            <span>Case {idx + 1}</span>
                          </button>
                        );
                      })}

                      {testCases.length < 10 && (
                        <button
                          onClick={handleAddTestCase}
                          className="px-2.5 py-1 rounded-md text-xs font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 border border-dashed border-sky-500/30 transition-colors flex items-center gap-1 ml-1"
                          title="Add another custom test case (up to 10)"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add Case</span>
                        </button>
                      )}
                    </div>

                    {/* Active Test Case Inputs */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <span>Test Case #{activeTestCaseIdx + 1}</span>
                        </span>

                        {testCases.length > 1 && (
                          <button
                            onClick={() => handleDeleteTestCase(activeTestCaseIdx)}
                            className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-1 rounded transition-colors flex items-center gap-1"
                            title="Delete this test case"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Remove Case</span>
                          </button>
                        )}
                      </div>

                      {/* Stdin input textarea */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Stdin Input (Passed to Scanner / System.in):
                        </label>
                        <textarea
                          value={activeTestCase.stdin}
                          onChange={(e) =>
                            handleUpdateActiveTestCase('stdin', e.target.value)
                          }
                          placeholder="Standard input string passed to your program..."
                          rows={3}
                          className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-y"
                        />
                      </div>

                      {/* Optional Expected Output textarea */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Expected Output (Optional):
                          </label>
                          <span className="text-[10px] text-slate-500">
                            If provided, actual stdout will be verified against this.
                          </span>
                        </div>
                        <textarea
                          value={activeTestCase.expected_output || ''}
                          onChange={(e) =>
                            handleUpdateActiveTestCase('expected_output', e.target.value)
                          }
                          placeholder="Optional expected stdout. If left blank, verdict will be EXECUTED."
                          rows={3}
                          className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-300 placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-y"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------------------------------------------- */}
                {/* TAB 2: EXECUTION RESULTS                              */}
                {/* ---------------------------------------------------- */}
                {bottomTab === 'results' && (
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Running State */}
                    {isRunning && (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400 gap-3">
                        <Cpu className="h-8 w-8 text-sky-400 animate-pulse" />
                        <span className="text-xs font-mono text-slate-300">
                          Compiling and executing in OpenJDK 25 standalone sandbox...
                        </span>
                      </div>
                    )}

                    {/* Empty State: No Run Yet */}
                    {!isRunning && !executionResult && (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500 text-xs text-center font-mono gap-2">
                        <Code2 className="h-8 w-8 text-slate-600" />
                        <span>Click "Run Code" or press Ctrl+Enter to test your Java program.</span>
                      </div>
                    )}

                    {/* Results Rendered */}
                    {!isRunning && executionResult && (
                      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                        {/* Verdict Banner */}
                        <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                          <div className="flex items-center gap-3">
                            {renderVerdictBadge(executionResult.verdict)}
                            <span className="text-xs font-medium text-slate-300">
                              Passed:{' '}
                              <strong className="text-white">
                                {executionResult.passed_count ?? executionResult.passedCount ?? 0}
                              </strong>{' '}
                              /{' '}
                              {executionResult.total_count ?? executionResult.totalCount ?? rawResults.length}
                            </span>
                          </div>

                          <div className="text-xs font-mono text-slate-400">
                            {executionResult.runtime_ms} ms execution time
                          </div>
                        </div>

                        {/* Compiler / Sandbox Errors Banner if any */}
                        {(executionResult.error_output || executionResult.errorOutput) && (
                          <div className="p-3 bg-amber-950/20 border-b border-amber-900/40">
                            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>Compiler / Sandbox Output:</span>
                            </div>
                            <pre className="p-2.5 rounded bg-amber-950/40 border border-amber-800/40 font-mono text-amber-200 whitespace-pre-wrap text-xs select-text overflow-x-auto">
                              {executionResult.error_output || executionResult.errorOutput}
                            </pre>
                          </div>
                        )}

                        {/* Test Case Result Tabs (if multiple cases ran) */}
                        {rawResults.length > 0 && (
                          <div className="flex items-center gap-1 px-3 pt-2 border-b border-slate-800 bg-slate-900/30 flex-shrink-0 overflow-x-auto">
                            {rawResults.map((tc, idx) => {
                              const isActive = activeResultIdx === idx;
                              const isCasePassed = tc.passed;
                              const isExecuted =
                                tc.status === 'EXECUTED' || (!tc.expectedOutput && !tc.expected_output);

                              return (
                                <button
                                  key={`res-tab-${idx}`}
                                  onClick={() => setActiveResultIdx(idx)}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                    isActive
                                      ? 'bg-slate-950 text-white border-t border-x border-slate-800 font-semibold'
                                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isExecuted
                                        ? 'bg-sky-400'
                                        : isCasePassed
                                        ? 'bg-emerald-400'
                                        : 'bg-rose-500'
                                    }`}
                                  />
                                  <span>Case {idx + 1}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Selected Test Case Result Card */}
                        {rawResults.length > 0 && (() => {
                          const resItem = rawResults[activeResultIdx] || rawResults[0];
                          const stdinVal = resItem.stdin ?? resItem.input_display ?? resItem.input_payload ?? '—';
                          const expectedVal = resItem.expectedOutput ?? resItem.expected_output;
                          const actualVal = resItem.actualOutput ?? resItem.actual_output ?? resItem.stdout ?? '';
                          const errVal = resItem.errorMessage ?? resItem.error ?? resItem.stderr;

                          return (
                            <div className="p-4 flex-1 overflow-y-auto space-y-3.5 max-w-4xl text-xs">
                              {/* Top status bar for this case */}
                              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-200">
                                    Case #{activeResultIdx + 1} Result
                                  </span>
                                  {renderTestCaseStatusBadge(resItem.status, resItem.passed)}
                                </div>
                                <span className="font-mono text-slate-400 text-[11px]">
                                  {resItem.runtime_ms ?? 0} ms
                                </span>
                              </div>

                              {/* Stdin */}
                              <div>
                                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                  Standard Input (stdin):
                                </div>
                                <pre className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-slate-200 whitespace-pre-wrap select-text">
                                  {stdinVal}
                                </pre>
                              </div>

                              {/* Expected Output if provided */}
                              {expectedVal !== undefined && expectedVal !== null && expectedVal !== '' && (
                                <div>
                                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                    Expected Output:
                                  </div>
                                  <pre className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-emerald-400 whitespace-pre-wrap select-text">
                                    {expectedVal}
                                  </pre>
                                </div>
                              )}

                              {/* Actual Output */}
                              <div>
                                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                  Actual Output (stdout):
                                </div>
                                <pre
                                  className={`p-2.5 rounded border font-mono whitespace-pre-wrap select-text ${
                                    resItem.passed
                                      ? 'bg-slate-900 border-slate-800 text-slate-200'
                                      : 'bg-rose-950/20 border-rose-900/40 text-rose-300'
                                  }`}
                                >
                                  {actualVal || '(no output)'}
                                </pre>
                              </div>

                              {/* Stderr or Runtime error if any */}
                              {errVal && (
                                <div>
                                  <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-1">
                                    Standard Error / Exception:
                                  </div>
                                  <pre className="p-2.5 rounded bg-rose-950/30 border border-rose-900/50 font-mono text-rose-300 whitespace-pre-wrap text-xs select-text overflow-x-auto">
                                    {errVal}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomProblemWorkspacePage;

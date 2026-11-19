import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, ProblemDetail, ExecutionResult, Submission, Verdict } from '../api/client';
import { MarkdownView } from '../components/MarkdownView';
import { JavaEditor } from '../components/JavaEditor';
import { ConsoleOutput } from '../components/ConsoleOutput';
import { formatDate, formatRelativeTime } from '../lib/utils';
import {
  Play,
  Send,
  RotateCcw,
  FileText,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronLeft,
  Loader2,
  Code2,
  Eye,
} from 'lucide-react';

export const ProblemWorkspacePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Editor code state
  const [code, setCode] = useState<string>('');
  const [leftTab, setLeftTab] = useState<'description' | 'submissions'>('description');

  // Submissions history for this problem
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(false);
  const [viewingSubmissionCode, setViewingSubmissionCode] = useState<Submission | null>(null);

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState<boolean>(false);

  // Load problem details
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!slug) return;
      try {
        setLoading(true);
        setError(null);
        const data = await api.getProblem(slug);
        if (isMounted) {
          setProblem(data);
          setCode(data.starter_code || '// Write your Java solution here\n');
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load problem');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Load submissions history when tab switches to 'submissions'
  const loadSubmissions = async () => {
    if (!slug) return;
    try {
      setLoadingSubmissions(true);
      const data = await api.getProblemSubmissions(slug);
      setSubmissions(data);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    if (leftTab === 'submissions') {
      loadSubmissions();
    }
  }, [leftTab, slug]);

  const handleResetCode = () => {
    if (!problem) return;
    if (window.confirm('Reset code to default starter template? All unsaved edits will be lost.')) {
      setCode(problem.starter_code);
    }
  };

  const handleRunCode = async () => {
    if (!slug || isRunning || isSubmitting) return;
    try {
      setIsRunning(true);
      setIsConsoleCollapsed(false);
      const res = await api.runCode(slug, code);
      setExecutionResult(res);
    } catch (err: unknown) {
      setExecutionResult({
        verdict: 'INTERNAL_ERROR',
        runtime_ms: 0,
        passed_count: 0,
        total_count: 0,
        error_output: err instanceof Error ? err.message : 'Execution failed',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmitCode = async () => {
    if (!slug || isRunning || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setIsConsoleCollapsed(false);
      const res = await api.submitCode(slug, code);
      setExecutionResult(res);
      // Refresh submissions tab list if user switches there
      if (leftTab === 'submissions') {
        loadSubmissions();
      }
    } catch (err: unknown) {
      setExecutionResult({
        verdict: 'INTERNAL_ERROR',
        runtime_ms: 0,
        passed_count: 0,
        total_count: 0,
        error_output: err instanceof Error ? err.message : 'Submission failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderVerdictBadge = (verdict: Verdict) => {
    switch (verdict) {
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Accepted
          </span>
        );
      case 'WRONG_ANSWER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            Wrong Answer
          </span>
        );
      case 'COMPILE_ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-3 w-3" />
            Compile Error
          </span>
        );
      case 'TIME_LIMIT_EXCEEDED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-600/10 text-rose-500 border border-rose-600/20">
            <Clock className="h-3 w-3" />
            TLE
          </span>
        );
      case 'RUNTIME_ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <AlertTriangle className="h-3 w-3" />
            Runtime Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-700/40 text-slate-300">
            {verdict}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
        <span className="text-sm font-mono">Loading problem workspace...</span>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
          <AlertTriangle className="h-10 w-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Problem Not Found</h2>
          <p className="text-sm text-slate-400 mb-6">{error || 'Requested problem does not exist.'}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to Problem Catalog</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-slate-950">
      {/* Workspace Sub-header */}
      <div className="h-11 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Problems</span>
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
            {problem.title}
          </span>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              problem.difficulty === 'Easy'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : problem.difficulty === 'Medium'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {problem.difficulty}
          </span>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetCode}
            className="px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            title="Reset code to starter template"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Reset</span>
          </button>

          <button
            onClick={handleRunCode}
            disabled={isRunning || isSubmitting}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 border border-slate-700 disabled:opacity-50"
          >
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
            ) : (
              <Play className="h-3.5 w-3.5 text-sky-400 fill-sky-400" />
            )}
            <span>Run Code</span>
          </button>

          <button
            onClick={handleSubmitCode}
            disabled={isRunning || isSubmitting}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-emerald-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>Submit</span>
          </button>
        </div>
      </div>

      {/* Main Split-Pane Layout */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left Pane: Problem Description & Submission History */}
        <div className="w-full lg:w-1/2 flex flex-col h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/40">
          {/* Left Tabs Bar */}
          <div className="flex items-center gap-2 px-4 border-b border-slate-800 bg-slate-900/80 flex-shrink-0">
            <button
              onClick={() => {
                setLeftTab('description');
                setViewingSubmissionCode(null);
              }}
              className={`py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-colors ${
                leftTab === 'description' && !viewingSubmissionCode
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Description</span>
            </button>

            <button
              onClick={() => {
                setLeftTab('submissions');
                setViewingSubmissionCode(null);
              }}
              className={`py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-colors ${
                leftTab === 'submissions' || viewingSubmissionCode
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Submissions</span>
            </button>
          </div>

          {/* Left Tab Content */}
          <div className="flex-1 overflow-y-auto p-5 md:p-6">
            {viewingSubmissionCode ? (
              /* View past submission code */
              <div className="h-full flex flex-col space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewingSubmissionCode(null)}
                      className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Back to list
                    </button>
                    <span className="text-slate-600">|</span>
                    {renderVerdictBadge(viewingSubmissionCode.verdict)}
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {formatDate(viewingSubmissionCode.created_at)}
                  </span>
                </div>

                <div className="text-xs text-slate-400 font-mono">
                  Runtime: {viewingSubmissionCode.runtime_ms}ms • Passed:{' '}
                  {viewingSubmissionCode.passed_count}/{viewingSubmissionCode.total_count}
                </div>

                <div className="flex-1 min-h-[300px] border border-slate-800 rounded-lg overflow-hidden">
                  <JavaEditor
                    value={viewingSubmissionCode.code}
                    onChange={() => {}}
                    readOnly={true}
                  />
                </div>
              </div>
            ) : leftTab === 'description' ? (
              /* Problem Markdown Description */
              <div className="max-w-none">
                <MarkdownView content={problem.description_md} />
              </div>
            ) : (
              /* Submissions History Tab */
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Your Submissions for this problem
                </h3>

                {loadingSubmissions ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
                    <span className="text-xs font-mono">Loading submissions...</span>
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    <Code2 className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    You haven't submitted any code for this problem yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {submissions.map((sub) => (
                      <div
                        key={sub.id}
                        className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {renderVerdictBadge(sub.verdict)}
                          <div className="text-xs font-mono text-slate-300">
                            {sub.passed_count}/{sub.total_count} tests ({sub.runtime_ms}ms)
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatRelativeTime(sub.created_at)}
                          </span>
                          <button
                            onClick={() => setViewingSubmissionCode(sub)}
                            className="p-1.5 text-slate-400 hover:text-sky-400 rounded hover:bg-slate-800 transition-colors"
                            title="Inspect submitted code"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Code Editor + Test Results Console */}
        <div className="w-full lg:w-1/2 flex flex-col h-1/2 lg:h-full bg-[#1e1e1e] min-h-0">
          {/* Editor Header Bar */}
          <div className="h-9 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <span className="text-xs font-mono font-semibold text-slate-300">
                Solution.java
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                Java (OpenJDK 25)
              </span>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              UTF-8 • Tab: 4
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div
            className={`min-h-0 transition-all ${
              isConsoleCollapsed ? 'flex-1' : 'h-[55%]'
            }`}
          >
            <JavaEditor value={code} onChange={setCode} />
          </div>

          {/* Collapsible / Resizable Bottom Results Console */}
          <div
            className={`transition-all ${
              isConsoleCollapsed ? 'h-10' : 'h-[45%]'
            }`}
          >
            <ConsoleOutput
              result={executionResult}
              isRunning={isRunning || isSubmitting}
              isCollapsed={isConsoleCollapsed}
              onToggleCollapse={() => setIsConsoleCollapsed(!isConsoleCollapsed)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

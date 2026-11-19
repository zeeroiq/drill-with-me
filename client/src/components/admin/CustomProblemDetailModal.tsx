import React, { useState, useEffect } from 'react';
import {
  api,
  CustomProblemDetail,
  CustomProblemRunItem,
  Verdict,
} from '../../api/client';
import { JavaEditor } from '../JavaEditor';
import { MarkdownView } from '../MarkdownView';
import { formatDate, formatRelativeTime } from '../../lib/utils';
import { ProblemEditorInitialData } from './ProblemEditorModal';
import { slugify } from '../../lib/utils';
import {
  X,
  Sparkles,
  Copy,
  Check,
  Code2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Terminal,
  Loader2,
  User,
  History,
  FileText,
} from 'lucide-react';

interface CustomProblemDetailModalProps {
  customProblemId: string;
  onClose: () => void;
  onPromote: (initialData: ProblemEditorInitialData) => void;
}

export const CustomProblemDetailModal: React.FC<CustomProblemDetailModalProps> = ({
  customProblemId,
  onClose,
  onPromote,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [detail, setDetail] = useState<CustomProblemDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'statement' | 'code' | 'testcases' | 'runs'>('statement');
  const [selectedRun, setSelectedRun] = useState<CustomProblemRunItem | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const data = await api.getAdminCustomProblem(customProblemId);
        if (isMounted) {
          setDetail(data);
          const runs = data.runs || data.recentRuns || [];
          if (runs.length > 0) {
            setSelectedRun(runs[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load custom problem detail:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [customProblemId]);

  const handleCopyVisitorId = () => {
    if (!detail) return;
    navigator.clipboard.writeText(detail.visitor_id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handlePromoteClick = () => {
    if (!detail) return;

    // Determine a clean title
    let derivedTitle = detail.title?.trim() || '';
    if (!derivedTitle || derivedTitle.toLowerCase() === 'custom problem') {
      const firstLine = detail.problem_statement?.split('\n')[0]?.replace(/[#*`]/g, '').trim();
      if (firstLine && firstLine.length > 3) {
        derivedTitle = firstLine.slice(0, 50);
      } else {
        derivedTitle = 'Custom Drill Practice';
      }
    }

    const derivedSlug = slugify(derivedTitle) || `practice-${detail.id.slice(0, 8)}`;

    const testCasesList = detail.customTestCases || detail.custom_test_cases || detail.testCases || [];

    const mappedTestCases = testCasesList.map((tc, idx) => ({
      input_display: tc.stdin || `Case ${idx + 1}`,
      input_payload: tc.stdin || '',
      expected_output: tc.expected_output || tc.expectedOutput || '',
      is_hidden: 0,
      sort_order: idx + 1,
    }));

    if (mappedTestCases.length === 0) {
      mappedTestCases.push({
        input_display: 'sample input',
        input_payload: 'sample input',
        expected_output: 'expected result',
        is_hidden: 0,
        sort_order: 1,
      });
    }

    const initialData: ProblemEditorInitialData = {
      title: derivedTitle,
      slug: derivedSlug,
      difficulty: 'Medium',
      description_md: detail.problem_statement || `# ${derivedTitle}\n\nDescribe the problem here...`,
      starter_code: detail.code || '',
      source_custom_problem_id: detail.id,
      test_cases: mappedTestCases,
      sample_solution_code: detail.code || '',
      is_published: 1,
    };

    onPromote(initialData);
  };

  const renderVerdictBadge = (verdict: Verdict) => {
    switch (verdict) {
      case 'ACCEPTED':
      case 'PASSED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Accepted
          </span>
        );
      case 'WRONG_ANSWER':
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        );
      case 'COMPILE_ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-3 w-3" />
            Compile Error
          </span>
        );
      case 'TIME_LIMIT_EXCEEDED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-600/10 text-rose-500 border border-rose-600/20">
            <Clock className="h-3 w-3" />
            TLE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {verdict}
          </span>
        );
    }
  };

  const runs = detail?.runs || detail?.recentRuns || [];
  const testCases = detail?.customTestCases || detail?.custom_test_cases || detail?.testCases || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {detail?.title || 'Anonymous Custom Practice Problem'}
                </h2>
                {detail?.is_promoted || detail?.promoted_problem_id ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Promoted ({detail.promoted_problem?.slug || `#${detail.promoted_problem_id}`})</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    Not Promoted
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3 text-slate-500" />
                  Visitor: <strong className="font-mono text-slate-300">{detail?.visitor_id.slice(0, 8)}...</strong>
                  <button
                    onClick={handleCopyVisitorId}
                    className="p-0.5 text-slate-400 hover:text-white rounded"
                    title="Copy full visitor ID"
                  >
                    {copiedId ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </span>
                <span>•</span>
                <span>Last updated {formatRelativeTime(detail?.updated_at)}</span>
                <span>•</span>
                <span>{runs.length} practice runs</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePromoteClick}
              className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Promote to Public Problem</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Sub-header Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-6 border-b border-slate-800 bg-slate-950/60 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('statement')}
            className={`py-3 px-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'statement'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Problem Statement</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`py-3 px-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'code'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Latest Visitor Code</span>
          </button>

          <button
            onClick={() => setActiveTab('testcases')}
            className={`py-3 px-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'testcases'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Custom Test Cases ({testCases.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('runs')}
            className={`py-3 px-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'runs'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Execution Runs ({runs.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-hidden p-4 sm:p-6 bg-slate-950/40">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-purple-400" />
              <span className="text-xs font-mono">Loading problem details...</span>
            </div>
          ) : !detail ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              Custom problem not found.
            </div>
          ) : (
            <>
              {/* TAB 1: Problem Statement */}
              {activeTab === 'statement' && (
                <div className="h-full overflow-y-auto max-w-4xl mx-auto space-y-4">
                  <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                    {detail.problem_statement?.trim() ? (
                      <MarkdownView content={detail.problem_statement} />
                    ) : (
                      <span className="text-slate-500 text-xs italic">
                        No problem statement provided for this custom drill.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Latest Java Code */}
              {activeTab === 'code' && (
                <div className="h-full flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
                    <span>Read-only view of visitor's latest code solution:</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {detail.code ? `${detail.code.split('\n').length} lines` : '0 lines'}
                    </span>
                  </div>
                  <div className="flex-1 min-h-[400px] rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                    <JavaEditor
                      value={detail.code || '// No code saved'}
                      onChange={() => {}}
                      readOnly={true}
                      height="100%"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: Custom Test Cases */}
              {activeTab === 'testcases' && (
                <div className="h-full overflow-y-auto max-w-4xl mx-auto space-y-3">
                  {testCases.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-xs">
                      No custom test cases were provided for this drill.
                    </div>
                  ) : (
                    testCases.map((tc, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 shadow-md"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-200">
                            Custom Test Case #{idx + 1}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                          <div>
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                              Standard Input (stdin):
                            </span>
                            <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-200 whitespace-pre-wrap select-text">
                              {tc.stdin || '(empty)'}
                            </pre>
                          </div>

                          <div>
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                              Expected Output:
                            </span>
                            <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 text-emerald-400 whitespace-pre-wrap select-text">
                              {tc.expected_output || tc.expectedOutput || '(none specified)'}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: Execution Run History */}
              {activeTab === 'runs' && (
                <div className="h-full grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Left: Runs List */}
                  <div className="md:col-span-5 flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-3 bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Run History
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
                      {runs.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-xs">
                          No execution runs logged yet.
                        </div>
                      ) : (
                        runs.map((run) => {
                          const isSelected = selectedRun?.id === run.id;
                          return (
                            <div
                              key={run.id}
                              onClick={() => setSelectedRun(run)}
                              className={`p-3 cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-purple-500/10 border-l-2 border-purple-500'
                                  : 'hover:bg-slate-800/50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-xs font-mono font-bold text-slate-200">
                                  Run #{run.id}
                                </span>
                                {renderVerdictBadge(run.verdict)}
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                                <span>
                                  {run.passed_count}/{run.total_count} tests ({run.runtime_ms}ms)
                                </span>
                                <span>{formatRelativeTime(run.created_at)}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right: Selected Run Code & Diagnostics */}
                  <div className="md:col-span-7 flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    {selectedRun ? (
                      <>
                        <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <Terminal className="h-4 w-4 text-purple-400" />
                            <span className="text-xs font-semibold text-slate-200">
                              Run #{selectedRun.id} Details
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatDate(selectedRun.created_at)}
                          </span>
                        </div>

                        {selectedRun.error_output && (
                          <div className="p-3 bg-rose-950/20 border-b border-rose-900/40 text-rose-300 text-xs font-mono max-h-32 overflow-y-auto">
                            <span className="font-bold block mb-1 text-rose-400">Error Output:</span>
                            {selectedRun.error_output}
                          </div>
                        )}

                        <div className="flex-1 min-h-0">
                          <JavaEditor
                            value={selectedRun.code}
                            onChange={() => {}}
                            readOnly={true}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                        Select an execution run on the left to inspect its code snapshot.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

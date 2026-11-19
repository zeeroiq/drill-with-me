import React, { useState, useEffect } from 'react';
import {
  api,
  Visitor,
  PageVisit,
  Submission,
  Verdict,
  CustomProblemItem,
} from '../api/client';
import { formatDate, formatRelativeTime } from '../lib/utils';
import { JavaEditor } from './JavaEditor';
import { MarkdownView } from './MarkdownView';
import { ProblemEditorInitialData } from './admin/ProblemEditorModal';
import { slugify } from '../lib/utils';
import {
  X,
  Copy,
  Check,
  History,
  Code2,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Globe,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface VisitorDrilldownModalProps {
  visitor: Visitor;
  onClose: () => void;
  onPromoteProblem?: (initialData: ProblemEditorInitialData) => void;
}

export const VisitorDrilldownModal: React.FC<VisitorDrilldownModalProps> = ({
  visitor,
  onClose,
  onPromoteProblem,
}) => {
  const [activeTab, setActiveTab] = useState<'submissions' | 'custom' | 'visits'>('submissions');
  const [loading, setLoading] = useState<boolean>(true);
  const [visits, setVisits] = useState<PageVisit[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [customProblems, setCustomProblems] = useState<CustomProblemItem[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedCustomProblem, setSelectedCustomProblem] = useState<CustomProblemItem | null>(null);
  const [customSubTab, setCustomSubTab] = useState<'statement' | 'code' | 'testcases'>('statement');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadDetails() {
      try {
        setLoading(true);
        const data = await api.getAdminVisitorDetail(visitor.id);
        if (isMounted) {
          setVisits(data.visits || []);
          setSubmissions(data.submissions || []);
          const cp = data.customProblems || (data as any).custom_problems || [];
          setCustomProblems(cp);

          if (data.submissions && data.submissions.length > 0) {
            setSelectedSubmission(data.submissions[0]);
          }
          if (cp.length > 0) {
            setSelectedCustomProblem(cp[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load visitor details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [visitor.id]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePromoteCustomProblem = (item: CustomProblemItem) => {
    if (!onPromoteProblem) return;

    let derivedTitle = item.title?.trim() || '';
    if (!derivedTitle || derivedTitle.toLowerCase() === 'custom problem') {
      const firstLine = item.problem_statement?.split('\n')[0]?.replace(/[#*`]/g, '').trim();
      if (firstLine && firstLine.length > 3) {
        derivedTitle = firstLine.slice(0, 50);
      } else {
        derivedTitle = 'Custom Drill Practice';
      }
    }

    const testCasesList = item.customTestCases || item.custom_test_cases || [];
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
      slug: slugify(derivedTitle) || `practice-${item.id.slice(0, 8)}`,
      difficulty: 'Medium',
      description_md: item.problem_statement || `# ${derivedTitle}\n\nDescribe problem here...`,
      starter_code: item.code || '',
      source_custom_problem_id: item.id,
      test_cases: mappedTestCases,
      sample_solution_code: item.code || '',
      is_published: 1,
    };

    onClose();
    onPromoteProblem(initialData);
  };

  const renderVerdictBadge = (verdict: Verdict) => {
    switch (verdict) {
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Accepted
          </span>
        );
      case 'WRONG_ANSWER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            Wrong Answer
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
      case 'RUNTIME_ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <AlertTriangle className="h-3 w-3" />
            Runtime Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-700/40 text-slate-300 border border-slate-600">
            {verdict}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Visitor:
              </span>
              <span className="font-mono text-xs sm:text-sm text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                {visitor.id}
              </span>
              <button
                onClick={() => copyToClipboard(visitor.id)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                title="Copy Full Visitor ID"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3 text-slate-500" />
                {visitor.ip_address || '127.0.0.1'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-slate-500" />
                Last seen {formatRelativeTime(visitor.last_seen_at)}
              </span>
              <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300">
                {visitor.visit_count} total visits
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Sub-Header Tabs */}
        <div className="flex items-center gap-4 px-6 border-b border-slate-800 bg-slate-900/80 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('submissions')}
            className={`py-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'submissions'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="h-4 w-4" />
            <span>Java Submissions ({submissions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('custom')}
            className={`py-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'custom'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Custom Problems ({customProblems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('visits')}
            className={`py-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'visits'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Page Visit History ({visits.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-hidden p-4 sm:p-6 bg-slate-950/60">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-sky-400" />
              <span className="text-xs font-mono">Loading visitor history...</span>
            </div>
          ) : activeTab === 'submissions' ? (
            /* Submissions Tab */
            submissions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                <Code2 className="h-10 w-10 text-slate-600 mb-2" />
                No code submissions recorded for this visitor yet.
              </div>
            ) : (
              <div className="h-full grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Left: Submissions List */}
                <div className="md:col-span-5 flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="p-3 bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Submission History
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
                    {submissions.map((sub) => {
                      const isSelected = selectedSubmission?.id === sub.id;
                      return (
                        <div
                          key={sub.id}
                          onClick={() => setSelectedSubmission(sub)}
                          className={`p-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-sky-500/10 border-l-2 border-sky-500'
                              : 'hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-slate-200 truncate">
                              {sub.problem_title || `Problem #${sub.problem_id}`}
                            </span>
                            {renderVerdictBadge(sub.verdict)}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                            <span>
                              {sub.passed_count}/{sub.total_count} tests ({sub.runtime_ms}ms)
                            </span>
                            <span>{formatRelativeTime(sub.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Submitted Java Code Viewer */}
                <div className="md:col-span-7 flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  {selectedSubmission ? (
                    <>
                      <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-sky-400" />
                          <span className="text-xs font-semibold text-slate-300">
                            Submitted Code — {selectedSubmission.problem_title || `Problem #${selectedSubmission.problem_id}`}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDate(selectedSubmission.created_at)}
                        </span>
                      </div>

                      {selectedSubmission.error_output && (
                        <div className="p-2.5 bg-amber-950/20 border-b border-amber-800/40 text-amber-300 text-xs font-mono max-h-24 overflow-y-auto">
                          {selectedSubmission.error_output}
                        </div>
                      )}

                      <div className="flex-1 min-h-0">
                        <JavaEditor
                          value={selectedSubmission.code}
                          onChange={() => {}}
                          readOnly={true}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                      Select a submission on the left to inspect code.
                    </div>
                  )}
                </div>
              </div>
            )
          ) : activeTab === 'custom' ? (
            /* Custom Problems Tab */
            customProblems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                <Sparkles className="h-10 w-10 text-slate-600 mb-2" />
                No custom practice problems created by this visitor.
              </div>
            ) : (
              <div className="h-full grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Left: Custom Problems List */}
                <div className="md:col-span-5 flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="p-3 bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Custom Drill Problems
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
                    {customProblems.map((cp) => {
                      const isSelected = selectedCustomProblem?.id === cp.id;
                      const isPromoted = cp.promoted_problem_id !== null || cp.is_promoted;

                      return (
                        <div
                          key={cp.id}
                          onClick={() => setSelectedCustomProblem(cp)}
                          className={`p-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-purple-500/10 border-l-2 border-purple-500'
                              : 'hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-slate-200 truncate">
                              {cp.title || 'Untitled Custom Problem'}
                            </span>
                            {isPromoted ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Promoted
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                Practice
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                            <span>{cp.run_count || 0} runs</span>
                            <span>{formatRelativeTime(cp.updated_at || cp.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Selected Custom Problem Viewer */}
                <div className="md:col-span-7 flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  {selectedCustomProblem ? (
                    <>
                      {/* Top bar with sub-tabs & promote button */}
                      <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCustomSubTab('statement')}
                            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                              customSubTab === 'statement'
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Statement
                          </button>
                          <button
                            onClick={() => setCustomSubTab('code')}
                            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                              customSubTab === 'code'
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Java Code
                          </button>
                          <button
                            onClick={() => setCustomSubTab('testcases')}
                            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                              customSubTab === 'testcases'
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Test Cases
                          </button>
                        </div>

                        {onPromoteProblem && (
                          <button
                            onClick={() => handlePromoteCustomProblem(selectedCustomProblem)}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>Promote Problem</span>
                          </button>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-h-0 overflow-y-auto">
                        {customSubTab === 'statement' ? (
                          <div className="p-4">
                            {selectedCustomProblem.problem_statement?.trim() ? (
                              <MarkdownView content={selectedCustomProblem.problem_statement} />
                            ) : (
                              <span className="text-xs text-slate-500 italic">No problem statement written.</span>
                            )}
                          </div>
                        ) : customSubTab === 'code' ? (
                          <JavaEditor
                            value={selectedCustomProblem.code || '// No code provided'}
                            onChange={() => {}}
                            readOnly={true}
                          />
                        ) : (
                          <div className="p-4 space-y-3">
                            {((selectedCustomProblem.customTestCases || selectedCustomProblem.custom_test_cases || [])).map(
                              (tc, idx) => (
                                <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
                                  <div className="text-[11px] font-bold text-slate-400">Case #{idx + 1}</div>
                                  <div><span className="text-slate-500">Stdin: </span><span className="text-slate-300">{tc.stdin || '—'}</span></div>
                                  <div><span className="text-slate-500">Expected: </span><span className="text-emerald-400">{tc.expected_output || tc.expectedOutput || '—'}</span></div>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                      Select a custom problem on the left to inspect details.
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            /* Page Visits Tab */
            visits.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                <History className="h-10 w-10 text-slate-600 mb-2" />
                No page visit history recorded.
              </div>
            ) : (
              <div className="h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                <div className="p-3 bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Complete Page Journey (Most Recent First)
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
                  {visits.map((v) => (
                    <div
                      key={v.id}
                      className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-sky-400/80" />
                        <span className="font-mono text-slate-200 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
                          {v.path}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400">
                        <span className="font-mono text-[11px]">{formatDate(v.visited_at)}</span>
                        <span className="text-[11px] text-slate-500">
                          ({formatRelativeTime(v.visited_at)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

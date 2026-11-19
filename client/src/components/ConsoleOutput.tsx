import React, { useState } from 'react';
import { ExecutionResult, Verdict } from '../api/client';
import { CheckCircle2, XCircle, AlertTriangle, Clock, Terminal, ChevronDown, ChevronUp, Cpu } from 'lucide-react';

interface ConsoleOutputProps {
  result: ExecutionResult | null;
  isRunning: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ConsoleOutput: React.FC<ConsoleOutputProps> = ({
  result,
  isRunning,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<string>('case-0');

  const getVerdictBadge = (verdict: Verdict) => {
    switch (verdict) {
      case 'ACCEPTED':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>Accepted</span>
          </div>
        );
      case 'WRONG_ANSWER':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-sm">
            <XCircle className="h-4 w-4" />
            <span>Wrong Answer</span>
          </div>
        );
      case 'COMPILE_ERROR':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>Compile Error</span>
          </div>
        );
      case 'TIME_LIMIT_EXCEEDED':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-600/10 border border-rose-600/30 text-rose-500 font-bold text-sm">
            <Clock className="h-4 w-4" />
            <span>Time Limit Exceeded</span>
          </div>
        );
      case 'RUNTIME_ERROR':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>Runtime Error</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-700/50 border border-slate-600 text-slate-300 font-bold text-sm">
            <span>{verdict}</span>
          </div>
        );
    }
  };

  const testCases = result?.test_cases || [];

  return (
    <div className="flex flex-col h-full bg-slate-950 border-t border-slate-800 text-slate-200">
      {/* Console Top Header Bar */}
      <div className="h-10 px-4 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-sky-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Console Output
          </span>
          {result && (
            <span className="text-xs text-slate-400 font-mono ml-2">
              Runtime: {result.runtime_ms} ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
              title={isCollapsed ? 'Expand console' : 'Collapse console'}
            >
              {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Running indicator */}
          {isRunning && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400 gap-3">
              <div className="relative">
                <Cpu className="h-8 w-8 text-sky-400 animate-pulse" />
              </div>
              <span className="text-sm font-mono text-slate-300">
                Compiling and running against OpenJDK 25 sandbox...
              </span>
            </div>
          )}

          {/* Empty state: No run yet */}
          {!isRunning && !result && (
            <div className="flex-1 flex items-center justify-center p-6 text-slate-500 text-xs font-mono">
              Press "Run Code" to test sample cases or "Submit" to test all cases.
            </div>
          )}

          {/* Result view */}
          {!isRunning && result && (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
              {/* Verdict header banner */}
              <div className="p-3.5 bg-slate-900/50 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3">
                  {getVerdictBadge(result.verdict)}
                  <span className="text-xs font-medium text-slate-300">
                    Passed: <strong className="text-white">{result.passed_count}</strong> / {result.total_count} cases
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  {result.runtime_ms}ms execution time
                </div>
              </div>

              {/* Sub-tabs: Test Cases or Compiler Output */}
              <div className="flex items-center gap-1 px-3 pt-2 border-b border-slate-800 bg-slate-900/30 flex-shrink-0 overflow-x-auto">
                {testCases.map((tc, idx) => {
                  const tabId = `case-${idx}`;
                  const isActive = activeTab === tabId;
                  return (
                    <button
                      key={tabId}
                      onClick={() => setActiveTab(tabId)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                        isActive
                          ? 'bg-slate-950 text-white border-t border-x border-slate-800 font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          tc.passed ? 'bg-emerald-400' : 'bg-rose-500'
                        }`}
                      />
                      <span>Case {idx + 1}</span>
                    </button>
                  );
                })}

                <button
                  onClick={() => setActiveTab('output')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'output'
                      ? 'bg-slate-950 text-white border-t border-x border-slate-800 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Terminal className="h-3 w-3" />
                  <span>Stdout & Errors</span>
                  {(result.error_output || result.stderr) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                </button>
              </div>

              {/* Content Panel */}
              <div className="p-4 flex-1 overflow-y-auto">
                {/* Specific Test Case Tab */}
                {activeTab.startsWith('case-') && (() => {
                  const caseIdx = parseInt(activeTab.replace('case-', ''), 10);
                  const tc = testCases[caseIdx];

                  if (!tc) {
                    return (
                      <div className="text-xs text-slate-500 font-mono">
                        No test case details available for this index.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3.5 max-w-4xl text-xs">
                      {/* Input */}
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Input:
                        </div>
                        <div className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-slate-200 whitespace-pre-wrap select-text">
                          {tc.input_display || tc.input_payload || '—'}
                        </div>
                      </div>

                      {/* Expected Output */}
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Expected Output:
                        </div>
                        <div className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-emerald-400 whitespace-pre-wrap select-text">
                          {tc.expected_output || '—'}
                        </div>
                      </div>

                      {/* Actual Output */}
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Actual Output:
                        </div>
                        <div
                          className={`p-2.5 rounded border font-mono whitespace-pre-wrap select-text ${
                            tc.passed
                              ? 'bg-slate-900 border-slate-800 text-slate-200'
                              : 'bg-rose-950/20 border-rose-900/40 text-rose-300'
                          }`}
                        >
                          {tc.actual_output !== undefined ? tc.actual_output : '(no output)'}
                        </div>
                      </div>

                      {/* Error or stdout per case if available */}
                      {tc.error && (
                        <div>
                          <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-1">
                            Error:
                          </div>
                          <pre className="p-2.5 rounded bg-rose-950/30 border border-rose-900/50 font-mono text-rose-300 whitespace-pre-wrap text-xs select-text">
                            {tc.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Output & Errors Tab */}
                {activeTab === 'output' && (
                  <div className="space-y-4 max-w-4xl text-xs">
                    {/* Compilation / Runtime Errors */}
                    {result.error_output && (
                      <div>
                        <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Compiler / Sandbox Error:</span>
                        </div>
                        <pre className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 font-mono text-amber-200 whitespace-pre-wrap select-text overflow-x-auto">
                          {result.error_output}
                        </pre>
                      </div>
                    )}

                    {/* Standard Error */}
                    {result.stderr && (
                      <div>
                        <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-1">
                          Standard Error (stderr):
                        </div>
                        <pre className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40 font-mono text-rose-300 whitespace-pre-wrap select-text overflow-x-auto">
                          {result.stderr}
                        </pre>
                      </div>
                    )}

                    {/* Standard Output */}
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Standard Output (stdout):
                      </div>
                      <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-slate-300 whitespace-pre-wrap select-text overflow-x-auto">
                        {result.stdout ? result.stdout : '(No stdout produced)'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

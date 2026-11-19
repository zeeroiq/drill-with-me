import React, { useState, useEffect } from 'react';
import { api, CustomProblemItem } from '../../api/client';
import { CustomProblemDetailModal } from './CustomProblemDetailModal';
import { ProblemEditorModal, ProblemEditorInitialData } from './ProblemEditorModal';
import { formatDate, formatRelativeTime } from '../../lib/utils';
import {
  Sparkles,
  Search,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export const AdminCustomProblemsTab: React.FC = () => {
  const [problems, setProblems] = useState<CustomProblemItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'unpromoted' | 'promoted'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selected for inspection modal
  const [selectedCustomProblemId, setSelectedCustomProblemId] = useState<string | null>(null);

  // Promotion Editor Modal state
  const [editorInitialData, setEditorInitialData] = useState<ProblemEditorInitialData | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);

  const loadCustomProblems = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminCustomProblems({
        search: search.trim() || undefined,
        filter: filter,
      });
      setProblems(data);
    } catch (err) {
      console.error('Failed to load custom problems:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomProblems();
  }, [filter]);

  // Debounced or on-submit search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCustomProblems();
  };

  const handleCopyVisitor = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenDetail = (item: CustomProblemItem) => {
    setSelectedCustomProblemId(item.id);
  };

  const handlePromoteFromDetail = (initialData: ProblemEditorInitialData) => {
    setSelectedCustomProblemId(null);
    setEditorInitialData(initialData);
    setIsEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <span>Anonymous Custom Problems</span>
            <span className="text-xs font-normal text-slate-400">
              ({problems.length} total)
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Inspect custom drill problems authored by anonymous visitors and promote promising ones to the public catalog.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Filter Pills */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filter === 'all'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unpromoted')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filter === 'unpromoted'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Unpromoted
            </button>
            <button
              onClick={() => setFilter('promoted')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filter === 'promoted'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Promoted
            </button>
          </div>

          <button
            onClick={loadCustomProblems}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh custom problems"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by title, statement keywords, or visitor ID... (Press Enter to search)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-24 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Search
        </button>
      </form>

      {/* Custom Problems Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Title & Statement Snippet</th>
                <th className="py-3 px-4">Visitor ID</th>
                <th className="py-3 px-4">Total Runs</th>
                <th className="py-3 px-4">Last Active</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-purple-400 mb-2" />
                    <span>Loading anonymous problems...</span>
                  </td>
                </tr>
              ) : problems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">
                    No custom practice problems found matching current filters.
                  </td>
                </tr>
              ) : (
                problems.map((p) => {
                  const shortVisitorId = `${p.visitor_id.slice(0, 8)}...${p.visitor_id.slice(-4)}`;
                  const isCopied = copiedId === p.visitor_id;
                  const statementSnippet = p.problem_statement
                    ? p.problem_statement.replace(/[#*`\n]/g, ' ').slice(0, 90) + '...'
                    : 'No problem statement recorded.';

                  const isPromoted = p.promoted_problem_id !== null || p.is_promoted;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleOpenDetail(p)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Title & Statement snippet */}
                      <td className="py-3 px-4 max-w-md">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-200 text-sm font-sans flex items-center gap-2 group-hover:text-purple-300 transition-colors">
                            <span>{p.title || 'Untitled Practice Problem'}</span>
                          </span>
                          <span className="text-[11px] text-slate-400 font-sans truncate mt-0.5" title={p.problem_statement}>
                            {statementSnippet}
                          </span>
                        </div>
                      </td>

                      {/* Visitor ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-sky-400">
                          <span>{shortVisitorId}</span>
                          <button
                            onClick={(e) => handleCopyVisitor(p.visitor_id, e)}
                            className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800 transition-colors opacity-80 group-hover:opacity-100"
                            title="Copy Visitor ID"
                          >
                            {isCopied ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Total Runs */}
                      <td className="py-3 px-4 text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono">
                          {p.run_count || 0} runs
                        </span>
                      </td>

                      {/* Last Active */}
                      <td className="py-3 px-4 text-slate-400 font-sans text-xs" title={formatDate(p.last_run_at || p.updated_at)}>
                        {formatRelativeTime(p.last_run_at || p.updated_at)}
                      </td>

                      {/* Promoted Status Badge */}
                      <td className="py-3 px-4 font-sans">
                        {isPromoted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Promoted</span>
                            {p.promoted_slug && (
                              <a
                                href={`/problems/${p.promoted_slug}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="ml-0.5 hover:underline text-emerald-300"
                              >
                                ({p.promoted_slug})
                              </a>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            Not Promoted
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] text-purple-400 font-sans font-semibold group-hover:underline">
                          <span>Inspect</span>
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Problem Detail Modal */}
      {selectedCustomProblemId && (
        <CustomProblemDetailModal
          customProblemId={selectedCustomProblemId}
          onClose={() => setSelectedCustomProblemId(null)}
          onPromote={handlePromoteFromDetail}
        />
      )}

      {/* Problem Promotion Editor Modal */}
      {isEditorOpen && (
        <ProblemEditorModal
          initialData={editorInitialData}
          onClose={() => setIsEditorOpen(false)}
          onSaved={() => {
            setIsEditorOpen(false);
            loadCustomProblems();
          }}
        />
      )}
    </div>
  );
};

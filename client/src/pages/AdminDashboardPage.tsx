import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, AdminOverview, Visitor } from '../api/client';
import { VisitorDrilldownModal } from '../components/VisitorDrilldownModal';
import { AdminProblemsTab } from '../components/admin/AdminProblemsTab';
import { AdminCustomProblemsTab } from '../components/admin/AdminCustomProblemsTab';
import { ProblemEditorModal, ProblemEditorInitialData } from '../components/admin/ProblemEditorModal';
import { formatDate, formatRelativeTime } from '../lib/utils';
import {
  Users,
  Eye,
  CheckCircle2,
  FileCode2,
  Search,
  LogOut,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  ArrowUpDown,
  ExternalLink,
  ShieldCheck,
  Percent,
  Sparkles,
  LayoutDashboard,
} from 'lucide-react';

interface AdminDashboardPageProps {
  onLogout: () => void;
}

type AdminTab = 'overview' | 'visitors' | 'problems' | 'anonymous-problems';

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onLogout }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as AdminTab) || 'overview';
  const [activeTab, setActiveTab] = useState<AdminTab>(
    ['overview', 'visitors', 'problems', 'anonymous-problems'].includes(initialTab)
      ? initialTab
      : 'overview'
  );

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Search & Sorting state for Visitors tab
  const [visitorSearch, setVisitorSearch] = useState<string>('');
  const [sortField, setSortField] = useState<'last_seen_at' | 'visit_count' | 'solved_count' | 'first_seen_at'>('last_seen_at');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Selected visitor modal
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Promotion modal state triggered from visitor modal
  const [promotionInitialData, setPromotionInitialData] = useState<ProblemEditorInitialData | null>(null);
  const [isPromotionEditorOpen, setIsPromotionEditorOpen] = useState<boolean>(false);

  const loadDashboardData = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      else setRefreshing(true);

      const [overviewData, visitorsData] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminVisitors(),
      ]);

      setOverview(overviewData);
      setVisitors(visitorsData);
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData(true);
  }, []);

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSort = (field: 'last_seen_at' | 'visit_count' | 'solved_count' | 'first_seen_at') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Filter & sort visitors
  const filteredVisitors = visitors
    .filter((v) => {
      const term = visitorSearch.toLowerCase();
      return (
        v.id.toLowerCase().includes(term) ||
        (v.ip_address && v.ip_address.toLowerCase().includes(term)) ||
        (v.user_agent && v.user_agent.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      let valA: string | number = a[sortField] ?? 0;
      let valB: string | number = b[sortField] ?? 0;

      if (sortField === 'last_seen_at' || sortField === 'first_seen_at') {
        const timeA = new Date(valA as string).getTime() || 0;
        const timeB = new Date(valB as string).getTime() || 0;
        return sortAsc ? timeA - timeB : timeB - timeA;
      }

      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
      return sortAsc ? valA - valB : valB - valA;
    });

  const stats = overview?.stats || {
    totalVisitors: overview?.totalVisitors || 0,
    totalPageVisits: overview?.totalPageVisits || 0,
    totalSubmissions: overview?.totalSubmissions || 0,
    acceptedRate: overview?.acceptedRate || 0,
    totalCustomProblems: overview?.totalCustomProblems || 0,
    totalCustomRuns: overview?.totalCustomRuns || 0,
  };

  const totalCustomProblems = overview?.totalCustomProblems ?? stats.totalCustomProblems ?? 0;
  const totalCustomRuns = overview?.totalCustomRuns ?? stats.totalCustomRuns ?? 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-16">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Public Site</span>
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-sky-400" />
                <span>Admin Portal</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadDashboardData(false)}
              disabled={refreshing}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Refresh dashboard"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-sky-400' : ''}`} />
            </button>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto border-t border-slate-800/60">
          <button
            onClick={() => handleTabChange('overview')}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => handleTabChange('visitors')}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'visitors'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Visitors</span>
            {visitors.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                {visitors.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('problems')}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'problems'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <FileCode2 className="h-4 w-4" />
            <span>Problems</span>
          </button>

          <button
            onClick={() => handleTabChange('anonymous-problems')}
            className={`py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'anonymous-problems'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Anonymous Problems</span>
            {totalCustomProblems > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
                {totalCustomProblems}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 flex-1">
        {/* ============================================================== */}
        {/* TAB 1: OVERVIEW */}
        {/* ============================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-150">
            {/* Metric Cards (5 Columns on Desktop) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Total Visitors */}
              <div
                onClick={() => handleTabChange('visitors')}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors relative overflow-hidden group shadow-lg"
              >
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Unique Visitors</span>
                  <Users className="h-5 w-5 text-sky-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {stats.totalVisitors.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Tracked via persistent HTTP cookie</p>
              </div>

              {/* Page Visits */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Page Hits</span>
                  <Eye className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {stats.totalPageVisits.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Total route transitions logged</p>
              </div>

              {/* Submissions */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Code Submissions</span>
                  <FileCode2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {stats.totalSubmissions.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Java OpenJDK 25 test harness runs</p>
              </div>

              {/* Acceptance Rate */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-lg">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Acceptance Rate</span>
                  <Percent className="h-5 w-5 text-amber-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {stats.acceptedRate}%
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Accepted vs total submissions
                </p>
              </div>

              {/* Custom Problems Practiced (New Card) */}
              <div
                onClick={() => handleTabChange('anonymous-problems')}
                className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-900/40 hover:border-purple-700/60 cursor-pointer transition-colors relative overflow-hidden group shadow-lg"
              >
                <div className="flex items-center justify-between text-purple-300 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Custom Practiced</span>
                  <Sparkles className="h-5 w-5 text-purple-400 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {totalCustomProblems.toLocaleString()}
                </div>
                <p className="text-[11px] text-purple-300/70 mt-1">
                  {totalCustomRuns.toLocaleString()} practice runs executed
                </p>
              </div>
            </div>

            {/* Problem Solve Stats Section */}
            {overview?.problemStats && overview.problemStats.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Problem Submissions & Solve Metrics</span>
                  </h3>
                  <button
                    onClick={() => handleTabChange('problems')}
                    className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:underline"
                  >
                    <span>Manage all problems</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  {overview.problemStats.map((p) => {
                    const solvePercent = p.attempts > 0 ? Math.round((p.solves / p.attempts) * 100) : 0;
                    return (
                      <div
                        key={p.id}
                        className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-xs font-semibold text-slate-200 truncate">
                              {p.title}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                p.difficulty === 'Easy'
                                  ? 'text-emerald-400 bg-emerald-500/10'
                                  : p.difficulty === 'Medium'
                                  ? 'text-amber-400 bg-amber-500/10'
                                  : 'text-rose-400 bg-rose-500/10'
                              }`}
                            >
                              {p.difficulty}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                            <span>Solves: <strong className="text-emerald-400">{p.solves}</strong></span>
                            <span>Attempts: <strong className="text-slate-300">{p.attempts}</strong></span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, solvePercent)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: VISITORS */}
        {/* ============================================================== */}
        {activeTab === 'visitors' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-150">
            {/* Table Header Controls */}
            <div className="p-4 sm:p-6 border-b border-slate-800/80 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-950/40">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-sky-400" />
                  <span>Tracked Anonymous Visitors</span>
                  <span className="text-xs font-normal text-slate-400">
                    ({filteredVisitors.length} total)
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any visitor row to open their complete visit journey, Java submissions, and custom practice problems.
                </p>
              </div>

              {/* Table Search */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search visitor ID, IP..."
                  value={visitorSearch}
                  onChange={(e) => setVisitorSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Visitor ID</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4 hidden md:table-cell">User Agent</th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-200 transition-colors"
                      onClick={() => handleSort('visit_count')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Visits</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-200 transition-colors"
                      onClick={() => handleSort('solved_count')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Solves</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-200 transition-colors"
                      onClick={() => handleSort('last_seen_at')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Last Seen</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Loading visitors table...
                      </td>
                    </tr>
                  ) : filteredVisitors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                        No visitors match the search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredVisitors.map((v) => {
                      const shortId = v.id ? `${v.id.slice(0, 8)}...${v.id.slice(-4)}` : '—';
                      const isCopied = copiedId === v.id;

                      return (
                        <tr
                          key={v.id}
                          onClick={() => setSelectedVisitor(v)}
                          className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                        >
                          {/* ID with copy */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 font-bold text-sky-400">
                              <span>{shortId}</span>
                              <button
                                onClick={(e) => handleCopyId(v.id, e)}
                                className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800 transition-colors opacity-80 group-hover:opacity-100"
                                title="Copy full Visitor ID"
                              >
                                {isCopied ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* IP */}
                          <td className="py-3 px-4 text-slate-300">
                            {v.ip_address || '127.0.0.1'}
                          </td>

                          {/* User Agent */}
                          <td className="py-3 px-4 hidden md:table-cell text-slate-400 max-w-xs truncate font-sans text-[11px]" title={v.user_agent}>
                            {v.user_agent || 'Unknown UA'}
                          </td>

                          {/* Visits */}
                          <td className="py-3 px-4 text-slate-200">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                              {v.visit_count}
                            </span>
                          </td>

                          {/* Solves */}
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[11px] border border-emerald-500/20">
                              {v.solved_count || 0}
                            </span>
                            <span className="text-slate-500 ml-1 text-[10px]">
                              / {v.attempted_count || 0} att.
                            </span>
                          </td>

                          {/* Last Seen */}
                          <td
                            className="py-3 px-4 text-slate-400 font-sans text-xs"
                            title={formatDate(v.last_seen_at)}
                          >
                            {formatRelativeTime(v.last_seen_at)}
                          </td>

                          {/* Inspect action */}
                          <td className="py-3 px-4 text-right">
                            <span className="inline-flex items-center gap-1 text-[11px] text-sky-400 font-sans font-semibold group-hover:underline">
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
        )}

        {/* ============================================================== */}
        {/* TAB 3: PROBLEMS (OFFICIAL PROBLEMS CRUD) */}
        {/* ============================================================== */}
        {activeTab === 'problems' && (
          <div className="animate-in fade-in duration-150">
            <AdminProblemsTab />
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: ANONYMOUS PROBLEMS (INSPECTION & ONE-CLICK PROMOTION) */}
        {/* ============================================================== */}
        {activeTab === 'anonymous-problems' && (
          <div className="animate-in fade-in duration-150">
            <AdminCustomProblemsTab />
          </div>
        )}
      </main>

      {/* Visitor Drilldown Modal */}
      {selectedVisitor && (
        <VisitorDrilldownModal
          visitor={selectedVisitor}
          onClose={() => setSelectedVisitor(null)}
          onPromoteProblem={(initialData) => {
            setSelectedVisitor(null);
            setPromotionInitialData(initialData);
            setIsPromotionEditorOpen(true);
          }}
        />
      )}

      {/* Problem Editor Modal triggered from Visitor drilldown promotion shortcut */}
      {isPromotionEditorOpen && (
        <ProblemEditorModal
          initialData={promotionInitialData}
          onClose={() => setIsPromotionEditorOpen(false)}
          onSaved={() => {
            setIsPromotionEditorOpen(false);
            loadDashboardData(false);
            setActiveTab('problems');
          }}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { api, AdminProblemItem } from '../../api/client';
import { ProblemEditorModal, ProblemEditorInitialData } from './ProblemEditorModal';
import { formatDate } from '../../lib/utils';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  FileCode2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';

export const AdminProblemsTab: React.FC = () => {
  const [problems, setProblems] = useState<AdminProblemItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Editor Modal state
  const [editorInitialData, setEditorInitialData] = useState<ProblemEditorInitialData | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);

  // Delete Confirmation state
  const [deletingProblem, setDeletingProblem] = useState<AdminProblemItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const loadProblems = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminProblems();
      setProblems(data);
    } catch (err) {
      console.error('Failed to load admin problems:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProblems();
  }, []);

  const handleCreateNew = () => {
    setEditorInitialData(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (problem: AdminProblemItem) => {
    setEditorInitialData({
      problemId: problem.id,
      title: problem.title,
      slug: problem.slug,
      difficulty: problem.difficulty,
      is_published: problem.is_published,
    });
    setIsEditorOpen(true);
  };

  const handleTogglePublish = async (problem: AdminProblemItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setTogglingId(problem.id);
      const newStatus = problem.is_published === 1 ? 0 : 1;
      await api.updateAdminProblem(problem.id, { is_published: newStatus });
      // Update local state immediately
      setProblems((prev) =>
        prev.map((p) =>
          p.id === problem.id ? { ...p, is_published: newStatus, isPublished: newStatus === 1 } : p
        )
      );
    } catch (err) {
      console.error('Failed to toggle publish status:', err);
      alert('Failed to update published status. Please check your admin permissions.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProblem) return;
    try {
      setIsDeleting(true);
      await api.deleteAdminProblem(deletingProblem.id);
      setProblems((prev) => prev.filter((p) => p.id !== deletingProblem.id));
      setDeletingProblem(null);
    } catch (err) {
      console.error('Failed to delete problem:', err);
      alert('Failed to delete problem.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProblems = problems.filter((p) => {
    const term = search.toLowerCase();
    return p.title.toLowerCase().includes(term) || p.slug.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-sky-400" />
            <span>Official Problems Library</span>
            <span className="text-xs font-normal text-slate-400">
              ({filteredProblems.length} total)
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage practice catalog problems, test harness suites, and publication visibility.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by title or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <button
            onClick={loadProblems}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh problems list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          <button
            onClick={handleCreateNew}
            className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-sky-600/20 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Create Problem</span>
          </button>
        </div>
      </div>

      {/* Problems Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Title & Slug</th>
                <th className="py-3 px-4">Difficulty</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Test Cases</th>
                <th className="py-3 px-4">Submissions</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-sky-400 mb-2" />
                    <span>Loading problem library...</span>
                  </td>
                </tr>
              ) : filteredProblems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                    No problems match your query.
                  </td>
                </tr>
              ) : (
                filteredProblems.map((p) => {
                  const isPublished = p.is_published === 1;
                  const isToggling = togglingId === p.id;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Title & Slug */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-200 text-sm font-sans flex items-center gap-2">
                            <span>{p.title}</span>
                            {isPublished && (
                              <a
                                href={`/problems/${p.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-500 hover:text-sky-400 opacity-60 group-hover:opacity-100 transition-opacity"
                                title="Open live problem in new tab"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            /{p.slug}
                          </span>
                        </div>
                      </td>

                      {/* Difficulty */}
                      <td className="py-3 px-4 font-sans">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                            p.difficulty === 'Easy'
                              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                              : p.difficulty === 'Medium'
                              ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                              : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                          }`}
                        >
                          {p.difficulty}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 font-sans">
                        <button
                          onClick={(e) => handleTogglePublish(p, e)}
                          disabled={isToggling}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                            isPublished
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                          }`}
                          title="Click to toggle publish status"
                        >
                          {isToggling ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isPublished ? (
                            <Eye className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <EyeOff className="h-3 w-3 text-amber-400" />
                          )}
                          <span>{isPublished ? 'Published' : 'Draft'}</span>
                        </button>
                      </td>

                      {/* Test Cases Count */}
                      <td className="py-3 px-4 text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                          {p.testCasesCount} cases
                        </span>
                      </td>

                      {/* Submissions */}
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-200 text-xs">
                            {p.submissionsCount}
                          </span>
                          {p.submissionsCount > 0 && (
                            <span className="text-[10px] text-emerald-400 font-mono">
                              ({p.acceptedSubmissionsCount} accepted)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-slate-400 font-sans text-xs">
                        {formatDate(p.created_at)}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(p)}
                            className="p-1.5 text-slate-400 hover:text-sky-400 rounded-lg hover:bg-slate-800 transition-colors"
                            title="Edit Problem"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingProblem(p)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                            title="Delete Problem"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Problem Editor Modal */}
      {isEditorOpen && (
        <ProblemEditorModal
          initialData={editorInitialData}
          onClose={() => setIsEditorOpen(false)}
          onSaved={() => {
            setIsEditorOpen(false);
            loadProblems();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Delete Problem</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">"{deletingProblem.title}"</strong> ({deletingProblem.slug})?
              All corresponding test cases and submissions will also be deleted.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingProblem(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center gap-1.5 shadow-md shadow-rose-600/20"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Problem</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

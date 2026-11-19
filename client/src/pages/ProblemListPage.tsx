import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, ProblemListItem, Difficulty } from '../api/client';
import {
  Search,
  CheckCircle2,
  Clock,
  Circle,
  Filter,
  Sparkles,
  ArrowRight,
  Loader2,
  Code2,
} from 'lucide-react';

export const ProblemListPage: React.FC = () => {
  const [problems, setProblems] = useState<ProblemListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('ALL');

  useEffect(() => {
    let isMounted = true;
    async function loadProblems() {
      try {
        setLoading(true);
        const data = await api.getProblems();
        if (isMounted) {
          setProblems(data);
        }
      } catch (err) {
        console.error('Failed to load problems:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProblems();
    return () => {
      isMounted = false;
    };
  }, []);

  const getDifficultyBadge = (difficulty: Difficulty) => {
    switch (difficulty) {
      case 'Easy':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Easy
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Medium
          </span>
        );
      case 'Hard':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Hard
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
            {difficulty}
          </span>
        );
    }
  };

  const getStatusBadge = (problem: ProblemListItem) => {
    const status = problem.solvedStatus || (problem.isSolved ? 'SOLVED' : problem.isAttempted ? 'ATTEMPTED' : 'UNSOLVED');
    if (status === 'SOLVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span>Solved</span>
        </span>
      );
    }
    if (status === 'ATTEMPTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span>Attempted</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-500">
        <Circle className="h-3 w-3 text-slate-600" />
        <span>Unsolved</span>
      </span>
    );
  };

  const filteredProblems = problems.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase());
    const matchesDifficulty =
      difficultyFilter === 'ALL' || p.difficulty.toUpperCase() === difficultyFilter.toUpperCase();
    return matchesSearch && matchesDifficulty;
  });

  const solvedCount = problems.filter(
    (p) => p.solvedStatus === 'SOLVED' || p.isSolved === true
  ).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Custom Problem Hero CTA Banner */}
      <div className="mb-8 p-6 sm:p-7 rounded-2xl bg-gradient-to-r from-sky-950/80 via-slate-900 to-indigo-950/80 border border-sky-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-500/15 via-indigo-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Custom Problem Sandbox</span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Practice Your Own Java Problem
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Have an interview question, assignment, or snippet you want to test? Write standalone{' '}
              <code className="text-sky-300 font-mono text-xs bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                public class Main
              </code>
              , provide custom stdin test cases, and verify output in real time.
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-3">
            <Link
              to="/custom"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-sky-600/30 hover:shadow-sky-500/40 transition-all flex items-center gap-2 group"
            >
              <span>Launch Custom Sandbox</span>
              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* Hero / Intro Banner */}
      <div className="mb-8 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>LeetCode-Style Java Practice</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Sharpen your <span className="text-sky-400">Java</span> skills with sandboxed drills.
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
            Write, compile, run, and benchmark Java solutions against hidden test suites in an
            isolated OpenJDK 25 runtime environment. No account or setup required.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300">
            <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1 rounded-lg border border-slate-700/60">
              <Code2 className="h-4 w-4 text-sky-400" />
              <span>Available Problems: {problems.length}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1 rounded-lg border border-slate-700/60">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Your Solved: {solvedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls: Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search problems by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Difficulty Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 hidden sm:block" />
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            {['ALL', 'EASY', 'MEDIUM', 'HARD'].map((diff) => (
              <button
                key={diff}
                onClick={() => setDifficultyFilter(diff)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  difficultyFilter === diff
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {diff.charAt(0) + diff.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Problems List Table / Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            <span className="text-sm font-mono">Loading problem catalog...</span>
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-base font-medium">No problems match your search criteria.</p>
            <p className="text-xs text-slate-500 mt-1">Try resetting the difficulty filter or search term.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-12 px-6 py-3.5 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <div className="col-span-1">Status</div>
              <div className="col-span-7">Title</div>
              <div className="col-span-2">Difficulty</div>
              <div className="col-span-2 text-right">Action</div>
            </div>

            {/* Rows */}
            {filteredProblems.map((problem, index) => (
              <Link
                key={problem.id}
                to={`/problems/${problem.slug}`}
                className="group grid grid-cols-1 sm:grid-cols-12 px-6 py-4 items-center hover:bg-slate-800/40 transition-colors gap-2 sm:gap-0"
              >
                {/* Status */}
                <div className="col-span-1 flex items-center">
                  {getStatusBadge(problem)}
                </div>

                {/* Title */}
                <div className="col-span-7 flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-500 w-6">
                    {index + 1}.
                  </span>
                  <span className="text-sm md:text-base font-semibold text-slate-200 group-hover:text-sky-400 transition-colors">
                    {problem.title}
                  </span>
                </div>

                {/* Difficulty */}
                <div className="col-span-2 flex items-center">
                  {getDifficultyBadge(problem.difficulty)}
                </div>

                {/* Action button */}
                <div className="col-span-2 flex items-center justify-end">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-sky-400 transition-colors">
                    <span>Solve</span>
                    <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

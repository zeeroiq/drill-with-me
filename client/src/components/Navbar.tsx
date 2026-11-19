import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Terminal, Code2, BookOpen, Sparkles } from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();

  const isProblemsActive = location.pathname === '/' || location.pathname.startsWith('/problems');
  const isCustomActive = location.pathname.startsWith('/custom');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-bold text-lg text-white hover:opacity-90 transition-opacity"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Code2 className="h-5 w-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="tracking-tight text-white font-extrabold text-lg">
                Java<span className="text-sky-400">Drill</span>
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                JDK 25
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                isProblemsActive
                  ? 'bg-slate-800 text-sky-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Terminal className="h-4 w-4" />
              <span>Problems</span>
            </Link>

            <Link
              to="/custom"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                isCustomActive
                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 font-semibold shadow-sm shadow-sky-500/10'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-slate-700/60 bg-slate-800/40'
              }`}
            >
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline">Practice Own Problem</span>
              <span className="sm:hidden">Custom</span>
            </Link>
          </nav>
        </div>

        {/* Right side helper info */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>OpenJDK Sandboxed Runtime</span>
          </div>

          <a
            href="https://docs.oracle.com/en/java/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-slate-200 p-2 rounded-md hover:bg-slate-800/50 transition-colors"
            title="Java Docs"
          >
            <BookOpen className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
};

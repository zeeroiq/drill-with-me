import React, { useState, useEffect } from 'react';
import {
  api,
  Difficulty,
  AdminTestCase,
  ExecutionResult,
  AdminProblemDetail,
} from '../../api/client';
import { JavaEditor } from '../JavaEditor';
import { MarkdownView } from '../MarkdownView';
import { slugify } from '../../lib/utils';
import {
  X,
  Save,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Edit3,
  Code2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  FileText,
  Loader2,
  Terminal,
} from 'lucide-react';

export interface ProblemEditorInitialData {
  problemId?: number;
  title?: string;
  slug?: string;
  difficulty?: Difficulty;
  description_md?: string;
  starter_code?: string;
  test_harness_code?: string;
  is_published?: number;
  test_cases?: AdminTestCase[];
  source_custom_problem_id?: string;
  sample_solution_code?: string;
}

interface ProblemEditorModalProps {
  initialData?: ProblemEditorInitialData | null;
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULT_STARTER_CODE = `class Solution {
    public String solve(String input) {
        // Implement your solution here
        return "";
    }
}`;

const DEFAULT_HARNESS_TEMPLATE = `import java.util.*;

public class Main {
    static String escape(String s) {
        if (s == null) return "null";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\\\\""); break;
                case '\\\\': sb.append("\\\\\\\\"); break;
                case '\\b': sb.append("\\\\b"); break;
                case '\\f': sb.append("\\\\f"); break;
                case '\\n': sb.append("\\\\n"); break;
                case '\\r': sb.append("\\\\r"); break;
                case '\\t': sb.append("\\\\t"); break;
                default:
                    if (c < 32 || c > 126) {
                        sb.append(String.format("\\\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }

    static void printResult(int testIndex, boolean passed, String input, String expected, String actual, String errorMessage) {
        System.out.println("---TEST_RESULT_START---");
        System.out.print("{\\"testIndex\\": " + testIndex + ", ");
        System.out.print("\\"passed\\": " + passed + ", ");
        System.out.print("\\"input\\": \\"" + escape(input) + "\\", ");
        System.out.print("\\"expected\\": \\"" + escape(expected) + "\\", ");
        System.out.print("\\"actual\\": " + (actual == null ? "null" : "\\"" + escape(actual) + "\\"") + ", ");
        System.out.print("\\"errorMessage\\": " + (errorMessage == null ? "null" : "\\"" + escape(errorMessage) + "\\""));
        System.out.println("}");
        System.out.println("---TEST_RESULT_END---");
    }

    static void printSummary(int passedCount, int totalCount) {
        System.out.println("---SUMMARY_START---");
        System.out.println("{\\"passedCount\\": " + passedCount + ", \\"totalCount\\": " + totalCount + ", \\"allPassed\\": " + (passedCount == totalCount && totalCount > 0) + "}");
        System.out.println("---SUMMARY_END---");
    }

    public static void main(String[] args) {
        boolean visibleOnly = args.length > 0 && ("--visible-only".equals(args[0]) || "run".equalsIgnoreCase(args[0]) || "--run".equalsIgnoreCase(args[0]));
        Solution sol = new Solution();
        int passed = 0;
        int total = visibleOnly ? 1 : 2;

        // Test 0 (Visible sample case)
        {
            int testIndex = 0;
            String input = "input1";
            String expected = "output1";
            try {
                String actual = String.valueOf(sol.solve("input1"));
                boolean ok = expected.equals(actual);
                if (ok) passed++;
                printResult(testIndex, ok, input, expected, actual, null);
            } catch (Throwable t) {
                printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
            }
        }

        // Test 1 (Full evaluation / hidden test case)
        if (!visibleOnly) {
            int testIndex = 1;
            String input = "input2";
            String expected = "output2";
            try {
                String actual = String.valueOf(sol.solve("input2"));
                boolean ok = expected.equals(actual);
                if (ok) passed++;
                printResult(testIndex, ok, input, expected, actual, null);
            } catch (Throwable t) {
                printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
            }
        }

        printSummary(passed, total);
    }
}`;

const DEFAULT_SAMPLE_SOLUTION = `class Solution {
    public String solve(String input) {
        if ("input1".equals(input)) return "output1";
        if ("input2".equals(input)) return "output2";
        return input;
    }
}`;

export const ProblemEditorModal: React.FC<ProblemEditorModalProps> = ({
  initialData,
  onClose,
  onSaved,
}) => {
  const isEditing = Boolean(initialData?.problemId);
  const problemId = initialData?.problemId;

  const [loading, setLoading] = useState<boolean>(isEditing);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState<string>(initialData?.title || '');
  const [slug, setSlug] = useState<string>(initialData?.slug || '');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState<boolean>(Boolean(initialData?.slug));
  const [difficulty, setDifficulty] = useState<Difficulty>(initialData?.difficulty || 'Medium');
  const [isPublished, setIsPublished] = useState<boolean>(
    initialData?.is_published === undefined ? true : initialData.is_published === 1
  );
  const [descriptionMd, setDescriptionMd] = useState<string>(initialData?.description_md || '');
  const [descTab, setDescTab] = useState<'edit' | 'preview'>('edit');

  const [starterCode, setStarterCode] = useState<string>(initialData?.starter_code || DEFAULT_STARTER_CODE);
  const [testHarnessCode, setTestHarnessCode] = useState<string>(initialData?.test_harness_code || DEFAULT_HARNESS_TEMPLATE);

  const [testCases, setTestCases] = useState<AdminTestCase[]>(
    initialData?.test_cases && initialData.test_cases.length > 0
      ? initialData.test_cases
      : [
          {
            input_display: 'input1',
            input_payload: 'input1',
            expected_output: 'output1',
            is_hidden: 0,
            sort_order: 1,
          },
          {
            input_display: 'input2',
            input_payload: 'input2',
            expected_output: 'output2',
            is_hidden: 1,
            sort_order: 2,
          },
        ]
  );

  // Dry Run state
  const [sampleSolutionCode, setSampleSolutionCode] = useState<string>(
    initialData?.sample_solution_code || initialData?.starter_code || DEFAULT_SAMPLE_SOLUTION
  );
  const [dryRunRunning, setDryRunRunning] = useState<boolean>(false);
  const [dryRunResult, setDryRunResult] = useState<ExecutionResult | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);

  // Active section tab in editor
  const [activeEditorTab, setActiveEditorTab] = useState<'meta' | 'starter' | 'harness' | 'testcases' | 'dryrun'>('meta');

  // Load problem details if editing
  useEffect(() => {
    if (problemId) {
      let isMounted = true;
      async function fetchProblem() {
        try {
          setLoading(true);
          const data: AdminProblemDetail = await api.getAdminProblem(problemId!);
          if (isMounted) {
            setTitle(data.title);
            setSlug(data.slug);
            setIsSlugManuallyEdited(true);
            setDifficulty(data.difficulty);
            setIsPublished(data.is_published === 1);
            setDescriptionMd(data.description_md || '');
            setStarterCode(data.starter_code || DEFAULT_STARTER_CODE);
            setTestHarnessCode(data.test_harness_code || DEFAULT_HARNESS_TEMPLATE);
            if (data.test_cases && data.test_cases.length > 0) {
              setTestCases(data.test_cases);
            }
            if (data.starter_code) {
              setSampleSolutionCode(data.starter_code);
            }
          }
        } catch (err: unknown) {
          console.error('Failed to load problem:', err);
          if (isMounted) {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to load problem');
          }
        } finally {
          if (isMounted) setLoading(false);
        }
      }
      fetchProblem();
      return () => {
        isMounted = false;
      };
    }
  }, [problemId]);

  // Handle title change and auto-slug
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!isSlugManuallyEdited) {
      setSlug(slugify(newTitle));
    }
  };

  const handleSlugChange = (newSlug: string) => {
    setIsSlugManuallyEdited(true);
    setSlug(newSlug.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  // Test case handlers
  const handleAddTestCase = () => {
    const newCase: AdminTestCase = {
      input_display: '',
      input_payload: '',
      expected_output: '',
      is_hidden: 0,
      sort_order: testCases.length + 1,
    };
    setTestCases([...testCases, newCase]);
  };

  const handleRemoveTestCase = (index: number) => {
    if (testCases.length <= 1) {
      alert('A problem must have at least one test case.');
      return;
    }
    const updated = testCases.filter((_, idx) => idx !== index).map((tc, idx) => ({
      ...tc,
      sort_order: idx + 1,
    }));
    setTestCases(updated);
  };

  const handleMoveTestCase = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === testCases.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...testCases];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);

    setTestCases(
      updated.map((tc, idx) => ({
        ...tc,
        sort_order: idx + 1,
      }))
    );
  };

  const handleTestCaseChange = (index: number, field: keyof AdminTestCase, value: any) => {
    const updated = [...testCases];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setTestCases(updated);
  };

  const handleLoadExampleHarness = () => {
    if (
      testHarnessCode &&
      testHarnessCode.trim() !== '' &&
      testHarnessCode !== DEFAULT_HARNESS_TEMPLATE
    ) {
      if (!window.confirm('Replace current harness code with the standard harness template?')) {
        return;
      }
    }
    setTestHarnessCode(DEFAULT_HARNESS_TEMPLATE);
  };

  // Execute dry-run test
  const handleDryRun = async () => {
    try {
      setDryRunRunning(true);
      setDryRunError(null);
      setDryRunResult(null);

      const payload = {
        test_harness_code: testHarnessCode,
        solution_code: sampleSolutionCode,
        test_cases: testCases.map((tc) => ({
          input_payload: tc.input_payload || tc.input_display,
          input_display: tc.input_display,
          expected_output: tc.expected_output,
        })),
      };

      const result = await api.dryRunAdminProblem(payload);
      setDryRunResult(result);
    } catch (err: unknown) {
      console.error('Dry run failed:', err);
      setDryRunError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setDryRunRunning(false);
    }
  };

  // Save / Update Problem
  const handleSave = async () => {
    setErrorMsg(null);

    // Basic Validation
    if (!title.trim()) {
      setErrorMsg('Problem title is required');
      setActiveEditorTab('meta');
      return;
    }

    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
      setErrorMsg('Slug must contain only lowercase letters, numbers, and hyphens (e.g. "two-sum")');
      setActiveEditorTab('meta');
      return;
    }

    if (!descriptionMd.trim()) {
      setErrorMsg('Problem description is required');
      setActiveEditorTab('meta');
      return;
    }

    if (!starterCode.trim()) {
      setErrorMsg('Starter code is required');
      setActiveEditorTab('starter');
      return;
    }

    if (!testHarnessCode.trim()) {
      setErrorMsg('Test harness code is required');
      setActiveEditorTab('harness');
      return;
    }

    if (testCases.length === 0) {
      setErrorMsg('At least one test case is required');
      setActiveEditorTab('testcases');
      return;
    }

    for (let i = 0; i < testCases.length; i++) {
      if (!testCases[i].expected_output || !testCases[i].expected_output.trim()) {
        setErrorMsg(`Test Case #${i + 1} is missing Expected Output`);
        setActiveEditorTab('testcases');
        return;
      }
    }

    try {
      setSaving(true);

      const payload = {
        title: title.trim(),
        slug: cleanSlug,
        difficulty,
        description_md: descriptionMd.trim(),
        starter_code: starterCode,
        test_harness_code: testHarnessCode,
        is_published: isPublished ? 1 : 0,
        test_cases: testCases.map((tc, idx) => ({
          input_display: tc.input_display || '',
          input_payload: tc.input_payload || tc.input_display || '',
          expected_output: tc.expected_output,
          is_hidden: tc.is_hidden ? 1 : 0,
          sort_order: idx + 1,
        })),
        source_custom_problem_id: initialData?.source_custom_problem_id,
      };

      if (isEditing && problemId) {
        await api.updateAdminProblem(problemId, payload);
      } else {
        await api.createAdminProblem(payload);
      }

      onSaved();
    } catch (err: unknown) {
      console.error('Failed to save problem:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save problem');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header Bar */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {isEditing ? `Edit Problem: ${title || 'Untitled'}` : initialData?.source_custom_problem_id ? 'Promote Anonymous Problem to Official' : 'Create New Problem'}
                </h2>
                {initialData?.source_custom_problem_id && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <span>Promotion Flow</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Configure slug, starter template, test harness, and evaluate with sandbox dry-run.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-sky-600/20"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>{isEditing ? 'Save Changes' : isPublished ? 'Publish Problem' : 'Save as Draft'}</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-2.5 text-rose-300 text-xs flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Navigation Tabs for Editor Sections */}
        <div className="flex items-center gap-1 px-4 sm:px-6 border-b border-slate-800 bg-slate-950/60 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveEditorTab('meta')}
            className={`py-3 px-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeEditorTab === 'meta'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Problem Info & Description</span>
          </button>

          <button
            onClick={() => setActiveEditorTab('starter')}
            className={`py-3 px-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeEditorTab === 'starter'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Starter Code (Solution.java)</span>
          </button>

          <button
            onClick={() => setActiveEditorTab('harness')}
            className={`py-3 px-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeEditorTab === 'harness'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Test Harness (Main.java)</span>
          </button>

          <button
            onClick={() => setActiveEditorTab('testcases')}
            className={`py-3 px-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeEditorTab === 'testcases'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Test Cases ({testCases.length})</span>
          </button>

          <button
            onClick={() => setActiveEditorTab('dryrun')}
            className={`py-3 px-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeEditorTab === 'dryrun'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            <span>Dry-Run Test Sandbox</span>
            {dryRunResult && (
              <span
                className={`w-2 h-2 rounded-full ${
                  dryRunResult.verdict === 'ACCEPTED' ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
            )}
          </button>
        </div>

        {/* Modal Body / Tab Contents */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-slate-950/40">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-sky-400" />
              <span className="text-xs font-mono">Loading problem details...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: Meta & Description */}
              {activeEditorTab === 'meta' && (
                <div className="space-y-6 max-w-5xl mx-auto">
                  {/* Basic Metadata Row */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Title */}
                    <div className="md:col-span-6 space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Problem Title <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="e.g. Reverse Linked List II"
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                      />
                    </div>

                    {/* Slug */}
                    <div className="md:col-span-6 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                          URL Slug <span className="text-rose-400">*</span>
                        </label>
                        <span className="text-[11px] text-slate-500 font-mono">/problems/{slug || ':slug'}</span>
                      </div>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        placeholder="e.g. reverse-linked-list-ii"
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono text-sky-400 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {/* Difficulty */}
                    <div className="md:col-span-6 space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Difficulty Level
                      </label>
                      <select
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="Easy">Easy (Emerald)</option>
                        <option value="Medium">Medium (Amber)</option>
                        <option value="Hard">Hard (Rose)</option>
                      </select>
                    </div>

                    {/* Published status checkbox */}
                    <div className="md:col-span-6 flex items-center pt-6">
                      <label className="relative flex items-center gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isPublished}
                          onChange={(e) => setIsPublished(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-200">
                            {isPublished ? 'Published' : 'Draft / Unpublished'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {isPublished
                              ? 'Visible to public visitors on the problem list'
                              : 'Hidden from public index, accessible only by admins'}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Markdown Description */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                          Problem Description (Markdown) <span className="text-rose-400">*</span>
                        </label>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setDescTab('edit')}
                          className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                            descTab === 'edit'
                              ? 'bg-slate-800 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDescTab('preview')}
                          className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                            descTab === 'preview'
                              ? 'bg-slate-800 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Eye className="h-3 w-3" />
                          <span>Preview</span>
                        </button>
                      </div>
                    </div>

                    {descTab === 'edit' ? (
                      <textarea
                        rows={14}
                        value={descriptionMd}
                        onChange={(e) => setDescriptionMd(e.target.value)}
                        placeholder={`# Two Sum\n\nGiven an array of integers \`nums\` and an integer \`target\`...\n\n### Example 1:\n\`\`\`\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\n\`\`\``}
                        className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 leading-relaxed"
                      />
                    ) : (
                      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl min-h-[350px] overflow-y-auto">
                        {descriptionMd.trim() ? (
                          <MarkdownView content={descriptionMd} />
                        ) : (
                          <span className="text-xs text-slate-500 font-mono italic">
                            No description written yet. Switch to "Edit" to add Markdown content.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Starter Code (Solution.java) */}
              {activeEditorTab === 'starter' && (
                <div className="h-full flex flex-col space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
                    <div>
                      <span className="font-semibold text-slate-200">Solution.java</span>
                      <span className="ml-2 text-slate-500">
                        This is the starter code template that public visitors will see when opening the problem workspace.
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[460px] rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                    <JavaEditor
                      value={starterCode}
                      onChange={setStarterCode}
                      height="100%"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: Test Harness (Main.java) */}
              {activeEditorTab === 'harness' && (
                <div className="h-full flex flex-col space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
                    <div>
                      <span className="font-semibold text-slate-200">Main.java (Harness)</span>
                      <span className="ml-2 text-slate-500">
                        Compiles alongside Solution.java in OpenJDK 25. Must output test result tokens (<code>---TEST_RESULT_START---</code>).
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadExampleHarness}
                      className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Load Example Harness Template</span>
                    </button>
                  </div>

                  <div className="flex-1 min-h-[460px] rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                    <JavaEditor
                      value={testHarnessCode}
                      onChange={setTestHarnessCode}
                      height="100%"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: Test Cases Builder */}
              {activeEditorTab === 'testcases' && (
                <div className="space-y-4 max-w-5xl mx-auto">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-sky-400" />
                        <span>Dynamic Test Cases Builder</span>
                        <span className="text-xs font-normal text-slate-400">
                          ({testCases.length} total)
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Define inputs and expected outputs. Uncheck "Hidden" to show in public problem statement sample cases.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddTestCase}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Test Case</span>
                    </button>
                  </div>

                  <div className="space-y-3.5">
                    {testCases.map((tc, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-md space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-200">
                              Test Case #{idx + 1}
                            </span>
                            {tc.is_hidden ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Hidden (Evaluation Only)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Visible Sample Case
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveTestCase(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded hover:bg-slate-800 transition-colors"
                              title="Move Up"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveTestCase(idx, 'down')}
                              disabled={idx === testCases.length - 1}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded hover:bg-slate-800 transition-colors"
                              title="Move Down"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <div className="h-4 w-px bg-slate-800 mx-1" />
                            <button
                              type="button"
                              onClick={() => handleRemoveTestCase(idx)}
                              className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-500/10 transition-colors"
                              title="Delete Test Case"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                          {/* Input Display */}
                          <div className="md:col-span-5 space-y-1">
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                              Display Input
                            </label>
                            <input
                              type="text"
                              value={tc.input_display || ''}
                              onChange={(e) => handleTestCaseChange(idx, 'input_display', e.target.value)}
                              placeholder="e.g. nums = [2,7,11,15], target = 9"
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>

                          {/* Raw Payload (optional) */}
                          <div className="md:col-span-3 space-y-1">
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                              Raw Stdin / Payload
                            </label>
                            <input
                              type="text"
                              value={tc.input_payload || ''}
                              onChange={(e) => handleTestCaseChange(idx, 'input_payload', e.target.value)}
                              placeholder="(Optional stdin payload)"
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>

                          {/* Expected Output */}
                          <div className="md:col-span-4 space-y-1">
                            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                              Expected Output <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={tc.expected_output || ''}
                              onChange={(e) => handleTestCaseChange(idx, 'expected_output', e.target.value)}
                              placeholder="e.g. [0,1]"
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-emerald-400 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                        </div>

                        {/* Hidden checkbox */}
                        <div className="pt-1 flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={tc.is_hidden === 1}
                              onChange={(e) => handleTestCaseChange(idx, 'is_hidden', e.target.checked ? 1 : 0)}
                              className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0 focus:ring-offset-0"
                            />
                            <span>Hidden test case (evaluation only, omitted from problem preview)</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: Dry-Run Test Sandbox */}
              {activeEditorTab === 'dryrun' && (
                <div className="h-full flex flex-col space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800 flex-shrink-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <Play className="h-4 w-4 text-emerald-400" />
                        <h3 className="text-sm font-bold text-white">
                          Pre-Save Sandbox Dry-Run
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Compiles your reference solution against <code>Main.java</code> test harness and your {testCases.length} test cases in real-time.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSampleSolutionCode(starterCode)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 border border-slate-700 transition-colors"
                        title="Copy code from Starter Code tab"
                      >
                        Reset from Starter Code
                      </button>
                      <button
                        type="button"
                        onClick={handleDryRun}
                        disabled={dryRunRunning}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-md shadow-emerald-600/20"
                      >
                        {dryRunRunning ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Compiling & Testing...</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5 fill-current" />
                            <span>Test Problem (Dry Run)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Dry Run Layout: Code Input on left/top, Output on right/bottom */}
                  <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
                    {/* Left: Sample Solution Monaco Editor */}
                    <div className="lg:col-span-6 flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                      <div className="p-3 bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-300 flex items-center justify-between flex-shrink-0">
                        <span>Reference Solution (Solution.java for Dry Run)</span>
                        <span className="text-[11px] text-slate-500 font-mono">JDK 25 Sandbox</span>
                      </div>
                      <div className="flex-1 min-h-[300px]">
                        <JavaEditor
                          value={sampleSolutionCode}
                          onChange={setSampleSolutionCode}
                          height="100%"
                        />
                      </div>
                    </div>

                    {/* Right: Dry Run Output / Verdict */}
                    <div className="lg:col-span-6 flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                      <div className="p-3 bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-300 flex items-center justify-between flex-shrink-0">
                        <span>Dry-Run Execution Output</span>
                        {dryRunResult && (
                          <span className="text-[11px] font-mono text-slate-400">
                            {dryRunResult.runtime_ms} ms
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-h-[300px] p-4 overflow-y-auto space-y-4">
                        {dryRunRunning ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                            <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
                            <span className="text-xs font-mono">Executing in secure isolated container...</span>
                          </div>
                        ) : dryRunError ? (
                          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-900/50 text-rose-300 space-y-2">
                            <div className="flex items-center gap-2 font-bold text-xs">
                              <AlertTriangle className="h-4 w-4 text-rose-400" />
                              <span>Execution Request Error:</span>
                            </div>
                            <pre className="text-xs font-mono whitespace-pre-wrap">{dryRunError}</pre>
                          </div>
                        ) : dryRunResult ? (
                          <div className="space-y-4">
                            {/* Verdict Banner */}
                            <div
                              className={`p-3.5 rounded-xl border flex items-center justify-between ${
                                dryRunResult.verdict === 'ACCEPTED'
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {dryRunResult.verdict === 'ACCEPTED' ? (
                                  <CheckCircle2 className="h-5 w-5" />
                                ) : (
                                  <XCircle className="h-5 w-5" />
                                )}
                                <span className="font-bold text-sm tracking-wide">
                                  {dryRunResult.verdict}
                                </span>
                              </div>
                              <div className="text-xs font-mono text-slate-300">
                                Passed: <strong className="text-white">{dryRunResult.passedCount ?? dryRunResult.passed_count ?? 0}</strong> / {dryRunResult.totalCount ?? dryRunResult.total_count ?? 0} cases
                              </div>
                            </div>

                            {/* Compiler or Runtime Errors */}
                            {(dryRunResult.errorOutput || dryRunResult.error_output) && (
                              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs font-mono space-y-1">
                                <span className="font-bold uppercase tracking-wider text-[10px] text-amber-400">
                                  Compilation / Runtime Diagnostics:
                                </span>
                                <pre className="whitespace-pre-wrap">{dryRunResult.errorOutput || dryRunResult.error_output}</pre>
                              </div>
                            )}

                            {/* Test Cases Results */}
                            {((dryRunResult.results && dryRunResult.results.length > 0) || (dryRunResult.testResults && dryRunResult.testResults.length > 0)) && (
                              <div className="space-y-2">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                  Test Results Breakdown:
                                </span>
                                {(dryRunResult.results || dryRunResult.testResults || []).map((tc, idx) => (
                                  <div
                                    key={idx}
                                    className={`p-3 rounded-lg border text-xs font-mono space-y-1.5 ${
                                      tc.passed
                                        ? 'bg-emerald-950/10 border-emerald-800/30 text-slate-200'
                                        : 'bg-rose-950/10 border-rose-800/30 text-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold flex items-center gap-1.5">
                                        {tc.passed ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                        ) : (
                                          <XCircle className="h-3.5 w-3.5 text-rose-400" />
                                        )}
                                        <span>Case {idx + 1}</span>
                                      </span>
                                      <span className={`text-[10px] font-bold ${tc.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {tc.passed ? 'PASSED' : 'FAILED'}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                                      <div>
                                        <span className="text-slate-500">Expected: </span>
                                        <span className="text-emerald-400">{tc.expected || tc.expected_output || tc.expectedOutput || '—'}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Actual: </span>
                                        <span className={tc.passed ? 'text-slate-200' : 'text-rose-400'}>
                                          {tc.actual || tc.actual_output || tc.actualOutput || 'null'}
                                        </span>
                                      </div>
                                    </div>
                                    {tc.errorMessage && (
                                      <div className="text-[11px] text-rose-400 pt-1">
                                        Error: {tc.errorMessage}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Stdout / Stderr output */}
                            {dryRunResult.stdout && (
                              <div className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                  Standard Output (stdout):
                                </span>
                                <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                  {dryRunResult.stdout}
                                </pre>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                            <Play className="h-8 w-8 text-slate-600" />
                            <span>Click "Test Problem (Dry Run)" above to execute against test cases.</span>
                          </div>
                        )}
                      </div>
                    </div>
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

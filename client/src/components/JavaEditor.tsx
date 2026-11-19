import React from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';

interface JavaEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  height?: string | number;
}

export const JavaEditor: React.FC<JavaEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  height = '100%',
}) => {
  const handleEditorDidMount: OnMount = (editor) => {
    // Optional focus or configuration on mount
    if (!readOnly) {
      editor.focus();
    }
  };

  return (
    <div className="relative w-full h-full bg-[#1e1e1e] overflow-hidden select-text">
      <Editor
        height={height}
        language="java"
        theme="vs-dark"
        value={value}
        onChange={(val) => onChange(val || '')}
        onMount={handleEditorDidMount}
        loading={
          <div className="h-full w-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
            <span className="text-xs font-mono">Loading Java Editor...</span>
          </div>
        }
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          tabSize: 4,
          insertSpaces: true,
          automaticLayout: true,
          readOnly,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          fontFamily: "'JetBrains Mono', Consolas, Menlo, Monaco, monospace",
          fontLigatures: true,
          lineNumbers: 'on',
          lineNumbersMinChars: 3,
          wordWrap: 'on',
          folding: true,
          contextmenu: true,
          renderLineHighlight: 'all',
          cursorBlinking: 'smooth',
          overviewRulerBorder: false,
          padding: {
            top: 12,
            bottom: 12,
          },
        }}
      />
    </div>
  );
};

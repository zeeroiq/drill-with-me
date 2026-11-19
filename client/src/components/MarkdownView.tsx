import React from 'react';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  // Parse lines into tokens: headings, code blocks, lists, blockquotes, paragraphs
  const renderTokens = () => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeBuffer: string[] = [];
    let currentKey = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code block start / end
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLanguage = line.trim().slice(3).trim();
          codeBuffer = [];
        } else {
          inCodeBlock = false;
          elements.push(
            <div key={`code-${currentKey++}`} className="my-4 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shadow-inner">
              {codeLanguage && (
                <div className="bg-slate-900/80 px-3 py-1 text-xs font-mono text-slate-400 border-b border-slate-800 flex justify-between items-center">
                  <span>{codeLanguage}</span>
                </div>
              )}
              <pre className="p-3.5 text-xs md:text-sm font-mono text-slate-200 overflow-x-auto leading-relaxed">
                <code>{codeBuffer.join('\n')}</code>
              </pre>
            </div>
          );
          codeBuffer = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        continue;
      }

      // Headings
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={`h1-${currentKey++}`} className="text-xl md:text-2xl font-bold text-white mt-6 mb-3 tracking-tight">
            {formatInlineText(trimmed.slice(2))}
          </h1>
        );
        continue;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={`h2-${currentKey++}`} className="text-lg md:text-xl font-semibold text-slate-100 mt-5 mb-2.5 tracking-tight">
            {formatInlineText(trimmed.slice(3))}
          </h2>
        );
        continue;
      }
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={`h3-${currentKey++}`} className="text-base md:text-lg font-medium text-slate-200 mt-4 mb-2">
            {formatInlineText(trimmed.slice(4))}
          </h3>
        );
        continue;
      }

      // Blockquote
      if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote key={`bq-${currentKey++}`} className="border-l-4 border-amber-500/60 pl-3.5 py-1.5 my-3 bg-amber-500/5 text-amber-200 text-sm rounded-r">
            {formatInlineText(trimmed.slice(2))}
          </blockquote>
        );
        continue;
      }

      // Unordered list item
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <li key={`li-${currentKey++}`} className="text-sm md:text-base text-slate-300 ml-4 list-disc my-1 pl-1">
            {formatInlineText(trimmed.slice(2))}
          </li>
        );
        continue;
      }

      // Ordered list item
      const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (orderedMatch) {
        elements.push(
          <li key={`oli-${currentKey++}`} className="text-sm md:text-base text-slate-300 ml-5 list-decimal my-1 pl-1">
            {formatInlineText(orderedMatch[2])}
          </li>
        );
        continue;
      }

      // Standard paragraph
      elements.push(
        <p key={`p-${currentKey++}`} className="text-sm md:text-base text-slate-300 my-2.5 leading-relaxed">
          {formatInlineText(trimmed)}
        </p>
      );
    }

    // Flush any leftover code block
    if (inCodeBlock && codeBuffer.length > 0) {
      elements.push(
        <div key={`code-${currentKey++}`} className="my-4 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
          <pre className="p-3 text-xs md:text-sm font-mono text-slate-200 overflow-x-auto">
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        </div>
      );
    }

    return elements;
  };

  return <div className={`space-y-1 ${className}`}>{renderTokens()}</div>;
};

// Inline markdown formatting: **bold**, `code`, links
function formatInlineText(text: string): React.ReactNode {
  // Regex to split by **bold** or `code`
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 mx-0.5 text-xs md:text-sm font-mono bg-slate-800 text-sky-300 rounded border border-slate-700/60"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

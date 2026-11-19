import { SecurityCheckResult } from './types.js';

interface SecurityPattern {
  name: string;
  pattern: RegExp;
  reason: string;
}

const FORBIDDEN_PATTERNS: SecurityPattern[] = [
  // Process execution
  {
    name: 'ProcessBuilder',
    pattern: /\bProcessBuilder\b/,
    reason: 'ProcessBuilder is forbidden: external process execution is not permitted',
  },
  {
    name: 'Runtime.getRuntime',
    pattern: /\bRuntime\s*\.\s*getRuntime\b/,
    reason: 'Runtime.getRuntime() is forbidden: process execution is not permitted',
  },
  {
    name: 'Process',
    pattern: /\bProcess\s+[a-zA-Z0-9_$]+\s*=/,
    reason: 'Process management is forbidden',
  },

  // File I/O
  {
    name: 'java.io.File',
    pattern:
      /\bjava\s*\.\s*io\s*\.\s*File\b|\bnew\s+File\s*\(|\bFile\s*\.\s*(createTempFile|listRoots)|\bFile\s+[a-zA-Z0-9_$]+\s*=/,
    reason: 'java.io.File is forbidden: file system access is not permitted',
  },
  {
    name: 'File Streams',
    pattern:
      /\b(FileInputStream|FileOutputStream|RandomAccessFile|FileReader|FileWriter|FileDescriptor)\b/,
    reason: 'Direct file stream operations are forbidden: file system access is not permitted',
  },
  {
    name: 'java.nio.file',
    pattern: /\bjava\s*\.\s*nio\s*\.\s*file\b|\b(Files|Paths|Path)\s*\./,
    reason: 'java.nio.file is forbidden: file system access is not permitted',
  },

  // Network
  {
    name: 'java.net',
    pattern:
      /\bjava\s*\.\s*net\b|\b(Socket|ServerSocket|DatagramSocket|HttpURLConnection|URLConnection)\b|\bnew\s+(URL|URI)\s*\(|\b(URL|URI)\s*\.\s*create\s*\(/,
    reason: 'java.net networking is forbidden: network connections are not permitted',
  },

  // System exit / modification
  {
    name: 'System.exit',
    pattern: /\bSystem\s*\.\s*exit\s*\(/,
    reason: 'System.exit() is forbidden: cannot terminate the JVM',
  },
  {
    name: 'System.setSecurityManager',
    pattern: /\bSystem\s*\.\s*setSecurityManager\s*\(/,
    reason: 'System.setSecurityManager is forbidden',
  },
  {
    name: 'System property / library modification',
    pattern:
      /\bSystem\s*\.\s*(load|loadLibrary|setProperty|setProperties|clearProperty)\s*\(/,
    reason: 'System modification methods are forbidden',
  },

  // Scripting
  {
    name: 'javax.script',
    pattern: /\bjavax\s*\.\s*script\b|\bScriptEngine\b/,
    reason: 'javax.script is forbidden: dynamic scripting is not permitted',
  },

  // Reflection
  {
    name: 'java.lang.reflect',
    pattern:
      /\bjava\s*\.\s*lang\s*\.\s*reflect\b|\b(Method|Field|Constructor)\s*\.\s*(invoke|setAccessible|newInstance)\b|\bClass\s*\.\s*forName\s*\(|\b\.getClass\s*\(\s*\)\s*\.\s*(getMethod|getDeclaredMethod|getField|getDeclaredField|getDeclaredConstructor)/,
    reason: 'java.lang.reflect is forbidden: reflection is not permitted',
  },
  {
    name: 'MethodHandles',
    pattern: /\bMethodHandles\b|\bMethodHandle\b/,
    reason: 'MethodHandles access is forbidden',
  },

  // ClassLoader
  {
    name: 'ClassLoader',
    pattern:
      /\b(ClassLoader|URLClassLoader|SecureClassLoader)\b|\b(loadClass|defineClass)\s*\(/,
    reason: 'ClassLoader access is forbidden: dynamic class loading is not permitted',
  },

  // Native / Unsafe
  {
    name: 'Native methods',
    pattern: /\bnative\s+/,
    reason: 'Native method declarations are forbidden',
  },
  {
    name: 'Unsafe',
    pattern: /\bsun\s*\.\s*misc\s*\.\s*Unsafe\b|\bjdk\s*\.\s*internal\b/,
    reason: 'sun.misc.Unsafe and internal JDK APIs are forbidden',
  },
];

/**
 * Decodes standard Java unicode escape sequences (\uXXXX)
 * so malicious code hidden via unicode escaping is visible to static analysis.
 */
function decodeUnicodeEscapes(code: string): string {
  return code.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
}

/**
 * Strips single-line (//) and multi-line (/ * ... * /) comments from Java code
 * while preserving string and char literals. Replaces multi-line comments with a space
 * to avoid merging adjacent tokens, but normalization catches obfuscated spacing.
 */
export function stripComments(code: string): string {
  let result = '';
  let i = 0;
  const n = code.length;
  let inString = false;
  let inChar = false;

  while (i < n) {
    const c = code[i];
    const next = i + 1 < n ? code[i + 1] : '';

    if (inString) {
      result += c;
      if (c === '\\' && i + 1 < n) {
        result += next;
        i += 2;
        continue;
      }
      if (c === '"') {
        inString = false;
      }
      i++;
    } else if (inChar) {
      result += c;
      if (c === '\\' && i + 1 < n) {
        result += next;
        i += 2;
        continue;
      }
      if (c === "'") {
        inChar = false;
      }
      i++;
    } else if (c === '/' && next === '/') {
      // Single-line comment
      i += 2;
      while (i < n && code[i] !== '\n' && code[i] !== '\r') {
        i++;
      }
      if (i < n) {
        result += code[i];
        i++;
      }
    } else if (c === '/' && next === '*') {
      // Multi-line comment
      i += 2;
      while (i < n && !(code[i] === '*' && i + 1 < n && code[i + 1] === '/')) {
        if (code[i] === '\n') {
          result += '\n';
        }
        i++;
      }
      if (i < n) {
        i += 2; // skip */
      }
      result += ' ';
    } else {
      if (c === '"') {
        inString = true;
      } else if (c === "'") {
        inChar = true;
      }
      result += c;
      i++;
    }
  }

  return result;
}

/**
 * Analyzes Java code to ensure it doesn't contain forbidden APIs or patterns.
 * Strips comments first to prevent false positives in comments,
 * and decodes unicode escapes to prevent comment/unicode obfuscation.
 */
export function checkJavaSecurity(code: string): SecurityCheckResult {
  if (!code || typeof code !== 'string') {
    return { safe: false, reason: 'Empty or invalid code provided' };
  }

  // 1. Decode unicode escapes
  const decoded = decodeUnicodeEscapes(code);

  // 2. Strip comments to eliminate false positives in legitimate comments
  const stripped = stripComments(decoded);

  // 3. Scan for forbidden patterns
  for (const rule of FORBIDDEN_PATTERNS) {
    if (rule.pattern.test(stripped)) {
      return {
        safe: false,
        reason: rule.reason,
      };
    }
  }

  return { safe: true };
}

export const checkJavaCodeSafety = checkJavaSecurity;


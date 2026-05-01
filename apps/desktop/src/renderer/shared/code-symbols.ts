export type CodeSymbolKind = 'class' | 'function' | 'method' | 'const';

export interface CodeSymbol {
  name: string;
  depth: number;
  line: number;
  kind: CodeSymbolKind;
}

const TS_JS_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

export function isCodeFile(filePath: string): boolean {
  return TS_JS_EXTS.some(ext => filePath.endsWith(ext));
}

const FN_RE = /^\s*export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/;
const CLASS_RE = /^\s*export\s+(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/;
const CONST_RE = /^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/;
const TOP_FN_RE = /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/;
const TOP_CLASS_RE = /^\s*(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/;

const RESERVED = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return', 'break',
  'continue', 'try', 'catch', 'finally', 'throw', 'new', 'delete', 'typeof',
  'instanceof', 'in', 'of', 'void', 'yield', 'await', 'function', 'class',
  'const', 'let', 'var', 'this', 'super', 'import', 'export', 'from', 'as',
  'default', 'null', 'undefined', 'true', 'false',
]);

const METHOD_RE = /^\s*(?:public\s+|private\s+|protected\s+|static\s+|readonly\s+|async\s+|abstract\s+|override\s+)*([A-Za-z_$][\w$]*)\s*[(<]/;

export function extractCodeSymbols(source: string, filePath: string): CodeSymbol[] {
  if (!isCodeFile(filePath)) return [];

  const lines = source.split('\n');
  const symbols: CodeSymbol[] = [];

  // Track whether we're inside a class body and how deep we are in braces
  let classDepthStart = -1;          // brace depth at which the class body opened
  let braceDepth = 0;
  let inSingleLineComment = false;
  let inBlockComment = false;
  let inString: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    // Skip pure comment lines / block-comment-internal lines for matching, but still update brace depth from non-string regions of the line
    let matchTarget = line;
    if (inBlockComment) {
      const endIdx = line.indexOf('*/');
      if (endIdx !== -1) {
        inBlockComment = false;
        matchTarget = line.slice(endIdx + 2);
      } else {
        continue;
      }
    }
    if (matchTarget.trimStart().startsWith('//')) {
      // skip line for symbols, but braces still mostly fine; pure comment
      continue;
    }

    // Top-level / exported declarations only count when we're at brace depth 0 (outside any class/function body)
    if (braceDepth === 0) {
      const fnExp = matchTarget.match(FN_RE);
      const classExp = matchTarget.match(CLASS_RE);
      const constExp = matchTarget.match(CONST_RE);
      const fnTop = matchTarget.match(TOP_FN_RE);
      const classTop = matchTarget.match(TOP_CLASS_RE);

      if (classExp) {
        symbols.push({ name: classExp[1], depth: 0, line: lineNum, kind: 'class' });
      } else if (classTop) {
        symbols.push({ name: classTop[1], depth: 0, line: lineNum, kind: 'class' });
      } else if (fnExp) {
        symbols.push({ name: fnExp[1], depth: 0, line: lineNum, kind: 'function' });
      } else if (fnTop) {
        symbols.push({ name: fnTop[1], depth: 0, line: lineNum, kind: 'function' });
      } else if (constExp) {
        symbols.push({ name: constExp[1], depth: 0, line: lineNum, kind: 'const' });
      }
    } else if (classDepthStart !== -1 && braceDepth === classDepthStart + 1) {
      // We're directly inside a class body — look for methods
      const m = matchTarget.match(METHOD_RE);
      if (m) {
        const name = m[1];
        if (!RESERVED.has(name)) {
          symbols.push({ name, depth: 1, line: lineNum, kind: 'method' });
        }
      }
    }

    // Update brace depth — process character-by-character respecting strings + block comments
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      const next = line[j + 1];

      if (inString) {
        if (ch === '\\') { j++; continue; }
        if (ch === inString) inString = null;
        continue;
      }

      if (inBlockComment) {
        if (ch === '*' && next === '/') { inBlockComment = false; j++; }
        continue;
      }

      if (ch === '/' && next === '/') break; // rest of line is comment
      if (ch === '/' && next === '*') { inBlockComment = true; j++; continue; }
      if (ch === '"' || ch === '\'' || ch === '`') { inString = ch; continue; }

      if (ch === '{') {
        // If this `{` opens a class body, record it
        if (classDepthStart === -1) {
          // crude heuristic: any `class X { ... }` opening at top level
          // We already pushed the class symbol when we saw the line; if the `{` is on the same line, classDepthStart still becomes braceDepth here.
          const upTo = line.slice(0, j);
          if (/(?:^|\W)class\s+[A-Za-z_$][\w$]*[^{]*$/.test(upTo)) {
            classDepthStart = braceDepth;
          }
        }
        braceDepth++;
      } else if (ch === '}') {
        braceDepth--;
        if (classDepthStart !== -1 && braceDepth <= classDepthStart) {
          classDepthStart = -1;
        }
      }
    }
    inSingleLineComment = false; // reset (not strictly needed)
  }

  return symbols;
}

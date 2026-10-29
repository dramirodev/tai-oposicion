const SUPPORTED_LANGUAGES = new Set([
  'bash', 'c', 'cpp', 'csharp', 'css', 'html', 'java', 'javascript', 'jsx', 'json',
  'json5', 'jsonc', 'php', 'powershell', 'python', 'scss', 'shell', 'shellsession',
  'sql', 'tsx', 'typescript', 'xml', 'yaml',
]);

const LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
  'c++': 'cpp', cxx: 'cpp', 'c#': 'csharp', cs: 'csharp',
  htm: 'html', js: 'javascript', jsx: 'jsx', node: 'javascript',
  postgres: 'sql', postgresql: 'sql', ps1: 'powershell', py: 'python',
  plain: 'text', plaintext: 'text', sh: 'bash', shell: 'bash', ts: 'typescript', tsx: 'tsx', txt: 'text',
  yml: 'yaml',
};

const CONTEXT_LANGUAGE_PATTERNS: readonly [RegExp, string][] = [
  [/\btsx\b/i, 'tsx'],
  [/\btypescript\b/i, 'typescript'],
  [/\bjsx\b/i, 'jsx'],
  [/\bjavascript\b/i, 'javascript'],
  [/\b(?:c\+\+|cpp)\b/i, 'cpp'],
  [/\b(?:c#|csharp|c sharp)\b/i, 'csharp'],
  [/\b(?:powershell|power shell)\b/i, 'powershell'],
  [/\b(?:python|php|java|jsonc|json5|json|xml|xsd|html|css|scss|sass|sql|pl\/sql|postgres(?:ql)?|bash|shell)\b/i, 'language'],
  [/\b(?:en|lenguaje|programa|código)\s+(?:el\s+lenguaje\s+)?c\b/i, 'c'],
];

function languageFromContext(context: string | undefined): string | null {
  if (!context) return null;
  if (/\btsx\b/i.test(context)) return 'tsx';
  if (/\bjsx\b/i.test(context)) return 'jsx';
  const matches = CONTEXT_LANGUAGE_PATTERNS.flatMap(([pattern, language]) => {
    const match = pattern.exec(context);
    if (!match) return [];
    if (language !== 'language') return [language];
    return [normalizeCodeLanguage(match[0])].filter((value): value is string => value !== null);
  });
  const uniqueMatches = new Set(matches);
  return uniqueMatches.size === 1 ? [...uniqueMatches][0] : null;
}

function hasJsxSyntax(code: string): boolean {
  return /<[A-Z][\w.$]*(?=\s|\/?>)/.test(code)
    || /<[a-z][\w:-]*\s+[^<>]*=\s*\{/.test(code)
    || /<[a-z][\w:-]*\s*>\s*\{/.test(code)
    || /(?:const|let|var)\s+\w+\s*=\s*<[a-z][\w:-]*\s*\/?>/.test(code);
}

function fitsLanguageContext(code: string, language: string): boolean {
  const value = code.trim();
  if (language === 'json') return /^(?:\{|\[)/.test(value) && (value.match(/"[^"\n]+"/g)?.length || 0) >= 2;
  if (language === 'xml') return /<\/?[A-Za-z][^>]*>|\b(?:xs|xsd):[A-Za-z_]/i.test(value);
  return value.length >= 12 && /[{}()[\];=<>]/.test(value);
}

export function normalizeCodeLanguage(language: string | undefined): string | null {
  const candidate = language?.trim().toLowerCase().replace(/^(?:language|lang)[-_:]/, '');
  if (!candidate) return null;
  const alias = Object.prototype.hasOwnProperty.call(LANGUAGE_ALIASES, candidate) ? LANGUAGE_ALIASES[candidate] : undefined;
  const normalized = alias || candidate;
  return normalized === 'text' || SUPPORTED_LANGUAGES.has(normalized) ? normalized : null;
}

export function inferCodeLanguage(code: string, declaredLanguage?: string, context?: string) {
  const explicit = normalizeCodeLanguage(declaredLanguage);
  if (explicit) return explicit;
  const contextual = languageFromContext(context);

  if (hasJsxSyntax(code)) {
    if (contextual === 'tsx' || contextual === 'typescript') return 'tsx';
    return 'jsx';
  }

  if (/^\s*(?:<\?xml\b|xmlns:[\w.-]+\s*=|<(?:xs|xsd):[A-Za-z_]|(?:xs|xsd):[A-Za-z_])/i.test(code)) return 'xml';
  if (/^\s*[\[{][\s\S]*?"(?:[^"\\]|\\.)+"\s*:/m.test(code)) return 'json';
  if (/^\s*(?:SELECT\b|FROM\b|WHERE\b|CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\b|INSERT\s+INTO\b|UPDATE\s+\w+\s+SET\b|DELETE(?:\s+FROM)?\b|DROP\s+TABLE\b|ALTER\s+TABLE\b|LOAD\s+DATA(?:\s+LOCAL)?\s+INFILE\b|GROUP\s+BY\b|ORDER\s+BY\b|HAVING\b|JOIN\b|GRANT\b|REVOKE\b|ROLLBACK\b|COMMIT\b|TRUNCATE\s+TABLE\b)/i.test(code)) return 'sql';
  if (/<\/?(?:html|head|body|div|p|span|table|script|style|form|input|video|audio|source|canvas|section|header|footer|button)\b/i.test(code)) return 'html';
  if (/(?:^|\n)\s*[.#][\w-]+[^\n]*\{[\s\S]*?:\s*[^;]+;/m.test(code)) return 'css';
  if (/^\s*(?:#!.*\b(?:bash|sh)|(?:echo|export|cd|pwd|grep|awk|sed|chmod|chown|mkdir|rmdir|rm|touch|ls|cp|mv|cat|find|tar|ssh|scp|sudo|apt(?:-get)?|systemctl|ps|kill|ping|ip|ifconfig|route|mount|umount|df|du|head|tail|cut|sort|uniq|wc|xargs|curl|wget|git|firewall-cmd)\s+)/m.test(code)) return 'bash';
  if (/\b(?:using\s+System\s*;|namespace\s+[\w.]+|Console\.(?:Write|Read)|(?:bool|byte|char|decimal|double|float|int|long|object|sbyte|short|string|uint|ulong|ushort|DateTime|Guid)\s*\?\s+[A-Za-z_]\w*)/m.test(code)) return 'csharp';
  if (/\b(?:std::|cout\s*<<)|#include\s*[<"](?:iostream|vector|string|map|set|algorithm)/m.test(code)) return 'cpp';
  if (/@(?:Test|Override|ManyToMany|JoinTable|JoinColumn)\b|\b(?:System\.out\.print|(?:public\s+)?static\s+(?:void|int)\s+main\s*\(\s*String\s*\[\]|class\s+\w+\s*\{|int\s*\[\s*\]\s+\w+\s*=)/m.test(code)) return 'java';
  if (/\b(?:def\s+\w+\s*\(|elif\s|self\.|None\b|True\b|False\b)|(?<![\w.])print\s*\(/m.test(code)) return 'python';
  if (/\b(?:interface|type)\s+\w+|:\s*(?:string|number|boolean)\b|\bas\s+const\b/.test(code)) return 'typescript';
  if (/\b(?:public|private|protected)\s+(?:static\s+)?(?:class|void|int|String|boolean)\b|\bSystem\.out\.print/.test(code)) return 'java';
  if (/^\s*<\?php\b/i.test(code)) return 'php';
  if (/#include\s*[<"]|\bint\s+main\s*\(|\bprintf\s*\(/.test(code)) return 'c';
  if (/\b(?:const|let|var)\s+\w+|\bfunction\s+\w+|=>|\bconsole\.\w+/.test(code)) return 'javascript';
  if (contextual && fitsLanguageContext(code, contextual)) return contextual;
  return 'text';
}

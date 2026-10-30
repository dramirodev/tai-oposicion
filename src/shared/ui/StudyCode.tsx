import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import type { HighlighterCore } from 'shiki/core';
import { inferCodeLanguage } from './study-code-language.js';

let highlighterPromise: Promise<HighlighterCore> | undefined;
const languagePromises = new Map<string, Promise<void>>();
const languageImports = {
  bash: () => import('@shikijs/langs/bash'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  csharp: () => import('@shikijs/langs/csharp'),
  css: () => import('@shikijs/langs/css'),
  html: () => import('@shikijs/langs/html'),
  java: () => import('@shikijs/langs/java'),
  javascript: () => import('@shikijs/langs/javascript'),
  jsx: () => import('@shikijs/langs/jsx'),
  json: () => import('@shikijs/langs/json'),
  json5: () => import('@shikijs/langs/json5'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  php: () => import('@shikijs/langs/php'),
  powershell: () => import('@shikijs/langs/powershell'),
  python: () => import('@shikijs/langs/python'),
  scss: () => import('@shikijs/langs/scss'),
  shellsession: () => import('@shikijs/langs/shellsession'),
  sql: () => import('@shikijs/langs/sql'),
  tsx: () => import('@shikijs/langs/tsx'),
  typescript: () => import('@shikijs/langs/typescript'),
  xml: () => import('@shikijs/langs/xml'),
  yaml: () => import('@shikijs/langs/yaml'),
} as const;

function getHighlighter() {
  highlighterPromise ??= createHighlighterCore({
    themes: [import('@shikijs/themes/github-light'), import('@shikijs/themes/github-dark')],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighterPromise;
}

function loadLanguage(highlighter: HighlighterCore, language: string) {
  if (language === 'text') return Promise.resolve();
  let load = languagePromises.get(language);
  if (!load) {
    const importLanguage = Object.prototype.hasOwnProperty.call(languageImports, language)
      ? languageImports[language as keyof typeof languageImports]
      : undefined;
    if (!importLanguage) return Promise.resolve();
    load = importLanguage().then(module => highlighter.loadLanguage(module));
    load = load.catch(error => {
      languagePromises.delete(language);
      throw error;
    });
    languagePromises.set(language, load);
  }
  return load;
}

function renderToken(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
  if (!(node instanceof Element)) return null;
  const children = Array.from(node.childNodes).map((child, index) => renderToken(child, index));
  if (node.tagName.toLowerCase() !== 'span') return <>{children}</>;
  const token = node as HTMLSpanElement;
  const light = token.style.color;
  const dark = token.style.getPropertyValue('--shiki-dark');
  const tokenClass = node.getAttribute('class');
  const style = {
    ...(light ? { '--shiki-token-light': light } : {}),
    ...(dark ? { '--shiki-token-dark': dark } : {}),
  } as CSSProperties;
  return <span key={key} className={light || dark ? 'shiki-token' : tokenClass === 'line' ? 'shiki-line' : tokenClass || undefined} style={style}>{children}</span>;
}

async function highlightedContent(code: string, lang: string): Promise<ReactNode | null> {
  const highlighter = await getHighlighter();
  await loadLanguage(highlighter, lang);
  const html = highlighter.codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: 'light',
    cssVariablePrefix: '--shiki-',
  });
  const document = new DOMParser().parseFromString(html, 'text/html');
  const highlightedCode = document.querySelector('pre code');
  if (!highlightedCode) return null;
  return Array.from(highlightedCode.childNodes).map((node, index) => renderToken(node, index));
}

export function StudyCode({ code, className, language: declaredLanguage, languageContext, block = false }: { code: string; className?: string; language?: string; languageContext?: string; block?: boolean }) {
  const [highlighted, setHighlighted] = useState<ReactNode | null>(null);
  const language = inferCodeLanguage(code, declaredLanguage, languageContext);

  useEffect(() => {
    let active = true;
    void highlightedContent(code, language).then(result => {
      if (active) setHighlighted(result);
    }).catch(() => {
      if (active) setHighlighted(null);
    });
    return () => { active = false; };
  }, [code, language]);

  const classes = new Set([
    'cd',
    ...(block ? ['blk'] : []),
    ...(className?.split(/\s+/).filter(Boolean) ?? []),
    ...(highlighted !== null ? ['shiki'] : []),
  ]);
  return <code className={[...classes].join(' ')} data-shiki-language={language}>
    {highlighted ?? code}
  </code>;
}

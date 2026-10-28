import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import type { HighlighterCore } from 'shiki/core';
import { inferCodeLanguage } from './study-code-language.js';

let highlighterPromise: Promise<HighlighterCore> | undefined;
const languagePromises = new Map<string, Promise<void>>();

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
    const module = language === 'sql' ? import('@shikijs/langs/sql')
      : language === 'javascript' ? import('@shikijs/langs/javascript')
        : language === 'typescript' ? import('@shikijs/langs/typescript')
          : language === 'python' ? import('@shikijs/langs/python')
            : language === 'java' ? import('@shikijs/langs/java')
              : language === 'csharp' ? import('@shikijs/langs/csharp')
                : language === 'cpp' ? import('@shikijs/langs/cpp')
                  : language === 'php' ? import('@shikijs/langs/php')
                    : language === 'xml' ? import('@shikijs/langs/xml')
                      : language === 'c' ? import('@shikijs/langs/c')
                        : language === 'html' ? import('@shikijs/langs/html')
                          : language === 'css' ? import('@shikijs/langs/css')
                            : import('@shikijs/langs/bash');
    load = highlighter.loadLanguage(module);
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

async function highlightedContent(code: string): Promise<ReactNode | null> {
  const highlighter = await getHighlighter();
  const lang = inferCodeLanguage(code);
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

export function StudyCode({ code, className, block = false }: { code: string; className?: string; block?: boolean }) {
  const [highlighted, setHighlighted] = useState<ReactNode | null>(null);
  const language = inferCodeLanguage(code);

  useEffect(() => {
    let active = true;
    void highlightedContent(code).then(result => {
      if (active) setHighlighted(result);
    }).catch(() => {
      if (active) setHighlighted(null);
    });
    return () => { active = false; };
  }, [code]);

  const classes = new Set([...(className?.split(/\s+/).filter(Boolean) ?? []), ...(block ? ['blk'] : []), ...(highlighted !== null ? ['shiki'] : [])]);
  return <code className={[...classes].join(' ')} data-shiki-language={language}>
    {highlighted ?? code}
  </code>;
}

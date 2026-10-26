import type { ReactNode } from 'react';

function renderNode(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
  if (!(node instanceof Element)) return null;
  const children = Array.from(node.childNodes).map((child, index) => renderNode(child, index));
  const className = node.getAttribute('class') || undefined;
  const label = node.getAttribute('aria-label') || undefined;
  switch (node.tagName.toLowerCase()) {
    case 'b': return <b key={key} className={className}>{children}</b>;
    case 'code': return <code key={key} className={className}>{children}</code>;
    case 'mark': return <mark key={key} className={className}>{children}</mark>;
    case 'p': return <p key={key} className={className}>{children}</p>;
    case 'span': return <span key={key} className={className} aria-label={label}>{children}</span>;
    case 'div': return <div key={key} className={className} aria-label={label}>{children}</div>;
    case 'aside': return <aside key={key} className={className} aria-label={label}>{children}</aside>;
    case 'a': {
      const href = node.getAttribute('href');
      if (!href) return <>{children}</>;
      try {
        const url = new URL(href, window.location.href);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return <>{children}</>;
        return <a key={key} className={className} href={url.href} target="_blank" rel="noopener noreferrer">{children}</a>;
      } catch { return <>{children}</>; }
    }
    default: return <>{children}</>;
  }
}

/** Converts the escaped markup produced by the study text formatters into React elements. */
export function StudyMarkup({ html }: { html: string }) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  return <>{Array.from(document.body.childNodes).map((node, index) => renderNode(node, index))}</>;
}

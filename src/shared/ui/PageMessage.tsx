import type { ReactNode } from 'react';

interface PageMessageProps {
  children: ReactNode;
  className?: string;
  role?: 'alert' | 'status';
  title?: ReactNode;
  titleLevel?: 1 | 2;
}

/** Shared presentational shell for page-level errors, empty states, and notices. */
export function PageMessage({ children, className = 'card', role, title, titleLevel = 2 }: PageMessageProps) {
  const Heading = titleLevel === 1 ? 'h1' : 'h2';
  return <div className={className} role={role}>
    {title != null && <Heading>{title}</Heading>}
    {children}
  </div>;
}

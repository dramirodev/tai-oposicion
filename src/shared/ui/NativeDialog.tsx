import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

interface NativeDialogProps {
  open: boolean;
  labelledBy: string;
  initialFocusSelector: string;
  onCancel: () => void;
  onBackdropClick?: () => void;
  children: ReactNode;
  className?: string;
  id?: string;
  dialogId?: number;
}

/** Keeps native modal behavior in sync with React state and focuses the intended first action. */
export function NativeDialog({ open, labelledBy, initialFocusSelector, onCancel, onBackdropClick, children, className, id, dialogId }: NativeDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    return () => {
      if (!dialog?.open) return;
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !onBackdropClick) return;
    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target === dialog) onBackdropClick();
    };
    dialog.addEventListener('click', handleBackdropClick);
    return () => dialog.removeEventListener('click', handleBackdropClick);
  }, [onBackdropClick]);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    dialog.addEventListener('keydown', trapTab);
    return () => dialog.removeEventListener('keydown', trapTab);
  }, [open]);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      dialog.querySelector<HTMLElement>(initialFocusSelector)?.focus();
      wasOpenRef.current = true;
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      if (wasOpenRef.current && previousFocusRef.current?.isConnected) previousFocusRef.current.focus({ preventScroll: true });
      wasOpenRef.current = false;
    }
  }, [initialFocusSelector, open]);

  return <dialog ref={ref} id={id} data-dialog-id={dialogId} className={className} aria-labelledby={labelledBy}
    onCancel={event => { event.preventDefault(); onCancel(); }}>
    {children}
  </dialog>;
}

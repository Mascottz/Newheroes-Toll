import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/util.js';

/**
 * Full-screen modal whose content is the ONLY thing that prints
 * (window.print() while it's open prints just this card). The toolbar and any
 * element with the `no-print` class are excluded from the printed page.
 */
export default function PrintModal({ children, onClose, widthClass = 'max-w-md' }) {
  useEffect(() => {
    document.body.classList.add('has-print-target');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.classList.remove('has-print-target');
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return createPortal(
    <div
      className="print-layer fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/70 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={cx('print-card my-auto w-full rounded-2xl bg-slate-50 shadow-2xl', widthClass)}>
        {children}
      </div>
    </div>,
    document.body
  );
}

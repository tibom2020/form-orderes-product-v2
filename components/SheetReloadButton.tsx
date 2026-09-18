import React from 'react';
import { ArrowsRotateIcon } from './icons';

interface SheetReloadButtonProps {
  onClick: () => void | Promise<void>;
  loading?: boolean;
  label?: string;
  title?: string;
  className?: string;
}

/** Nút ép tải lại dữ liệu Google Sheets — dùng chung header / từng tab */
const SheetReloadButton: React.FC<SheetReloadButtonProps> = ({
  onClick,
  loading = false,
  label = 'Làm mới',
  title = 'Ép tải lại dữ liệu từ Google Sheets',
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={loading}
      title={title}
      aria-busy={loading}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold bg-emerald-700 text-white dark:bg-emerald-600 border border-emerald-800/40 dark:border-emerald-400/40 hover:bg-emerald-800 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all shadow-sm ${className}`}
    >
      <span className={`w-3.5 h-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`}>
        <ArrowsRotateIcon />
      </span>
      <span className="whitespace-nowrap">{loading ? 'Đang tải…' : label}</span>
    </button>
  );
};

export default SheetReloadButton;

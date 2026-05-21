import React from 'react';
import { isGoiPs25Yes } from '../utils/psOnInvoicePromo';

interface GoiPs25ToggleProps {
  value: string;
  disabled?: boolean;
  loading?: boolean;
  onToggle?: (next: 'YES' | 'NO') => void;
}

/** Gạt YES/NO — admin bật; user chỉ xem (disabled) */
const GoiPs25Toggle: React.FC<GoiPs25ToggleProps> = ({
  value,
  disabled = false,
  loading = false,
  onToggle,
}) => {
  const isYes = isGoiPs25Yes(value);
  const canInteract = !disabled && !loading && !!onToggle;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isYes}
      aria-label={isYes ? 'Gói PS 25%: Đã đặt (YES)' : 'Gói PS 25%: Chưa đặt (NO)'}
      disabled={!canInteract}
      title={
        disabled
          ? 'Chỉ admin được cập nhật Gói PS 25%'
          : loading
            ? 'Đang lưu…'
            : isYes
              ? 'Gạt sang NO (chưa đặt gói)'
              : 'Gạt sang YES (đã đặt gói)'
      }
      onClick={e => {
        e.stopPropagation();
        if (!canInteract) return;
        onToggle(isYes ? 'NO' : 'YES');
      }}
      className={`
        relative inline-flex items-center h-6 w-[3.25rem] rounded-full border-2 transition-all duration-200 shrink-0
        ${isYes ? 'bg-emerald-600 border-emerald-700' : 'bg-amber-100 border-amber-300 dark:bg-amber-900/40 dark:border-amber-700'}
        ${canInteract ? 'cursor-pointer hover:opacity-90 active:scale-95' : 'cursor-default opacity-90'}
        ${loading ? 'opacity-60 pointer-events-none' : ''}
      `}
    >
      <span
        className={`
          absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
          ${isYes ? 'translate-x-[1.35rem]' : 'translate-x-0'}
        `}
      />
      <span
        className={`w-full text-center text-[8px] font-black uppercase tracking-tight select-none ${
          isYes ? 'text-white pr-3 pl-0.5' : 'text-amber-900 dark:text-amber-100 pl-3 pr-0.5'
        }`}
      >
        {loading ? '…' : isYes ? 'YES' : 'NO'}
      </span>
    </button>
  );
};

export default GoiPs25Toggle;

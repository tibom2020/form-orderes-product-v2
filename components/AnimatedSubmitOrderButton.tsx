import React, { useMemo } from 'react';

export interface AnimatedSubmitOrderButtonProps {
    disabled: boolean;
    isLoading: boolean;
    /** true khi vừa gửi đơn thành công (đồng bộ với thông báo dưới nút) */
    showSubmitSuccess: boolean;
    onClick: () => void;
}

/**
 * Nút gửi đơn: xe tải chạy khi đang gửi, tick + nhãn khi thành công (theo Code Wars / truck-button pattern).
 */
const AnimatedSubmitOrderButton: React.FC<AnimatedSubmitOrderButtonProps> = ({
    disabled,
    isLoading,
    showSubmitSuccess,
    onClick,
}) => {
    const phase = useMemo(() => {
        if (isLoading) return 'loading' as const;
        if (showSubmitSuccess) return 'success' as const;
        return 'idle' as const;
    }, [isLoading, showSubmitSuccess]);

    return (
        <>
            <style>{`
                /* 100% phải là chiều rộng track (cha), không phải width của xe → dùng left thay vì translateX trên xe */
                @keyframes aso-truck-move {
                    0% { left: 0; }
                    100% { left: calc(100% - 26px); }
                }
                .aso-truck-track {
                    min-width: 0;
                }
                .aso-truck-wrap {
                    position: absolute;
                    bottom: 1px;
                    left: 0;
                    width: 26px;
                    height: 14px;
                    animation: aso-truck-move 1.6s linear infinite;
                }
                .aso-check-path {
                    stroke-dasharray: 20px;
                    stroke-dashoffset: 20px;
                    transition: stroke-dashoffset 0.5s ease 0.15s;
                }
                .aso-submit-btn--success .aso-check-path {
                    stroke-dashoffset: 0;
                }
            `}</style>
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    if (disabled || isLoading) return;
                    onClick();
                }}
                disabled={disabled}
                aria-disabled={disabled || isLoading}
                className={[
                    'aso-submit-btn group relative flex-[2] flex min-h-[44px] min-w-0 items-center justify-center overflow-hidden rounded-lg py-2 px-2 font-black text-[11px] uppercase shadow-md transition-all',
                    phase === 'success' && 'aso-submit-btn--success',
                    phase === 'idle' && 'bg-opella-green text-white hover:bg-opella-green/90 active:scale-[0.98]',
                    phase === 'loading' && 'bg-opella-green text-white',
                    phase === 'success' && 'bg-emerald-600 text-white dark:bg-emerald-500',
                    disabled && phase === 'idle' && 'bg-slate-300 dark:bg-slate-600 cursor-not-allowed hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-100',
                    (isLoading || phase === 'success') && 'pointer-events-none cursor-default',
                    isLoading && 'cursor-wait',
                ]
                    .filter(Boolean)
                    .join(' ')}
                aria-busy={isLoading}
                aria-label={phase === 'loading' ? 'Đang gửi đơn' : phase === 'success' ? 'Đã gửi đơn thành công' : 'Gửi đơn ngay'}
            >
                {/* Idle */}
                <span
                    className={`flex items-center justify-center gap-1 transition-opacity duration-200 ${phase === 'idle' ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'}`}
                >
                    Gửi đơn ngay
                </span>

                {/* Loading: đường + xe */}
                <span
                    className={`flex w-full min-w-0 flex-col items-stretch justify-center px-1 transition-opacity duration-200 ${phase === 'loading' ? 'opacity-100' : 'pointer-events-none absolute inset-0 z-[1] opacity-0'}`}
                >
                    <span className="text-[9px] font-black tracking-wide text-white/95">Đang gửi đơn...</span>
                    <span className="aso-truck-track relative mt-1.5 h-[16px] w-full overflow-visible">
                        <span
                            className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-white/35"
                            aria-hidden
                        />
                        <span className="aso-truck-wrap will-change-[left]" aria-hidden>
                            <svg width="26" height="14" viewBox="0 0 26 14" className="drop-shadow-md">
                                <rect x="1" y="5" width="14" height="6" rx="1" fill="#38bdf8" />
                                <rect x="14" y="7" width="9" height="4" rx="0.5" fill="#e2e8f0" />
                                <circle cx="7" cy="12" r="2" fill="#0f172a" />
                                <circle cx="17" cy="12" r="2" fill="#0f172a" />
                            </svg>
                        </span>
                    </span>
                </span>

                {/* Success: tick + chữ */}
                <span
                    className={`flex items-center justify-center gap-2 transition-opacity duration-200 ${phase === 'success' ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'}`}
                >
                    <span className="aso-check inline-flex shrink-0">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                            <path
                                className="aso-check-path"
                                d="M4 9.5l3.5 3.5L14 5"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </span>
                    <span className="text-[11px] font-black tracking-tight">Đã gửi!</span>
                </span>
            </button>
        </>
    );
};

export default AnimatedSubmitOrderButton;

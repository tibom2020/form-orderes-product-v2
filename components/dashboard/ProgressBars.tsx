

import { calculatePercent } from './DashboardUtils';
import { formatCurrency } from '../../utils/formatters';

export const ProgressBar = ({ actual, target, colorClass }: { actual: number, target: number, colorClass: string, showLabel?: boolean }) => {
    const percent = calculatePercent(actual, target);
    const totalSegments = 24;
    const activeSegments = Math.round((percent / 100) * totalSegments);

    let borderColorClass = 'border-slate-300 dark:border-slate-600';
    let shadowClass = '';

    if (colorClass.includes('blue')) {
        borderColorClass = 'border-blue-300 dark:border-blue-700';
        shadowClass = 'shadow-[0_0_6px_rgba(59,130,246,0.6)]';
    } else if (colorClass.includes('green') || colorClass.includes('emerald')) {
        borderColorClass = 'border-green-300 dark:border-green-700';
        shadowClass = 'shadow-[0_0_6px_rgba(34,197,94,0.6)]';
    } else if (colorClass.includes('sky') || colorClass.includes('cyan')) {
        borderColorClass = 'border-opella-green/50 dark:border-opella-green';
        shadowClass = 'shadow-[0_0_6px_rgba(14,165,233,0.6)]';
    } else if (colorClass.includes('red') || colorClass.includes('pink') || colorClass.includes('rose')) {
        borderColorClass = 'border-red-300 dark:border-red-700';
        shadowClass = 'shadow-[0_0_6px_rgba(244,63,94,0.6)]';
    }

    return (
        <div className="w-full">
            <div className={`w-full border ${borderColorClass} p-[3px] rounded-lg bg-white dark:bg-slate-800 shadow-sm flex gap-[2px] overflow-hidden`}>
                {Array.from({ length: totalSegments }).map((_, i) => {
                    const isActive = i < activeSegments;
                    return (
                        <div
                            key={i}
                            className={`h-2.5 flex-1 rounded-[1px] transition-all duration-500 ${isActive
                                ? `${colorClass} ${shadowClass}`
                                : 'bg-slate-100 dark:bg-slate-700'
                                }`}
                        ></div>
                    );
                })}
            </div>
        </div>
    );
};

export const MiniProgressBar = ({ label, actual, totalTarget, barColor }: { label: string, actual: number, totalTarget: number, barColor: string }) => {
    const percent = calculatePercent(actual, totalTarget);
    if (actual <= 0) return null;

    const totalSegments = 15;
    const activeSegments = Math.round((percent / 100) * totalSegments);

    return (
        <div className="mb-2">
            <div className="flex justify-between items-end text-[10px] mb-1 text-slate-500 dark:text-slate-400">
                <span>{label}:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(actual)}</span>
            </div>

            <div className="w-full border border-slate-200 dark:border-slate-700 p-[2px] rounded bg-white dark:bg-slate-800 flex gap-[1px]">
                {Array.from({ length: totalSegments }).map((_, i) => {
                    const isActive = i < activeSegments;
                    return (
                        <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-[1px] ${isActive
                                ? `${barColor} opacity-90`
                                : 'bg-slate-100 dark:bg-slate-700'
                                }`}
                        ></div>
                    )
                })}
            </div>
        </div>
    );
};

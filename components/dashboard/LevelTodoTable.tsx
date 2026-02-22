

import { REBATE_TIERS, formatCompact } from './DashboardUtils';

export const LevelTodoTable = ({ actual }: { actual: number }) => {
    return (
        <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Bảng tính Todo Level</p>
            <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-left border-collapse">
                    <thead>
                        <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <th className="py-1 pr-2">Level</th>
                            <th className="py-1 px-2 text-right">Mốc DS</th>
                            <th className="py-1 pl-2 text-right">Cần làm</th>
                        </tr>
                    </thead>
                    <tbody>
                        {REBATE_TIERS.map((tier) => {
                            const todo = tier.amount - actual;
                            const isReached = todo <= 0;
                            return (
                                <tr key={tier.level} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="py-1.5 pr-2 font-bold text-slate-600 dark:text-slate-300">
                                        Lv{tier.level} <span className="font-normal text-[9px] text-slate-400">({tier.percent}%)</span>
                                    </td>
                                    <td className="py-1.5 px-2 text-right text-slate-500 dark:text-slate-400">
                                        {formatCompact(tier.amount)}
                                    </td>
                                    <td className="py-1.5 pl-2 text-right font-bold">
                                        {isReached ? (
                                            <span className="text-green-500 dark:text-green-400">✓ Đạt</span>
                                        ) : (
                                            <span className="text-red-500 dark:text-red-400">{formatCompact(todo)}</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

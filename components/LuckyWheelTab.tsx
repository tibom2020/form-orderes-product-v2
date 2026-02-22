import React, { useState, useMemo } from 'react';
import type { Employee, LiXiResult } from '../types';
import { GiftIcon, CheckCircleIcon } from './icons';
import { formatCurrency } from '../utils/formatters';
import confetti from 'canvas-confetti';

interface LuckyWheelTabProps {
    currentEmployee: Employee;
    allLiXiResults: LiXiResult[];
    onSubmitResult: (result: LiXiResult) => Promise<void>;
    isLoading: boolean;
}

const PRIZE_CONFIG = [
    { id: 1, name: 'Bao thư Vàng', value: 499999, color: '#fbbf24', textColor: '#78350f', count: 1 },
    { id: 2, name: 'Bao thư Bạc', value: 299999, color: '#94a3b8', textColor: '#1e293b', count: 1 },
    { id: 3, name: 'Bao thư Đỏ', value: 199999, color: '#ef4444', textColor: '#ffffff', count: 2 },
    { id: 4, name: 'Bao thư Xanh', value: 99999, color: '#3b82f6', textColor: '#ffffff', count: 4 },
];

const LuckyWheelTab: React.FC<LuckyWheelTabProps> = ({ currentEmployee, allLiXiResults, onSubmitResult }) => {
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [wonPrize, setWonPrize] = useState<typeof PRIZE_CONFIG[0] | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [isOpened, setIsOpened] = useState(false);

    // Kiểm tra xem nhân viên hiện tại đã quay chưa
    const hasSpun = useMemo(() => {
        return allLiXiResults.some(r => String(r.EmployeeCode).trim() === String(currentEmployee.code).trim());
    }, [allLiXiResults, currentEmployee.code]);

    // Kết quả đã quay của nhân viên này (nếu có)
    const myResult = useMemo(() => {
        return allLiXiResults.find(r => String(r.EmployeeCode).trim() === String(currentEmployee.code).trim());
    }, [allLiXiResults, currentEmployee.code]);

    // Xác định các giải còn lại
    const availablePrizes = useMemo(() => {
        const counts: Record<string, number> = {};
        allLiXiResults.forEach(r => {
            counts[r.PrizeName] = (counts[r.PrizeName] || 0) + 1;
        });

        const list: typeof PRIZE_CONFIG = [];
        PRIZE_CONFIG.forEach(p => {
            const remaining = p.count - (counts[p.name] || 0);
            for (let i = 0; i < remaining; i++) {
                list.push(p);
            }
        });
        return list;
    }, [allLiXiResults]);

    // Tạo visual segments cho vòng quay (8 segments: mỗi loại 2 ô)
    const wheelSegments = useMemo(() => {
        return [
            PRIZE_CONFIG[0], PRIZE_CONFIG[1], PRIZE_CONFIG[2], PRIZE_CONFIG[3],
            PRIZE_CONFIG[0], PRIZE_CONFIG[1], PRIZE_CONFIG[2], PRIZE_CONFIG[3]
        ];
    }, []);

    const handleSpin = async () => {
        if (isSpinning || hasSpun || availablePrizes.length === 0) return;

        setIsSpinning(true);
        setIsOpened(false); // Reset trạng thái mở bao thư

        // 1. Chọn ngẫu nhiên một giải từ danh sách CÒN LẠI
        const randomIndex = Math.floor(Math.random() * availablePrizes.length);
        const prize = availablePrizes[randomIndex];

        // 2. Tìm vị trí của giải này trên vòng quay visual (8 segments)
        // Vì có 2 ô cùng loại, ta chọn ngẫu nhiên 1 trong 2 ô đó để kim chỉ vào
        const targetIndices = wheelSegments
            .map((s, i) => s.id === prize.id ? i : -1)
            .filter(i => i !== -1);
        const targetSegmentIndex = targetIndices[Math.floor(Math.random() * targetIndices.length)];

        // Tính toán góc quay
        // Mỗi segment chiếm 360 / 8 = 45 độ
        // Vòng quay quay theo chiều kim đồng hồ, nên góc quay = (vòng quay x 360) + (360 - (i * 45) - 22.5)
        // -22.5 để dừng ở giữa ô 45 độ
        const extraRounds = 12 + Math.floor(Math.random() * 5);
        const targetAngle = (extraRounds * 360) + (360 - (targetSegmentIndex * 45) - 22.5);

        setRotation(targetAngle);

        // Đợi hiệu ứng quay kết thúc (8s)
        setTimeout(async () => {
            setIsSpinning(false);
            setWonPrize(prize);
            setShowResult(true);

            // Lưu kết quả lên Google Sheet
            const result: LiXiResult = {
                EmployeeCode: currentEmployee.code,
                EmployeeName: currentEmployee.name,
                PrizeName: prize.name,
                PrizeValue: prize.value
            };
            await onSubmitResult(result);
        }, 8500);
    };

    const handleOpenEnvelope = () => {
        setIsOpened(true);

        // Hiệu ứng pháo bông
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            // since particles fall down, start a bit higher than random
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    };

    return (
        <div className="flex flex-col items-center justify-center space-y-8 py-8 animate-fade-in">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-red-600 dark:text-red-500 uppercase tracking-widest flex items-center justify-center gap-3">
                    🧧 Vòng Quay Lì Xì 🧧
                </h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-widest italic">
                    Chúc mừng năm mới 2026 - Vạn sự như ý
                </p>
            </div>

            {!hasSpun || showResult ? (
                <div className="relative group">
                    {/* Wheel Container */}
                    <div
                        className="relative w-80 h-80 sm:w-96 sm:h-96 rounded-full border-[12px] border-red-700 shadow-[0_0_50px_rgba(185,28,28,0.4)] overflow-hidden transition-all"
                        style={{
                            transform: `rotate(${rotation}deg)`,
                            transition: isSpinning ? 'transform 8s cubic-bezier(0.1, 0, 0.1, 1)' : 'none',
                            background: `conic-gradient(
                                ${PRIZE_CONFIG[0].color} 0deg 45deg, 
                                ${PRIZE_CONFIG[1].color} 45deg 90deg, 
                                ${PRIZE_CONFIG[2].color} 90deg 135deg, 
                                ${PRIZE_CONFIG[3].color} 135deg 180deg,
                                ${PRIZE_CONFIG[0].color} 180deg 225deg, 
                                ${PRIZE_CONFIG[1].color} 225deg 270deg, 
                                ${PRIZE_CONFIG[2].color} 270deg 315deg, 
                                ${PRIZE_CONFIG[3].color} 315deg 360deg
                            )`
                        }}
                    >
                        {wheelSegments.map((segment, i) => (
                            <div
                                key={i}
                                className="absolute top-0 left-0 w-full h-full"
                                style={{ transform: `rotate(${i * 45 + 22.5}deg)` }}
                            >
                                <div className="absolute top-[10%] left-1/2 -translate-x-1/2 text-center" style={{ color: segment.textColor }}>
                                    <p className="font-black text-[10px] sm:text-sm uppercase tracking-tighter drop-shadow-sm">{segment.name.split(' ')[2]}</p>
                                </div>
                            </div>
                        ))}

                        {/* Overlay lines (8 segments) */}
                        <div className="absolute inset-0 pointer-events-none">
                            {[0, 45, 90, 135].map(deg => (
                                <div key={deg} className="absolute top-0 left-1/2 w-[1px] h-full bg-red-900/20 origin-center" style={{ transform: `rotate(${deg}deg)` }}></div>
                            ))}
                        </div>
                    </div>

                    {/* Center decoration */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 bg-red-700 rounded-full border-4 border-yellow-400 shadow-xl z-20 flex items-center justify-center text-yellow-400">
                            <GiftIcon />
                        </div>
                    </div>

                    {/* Pointer */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 drop-shadow-xl">
                        <div className="w-8 h-10 bg-yellow-400" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}></div>
                    </div>

                    {/* Spin Button */}
                    {!hasSpun && !isSpinning && (
                        <button
                            onClick={handleSpin}
                            className="absolute inset-0 z-40 flex items-center justify-center"
                        >
                            <div className="w-20 h-20 bg-yellow-500 hover:bg-yellow-400 text-white rounded-full font-black text-sm uppercase shadow-2xl transform transition-all active:scale-90 flex items-center justify-center text-center leading-tight">
                                Quay<br />Ngay
                            </div>
                        </button>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl border-4 border-red-100 dark:border-red-900/30 w-full max-sm text-center space-y-6 animate-slide-up">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-full mx-auto flex items-center justify-center scale-150 mb-4">
                        <CheckCircleIcon />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase">Bạn đã nhận thưởng!</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Lì xì may mắn đầu năm dành cho nhân viên</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-600">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Phần quà của bạn:</p>
                        <p className="text-3xl font-black text-red-600 dark:text-red-500 uppercase">{myResult?.PrizeName}</p>
                    </div>

                    <p className="text-xs font-medium text-slate-400 italic">
                        Cám ơn {currentEmployee.name} đã đồng hành cùng team!
                    </p>
                </div>
            )}

            {/* Result Modal */}
            {showResult && wonPrize && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-red-900/60 backdrop-blur-md animate-fade-in text-center">
                    <div className="bg-white p-8 rounded-[40px] shadow-[0_0_100px_rgba(255,255,255,0.3)] max-w-sm w-full animate-bounce-in relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-red-500 to-yellow-400"></div>
                        <p className="text-4xl mb-4">🎉</p>
                        <h3 className="text-2xl font-black text-slate-800 uppercase">Chúc mừng bạn!</h3>
                        <p className="text-slate-500 text-sm mt-2">Bạn đã quay trúng</p>

                        <div className="my-8">
                            <p className="text-4xl font-black text-red-600 uppercase tracking-tight">{wonPrize.name}</p>
                            {isOpened && (
                                <p className="text-5xl font-black text-sky-600 mt-4 animate-slide-up">
                                    {formatCurrency(wonPrize.value)}
                                </p>
                            )}
                        </div>

                        {!isOpened ? (
                            <button
                                onClick={handleOpenEnvelope}
                                className="w-full py-4 bg-yellow-500 hover:bg-yellow-600 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                🧧 Mở bao thư
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowResult(false)}
                                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest"
                            >
                                Đóng
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Prize List Info */}
            <div className="w-full max-w-md bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg">
                <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">Cơ cấu giải thưởng</h4>
                <div className="grid grid-cols-2 gap-3">
                    {PRIZE_CONFIG.map(p => (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }}></div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{p.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LuckyWheelTab;

import React, { useState } from 'react';
import DummyBoxLocalCalculator from './DummyBoxLocalCalculator';
import DummyBoxImportCalculator from './DummyBoxImportCalculator';

type CalculatorMode = 'local' | 'import';

interface DummyBoxCalculatorProps {
    onClose: () => void;
}

const DummyBoxCalculator: React.FC<DummyBoxCalculatorProps> = ({ onClose }) => {
    const [mode, setMode] = useState<CalculatorMode>('local');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase">
                            Tính toán gói DummyBox
                        </h2>
                        <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-0.5">
                            <button
                                onClick={() => setMode('local')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'local' ? 'bg-green-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                            >
                                Local
                            </button>
                            <button
                                onClick={() => setMode('import')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'import' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                            >
                                Import
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">✕</button>
                </div>

                <div className="overflow-auto p-4 flex-1">
                    {mode === 'local' ? (
                        <DummyBoxLocalCalculator embedded onClose={onClose} />
                    ) : (
                        <DummyBoxImportCalculator />
                    )}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 rounded-b-2xl text-right">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow transition-colors">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DummyBoxCalculator;

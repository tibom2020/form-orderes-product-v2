import React, { useState, useEffect } from 'react';
import { BellIcon, MegaphoneIcon, PaperAirplaneIcon } from './icons';
import { AdminNewsItem, Employee } from '../types';
import { submitAdminNews } from '../services/googleSheetService';
import { GOOGLE_SCRIPT_URL } from '../constants';

// For simplicity, XCircleIcon might not exist, let's use a local SVG if needed or check icons.tsx
// I will use a simple X button if XCircleIcon is missing.

interface AdminNewsWidgetProps {
    currentEmployee: Employee;
    isAdmin: boolean;
    newsItems: AdminNewsItem[];
    onNewMessage?: (item: AdminNewsItem) => void;
}

const AdminNewsWidget: React.FC<AdminNewsWidgetProps> = ({ currentEmployee, isAdmin, newsItems, onNewMessage }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showBadge, setShowBadge] = useState(false);

    // Hiệu ứng badge khi có tin mới
    useEffect(() => {
        if (newsItems.length > 0 && !isOpen) {
            setShowBadge(true);
        }
    }, [newsItems, isOpen]);

    const handleSend = async () => {
        if (!message.trim()) return;
        setIsSubmitting(true);

        const timestamp = new Date().toLocaleString('vi-VN');
        const result = await submitAdminNews(GOOGLE_SCRIPT_URL, {
            adminName: currentEmployee.name,
            message: message.trim(),
            timestamp: timestamp
        });

        setIsSubmitting(false);
        if (result.status === 'success') {
            const newItem: AdminNewsItem = {
                timestamp,
                adminName: currentEmployee.name,
                message: message.trim(),
                type: 'news'
            };
            if (onNewMessage) onNewMessage(newItem);
            setMessage('');
            alert("Đã gửi thông báo thành công!");
        } else {
            alert("Lỗi khi gửi thông báo: " + (result.message || "Không rõ nguyên nhân"));
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Nút bong bóng thông báo */}
            {!isOpen && (
                <button
                    onClick={() => { setIsOpen(true); setShowBadge(false); }}
                    className="relative w-14 h-14 bg-gradient-to-tr from-sky-500 to-blue-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-transform duration-300 animate-bounce-slow border-2 border-white dark:border-slate-800"
                >
                    <BellIcon />
                    {showBadge && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 border-2 border-white text-[10px] items-center justify-center font-bold">!</span>
                        </span>
                    )}
                </button>
            )}

            {/* Cửa sổ Chat/News */}
            {isOpen && (
                <div className="w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-slide-up origin-bottom-right">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-sky-600 to-blue-700 p-4 text-white flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <MegaphoneIcon />
                            <h3 className="font-black uppercase tracking-wider text-sm">Thông báo Admin</h3>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* List Tin tức */}
                    <div className="flex-1 max-h-80 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50 custom-scrollbar">
                        {newsItems.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <p className="text-xs italic">Chưa có thông báo mới nào từ Admin.</p>
                            </div>
                        ) : (
                            [...newsItems].reverse().map((news, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 animate-fade-in">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-tighter">{news.adminName}</span>
                                        <span className="text-[8px] text-slate-400 italic">{news.timestamp}</span>
                                    </div>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{news.message}</p>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Form gửi tin (Chỉ dành cho Admin) */}
                    {isAdmin && (
                        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Gửi thông báo mới:</p>
                            <div className="flex items-end gap-2">
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Nhập nội dung thông báo..."
                                    className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-sky-500 dark:text-white resize-none h-20 transition-all"
                                    disabled={isSubmitting}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={isSubmitting || !message.trim()}
                                    className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white p-3 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center"
                                >
                                    {isSubmitting ? (
                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <PaperAirplaneIcon />
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Footer nhỏ */}
                    {!isAdmin && (
                        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 text-center">
                            <p className="text-[9px] text-slate-400 italic">Luôn cập nhật thông tin mới nhất từ Ban điều hành.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminNewsWidget;

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { submitMarketingData } from '../services/googleSheetService';

import { GOOGLE_SCRIPT_URL } from '../constants';
import { removeVietnameseTones } from '../utils/formatters';
import { generateCustomerSummary } from '../utils/customerSummarizer';
import type { MarketingRecord, Employee, SalesRecord, ForecastItem } from '../types';
import {
    CameraIcon, CloudArrowUpIcon, CheckCircleIcon, GiftIcon, UserGroupIcon,
    SearchIcon, RocketLaunchIcon, ExclamationCircleIcon, CartIcon,
    DocumentTextIcon, ChartBarIcon, FunnelIcon
} from './icons';


interface LandingPageProps {
    currentEmployee: Employee;
    marketingData: MarketingRecord[];
    salesRecords: SalesRecord[];
    forecastData: ForecastItem[];
    onReloadData: () => void;
    onCustomerSelect: (code: string) => void;
    onUpdateRecord: (customerCode: string, updates: Partial<MarketingRecord>) => void;
}



const LandingPage: React.FC<LandingPageProps> = ({
    currentEmployee,
    marketingData,
    salesRecords,
    forecastData,
    onCustomerSelect,
    onUpdateRecord
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<MarketingRecord | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [imageFilterMode, setImageFilterMode] = useState<'ALL' | 'HAS_IMAGE' | 'NO_IMAGE'>('ALL');
    // State lọc theo Rep
    const [selectedRepFilter, setSelectedRepFilter] = useState<string | null>(null);

    // States cho việc upload ảnh
    const [activeSlot, setActiveSlot] = useState<1 | 2 | null>(null);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadNote, setUploadNote] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // State quản lý trạng thái local
    const [localStatus, setLocalStatus] = useState<{ upHinh: string; upHinh2: string; goiLocal: string; goiImport: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Chỉ cho phép chỉnh sửa gói nếu mã nhân viên là 20043741
    const canEditPackages = currentEmployee.code === '20043741';

    // --- PRE-PROCESS DATA: DEDUPLICATE CUSTOMERS ---
    const uniqueMarketingData = useMemo(() => {
        // Dùng Map để lọc trùng theo CustomerCode, giữ lại record cuối cùng (mới nhất)
        const map = new Map<string, MarketingRecord>();
        marketingData.forEach(record => {
            if (record.CustomerCode) {
                map.set(String(record.CustomerCode).trim(), record);
            }
        });
        return Array.from(map.values());
    }, [marketingData]);

    // --- REPORT LOGIC (Dựa trên unique data) ---
    const reportData = useMemo(() => {
        const stats: Record<string, { total: number, upHinh: number, local: number, import: number }> = {};

        uniqueMarketingData.forEach(record => {
            // Chuẩn hóa tên Rep
            const repName = record.Rep ? record.Rep.trim() : 'Chưa phân công';
            if (!stats[repName]) {
                stats[repName] = { total: 0, upHinh: 0, local: 0, import: 0 };
            }

            stats[repName].total += 1;

            // Check conditions
            const hasImg1 = record.UpHinh && record.UpHinh !== 'NO' && record.UpHinh !== '';
            const hasImg2 = record.UpHinh2 && record.UpHinh2 !== 'NO' && record.UpHinh2 !== '';

            // Chỉ cần có 1 trong 2 ảnh là tính
            if (hasImg1 || hasImg2) stats[repName].upHinh += 1;

            if (record.GoiLocal === 'YES') stats[repName].local += 1;
            if (record.GoiImport === 'YES') stats[repName].import += 1;
        });

        // Chuyển về mảng và sort theo tổng số KH giảm dần
        return Object.entries(stats)
            .map(([rep, data]) => ({ rep, ...data }))
            .sort((a, b) => b.total - a.total);
    }, [uniqueMarketingData]);

    const currentDate = new Date().toLocaleDateString('vi-VN');
    // --------------------

    // Sync selectedCustomer with marketingData updates
    useEffect(() => {
        if (selectedCustomer) {
            // Tìm trong uniqueMarketingData thay vì marketingData gốc
            const updatedRecord = uniqueMarketingData.find(r => r.CustomerCode === selectedCustomer.CustomerCode);
            if (updatedRecord && updatedRecord !== selectedCustomer) {
                setSelectedCustomer(updatedRecord);
            }
        }
    }, [uniqueMarketingData, selectedCustomer]);

    useEffect(() => {
        if (selectedCustomer) {
            setLocalStatus({
                upHinh: selectedCustomer.UpHinh || 'NO',
                upHinh2: selectedCustomer.UpHinh2 || 'NO',
                goiLocal: selectedCustomer.GoiLocal || 'NO',
                goiImport: selectedCustomer.GoiImport || 'NO'
            });
            resetUploadState();
        }
    }, [selectedCustomer]);

    const resetUploadState = () => {
        setSelectedImage(null);
        setPreviewUrl(null);
        setUploadNote('');
        setUploadError(null);
        setActiveSlot(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const myCustomers = uniqueMarketingData.filter(r => {
        const codeMatch = r.StaffCode && String(r.StaffCode).trim() === currentEmployee.code;
        const repMatch = r.Rep && r.Rep.toLowerCase().trim() === currentEmployee.name.toLowerCase().trim();
        if (currentEmployee.code === '20043741') return true;
        return codeMatch || repMatch;
    });

    const filteredCustomers = myCustomers.filter(c => {
        // 1. Lọc theo Search Term (Có xử lý tiếng Việt không dấu)
        const normalizedSearch = removeVietnameseTones(searchTerm).toLowerCase();
        const normalizedName = removeVietnameseTones(c.CustomerName || '').toLowerCase();
        const normalizedAddress = removeVietnameseTones(c.District || '').toLowerCase();
        const normalizedRep = removeVietnameseTones(c.Rep || '').toLowerCase();

        const matchesSearch = normalizedName.includes(normalizedSearch) ||
            String(c.CustomerCode).includes(normalizedSearch) ||
            normalizedAddress.includes(normalizedSearch) ||
            normalizedRep.includes(normalizedSearch);

        if (!matchesSearch) return false;

        // 2. Lọc theo Rep (Nếu có chọn từ Báo cáo)
        if (selectedRepFilter) {
            const repName = c.Rep ? c.Rep.trim() : 'Chưa phân công';
            if (repName !== selectedRepFilter) return false;
        }

        // 3. Logic lọc ảnh
        const hasImage = (c.UpHinh && c.UpHinh !== 'NO' && c.UpHinh !== '') ||
            (c.UpHinh2 && c.UpHinh2 !== 'NO' && c.UpHinh2 !== '');

        if (imageFilterMode === 'HAS_IMAGE' && !hasImage) return false;
        if (imageFilterMode === 'NO_IMAGE' && hasImage) return false;

        return true;
    })
    .sort((a, b) => ((a.District || '').trim()).localeCompare((b.District || '').trim(), 'vi'));

    const handleBoxClick = (slot: 1 | 2) => {
        resetUploadState();
        setActiveSlot(slot);
        fileInputRef.current?.click();
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUploadError(null);
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedImage(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const compressAndConvertBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 1200;
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                        const base64Data = dataUrl.split(',')[1];
                        resolve(base64Data);
                    } else {
                        reject(new Error("Cannot get canvas context"));
                    }
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleUploadImage = async () => {
        if (!selectedImage || !selectedCustomer || !activeSlot) return;
        setIsUploading(true);
        setUploadError(null);

        try {
            const base64 = await compressAndConvertBase64(selectedImage);
            const targetColumn = activeSlot === 1 ? 'UpHinh' : 'UpHinh2';

            // Tạo tóm tắt thông tin khách hàng nếu là ảnh số 1
            let customerSummary = "";
            if (activeSlot === 1) {
                const record = salesRecords.find(r => String(r.CustomerCode).trim() === String(selectedCustomer.CustomerCode).trim());
                const forecast = forecastData.find(f => String(f.CustomerCode).trim() === String(selectedCustomer.CustomerCode).trim());

                customerSummary = generateCustomerSummary(
                    record,
                    forecast
                );
            }

            const response = await submitMarketingData(GOOGLE_SCRIPT_URL, {
                action: 'uploadImage',
                sheetName: 'DummyBoxRecord',
                customerCode: selectedCustomer.CustomerCode,
                image: base64,
                mimeType: 'image/jpeg',
                targetColumn: targetColumn,
                note: uploadNote,
                // ADD: Gửi thêm thông tin để Bot Telegram hiển thị
                employeeName: currentEmployee.name,
                customerName: selectedCustomer.CustomerName,
                customerSummary: customerSummary // Gửi kèm tóm tắt KPI
            });


            if (response.status === 'success' && response.url) {
                const updates = activeSlot === 1 ? { UpHinh: response.url } : { UpHinh2: response.url };

                setLocalStatus(prev => {
                    if (!prev) return null;
                    return activeSlot === 1
                        ? { ...prev, upHinh: response.url! }
                        : { ...prev, upHinh2: response.url! };
                });

                // Update global state
                onUpdateRecord(selectedCustomer.CustomerCode, updates);

                alert(`Thành công! Ảnh ${activeSlot} và ghi chú đã được lưu.`);
                resetUploadState();
            } else {
                setUploadError(`Lỗi Server: ${response.message || 'Không xác định'}`);
            }
        } catch (error: any) {
            setUploadError(`Lỗi kết nối: ${error.message || 'Không thể gửi yêu cầu'}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleTogglePackage = async (type: 'GoiLocal' | 'GoiImport', isChecked: boolean) => {
        if (!selectedCustomer) return;
        if (!canEditPackages) {
            alert("Bạn không có quyền thay đổi thông tin này.");
            return;
        }

        setIsRegistering(true);
        const statusValue = isChecked ? 'YES' : 'NO';
        const key = type === 'GoiLocal' ? 'goiLocal' : 'goiImport';

        // 1. Update Local UI State
        setLocalStatus(prev => prev ? ({ ...prev, [key]: statusValue }) : null);

        // 2. Optimistic Update Global State
        onUpdateRecord(selectedCustomer.CustomerCode, { [type]: statusValue });

        try {
            await submitMarketingData(GOOGLE_SCRIPT_URL, {
                action: 'registerPackage',
                sheetName: 'DummyBoxRecord',
                customerCode: selectedCustomer.CustomerCode,
                packageType: type,
                value: statusValue
            });
        } catch (e) {
            console.error('Lỗi khi cập nhật gói:', e);
        } finally {
            setIsRegistering(false);
            // Removed onReloadData() to maintain optimistic state and avoid race conditions
        }
    };

    const isLocalDone = localStatus?.goiLocal === 'YES';
    const isImportDone = localStatus?.goiImport === 'YES';

    const renderCameraBox = (slot: 1 | 2, title: string) => {
        const statusUrl = slot === 1 ? localStatus?.upHinh : localStatus?.upHinh2;
        const isDone = statusUrl && statusUrl !== 'NO' && statusUrl !== '';
        const displayUrl = (statusUrl && statusUrl.startsWith('http')) ? statusUrl : null;
        const isInteracting = activeSlot === slot;
        const showPreview = isInteracting && previewUrl;

        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col h-full transition-all">
                <div className={`p-3 text-white flex justify-between items-center ${slot === 1 ? 'bg-gradient-to-r from-indigo-500 to-purple-600' : 'bg-gradient-to-r from-pink-500 to-rose-600'}`}>
                    <div className="flex items-center gap-2 text-sm">
                        <CameraIcon />
                        <h3 className="font-bold uppercase">{title}</h3>
                    </div>
                    {isDone && <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold">✓ Đã xong</span>}
                </div>

                <div className="p-4 flex flex-col items-center justify-center flex-1">
                    {isInteracting && uploadError && (
                        <div className="w-full mb-3 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[10px] rounded border border-red-200 dark:border-red-800 flex items-start gap-2">
                            <ExclamationCircleIcon />
                            <span className="font-bold whitespace-pre-wrap">{uploadError}</span>
                        </div>
                    )}

                    {isDone && !showPreview ? (
                        <div className="text-center py-2">
                            <div className="inline-block p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400 mb-2">
                                <CheckCircleIcon />
                            </div>
                            <p className="text-green-600 dark:text-green-400 font-bold text-sm">Ảnh đã lưu</p>
                            <div className="flex flex-col gap-2 mt-4">
                                {displayUrl && (
                                    <a href={displayUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-sky-600 dark:text-sky-400 rounded text-xs font-bold border border-slate-200 dark:border-slate-600 transition-colors">
                                        Mở Ảnh Drive
                                    </a>
                                )}
                                <button
                                    onClick={() => handleBoxClick(slot)}
                                    className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors"
                                >
                                    Chụp ảnh khác
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full">
                            {!showPreview ? (
                                <div
                                    onClick={() => handleBoxClick(slot)}
                                    className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all min-h-[160px] group"
                                >
                                    <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-400 group-hover:text-sky-500 transition-colors">
                                        <CameraIcon />
                                    </div>
                                    <span className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-400 text-center uppercase tracking-tight">Chụp ảnh {slot}</span>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="relative rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-sm max-h-52 bg-slate-100">
                                        <img src={previewUrl!} alt="Preview" className="w-full h-full object-contain" />
                                        <button
                                            onClick={resetUploadState}
                                            className="absolute top-2 right-2 bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <div className="absolute top-2.5 left-2.5 text-slate-400">
                                            <DocumentTextIcon />
                                        </div>
                                        <textarea
                                            value={uploadNote}
                                            onChange={(e) => setUploadNote(e.target.value)}
                                            placeholder="Ghi chú ảnh (ví dụ: Góc trái cửa...)"
                                            rows={2}
                                            className="w-full pl-10 pr-3 py-2 text-[11px] border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none resize-none"
                                        />
                                    </div>

                                    <button
                                        onClick={handleUploadImage}
                                        disabled={isUploading}
                                        className={`w-full text-white font-black py-3 rounded-lg shadow-lg flex justify-center items-center gap-2 text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 ${slot === 1 ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-pink-600 hover:bg-pink-700'}`}
                                    >
                                        {isUploading ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                <span>Đang tải lên...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CloudArrowUpIcon />
                                                <span>Xác nhận gửi ảnh</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Render Modal Report
    const renderReportModal = () => {
        if (!showReport) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                                <ChartBarIcon />
                                <span>Báo Cáo Tiến Độ DummyBox</span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                                Ngày hệ thống: <span className="text-sky-600 dark:text-sky-400">{currentDate}</span>
                            </p>
                            <p className="text-[10px] text-slate-400 italic mt-1">(Click vào tên Rep để lọc danh sách)</p>
                        </div>
                        <button
                            onClick={() => setShowReport(false)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="overflow-auto p-0">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3">Rep Phụ Trách</th>
                                    <th className="px-4 py-3 text-center">Tổng KH</th>
                                    <th className="px-4 py-3 text-center text-indigo-600 dark:text-indigo-400">Ảnh</th>
                                    <th className="px-4 py-3 text-center text-green-600 dark:text-green-400">Gói Local</th>
                                    <th className="px-4 py-3 text-center text-blue-600 dark:text-blue-400">Gói Import</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                                {reportData.map((row, idx) => (
                                    <tr
                                        key={idx}
                                        onClick={() => {
                                            setSelectedRepFilter(row.rep);
                                            setShowReport(false);
                                        }}
                                        className="hover:bg-sky-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                                        title="Click để lọc theo Rep này"
                                    >
                                        <td className="px-4 py-3 font-bold group-hover:text-sky-600 transition-colors">{row.rep}</td>
                                        <td className="px-4 py-3 text-center font-bold bg-slate-50 dark:bg-slate-800/50">{row.total}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${row.upHinh > 0 ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-400'}`}>
                                                {row.upHinh} <span className="font-normal text-[10px] opacity-70">({Math.round(row.upHinh / row.total * 100)}%)</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${row.local > 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'text-slate-400'}`}>
                                                {row.local} <span className="font-normal text-[10px] opacity-70">({Math.round(row.local / row.total * 100)}%)</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${row.import > 0 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-400'}`}>
                                                {row.import} <span className="font-normal text-[10px] opacity-70">({Math.round(row.import / row.total * 100)}%)</span>
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {reportData.length === 0 && (
                                    <tr><td colSpan={5} className="text-center py-6 text-slate-400 italic">Chưa có dữ liệu</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 rounded-b-2xl text-right">
                        <button
                            onClick={() => setShowReport(false)}
                            className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow transition-colors"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        )
    };

    return (
        <div className="pb-20">
            <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageSelect}
            />

            {renderReportModal()}

            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-lg mb-6 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-black uppercase text-sm tracking-tight">
                        <div className="p-2 bg-sky-50 dark:bg-sky-900/30 rounded-lg">
                            <UserGroupIcon />
                        </div>
                        <span>Danh mục khách hàng ({filteredCustomers.length})</span>

                        {selectedRepFilter && (
                            <button
                                onClick={() => setSelectedRepFilter(null)}
                                className="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] rounded border border-red-200 dark:border-red-800 flex items-center gap-1 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors shadow-sm"
                                title="Click để bỏ lọc"
                            >
                                <span>✕ Rep: {selectedRepFilter}</span>
                            </button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {/* Nút Lọc Ảnh */}
                        <button
                            onClick={() => {
                                if (imageFilterMode === 'ALL') setImageFilterMode('HAS_IMAGE');
                                else if (imageFilterMode === 'HAS_IMAGE') setImageFilterMode('NO_IMAGE');
                                else setImageFilterMode('ALL');
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${imageFilterMode === 'HAS_IMAGE' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' :
                                imageFilterMode === 'NO_IMAGE' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' :
                                    'bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                        >
                            <FunnelIcon />
                            <span>
                                {imageFilterMode === 'ALL' ? 'Lọc Ảnh' :
                                    imageFilterMode === 'HAS_IMAGE' ? 'Đã có ảnh' : 'Chưa có ảnh'}
                            </span>
                        </button>

                        <button
                            onClick={() => setShowReport(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold transition-all border border-indigo-200 dark:border-indigo-800"
                        >
                            <ChartBarIcon />
                            <span>Báo Cáo</span>
                        </button>
                    </div>
                </div>

                {!selectedCustomer ? (
                    <div className="relative animate-fade-in">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><SearchIcon /></div>
                        <input
                            type="text"
                            placeholder="Tìm tên KH, mã KH, quận..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 p-3 text-sm border border-slate-300 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                        />
                        <div className="mt-4 max-h-[55vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700">
                            {filteredCustomers.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 italic text-sm">
                                    Không tìm thấy khách hàng phù hợp
                                </div>
                            ) : (
                                filteredCustomers.map(c => {
                                    const hasImage = (c.UpHinh && c.UpHinh !== 'NO' && c.UpHinh !== '') || (c.UpHinh2 && c.UpHinh2 !== 'NO' && c.UpHinh2 !== '');
                                    const hasLocal = c.GoiLocal === 'YES';
                                    const hasImport = c.GoiImport === 'YES';

                                    return (
                                        <div
                                            key={c.CustomerCode}
                                            onClick={() => setSelectedCustomer(c)}
                                            className="py-3 px-1 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer flex justify-between items-center transition-colors group"
                                        >
                                            <div className="flex-1 min-w-0 pr-4">
                                                <p className="font-bold text-sm text-slate-800 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{c.CustomerName}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{c.CustomerCode} • {c.District}</p>
                                                    {/* Hiển thị Rep Name nếu đang xem ở chế độ Admin */}
                                                    {currentEmployee.code === '20043741' && c.Rep && (
                                                        <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                                            {c.Rep}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${hasImage
                                                    ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'
                                                    : 'bg-slate-100 text-slate-300 dark:bg-slate-700 dark:text-slate-600'
                                                    }`}>
                                                    <div className="scale-75"><CameraIcon /></div>
                                                </div>
                                                <div className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black border transition-all ${hasLocal
                                                    ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800'
                                                    : 'bg-slate-50 text-slate-300 border-slate-100 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700'
                                                    }`}>L</div>
                                                <div className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black border transition-all ${hasImport
                                                    ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800'
                                                    : 'bg-slate-50 text-slate-300 border-slate-100 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700'
                                                    }`}>I</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between items-center bg-sky-50 dark:bg-sky-900/20 p-4 rounded-xl border border-sky-100 dark:border-sky-800 animate-slide-up">
                        <div className="min-w-0 flex-1">
                            <p className="font-black text-sky-800 dark:text-sky-300 truncate text-base">{selectedCustomer.CustomerName}</p>
                            <p className="text-xs text-sky-600 dark:text-sky-400 font-mono mt-0.5">{selectedCustomer.CustomerCode}</p>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                            <button
                                onClick={() => onCustomerSelect(selectedCustomer.CustomerCode)}
                                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-md transition-all uppercase flex items-center gap-2 active:scale-95"
                            >
                                <CartIcon />
                                <span className="hidden sm:inline">Đặt Hàng</span>
                            </button>
                            <button onClick={() => setSelectedCustomer(null)} className="text-[11px] font-bold text-slate-500 uppercase hover:text-red-500 transition-colors whitespace-nowrap">Đổi</button>
                        </div>
                    </div>
                )}
            </div>

            {selectedCustomer && (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {renderCameraBox(1, "Hình ảnh trưng bày 1")}
                        {renderCameraBox(2, "Hình ảnh trưng bày 2")}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className={`rounded-2xl border-2 shadow-sm p-5 flex flex-col justify-between transition-all duration-300 ${isLocalDone ? 'bg-green-50/50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                            <div className="text-center mb-4">
                                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${isLocalDone ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'}`}>
                                    <GiftIcon />
                                </div>
                                <h4 className="font-black text-slate-800 dark:text-white uppercase text-sm tracking-tight">Gói Local 2026</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Chương trình khuyến mãi Local</p>
                            </div>
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                <span className={`text-xs font-black uppercase tracking-tight ${isLocalDone ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                                    {isLocalDone ? 'Đã đăng ký' : 'Chưa tham gia'}
                                </span>
                                <label className={`relative inline-flex items-center ${canEditPackages ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`} title={canEditPackages ? '' : 'Chỉ Admin mới có quyền thay đổi'}>
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isLocalDone}
                                        disabled={isRegistering || !canEditPackages}
                                        onChange={(e) => handleTogglePackage('GoiLocal', e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                            </div>
                        </div>

                        <div className={`rounded-2xl border-2 shadow-sm p-5 flex flex-col justify-between transition-all duration-300 ${isImportDone ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                            <div className="text-center mb-4">
                                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${isImportDone ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'}`}>
                                    <RocketLaunchIcon />
                                </div>
                                <h4 className="font-black text-slate-800 dark:text-white uppercase text-sm tracking-tight">Gói Import 2026</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Chương trình khuyến mãi Import</p>
                            </div>
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                <span className={`text-xs font-black uppercase tracking-tight ${isImportDone ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                                    {isImportDone ? 'Đã đăng ký' : 'Chưa tham gia'}
                                </span>
                                <label className={`relative inline-flex items-center ${canEditPackages ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`} title={canEditPackages ? '' : 'Chỉ Admin mới có quyền thay đổi'}>
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isImportDone}
                                        disabled={isRegistering || !canEditPackages}
                                        onChange={(e) => handleTogglePackage('GoiImport', e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPage;

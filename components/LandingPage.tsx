import React, { useState, useRef, useEffect, useMemo } from 'react';
import { submitMarketingData } from '../services/googleSheetService';
import { registerDummyBoxPackage } from '../utils/dummyBoxPackage';

import { GOOGLE_SCRIPT_URL, DUMMYBOX_TARGET_1, DUMMYBOX_TARGET_2 } from '../constants';
import { removeVietnameseTones, formatCurrency } from '../utils/formatters';
import { generateCustomerSummary } from '../utils/customerSummarizer';
import type { MarketingRecord, Employee, SalesRecord, Rebate } from '../types';
import {
    CameraIcon, CloudArrowUpIcon, CheckCircleIcon, GiftIcon, UserGroupIcon,
    SearchIcon, RocketLaunchIcon, ExclamationCircleIcon, CartIcon,
    DocumentTextIcon, ChartBarIcon, FunnelIcon, ClipboardDocumentListIcon, ArrowsRotateIcon
} from './icons';
import DummyBoxCalculator from './DummyBoxCalculator';


interface LandingPageProps {
    currentEmployee: Employee;
    marketingData: MarketingRecord[];
    salesRecords: SalesRecord[];
    rebates?: Rebate[];
    onReloadData: () => void | Promise<void>;
    onCustomerSelect: (code: string) => void;
    onUpdateRecord: (customerCode: string, updates: Partial<MarketingRecord>) => void;
    showReportOnMount?: boolean;
    onReminderShown?: () => void;
    sheetName?: string;
    enableReportTools?: boolean;
    /** Sheet còn lại (DummyBoxRecord ↔ DummyBoxRecordBs): nếu cùng mã KH thì ghi chung URL ảnh sau khi upload */
    mirrorPeerSheetName?: string;
    mirrorPeerHasCustomer?: (customerCode: string) => boolean;
    onPeerMirrorRecordUpdate?: (
        customerCode: string,
        updates: Partial<Pick<MarketingRecord, 'UpHinh' | 'UpHinh2'>>
    ) => void;
}

/** Giai đoạn Kanban DummyBox — khớp cột TODO / PROCESSING_1 / PROCESSING_2 / COMPLETE */
type DummyBoxKanbanStage = 'TODO' | 'PROCESSING_1' | 'PROCESSING_2' | 'COMPLETE';

function getDummyBoxKanbanStage(customer: MarketingRecord): DummyBoxKanbanStage {
    const hasImage =
        !!(customer.UpHinh && customer.UpHinh !== 'NO' && customer.UpHinh !== '') ||
        !!(customer.UpHinh2 && customer.UpHinh2 !== 'NO' && customer.UpHinh2 !== '');
    const hasPackage = customer.GoiLocal === 'YES' || customer.GoiImport === 'YES';
    if (hasImage && hasPackage) return 'COMPLETE';
    if (hasImage) return 'PROCESSING_1';
    if (hasPackage) return 'PROCESSING_2';
    return 'TODO';
}

const STAGE_CHECK_COLS: {
    key: 'PROCESSING_1' | 'PROCESSING_2' | 'COMPLETE';
    label: string;
    activeClass: string;
}[] = [
    { key: 'PROCESSING_1', label: 'P1', activeClass: 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800' },
    { key: 'PROCESSING_2', label: 'P2', activeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800' },
    { key: 'COMPLETE', label: 'Done', activeClass: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800' },
];


const LandingPage: React.FC<LandingPageProps> = ({
    currentEmployee,
    marketingData,
    salesRecords,
    rebates = [],
    onReloadData,
    onCustomerSelect,
    onUpdateRecord,
    showReportOnMount = false,
    onReminderShown,
    sheetName = 'DummyBoxRecord',
    enableReportTools = true,
    mirrorPeerSheetName,
    mirrorPeerHasCustomer,
    onPeerMirrorRecordUpdate,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<MarketingRecord | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [showConditionsModal, setShowConditionsModal] = useState(false);
    const [showCalculatorModal, setShowCalculatorModal] = useState(false);
    const [showRepTodoProcessingModal, setShowRepTodoProcessingModal] = useState(false);
    const [isReloadingList, setIsReloadingList] = useState(false);
    const [imageFilterMode, setImageFilterMode] = useState<'ALL' | 'HAS_IMAGE' | 'NO_IMAGE' | 'PACKAGE_NO_IMAGE'>('ALL');
    // State lọc theo Rep
    const [selectedRepFilter, setSelectedRepFilter] = useState<string | null>(null);
    /** board = Kanban 4 cột; list = mỗi KH 1 dòng + cột tích P1 / P2 / COMPLETE */
    const [customerViewMode, setCustomerViewMode] = useState<'board' | 'list'>('board');

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

    const handleReloadDummyList = async () => {
        if (isReloadingList) return;
        setIsReloadingList(true);
        try {
            await Promise.resolve(onReloadData());
        } catch (e) {
            console.error('Reload DummyBox list failed', e);
        } finally {
            setIsReloadingList(false);
        }
    };

    // Khi mount với showReportOnMount (nhắc nhở KPI sau đăng nhập): mở báo cáo DummyBox
    useEffect(() => {
        if (enableReportTools && showReportOnMount) {
            setShowReport(true);
            onReminderShown?.();
        }
    }, [enableReportTools, showReportOnMount, onReminderShown]);

    // Chỉ cho phép chỉnh sửa gói nếu mã nhân viên là 20043741
    const canEditPackages = currentEmployee.code === '20043741';

    // --- PRE-PROCESS DATA: DEDUPLICATE CUSTOMERS ---
    const uniqueMarketingData = useMemo(() => {
        // Dùng Map để lọc trùng theo CustomerCode, giữ lại record cuối cùng (mới nhất)
        const map = new Map<string, MarketingRecord>();
        marketingData.forEach(record => {
            if (!record) return;
            const code = String(record.CustomerCode ?? '').trim();
            if (!code) return;
            map.set(code, record);
        });
        return Array.from(map.values());
    }, [marketingData]);

    // --- REPORT LOGIC (Dựa trên unique data) ---
    const reportData = useMemo(() => {
        const stats: Record<string, { total: number, upHinh: number, local: number, import: number, dangKyGoi: number }> = {};

        uniqueMarketingData.forEach(record => {
            // Chuẩn hóa tên Rep
            const repName = String(record.Rep ?? '').trim() || 'Chưa phân công';
            if (!stats[repName]) {
                stats[repName] = { total: 0, upHinh: 0, local: 0, import: 0, dangKyGoi: 0 };
            }

            stats[repName].total += 1;

            // Check conditions
            const up1 = String(record.UpHinh ?? '').trim();
            const up2 = String(record.UpHinh2 ?? '').trim();
            const hasImg1 = up1 !== '' && up1 !== 'NO';
            const hasImg2 = up2 !== '' && up2 !== 'NO';

            // Chỉ cần có 1 trong 2 ảnh là tính
            if (hasImg1 || hasImg2) stats[repName].upHinh += 1;

            if (record.GoiLocal === 'YES') stats[repName].local += 1;
            if (record.GoiImport === 'YES') stats[repName].import += 1;
            /** Đã mua 1 hoặc 2 gói đều tính 1 KH */
            if (record.GoiLocal === 'YES' || record.GoiImport === 'YES') stats[repName].dangKyGoi += 1;
        });

        // Chuyển về mảng và sort: ưu tiên ảnh cao→thấp, rồi tổng đơn hàng (local+import) cao→thấp
        return Object.entries(stats)
            .map(([rep, data]) => ({
                rep,
                ...data,
                todoTarget1: Math.max(0, DUMMYBOX_TARGET_1 - data.dangKyGoi),
                todoTarget2: Math.max(0, DUMMYBOX_TARGET_2 - data.dangKyGoi),
            }))
            .sort((a, b) => {
                const orderA = a.local + a.import;
                const orderB = b.local + b.import;
                if (orderB !== orderA) return orderB - orderA; // Ưu tiên Top 1 đơn hàng
                return b.upHinh - a.upHinh; // Kế Top 1 ảnh
            });
    }, [uniqueMarketingData]);

    // Tổng số cho các ô thống kê phía trên báo cáo (tương tự Forecast)
    const reportTotalStats = useMemo(() => {
        return reportData.reduce(
            (acc, row) => ({
                total: acc.total + row.total,
                upHinh: acc.upHinh + row.upHinh,
                local: acc.local + row.local,
                import: acc.import + row.import,
                dangKyGoi: acc.dangKyGoi + row.dangKyGoi
            }),
            { total: 0, upHinh: 0, local: 0, import: 0, dangKyGoi: 0 }
        );
    }, [reportData]);

    // Top performers cho báo cáo: Top 1 Ảnh, Top 1 Đơn hàng (local + import)
    const { topRepByHinh, topRepByOrder } = useMemo(() => {
        if (reportData.length === 0) return { topRepByHinh: null as string | null, topRepByOrder: null as string | null };
        const byHinh = reportData.reduce((best, r) => (r.upHinh > (best?.upHinh ?? -1) ? r : best), reportData[0]);
        const byOrder = reportData.reduce((best, r) => {
            const sum = r.local + r.import;
            const bestSum = (best?.local ?? 0) + (best?.import ?? 0);
            return sum > bestSum ? r : best;
        }, reportData[0]);
        return {
            topRepByHinh: byHinh.upHinh > 0 ? byHinh.rep : null,
            topRepByOrder: (byOrder.local + byOrder.import) > 0 ? byOrder.rep : null
        };
    }, [reportData]);

    const currentDate = new Date().toLocaleDateString('vi-VN');

    // Map CustomerCode -> Tổng MW + Other (Sale Q1)
    const salesByCode = useMemo(() => {
        const map = new Map<string, number>();
        salesRecords.forEach(r => {
            const code = String(r.CustomerCode || '').trim();
            const total = (Number(r.MustWin) || 0) + (Number(r.Other) || 0);
            map.set(code, total);
        });
        return map;
    }, [salesRecords]);

    /** Cột FinalStoreType sheet DOANH_SO — hiện PS Q2 trên thẻ khi có giá trị */
    const psQ2FinalStoreTypeByCode = useMemo(() => {
        const map = new Map<string, string>();
        salesRecords.forEach((r) => {
            const code = String(r.CustomerCode ?? '').trim();
            const raw = String(r.FinalStoreType ?? '').trim();
            if (!code || !raw) return;
            map.set(code, raw);
        });
        return map;
    }, [salesRecords]);

    // Map CustomerCode -> Tổng phí REBATE (Giga) theo LOCAL / IMPORT / ALL
    const rebateFeeByCode = useMemo(() => {
        const map = new Map<string, { local: number; import: number; all: number }>();
        rebates.forEach((item) => {
            const code = String(item.code ?? '').trim();
            if (!code) return;

            if (!map.has(code)) {
                map.set(code, { local: 0, import: 0, all: 0 });
            }

            const group = String(item.Group ?? '').toUpperCase().trim();
            const amount = Number(item.RemainAmount) || 0;
            const cur = map.get(code)!;

            if (group === 'LOCAL') {
                cur.local += amount;
            } else if (group === 'IMPORT') {
                cur.import += amount;
            } else if (group === 'ALL') {
                cur.all += amount;
            }
        });
        return map;
    }, [rebates]);
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

    const myCustomers = useMemo(() => {
        return uniqueMarketingData.filter(r => {
            const codeMatch = String(r.StaffCode ?? '').trim() === currentEmployee.code;
            const repMatch = String(r.Rep ?? '').toLowerCase().trim() === currentEmployee.name.toLowerCase().trim();
            if (currentEmployee.code === '20043741') return true;
            return codeMatch || repMatch;
        });
    }, [uniqueMarketingData, currentEmployee.code, currentEmployee.name]);

    const filteredCustomers = useMemo(() => {
        const normalizedSearch = removeVietnameseTones(searchTerm).toLowerCase();
        return myCustomers
            .filter(c => {
                const normalizedName = removeVietnameseTones(String(c.CustomerName ?? '')).toLowerCase();
                const normalizedAddress = removeVietnameseTones(String(c.District ?? '')).toLowerCase();
                const normalizedRep = removeVietnameseTones(String(c.Rep ?? '')).toLowerCase();

                const matchesSearch = normalizedName.includes(normalizedSearch) ||
                    String(c.CustomerCode).includes(normalizedSearch) ||
                    normalizedAddress.includes(normalizedSearch) ||
                    normalizedRep.includes(normalizedSearch);

                if (!matchesSearch) return false;

                if (selectedRepFilter) {
                    const repName = String(c.Rep ?? '').trim() || 'Chưa phân công';
                    if (repName !== selectedRepFilter) return false;
                }

                const up1 = String(c.UpHinh ?? '').trim();
                const up2 = String(c.UpHinh2 ?? '').trim();
                const hasImage = (up1 !== '' && up1 !== 'NO') || (up2 !== '' && up2 !== 'NO');

                if (imageFilterMode === 'HAS_IMAGE' && !hasImage) return false;
                if (imageFilterMode === 'NO_IMAGE' && hasImage) return false;
                if (imageFilterMode === 'PACKAGE_NO_IMAGE') {
                    const hasPackage = c.GoiLocal === 'YES' || c.GoiImport === 'YES';
                    if (!hasPackage || hasImage) return false;
                }

                return true;
            })
            .sort((a, b) => {
                const saleA = salesByCode.get(String(a.CustomerCode || '').trim()) ?? 0;
                const saleB = salesByCode.get(String(b.CustomerCode || '').trim()) ?? 0;
                return saleB - saleA;
            });
    }, [myCustomers, searchTerm, selectedRepFilter, imageFilterMode, salesByCode]);

    type CustomerStage = DummyBoxKanbanStage;

    const customerBoard = useMemo(() => {
        const columns: Record<CustomerStage, MarketingRecord[]> = {
            TODO: [],
            PROCESSING_1: [],
            PROCESSING_2: [],
            COMPLETE: [],
        };

        filteredCustomers.forEach((customer) => {
            columns[getDummyBoxKanbanStage(customer)].push(customer);
        });

        return columns;
    }, [filteredCustomers]);

    /** Thống kê SL KH (Todo + PROCESSING_1) theo Rep — tab Bs T3+T4+T5 */
    const repTodoProcessingStats = useMemo(() => {
        const bucket = new Map<string, { todo: number; processing1: number }>();
        uniqueMarketingData.forEach((record) => {
            const stage = getDummyBoxKanbanStage(record);
            if (stage !== 'TODO' && stage !== 'PROCESSING_1') return;
            const rep = String(record.Rep ?? '').trim() || 'Chưa phân công';
            if (!bucket.has(rep)) bucket.set(rep, { todo: 0, processing1: 0 });
            const row = bucket.get(rep)!;
            if (stage === 'TODO') row.todo += 1;
            else row.processing1 += 1;
        });
        return Array.from(bucket.entries())
            .map(([rep, v]) => ({
                rep,
                todo: v.todo,
                processing1: v.processing1,
                sum: v.todo + v.processing1,
            }))
            .sort((a, b) => b.sum - a.sum || a.rep.localeCompare(b.rep, 'vi'));
    }, [uniqueMarketingData]);

    const repTodoProcessingTotals = useMemo(
        () =>
            repTodoProcessingStats.reduce(
                (acc, r) => ({
                    todo: acc.todo + r.todo,
                    processing1: acc.processing1 + r.processing1,
                }),
                { todo: 0, processing1: 0 }
            ),
        [repTodoProcessingStats]
    );

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
                customerSummary = generateCustomerSummary(record);
            }

            const response = await submitMarketingData(GOOGLE_SCRIPT_URL, {
                action: 'uploadImage',
                sheetName,
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

                const codeTrim = String(selectedCustomer.CustomerCode).trim();
                if (mirrorPeerSheetName && mirrorPeerHasCustomer?.(codeTrim)) {
                    const peerRes = await submitMarketingData(GOOGLE_SCRIPT_URL, {
                        action: 'setImageUrl',
                        sheetName: mirrorPeerSheetName,
                        customerCode: codeTrim,
                        targetColumn,
                        imageUrl: response.url,
                        ...(uploadNote.trim() ? { note: uploadNote.trim() } : {}),
                    });
                    if (peerRes.status !== 'success') {
                        console.warn('Đồng bộ ảnh sang sheet đối tác thất bại:', peerRes.message);
                    }
                    onPeerMirrorRecordUpdate?.(codeTrim, updates);
                }

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
            await registerDummyBoxPackage(
                selectedCustomer.CustomerCode,
                sheetName as 'DummyBoxRecord' | 'DummyBoxRecordBs',
                type,
                statusValue as 'YES' | 'NO'
            );
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
                <div className={`p-3 text-white flex justify-between items-center ${slot === 1 ? 'bg-opella-green' : 'bg-opella-green/90'}`}>
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
                                    <a href={displayUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-opella-green dark:text-opella-green rounded text-xs font-bold border border-slate-200 dark:border-slate-600 transition-colors">
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
                                    <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-400 group-hover:text-opella-green transition-colors">
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
                                            className="w-full pl-10 pr-3 py-2 text-[11px] border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-opella-green outline-none resize-none"
                                        />
                                    </div>

                                    <button
                                        onClick={handleUploadImage}
                                        disabled={isUploading}
                                        className={`w-full text-white font-black py-3 rounded-lg shadow-lg flex justify-center items-center gap-2 text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 ${slot === 1 ? 'bg-opella-green hover:bg-opella-green/90' : 'bg-opella-green/90 hover:bg-opella-green/80'}`}
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
                <div className="bg-white dark:bg-slate-800 w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                                <ChartBarIcon />
                                <span>Báo Cáo Tiến Độ DummyBox</span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                                Ngày hệ thống: <span className="text-opella-green dark:text-opella-green">{currentDate}</span>
                            </p>
                            <p className="text-[10px] text-slate-400 italic mt-1">(Click vào tên Rep để lọc danh sách)</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Target 1: <span className="font-bold text-indigo-600 dark:text-indigo-400">{DUMMYBOX_TARGET_1}</span>
                                {' '}KH/Rep · Target 2:{' '}
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{DUMMYBOX_TARGET_2}</span>
                                {' '}KH/Rep (theo KH đã mua gói)
                            </p>
                        </div>
                        <button
                            onClick={() => setShowReport(false)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Ô tổng phía trên (tương tự Thống kê Forecast) */}
                    <div className="px-5 pb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                            <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-200 dark:border-slate-600">
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng KH</p>
                                <p className="text-2xl font-black text-slate-700 dark:text-slate-200">{reportTotalStats.total}</p>
                            </div>
                            <div className="bg-opella-beige/50 dark:bg-opella-green/20 p-3 rounded-xl border border-opella-green/30 dark:border-opella-green/50">
                                <p className="text-[10px] font-bold text-opella-green dark:text-opella-green uppercase">Đã có ảnh</p>
                                <p className="text-2xl font-black text-opella-green dark:text-opella-green">{reportTotalStats.upHinh}</p>
                            </div>
                            <div className="bg-violet-50 dark:bg-violet-950/40 p-3 rounded-xl border border-violet-200 dark:border-violet-800">
                                <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase" title="KH đã mua ít nhất 1 gói (1 hoặc 2 gói đều tính 1 KH)">KH ĐÃ MUA</p>
                                <p className="text-2xl font-black text-violet-700 dark:text-violet-300">{reportTotalStats.dangKyGoi}</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-800">
                                <p className="text-[10px] font-bold text-green-500 dark:text-green-400 uppercase">Gói Local</p>
                                <p className="text-2xl font-black text-green-700 dark:text-green-300">{reportTotalStats.local}</p>
                            </div>
                            <div className="bg-opella-beige/50 dark:bg-opella-green/20 p-3 rounded-xl border border-opella-green/30 dark:border-opella-green/50">
                                <p className="text-[10px] font-bold text-opella-green dark:text-opella-green uppercase">Gói Import</p>
                                <p className="text-2xl font-black text-opella-green dark:text-opella-green">{reportTotalStats.import}</p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-auto p-0">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3">Rep Phụ Trách</th>
                                    <th className="px-4 py-3 text-center">Tổng KH</th>
                                    <th className="px-4 py-3 text-center text-opella-green dark:text-opella-green">Ảnh</th>
                                    <th className="px-4 py-3 text-center text-violet-600 dark:text-violet-400" title="Số KH đã mua ít nhất 1 gói (Local và/hoặc Import; 2 gói vẫn tính 1 KH)">
                                        KH ĐÃ MUA
                                    </th>
                                    <th
                                        className="px-4 py-3 text-center text-indigo-600 dark:text-indigo-400 leading-tight"
                                        title={`Mục tiêu 1 — ${DUMMYBOX_TARGET_1} KH/Rep đã mua gói`}
                                    >
                                        <span className="block">Target 1</span>
                                        <span className="block text-[9px] font-semibold normal-case opacity-90">({DUMMYBOX_TARGET_1} KH)</span>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-center text-orange-600 dark:text-orange-400"
                                        title={`Số KH còn thiếu so với Target 1 (${DUMMYBOX_TARGET_1})`}
                                    >
                                        TODO T1
                                    </th>
                                    <th
                                        className="px-4 py-3 text-center text-indigo-600 dark:text-indigo-400 leading-tight"
                                        title={`Mục tiêu 2 — ${DUMMYBOX_TARGET_2} KH/Rep đã mua gói`}
                                    >
                                        <span className="block">Target 2</span>
                                        <span className="block text-[9px] font-semibold normal-case opacity-90">({DUMMYBOX_TARGET_2} KH)</span>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-center text-orange-600 dark:text-orange-400"
                                        title={`Số KH còn thiếu so với Target 2 (${DUMMYBOX_TARGET_2})`}
                                    >
                                        TODO T2
                                    </th>
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
                                        className="hover:bg-opella-beige/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                                        title="Click để lọc theo Rep này"
                                    >
                                        <td className="px-4 py-3 font-bold group-hover:text-opella-green transition-colors">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span>{row.rep}</span>
                                                {row.rep === topRepByHinh && (
                                                    <>
                                                        <span className="text-yellow-500 dark:text-yellow-400 shrink-0 inline-flex" title="Top 1 Ảnh">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                        </span>
                                                        <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">Top 1 Ảnh</span>
                                                    </>
                                                )}
                                                {row.rep === topRepByOrder && (
                                                    <>
                                                        <span className="text-amber-500 dark:text-amber-400 shrink-0 inline-flex" title="Top 1 Đơn hàng">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                        </span>
                                                        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">Top 1 Đơn hàng</span>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold bg-slate-50 dark:bg-slate-800/50">{row.total}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${row.upHinh > 0 ? 'bg-opella-beige/50 text-opella-green dark:bg-opella-green/20 dark:text-opella-green' : 'text-slate-400'}`}>
                                                {row.upHinh} <span className="font-normal text-[10px] opacity-70">({Math.round(row.upHinh / row.total * 100)}%)</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${row.dangKyGoi > 0 ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300' : 'text-slate-400'}`}>
                                                {row.dangKyGoi} <span className="font-normal text-[10px] opacity-70">({Math.round(row.dangKyGoi / row.total * 100)}%)</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20">
                                            {DUMMYBOX_TARGET_1}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span
                                                className={`px-2 py-1 rounded text-xs font-black tabular-nums ${
                                                    row.todoTarget1 === 0
                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                        : 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
                                                }`}
                                            >
                                                {row.todoTarget1 === 0 ? 'ĐẠT' : row.todoTarget1}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20">
                                            {DUMMYBOX_TARGET_2}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span
                                                className={`px-2 py-1 rounded text-xs font-black tabular-nums ${
                                                    row.todoTarget2 === 0
                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                        : 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
                                                }`}
                                            >
                                                {row.todoTarget2 === 0 ? 'ĐẠT' : row.todoTarget2}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${row.local > 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'text-slate-400'}`}>
                                                {row.local} <span className="font-normal text-[10px] opacity-70">({Math.round(row.local / row.total * 100)}%)</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${row.import > 0 ? 'bg-opella-beige/50 text-opella-green dark:bg-opella-green/20 dark:text-opella-green' : 'text-slate-400'}`}>
                                                {row.import} <span className="font-normal text-[10px] opacity-70">({Math.round(row.import / row.total * 100)}%)</span>
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {reportData.length === 0 && (
                                    <tr><td colSpan={10} className="text-center py-6 text-slate-400 italic">Chưa có dữ liệu</td></tr>
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

    // Modal điều kiện đặt hàng DummyBox Local & Import (CTKM OPELLA 3/2026)
    const renderConditionsModal = () => {
        if (!showConditionsModal) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                            <DocumentTextIcon />
                            Điều kiện đặt hàng DummyBox
                        </h2>
                        <button onClick={() => setShowConditionsModal(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors">✕</button>
                    </div>
                    <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
                        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                            <h3 className="text-sm font-black text-green-800 dark:text-green-300 uppercase mb-2">DummyBox Local (-150k)</h3>
                            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                                <li>Doanh số sau chiết khấu ≥ 1.000.000 VND (tổng basePrice × số lượng × (1 − % CK) của nhóm SP bên dưới).</li>
                                <li>Sản phẩm tính điều kiện: <strong>Corbiere Calcium Plus</strong>, <strong>Telfast HD</strong>, <strong>Telfast BD</strong>, <strong>Calcium Corbiere Extra 5ml</strong>.</li>
                                <li>Quà: giảm 150.000 VND trực tiếp trên đơn.</li>
                            </ul>
                        </div>
                        <div className="p-4 rounded-xl bg-opella-beige/50 dark:bg-opella-green/20 border border-opella-green/30 dark:border-opella-green/50">
                            <h3 className="text-sm font-black text-opella-green dark:text-opella-green uppercase mb-2">DummyBox Import (-150k)</h3>
                            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                                <li>Doanh số sau chiết khấu ≥ 1.000.000 VND (tổng basePrice × số lượng × (1 − % CK); riêng Pharmaton Energy dùng giá gốc, không áp CK 29.5%).</li>
                                <li>Sản phẩm tính điều kiện: <strong>Pharmaton Energy</strong>, <strong>Essent</strong>, <strong>Vitality</strong>, <strong>Pharmaton Energy Fizzi</strong>, <strong>Enterogermina</strong> (GUT 2B, 4B, 2B/20).</li>
                                <li>Quà: giảm 150.000 VND trực tiếp trên đơn.</li>
                            </ul>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 rounded-b-2xl text-right">
                        <button onClick={() => setShowConditionsModal(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow transition-colors">Đóng</button>
                    </div>
                </div>
            </div>
        );
    };

    /** Modal thống kê Todo / PROCESSING_1 theo Rep — chỉ dùng tab DummyBoxRecordBs */
    const renderRepTodoProcessingModal = () => {
        if (!showRepTodoProcessingModal) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
                        <div>
                            <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                                <ChartBarIcon />
                                <span>SL KH Todo &amp; PROCESSING_1 — theo Rep</span>
                            </h2>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1 leading-snug">
                                Đếm số khách (toàn sheet) đang ở cột <span className="text-red-600 dark:text-red-400">TODO</span> hoặc{' '}
                                <span className="text-blue-600 dark:text-blue-400">PROCESSING_1</span> trên Kanban (logic giống bảng chính).
                            </p>
                            <p className="text-[10px] text-slate-400 italic mt-1">Click vào Rep để lọc danh sách.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowRepTodoProcessingModal(false)}
                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="px-5 pb-4 pt-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-100 dark:border-red-900/50">
                                <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">TODO</p>
                                <p className="text-2xl font-black text-red-700 dark:text-red-300">{repTodoProcessingTotals.todo}</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50">
                                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">PROCESSING_1</p>
                                <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{repTodoProcessingTotals.processing1}</p>
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-200 dark:border-slate-600">
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng (Todo + P1)</p>
                                <p className="text-2xl font-black text-slate-700 dark:text-slate-200">
                                    {repTodoProcessingTotals.todo + repTodoProcessingTotals.processing1}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-auto px-0 pb-0 flex-1 min-h-0">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3">Rep phụ trách</th>
                                    <th className="px-4 py-3 text-center text-red-600 dark:text-red-400">SL KH Todo</th>
                                    <th className="px-4 py-3 text-center text-blue-600 dark:text-blue-400">SL KH PROCESSING_1</th>
                                    <th className="px-4 py-3 text-center">Tổng</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                                {repTodoProcessingStats.map((row) => (
                                    <tr
                                        key={row.rep}
                                        onClick={() => {
                                            setSelectedRepFilter(row.rep);
                                            setShowRepTodoProcessingModal(false);
                                        }}
                                        className="hover:bg-opella-beige/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                                        title="Lọc danh sách theo Rep"
                                    >
                                        <td className="px-4 py-3 font-bold">{row.rep}</td>
                                        <td className="px-4 py-3 text-center font-bold text-red-700 dark:text-red-300">{row.todo}</td>
                                        <td className="px-4 py-3 text-center font-bold text-blue-700 dark:text-blue-300">{row.processing1}</td>
                                        <td className="px-4 py-3 text-center font-black bg-slate-50 dark:bg-slate-800/50">{row.sum}</td>
                                    </tr>
                                ))}
                                {repTodoProcessingStats.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-slate-400 italic">
                                            Không có KH nào đang Todo hoặc PROCESSING_1
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 rounded-b-2xl flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setShowRepTodoProcessingModal(false)}
                            className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg shadow transition-colors"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        );
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

            {enableReportTools && renderReportModal()}
            {sheetName === 'DummyBoxRecordBs' && renderRepTodoProcessingModal()}
            {enableReportTools && renderConditionsModal()}
            {enableReportTools && showCalculatorModal && <DummyBoxCalculator onClose={() => setShowCalculatorModal(false)} />}

            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-lg mb-6 border border-slate-200 dark:border-slate-700">
                {/* Mobile: stack dọc; Desktop: hàng ngang */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2 text-opella-green dark:text-opella-green font-black uppercase text-sm tracking-tight">
                        <div className="p-2 bg-opella-beige/50 dark:bg-opella-green/20 rounded-lg">
                            <UserGroupIcon />
                        </div>
                        <span>Danh mục khách hàng ({filteredCustomers.length})</span>
                        <button
                            type="button"
                            onClick={() => void handleReloadDummyList()}
                            disabled={isReloadingList}
                            className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide border border-opella-green/40 bg-opella-beige/60 hover:bg-opella-beige text-opella-green dark:bg-opella-green/20 dark:hover:bg-opella-green/30 dark:border-opella-green/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Ép tải lại danh sách DummyBox từ Google Sheet"
                        >
                            <span className={isReloadingList ? 'inline-block animate-spin' : 'inline-block'}>
                                <ArrowsRotateIcon />
                            </span>
                            <span>{isReloadingList ? 'Đang tải…' : 'Làm mới'}</span>
                        </button>
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

                    {/* Hàng 2 (mobile) / Cùng hàng (desktop): Lọc + Nút chức năng */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        {/* Lọc: full width trên mobile */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="flex-shrink-0"><FunnelIcon /></div>
                            <select
                                value={imageFilterMode}
                                onChange={(e) => setImageFilterMode(e.target.value as typeof imageFilterMode)}
                                className="flex-1 sm:flex-none min-w-0 px-3 py-2.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-opella-green outline-none cursor-pointer"
                            >
                                <option value="ALL">Tất cả</option>
                                <option value="HAS_IMAGE">Đã có ảnh</option>
                                <option value="NO_IMAGE">Chưa có ảnh</option>
                                <option value="PACKAGE_NO_IMAGE">Có gói chưa ảnh</option>
                            </select>
                        </div>

                        {/* Nút thống kê Todo/P1 — luôn hiện tab Bs (DummyBoxRecordBs), không phụ thuộc enableReportTools */}
                        {sheetName === 'DummyBoxRecordBs' && (
                            <button
                                type="button"
                                onClick={() => setShowRepTodoProcessingModal(true)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 rounded-lg text-xs font-bold transition-all border border-indigo-200 dark:border-indigo-800 shrink-0"
                                title="Thống kê số khách Todo và PROCESSING_1 theo Rep"
                            >
                                <ChartBarIcon />
                                <span className="hidden sm:inline">Todo / P1 theo Rep</span>
                                <span className="sm:hidden">Todo·P1</span>
                            </button>
                        )}

                        {/* Nút chức năng: grid 2 cột mobile, hàng ngang desktop */}
                        {enableReportTools && (
                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                                <button
                                    onClick={() => setShowReport(true)}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-opella-beige/50 hover:bg-opella-beige dark:bg-opella-green/20 dark:hover:bg-opella-green/30 text-opella-green dark:text-opella-green rounded-lg text-xs font-bold transition-all border border-opella-green/30 dark:border-opella-green/50"
                                >
                                    <ChartBarIcon />
                                    <span>Báo Cáo</span>
                                </button>
                                <button
                                    onClick={() => setShowConditionsModal(true)}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold transition-all border border-amber-200 dark:border-amber-800"
                                    title="Xem điều kiện đặt hàng DummyBox Local & Import"
                                >
                                    <DocumentTextIcon />
                                    <span>Điều kiện</span>
                                </button>
                                <button
                                    onClick={() => setShowCalculatorModal(true)}
                                    className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg text-xs font-bold transition-all border border-green-200 dark:border-green-800"
                                    title="Tính toán gói DummyBox Local & Import"
                                >
                                    <ChartBarIcon />
                                    <span>Tính DummyBox</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {!selectedCustomer ? (
                    <div className="relative animate-fade-in">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><SearchIcon /></div>
                                <input
                                    type="text"
                                    placeholder="Tìm tên KH, mã KH, quận..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 p-3 text-sm border border-slate-300 dark:border-slate-600 rounded-xl dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-opella-green outline-none transition-all"
                                />
                            </div>
                            <div className="flex shrink-0 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-50 dark:bg-slate-900/40">
                                <button
                                    type="button"
                                    onClick={() => setCustomerViewMode('board')}
                                    className={`px-3 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
                                        customerViewMode === 'board'
                                            ? 'bg-opella-green text-white'
                                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                    title="Dạng cột Kanban"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M9 4v16M9 4h6M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M15 4v16" />
                                    </svg>
                                    <span className="hidden sm:inline">Cột</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCustomerViewMode('list')}
                                    className={`px-3 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-600 ${
                                        customerViewMode === 'list'
                                            ? 'bg-opella-green text-white'
                                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                    title="Dạng dòng — P1 / P2 / COMPLETE"
                                >
                                    <ClipboardDocumentListIcon />
                                    <span className="hidden sm:inline">Dòng</span>
                                </button>
                            </div>
                        </div>
                        <div className={`mt-1 ${customerViewMode === 'board' ? 'max-h-[58vh] overflow-x-auto overflow-y-hidden pb-1' : ''}`}>
                            {filteredCustomers.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 italic text-sm border-t border-slate-100 dark:border-slate-700">
                                    Không tìm thấy khách hàng phù hợp
                                </div>
                            ) : customerViewMode === 'list' ? (
                                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col max-h-[58vh]">
                                    <div className="shrink-0 px-3 py-2 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold">
                                        <span className="text-blue-600 dark:text-blue-400">
                                            <span className="font-black">P1</span> = PROCESSING_1 · Ảnh YES, Gói NO
                                        </span>
                                        <span className="text-amber-600 dark:text-amber-400">
                                            <span className="font-black">P2</span> = PROCESSING_2 · Ảnh NO, Gói YES
                                        </span>
                                        <span className="text-green-600 dark:text-green-400">
                                            <span className="font-black">COMPLETE</span> · Ảnh YES, Gói YES
                                        </span>
                                    </div>
                                    <div className="overflow-auto flex-1 min-h-0">
                                        <table className="w-full text-left border-collapse min-w-[640px]">
                                            <thead className="sticky top-0 z-10 shadow-sm">
                                                <tr className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                    <th className="px-3 py-2.5 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">Khách hàng</th>
                                                    <th className="px-2 py-2.5 text-center w-[88px] bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400" title="PROCESSING_1: Ảnh YES, Gói NO">
                                                        <div>P1</div>
                                                        <div className="normal-case font-semibold tracking-normal text-[9px] opacity-80 mt-0.5 leading-tight">Ảnh✓ Gói✗</div>
                                                    </th>
                                                    <th className="px-2 py-2.5 text-center w-[88px] bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-amber-600 dark:text-amber-400" title="PROCESSING_2: Ảnh NO, Gói YES">
                                                        <div>P2</div>
                                                        <div className="normal-case font-semibold tracking-normal text-[9px] opacity-80 mt-0.5 leading-tight">Ảnh✗ Gói✓</div>
                                                    </th>
                                                    <th className="px-2 py-2.5 text-center w-[96px] bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-green-600 dark:text-green-400" title="COMPLETE: Ảnh YES, Gói YES">
                                                        <div>COMPLETE</div>
                                                        <div className="normal-case font-semibold tracking-normal text-[9px] opacity-80 mt-0.5 leading-tight">Ảnh✓ Gói✓</div>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredCustomers.map((c) => {
                                                    const stage = getDummyBoxKanbanStage(c);
                                                    const sale = salesByCode.get(String(c.CustomerCode || '').trim()) ?? 0;
                                                    const rebateFee = rebateFeeByCode.get(String(c.CustomerCode ?? '').trim());
                                                    const localFee = rebateFee?.local ?? 0;
                                                const importFee = rebateFee?.import ?? 0;
                                                const allFee = rebateFee?.all ?? 0;
                                                const hasAnyRebateFee = localFee > 0 || importFee > 0 || allFee > 0;
                                                return (
                                                    <tr
                                                        key={c.CustomerCode}
                                                        onClick={() => setSelectedCustomer(c)}
                                                        className="border-b border-slate-100 dark:border-slate-700/80 hover:bg-opella-beige/40 dark:hover:bg-opella-green/10 cursor-pointer transition-colors group"
                                                    >
                                                        <td className="px-3 py-2.5 min-w-0">
                                                            <p className="text-[10px] text-slate-400 font-mono">#{c.CustomerCode}</p>
                                                            <p className="font-bold text-sm text-slate-800 dark:text-white group-hover:text-opella-green line-clamp-1">
                                                                {c.CustomerName}
                                                            </p>
                                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                                                    {c.District || '—'}
                                                                </span>
                                                                <span className="text-[11px] font-black text-red-600 dark:text-red-400">
                                                                    {formatCurrency(sale)}
                                                                </span>
                                                                {currentEmployee.code === '20043741' && c.Rep && (
                                                                    <span className="text-[9px] text-slate-400">Rep: {c.Rep}</span>
                                                                )}
                                                            </div>
                                                            {hasAnyRebateFee && (
                                                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                                                                    {localFee > 0 && (
                                                                        <span className="font-bold text-green-700 dark:text-green-300">
                                                                            Phí LOCAL còn lại: {formatCurrency(localFee)}
                                                                        </span>
                                                                    )}
                                                                    {importFee > 0 && (
                                                                        <span className="font-bold text-blue-700 dark:text-blue-300">
                                                                            Phí IMPORT còn lại: {formatCurrency(importFee)}
                                                                        </span>
                                                                    )}
                                                                    {allFee > 0 && (
                                                                        <span className="font-bold text-violet-700 dark:text-violet-300">
                                                                            Phí ALL còn lại: {formatCurrency(allFee)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                            {STAGE_CHECK_COLS.map((col) => {
                                                                const checked =
                                                                    col.key === 'COMPLETE'
                                                                        ? stage === 'COMPLETE'
                                                                        : col.key === 'PROCESSING_1'
                                                                          ? stage === 'PROCESSING_1' || stage === 'COMPLETE'
                                                                          : stage === 'PROCESSING_2' || stage === 'COMPLETE';
                                                                return (
                                                                    <td key={col.key} className="px-2 py-2.5 text-center align-middle">
                                                                        <span
                                                                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-black transition-all ${
                                                                                checked
                                                                                    ? col.activeClass
                                                                                    : 'bg-slate-50 text-slate-300 border-slate-100 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700'
                                                                            }`}
                                                                            title={checked ? col.key : `Chưa ${col.key}`}
                                                                            aria-label={`${col.key}: ${checked ? 'yes' : 'no'}`}
                                                                        >
                                                                            {checked ? '✓' : '·'}
                                                                        </span>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-4 min-w-max pr-2">
                                    {([
                                        {
                                            key: 'TODO' as const,
                                            title: 'TODO',
                                            hint: 'Ảnh - NO, Gói - NO',
                                            titleClass: 'text-red-700 dark:text-red-300',
                                            hintClass: 'text-red-500/80 dark:text-red-300/80',
                                            badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                                            borderClass: 'border-l-red-500'
                                        },
                                        {
                                            key: 'PROCESSING_1' as const,
                                            title: 'PROCESSING_1',
                                            hint: 'Ảnh - YES, Gói - NO',
                                            titleClass: 'text-blue-700 dark:text-blue-300',
                                            hintClass: 'text-blue-500/80 dark:text-blue-300/80',
                                            badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                                            borderClass: 'border-l-blue-500'
                                        },
                                        {
                                            key: 'PROCESSING_2' as const,
                                            title: 'PROCESSING_2',
                                            hint: 'Ảnh - NO, Gói - YES',
                                            titleClass: 'text-amber-700 dark:text-amber-300',
                                            hintClass: 'text-amber-600/80 dark:text-amber-300/80',
                                            badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                                            borderClass: 'border-l-amber-500'
                                        },
                                        {
                                            key: 'COMPLETE' as const,
                                            title: 'COMPLETE',
                                            hint: 'Ảnh - YES, Gói - YES',
                                            titleClass: 'text-green-700 dark:text-green-300',
                                            hintClass: 'text-green-600/80 dark:text-green-300/80',
                                            badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
                                            borderClass: 'border-l-green-600'
                                        },
                                    ]).map((column) => (
                                        <div key={column.key} className="w-[290px] min-w-[290px]">
                                            <div className="px-1 mb-2">
                                                <div className="flex items-center justify-between">
                                                    <h4 className={`text-sm font-black tracking-wide uppercase flex items-center gap-2 ${column.titleClass}`}>
                                                        <span>{column.title}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs ${column.badgeClass}`}>
                                                            {customerBoard[column.key].length}
                                                        </span>
                                                    </h4>
                                                </div>
                                                <p className={`mt-1 text-xs font-semibold uppercase tracking-tight ${column.hintClass}`}>{column.hint}</p>
                                            </div>

                                            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                                                {customerBoard[column.key].map((c) => {
                                                    const hasImage = (c.UpHinh && c.UpHinh !== 'NO' && c.UpHinh !== '') || (c.UpHinh2 && c.UpHinh2 !== 'NO' && c.UpHinh2 !== '');
                                                    const hasLocal = c.GoiLocal === 'YES';
                                                    const hasImport = c.GoiImport === 'YES';
                                                    const rebateFee = rebateFeeByCode.get(String(c.CustomerCode ?? '').trim());
                                                    const localFee = rebateFee?.local ?? 0;
                                                    const importFee = rebateFee?.import ?? 0;
                                                    const allFee = rebateFee?.all ?? 0;
                                                    const hasAnyRebateFee = localFee > 0 || importFee > 0 || allFee > 0;
                                                    const psQ2FinalStoreType = psQ2FinalStoreTypeByCode.get(String(c.CustomerCode ?? '').trim());

                                                    return (
                                                        <div
                                                            key={c.CustomerCode}
                                                            onClick={() => setSelectedCustomer(c)}
                                                            className={`bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 border-l-4 ${column.borderClass} shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group`}
                                                        >
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mb-1">
                                                                #{c.CustomerCode}
                                                            </p>
                                                            <h5 className="font-black text-[15px] text-slate-800 dark:text-white leading-snug group-hover:text-opella-green dark:group-hover:text-opella-green transition-colors line-clamp-2">
                                                                {c.CustomerName}
                                                            </h5>
                                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                                                {c.District || 'Chưa có quận/huyện'}
                                                            </p>
                                                            {hasAnyRebateFee && (
                                                                <div className="mt-2 space-y-1 text-[11px]">
                                                                    {localFee > 0 && (
                                                                        <p className="font-bold text-green-700 dark:text-green-300 leading-tight">
                                                                            Tổng phí LOCAL (Giga): {formatCurrency(localFee)}
                                                                        </p>
                                                                    )}
                                                                    {importFee > 0 && (
                                                                        <p className="font-bold text-blue-700 dark:text-blue-300 leading-tight">
                                                                            Tổng phí IMPORT (Giga): {formatCurrency(importFee)}
                                                                        </p>
                                                                    )}
                                                                    {allFee > 0 && (
                                                                        <p className="font-bold text-violet-700 dark:text-violet-300 leading-tight">
                                                                            Tổng phí ALL (Giga): {formatCurrency(allFee)}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                                                                <span className="text-xs font-black text-red-600 dark:text-red-400">
                                                                    {formatCurrency(salesByCode.get(String(c.CustomerCode || '').trim()) ?? 0)}
                                                                </span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${hasImage ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' : 'bg-slate-100 text-slate-300 dark:bg-slate-700 dark:text-slate-600'}`}>
                                                                        <div className="scale-75"><CameraIcon /></div>
                                                                    </div>
                                                                    <div className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black border transition-all ${hasLocal ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800' : 'bg-slate-50 text-slate-300 border-slate-100 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700'}`}>L</div>
                                                                    <div className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black border transition-all ${hasImport ? 'bg-opella-beige/50 text-opella-green border-opella-green/30 dark:bg-opella-green/20 dark:text-opella-green dark:border-opella-green/50' : 'bg-slate-50 text-slate-300 border-slate-100 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700'}`}>I</div>
                                                                </div>
                                                            </div>
                                                            {psQ2FinalStoreType && (
                                                                <div className="mt-2">
                                                                    <span className="text-[9px] bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800 font-bold">
                                                                        PS Q2: {psQ2FinalStoreType}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {currentEmployee.code === '20043741' && c.Rep && (
                                                                <div className="mt-2">
                                                                    <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                                                        Rep: {c.Rep}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {customerBoard[column.key].length === 0 && (
                                                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-4 text-center text-[11px] text-slate-400 italic">
                                                        Không có khách hàng
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between items-center bg-opella-beige/50 dark:bg-opella-green/20 p-4 rounded-xl border border-opella-green/20 dark:border-opella-green/40 animate-slide-up">
                        <div className="min-w-0 flex-1">
                            <p className="font-black text-opella-green dark:text-opella-green truncate text-base">{selectedCustomer.CustomerName}</p>
                            <p className="text-xs text-opella-green dark:text-opella-green font-mono mt-0.5">{selectedCustomer.CustomerCode}</p>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                            <button
                                onClick={() => onCustomerSelect(selectedCustomer.CustomerCode)}
                                className="px-4 py-2 bg-opella-green hover:bg-opella-green/90 text-white text-xs font-bold rounded-lg shadow-md transition-all uppercase flex items-center gap-2 active:scale-95"
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

                        <div className={`rounded-2xl border-2 shadow-sm p-5 flex flex-col justify-between transition-all duration-300 ${isImportDone ? 'bg-opella-beige/50 border-opella-green/30 dark:bg-opella-green/20 dark:border-opella-green/50' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                            <div className="text-center mb-4">
                                <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${isImportDone ? 'bg-opella-beige/50 text-opella-green dark:bg-opella-green/20 dark:text-opella-green' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'}`}>
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
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-opella-green"></div>
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

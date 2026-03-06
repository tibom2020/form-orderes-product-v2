
import React, { useState } from 'react';
import type { Order } from '../types';
import { formatCurrency } from '../utils/formatters';
import { TrashIcon, DocumentTextIcon, PaperAirplaneIcon } from './icons';

interface OrderHistoryProps {
  drafts: Order[];
  sent: Order[];
  onLoad: (id: string) => void;
  onDeleteDrafts: (ids: string[]) => void;
  onDeleteSentOrders: (ids: string[]) => void;
}

const OrderHistory: React.FC<OrderHistoryProps> = ({ drafts, sent, onLoad, onDeleteDrafts, onDeleteSentOrders }) => {
  const [activeTab, setActiveTab] = useState<'draft' | 'sent'>('draft');
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Confirmation state
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[], type: 'draft' | 'sent' } | null>(null);

  const currentList = activeTab === 'draft' ? drafts : sent;

  const isAllSelected = currentList.length > 0 && selectedIds.length === currentList.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(currentList.map(o => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleTabChange = (tab: 'draft' | 'sent') => {
    setActiveTab(tab);
    setSelectedIds([]);
  };

  const executeDelete = () => {
    if (!confirmDelete) return;
    const { ids, type } = confirmDelete;
    if (type === 'draft') {
      onDeleteDrafts(ids);
    } else {
      onDeleteSentOrders(ids);
    }
    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    setConfirmDelete(null);
  };

  const getTabClass = (tabName: 'draft' | 'sent') => {
    const baseClass = "px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors duration-200 focus:outline-none flex items-center gap-2";
    if (activeTab === tabName) {
      return `${baseClass} bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 border-l border-t border-r -mb-px text-opella-green dark:text-opella-green`;
    }
    return `${baseClass} text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700`;
  };

  const OrderRow: React.FC<{ order: Order, type: 'draft' | 'sent' }> = ({ order, type }) => (
    <div className={`p-3 border-b border-slate-200 dark:border-slate-700 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700 grid grid-cols-12 gap-2 items-center text-sm transition-colors ${selectedIds.includes(order.id) ? 'bg-opella-beige/50 dark:bg-opella-green/10' : ''}`}>
      <div className="col-span-1 flex justify-center">
        <input
          type="checkbox"
          checked={selectedIds.includes(order.id)}
          onChange={() => toggleSelect(order.id)}
          className="w-4 h-4 rounded border-slate-300 text-opella-green focus:ring-opella-green cursor-pointer"
        />
      </div>
      <div className="col-span-4">
        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{order.customerName}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{order.customerCode}</p>
      </div>
      <div className="col-span-3 text-slate-600 dark:text-slate-400 text-xs">{new Date(order.createdAt).toLocaleString('vi-VN')}</div>
      <div className="col-span-2 font-semibold text-slate-800 dark:text-slate-200 text-right">{formatCurrency(order.finalAmount)}</div>
      <div className="col-span-2 flex justify-end space-x-1">
        {type === 'draft' ? (
          <>
            <button onClick={() => onLoad(order.id)} className="bg-opella-green text-white text-[10px] font-bold py-1 px-2 rounded-md hover:bg-opella-green/90 transition-colors">Tải</button>
            <button onClick={() => setConfirmDelete({ ids: [order.id], type: 'draft' })} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"><TrashIcon /></button>
          </>
        ) : (
          <>
            <button onClick={() => setViewingOrder(order)} className="bg-slate-500 text-white text-[10px] font-bold py-1 px-2 rounded-md hover:bg-slate-600 transition-colors">Xem</button>
            <button onClick={() => setConfirmDelete({ ids: [order.id], type: 'sent' })} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"><TrashIcon /></button>
          </>
        )}
      </div>
    </div>
  );

  const OrderModal: React.FC<{ order: Order, onClose: () => void }> = ({ order, onClose }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-lg">
          <h3 className="text-lg font-bold text-slate-800 dark:white">Chi Tiết Đơn Hàng</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors text-2xl">&times;</button>
        </div>
        <div className="p-4 overflow-y-auto text-slate-800 dark:text-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-6 bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg">
            <div><span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-bold mb-1">Khách hàng:</span> <span className="font-semibold">{order.customerName} ({order.customerCode})</span></div>
            <div><span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-bold mb-1">Ngày tạo:</span> <span className="font-semibold">{new Date(order.createdAt).toLocaleString('vi-VN')}</span></div>
            {order.customerAddress && <div className="sm:col-span-2"><span className="text-slate-500 dark:text-slate-400 block text-xs uppercase font-bold mb-1">Địa chỉ:</span> <span className="italic">{order.customerAddress}</span></div>}
          </div>
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h4 className="font-bold mb-3 text-opella-green dark:text-opella-green uppercase text-xs tracking-wider">Danh sách sản phẩm ({order.items.length})</h4>
            <div className="space-y-2">
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between items-start text-sm py-2 px-3 bg-slate-50 dark:bg-slate-700/20 rounded-md border border-slate-100 dark:border-slate-700">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-slate-500">Số lượng: {item.quantity}</p>
                  </div>
                  <span className="font-bold">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2 text-sm bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Tạm tính:</span> <span>{formatCurrency(order.totalAmount)}</span></div>
            {order.isOnTopLiXi && <div className="flex justify-between text-rose-500 font-medium"><span>Đơn Ontop lì xì:</span> <span>- {formatCurrency(250000)}</span></div>}
            {order.isDummyBoxLocal && <div className="flex justify-between text-rose-500 font-medium"><span>DummyBox Local:</span> <span>- {formatCurrency(150000)}</span></div>}
            {order.isDummyBoxImport && <div className="flex justify-between text-rose-500 font-medium"><span>DummyBox Import:</span> <span>- {formatCurrency(150000)}</span></div>}
            {order.isDummyBox && !order.isDummyBoxLocal && !order.isDummyBoxImport && <div className="flex justify-between text-rose-500 font-medium"><span>DummyBox:</span> <span>- {formatCurrency(150000)}</span></div>}
            <div className="flex justify-between font-bold text-lg border-t border-slate-200 dark:border-slate-700 pt-2 mt-2 text-opella-green dark:text-opella-green"><span>Tổng thanh toán:</span> <span>{formatCurrency(order.finalAmount)}</span></div>
          </div>
          {order.note && <div className="mt-4"><h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Ghi chú:</h4><p className="text-sm whitespace-pre-wrap bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">{order.note}</p></div>}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end rounded-b-lg">
          <button onClick={onClose} className="bg-slate-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 shadow-md transition-all">Đóng</button>
        </div>
      </div>
    </div>
  );

  const ConfirmationModal = () => {
    if (!confirmDelete) return null;
    const isMultiple = confirmDelete.ids.length > 1;
    const isAll = confirmDelete.ids.length === currentList.length && currentList.length > 1;

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrashIcon />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Xác nhận xóa?</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {isAll ? "Bạn có chắc chắn muốn xóa TẤT CẢ các đơn hàng này không?" :
                isMultiple ? `Bạn có chắc chắn muốn xóa ${confirmDelete.ids.length} đơn hàng đã chọn không?` :
                  "Bạn có chắc chắn muốn xóa đơn hàng này không?"}
            </p>
            <p className="text-red-500 dark:text-red-400 text-xs mt-2 font-medium">Hành động này không thể hoàn tác.</p>
          </div>
          <div className="flex border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-4 text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-r border-slate-200 dark:border-slate-700">Hủy</button>
            <button onClick={executeDelete} className="flex-1 py-4 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Đồng ý Xóa</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
      <div className="px-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
        <nav className="-mb-px flex space-x-2 sm:space-x-6" aria-label="Tabs">
          <button onClick={() => handleTabChange('draft')} className={getTabClass('draft')}>
            <DocumentTextIcon />
            <span className="hidden xs:inline">Đơn Nháp</span> ({drafts.length})
          </button>
          <button onClick={() => handleTabChange('sent')} className={getTabClass('sent')}>
            <PaperAirplaneIcon />
            <span className="hidden xs:inline">Đơn Đã Gửi</span> ({sent.length})
          </button>
        </nav>

        <div className="py-2 flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setConfirmDelete({ ids: selectedIds, type: activeTab })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg shadow-md transition-all animate-in slide-in-from-right-4"
            >
              <TrashIcon /> Xóa đã chọn ({selectedIds.length})
            </button>
          )}
          {currentList.length > 0 && (
            <button
              onClick={() => setConfirmDelete({ ids: currentList.map(o => o.id), type: activeTab })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-all"
            >
              Xóa tất cả
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 grid grid-cols-12 gap-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            <div className="col-span-1 flex justify-center">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-slate-400 text-opella-green focus:ring-opella-green cursor-pointer"
                title="Chọn tất cả"
              />
            </div>
            <div className="col-span-4">Khách Hàng</div>
            <div className="col-span-3">Ngày Tạo</div>
            <div className="col-span-2 text-right">Tổng Tiền</div>
            <div className="col-span-2 text-right">Hành Động</div>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {activeTab === 'draft' ? (
              drafts.length > 0 ? drafts.map(d => <OrderRow key={d.id} order={d} type="draft" />) : <p className="p-12 text-center text-slate-400 italic">Không có đơn nháp nào.</p>
            ) : (
              sent.length > 0 ? sent.map(s => <OrderRow key={s.id} order={s} type="sent" />) : <p className="p-12 text-center text-slate-400 italic">Chưa có đơn hàng nào được gửi đi.</p>
            )}
          </div>
        </div>
      </div>

      {viewingOrder && <OrderModal order={viewingOrder} onClose={() => setViewingOrder(null)} />}
      <ConfirmationModal />
    </div>
  );
};

export default OrderHistory;

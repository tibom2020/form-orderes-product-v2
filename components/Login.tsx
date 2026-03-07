
import React, { useState, useEffect } from 'react';
import type { Employee } from '../types';

interface LoginProps {
  employees: Employee[];
  onLoginSuccess: (employee: Employee) => void;
}

const Login: React.FC<LoginProps> = ({ employees, onLoginSuccess }) => {
  const [code, setCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Kiểm tra mã nhân viên đã lưu khi component mount
  useEffect(() => {
    const savedCode = localStorage.getItem('rememberedEmployeeCode');
    if (savedCode) {
      setCode(savedCode);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
        const trimmedCode = code.trim();
        const foundEmployee = employees.find(emp => emp.code === trimmedCode);
        
        if (foundEmployee) {
          // Xử lý ghi nhớ mã nhân viên
          if (rememberMe) {
            localStorage.setItem('rememberedEmployeeCode', trimmedCode);
          } else {
            localStorage.removeItem('rememberedEmployeeCode');
          }
          
          onLoginSuccess(foundEmployee);
        } else {
          setError('Mã nhân viên không hợp lệ. Vui lòng thử lại.');
        }
        setIsLoading(false);
    }, 500);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-opella-beige dark:bg-slate-900 font-sans transition-colors duration-200">
      <div className="w-full max-w-sm p-8 space-y-6 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="text-center">
            <img src="https://i.postimg.cc/D0p4bsQD/logo.webp" alt="Smart Orders Pharmacy Fulfillment" className="mx-auto h-24 sm:h-28 w-auto object-contain mb-4" />
            <h1 className="text-3xl font-bold text-opella-green">Đăng Nhập</h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400">Vui lòng nhập mã nhân viên của bạn</p>
        </div>
        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="employeeCode" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Mã nhân viên
            </label>
            <div className="mt-1">
              <input
                id="employeeCode"
                name="employeeCode"
                type="text"
                autoComplete="off"
                required
                value={code}
                onChange={(e) => {
                    setCode(e.target.value);
                    setError('');
                }}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-opella-green focus:border-opella-green"
                placeholder="e.g., 20045852"
              />
            </div>
          </div>

          <div className="flex items-center">
            <div className="flex items-center h-5">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-opella-green border-slate-300 rounded focus:ring-opella-green dark:focus:ring-opella-green dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
              />
            </div>
            <label htmlFor="remember-me" className="ml-2 text-sm font-medium text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              Ghi nhớ mã nhân viên
            </label>
          </div>

          {error && (
              <p className="text-sm text-red-600 dark:text-red-400 text-center font-medium">{error}</p>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-opella-green hover:bg-opella-green/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opella-green disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-wait transition-all uppercase tracking-wide"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang kiểm tra...
                </span>
              ) : 'Đăng Nhập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;

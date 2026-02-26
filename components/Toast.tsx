
import React, { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-primary',
    info: 'bg-blue-600'
  }[type];

  return (
    <div className={`fixed bottom-4 right-4 z-[200] ${bgColor} text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-in slide-in-from-right-full duration-300`}>
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

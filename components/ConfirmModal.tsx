import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2 uppercase tracking-tight">{title}</h3>
          <p className="text-muted text-sm font-medium leading-relaxed mb-8">{message}</p>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={onClose}
              className="py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={onConfirm}
              className="py-3 px-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 transition-all"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
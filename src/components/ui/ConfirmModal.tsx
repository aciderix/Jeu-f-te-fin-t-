import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "Confirmer", 
  cancelText = "Annuler", 
  isDanger = true 
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className={`bg-indigo-950 border-2 ${isDanger ? 'border-red-500' : 'border-blue-500'} p-8 rounded-3xl max-w-md w-full shadow-2xl text-center`}>
        <h3 className="text-2xl text-white font-paytone mb-4">{title}</h3>
        <p className="text-white/90 text-lg mb-8 font-sans">
          {message}
        </p>
        <div className="flex gap-4">
          <button 
            onClick={onCancel}
            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-xl transition-colors font-sans"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`flex-1 ${isDanger ? 'bg-red-600 hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.5)]'} text-white font-bold py-3 rounded-xl transition-colors font-sans`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

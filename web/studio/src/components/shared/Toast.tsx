import React from 'react';
import { Toaster, toast } from 'react-hot-toast';

export function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast[type](message);
}

const ToastProvider: React.FC = () => <Toaster position="bottom-right" />;

export default ToastProvider;

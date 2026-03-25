import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
    full: 'max-w-[95vw] max-h-[95vh]',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`relative bg-white shadow-2xl w-full overflow-hidden rounded-t-2xl md:rounded-2xl ${size === 'full' ? 'max-h-[95vh] md:max-w-[95vw]' : `max-h-[90vh] md:max-h-[80vh] ${sizes[size]}`}`}
          >
            {title && (
              <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                {/* Mobile drag indicator */}
                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-gray-300 rounded-full md:hidden" />
                <h2 className="text-base md:text-lg font-bold text-text m-0 mt-1 md:mt-0">{title}</h2>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full hover:bg-surface flex items-center justify-center text-text-secondary hover:text-text transition-colors cursor-pointer bg-transparent border-none text-xl"
                >
                  &times;
                </button>
              </div>
            )}
            <div className="overflow-y-auto" style={{ maxHeight: title ? 'calc(90vh - 3.5rem)' : '90vh' }}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

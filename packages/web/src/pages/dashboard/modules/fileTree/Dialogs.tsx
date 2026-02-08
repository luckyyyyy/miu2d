/**
 * 对话框组件集合
 */
import { useState, useEffect, useRef } from "react";

interface DialogProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Dialog({ title, onClose, children }: DialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#252526] border border-[#454545] rounded-lg shadow-xl w-[400px] max-w-[90vw]">
        <div className="px-4 py-3 border-b border-[#454545]">
          <h3 className="text-[15px] font-medium text-white">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

interface InputDialogProps {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  validator?: (value: string) => string | null; // 返回错误信息或 null
}

export function InputDialog({
  title,
  placeholder,
  defaultValue = "",
  confirmText = "确定",
  onConfirm,
  onCancel,
  validator,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) {
      setError("名称不能为空");
      return;
    }
    if (validator) {
      const validationError = validator(normalizedValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    onConfirm(normalizedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <Dialog title={title} onClose={onCancel}>
      <div className="p-4">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.toLowerCase());
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-[#1e1e1e] border border-[#454545] rounded text-[#cccccc] text-[13px] placeholder-[#666] focus:border-[#007fd4] focus:outline-none"
        />
        {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#454545]">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-[13px] text-[#cccccc] transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-1.5 bg-[#0e639c] hover:bg-[#1177bb] rounded text-[13px] text-white transition-colors"
        >
          {confirmText}
        </button>
      </div>
    </Dialog>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmText = "确定",
  cancelText = "取消",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog title={title} onClose={onCancel}>
      <div className="p-4 text-[13px] text-[#cccccc]">{message}</div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#454545]">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded text-[13px] text-[#cccccc] transition-colors"
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-1.5 rounded text-[13px] text-white transition-colors ${
            danger
              ? "bg-red-600 hover:bg-red-700"
              : "bg-[#0e639c] hover:bg-[#1177bb]"
          }`}
        >
          {confirmText}
        </button>
      </div>
    </Dialog>
  );
}

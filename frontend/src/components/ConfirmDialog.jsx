import { useEffect, useRef } from 'react';

const tones = { red: 'bg-red-600 hover:bg-red-700', green: 'bg-green-700 hover:bg-green-800' };

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = 'red',
  disabled = false,
  children,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby="confirm-dialog-title" onClose={() => open && onCancel()} className="m-auto w-full max-w-sm rounded-lg p-6 backdrop:bg-black/40">
      <h2 id="confirm-dialog-title" className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-gray-600">{message}</p>
      {children}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          className={`rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50 ${tones[tone]}`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

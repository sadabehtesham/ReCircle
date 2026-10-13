import { useEffect, useRef } from 'react';

export default function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }) {
  const ref = useRef(null);
  const cancel = (event) => {
    event.preventDefault();
    onCancel();
    event.currentTarget.close();
  };

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-title"
      onCancel={cancel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') cancel(event);
      }}
      className="m-auto w-full max-w-sm rounded-lg p-6 backdrop:bg-black/40"
    >
      <h2 id="confirm-dialog-title" className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-gray-600">{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-1.5 text-sm">Cancel</button>
        <button type="button" onClick={onConfirm} className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

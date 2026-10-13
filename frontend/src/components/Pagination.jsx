export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  const btn = 'rounded-md border bg-white px-3 py-1 text-sm disabled:opacity-40';
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span className="text-sm">Page {page} of {pages}</span>
      <button type="button" className={btn} disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </nav>
  );
}

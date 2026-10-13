export default function Field({ label, id, as: Tag = 'input', ...props }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <Tag
        id={id}
        name={id}
        required
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
        {...props}
      />
    </div>
  );
}

export default function Select({ label, id, options, placeholder, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <select
        id={id}
        name={id}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>{text}</option>
        ))}
      </select>
    </div>
  );
}

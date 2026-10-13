const tones = {
  borrow: 'bg-green-100 text-green-800',
  sell: 'bg-amber-100 text-amber-800',
  giveaway: 'bg-blue-100 text-blue-800',
  default: 'bg-gray-100 text-gray-700',
};

export default function Badge({ tone = 'default', children }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.default}`}>{children}</span>;
}

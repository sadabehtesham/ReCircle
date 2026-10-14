const styles = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
  active: 'bg-blue-100 text-blue-800 border-blue-200',
  overdue: 'bg-orange-100 text-orange-800 border-orange-200',
  returned: 'bg-gray-100 text-gray-700 border-gray-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  default: 'bg-gray-100 text-gray-700 border-gray-200',
};

const labels = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  active: 'Active',
  overdue: 'Overdue',
  returned: 'Returned',
  completed: 'Completed',
};

export default function StatusBadge({ status }) {
  const key = status && labels[status] ? status : 'default';
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${styles[key]}`}>
      {labels[status] || status || 'Unknown'}
    </span>
  );
}

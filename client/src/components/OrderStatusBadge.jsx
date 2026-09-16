export default function OrderStatusBadge({ status }) {
  const styles = {
    PENDING_PAYMENT: 'bg-amber-50 text-amber-800 border-amber-200',
    CONFIRMED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    PROCESSING: 'bg-blue-50 text-blue-900 border-blue-200',
    SHIPPED: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    DELIVERED: 'bg-green-50 text-green-800 border-green-200',
    CANCELLED: 'bg-rose-50 text-rose-800 border-rose-200',
  };

  const labels = {
    PENDING_PAYMENT: 'Pending Payment',
    CONFIRMED: 'Confirmed',
    PROCESSING: 'Processing',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  };

  const currentStyle = styles[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  const label = labels[status] || status;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${currentStyle}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          status === 'CANCELLED' ? 'bg-rose-500' : status === 'DELIVERED' ? 'bg-green-600' : 'bg-current'
        }`}
      />
      {label}
    </span>
  );
}

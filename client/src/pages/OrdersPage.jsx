import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Truck, CheckCircle2, Clock, XCircle, AlertCircle, ShoppingBag } from 'lucide-react';
import { ordersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import OrderStatusBadge from '../components/OrderStatusBadge';
import Modal from '../components/Modal';

export default function OrdersPage() {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cancellation Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const fetchOrders = () => {
    setLoading(true);
    ordersApi
      .getMyOrders()
      .then((data) => {
        setOrders(data.orders || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white border border-[#E5E7EB] rounded-2xl text-center shadow-xs">
        <Package size={32} className="text-[#1F3A5F] mx-auto mb-3" />
        <h2 className="text-base font-bold text-[#17202A]">Sign in to View Orders</h2>
        <p className="text-xs text-[#667085] mt-1">
          Please sign in to access your order history and live delivery tracking.
        </p>
        <Link
          to="/login?redirect=/orders"
          className="mt-5 inline-block px-5 py-2.5 bg-[#1F3A5F] text-white text-xs font-semibold rounded-lg hover:bg-[#172D4A] transition"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const handleCancelClick = (order) => {
    setSelectedOrder(order);
    setCancelReason('');
    setCancelError(null);
    setCancelModalOpen(true);
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setCancelSubmitting(true);
    setCancelError(null);

    try {
      await ordersApi.cancel(selectedOrder._id, cancelReason.trim());
      setCancelModalOpen(false);
      fetchOrders(); // Refresh status
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelSubmitting(false);
    }
  };

  const steps = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

  const getStepIndex = (status) => {
    if (status === 'CANCELLED') return -1;
    if (status === 'PENDING_PAYMENT') return 0;
    return steps.indexOf(status);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#17202A] tracking-tight">
          My Orders & Delivery Tracking
        </h1>
        <p className="text-xs text-[#667085] mt-1">
          Monitor fulfillment progress, view item snapshots, or initiate cancellation
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E7EB] p-6 animate-pulse space-y-3">
              <div className="h-5 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-16 bg-gray-200 rounded mt-4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center text-xs text-[#B54747] font-medium">
          {error}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-full bg-[#F7F7F5] flex items-center justify-center text-gray-400 mx-auto mb-3">
            <Package size={28} />
          </div>
          <h3 className="text-base font-bold text-[#17202A]">No orders placed yet</h3>
          <p className="text-xs text-[#667085] mt-1">
            When you purchase items, their fulfillment timeline will appear here.
          </p>
          <Link
            to="/catalog"
            className="mt-5 inline-block px-5 py-2.5 bg-[#1F3A5F] text-white text-xs font-semibold rounded-lg hover:bg-[#172D4A] transition shadow-xs"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const currentStepIdx = getStepIndex(order.orderStatus);
            const canCancel =
              order.orderStatus === 'PENDING_PAYMENT' || order.orderStatus === 'CONFIRMED';

            return (
              <div
                key={order._id}
                className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs overflow-hidden"
              >
                {/* Order Card Header */}
                <div className="bg-[#F7F7F5]/50 border-b border-[#E5E7EB] px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-4">
                    <div>
                      <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                        Order Placed
                      </span>
                      <span className="font-semibold text-[#17202A]">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <div>
                      <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                        Total Amount
                      </span>
                      <span className="font-bold text-[#1F3A5F]">
                        ₹{order.totalAmount?.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[#667085] block text-[10px] uppercase font-semibold">
                        Order Number
                      </span>
                      <span className="font-mono font-bold text-[#17202A]">{order.orderNumber}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <OrderStatusBadge status={order.orderStatus} />
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => handleCancelClick(order)}
                        className="px-3 py-1 bg-white border border-[#B54747]/40 text-[#B54747] text-[11px] font-semibold rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                </div>

                {/* Fulfillment Timeline Stepper */}
                {order.orderStatus !== 'CANCELLED' ? (
                  <div className="px-6 py-6 border-b border-[#E5E7EB] bg-white">
                    <div className="relative flex items-center justify-between max-w-2xl mx-auto">
                      {/* Connecting Line */}
                      <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-gray-200 -translate-y-1/2 z-0" />
                      <div
                        className="absolute top-1/2 left-4 h-0.5 bg-[#1F3A5F] -translate-y-1/2 z-0 transition-all duration-500"
                        style={{
                          width: `${Math.max(0, (currentStepIdx / (steps.length - 1)) * 95)}%`,
                        }}
                      />

                      {steps.map((step, idx) => {
                        const isCompleted = idx <= currentStepIdx;
                        const isCurrent = idx === currentStepIdx;

                        return (
                          <div key={step} className="relative z-10 flex flex-col items-center">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition ${
                                isCompleted
                                  ? 'bg-[#1F3A5F] text-white shadow-xs'
                                  : 'bg-white border-2 border-gray-300 text-gray-400'
                              }`}
                            >
                              {idx === 0 ? (
                                <CheckCircle2 size={16} />
                              ) : idx === 1 ? (
                                <Clock size={16} />
                              ) : idx === 2 ? (
                                <Truck size={16} />
                              ) : (
                                <Package size={16} />
                              )}
                            </div>
                            <span
                              className={`text-[10px] mt-2 font-semibold uppercase tracking-wider ${
                                isCurrent ? 'text-[#1F3A5F]' : isCompleted ? 'text-[#17202A]' : 'text-gray-400'
                              }`}
                            >
                              {step.toLowerCase()}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Carrier & Tracking details */}
                    {order.carrier && (
                      <div className="mt-5 p-3 rounded-lg bg-[#F7F7F5] border border-[#E5E7EB] flex items-center justify-between text-xs max-w-2xl mx-auto">
                        <div className="flex items-center space-x-2">
                          <Truck size={16} className="text-[#1F3A5F]" />
                          <span>
                            Shipped via <strong className="text-[#17202A]">{order.carrier}</strong>
                          </span>
                        </div>
                        {order.trackingNumber && (
                          <span className="font-mono text-[#667085]">
                            AWB: <strong>{order.trackingNumber}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-6 py-4 bg-rose-50/70 border-b border-rose-200 flex items-start space-x-3 text-xs">
                    <XCircle size={18} className="text-[#B54747] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#B54747]">Order Cancelled</p>
                      <p className="text-rose-700 mt-0.5">
                        Reason: {order.cancellationReason || 'Cancelled upon customer request'}
                      </p>
                      {order.refundDetails?.status === 'PROCESSED' && (
                        <p className="text-[#2F6B4F] font-semibold mt-1">
                          Refund Processed: ₹{order.refundDetails.amount?.toLocaleString('en-IN')} (Ref: {order.refundDetails.refundId})
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Ordered Items List */}
                <div className="px-6 py-4 divide-y divide-[#E5E7EB]">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="py-3 flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-[#F7F7F5] border border-[#E5E7EB] flex items-center justify-center text-gray-400">
                          <ShoppingBag size={18} />
                        </div>
                        <div>
                          <p className="font-semibold text-[#17202A]">{item.name}</p>
                          <p className="text-[#667085]">Quantity: {item.quantity} · Price: ₹{item.finalPrice?.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                      <span className="font-bold text-[#17202A]">
                        ₹{item.lineTotal?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Order"
      >
        <form onSubmit={handleCancelSubmit} className="space-y-4">
          <p className="text-xs text-[#667085]">
            Are you sure you want to cancel order <strong>{selectedOrder?.orderNumber}</strong>?
            Any reserved inventory will be automatically restored, and any paid funds will be refunded.
          </p>

          {cancelError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-[#B54747]">
              {cancelError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#17202A] mb-1">
              Reason for Cancellation *
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              required
              minLength={5}
              maxLength={500}
              placeholder="Please provide a reason (minimum 5 characters)"
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setCancelModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-[#667085] hover:bg-gray-100 rounded-lg"
            >
              Keep Order
            </button>
            <button
              type="submit"
              disabled={cancelSubmitting || cancelReason.trim().length < 5}
              className="px-4 py-2 text-xs font-semibold bg-[#B54747] text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
            >
              {cancelSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

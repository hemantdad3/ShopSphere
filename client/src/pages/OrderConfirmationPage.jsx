import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Package, ArrowRight, ShoppingBag } from 'lucide-react';
import { ordersApi } from '../services/api';
import OrderStatusBadge from '../components/OrderStatusBadge';

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    ordersApi
      .getById(orderId)
      .then((data) => {
        setOrder(data.order);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [orderId]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto my-16 p-12 bg-white rounded-2xl border border-[#E5E7EB] animate-pulse space-y-4 text-center">
        <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto" />
        <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto" />
        <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-[#E5E7EB] text-center shadow-xs">
        <p className="text-xs text-[#B54747] font-semibold">{error || 'Unable to find order details.'}</p>
        <Link
          to="/catalog"
          className="mt-4 inline-block px-4 py-2 bg-[#1F3A5F] text-white text-xs font-semibold rounded-lg"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      {/* Confirmation Banner */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 sm:p-10 text-center shadow-xs space-y-4">
        <div className="w-16 h-16 bg-emerald-50 text-[#2F6B4F] rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 size={36} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#17202A]">Order Successfully Placed!</h1>
          <p className="text-xs text-[#667085] mt-1.5">
            Thank you for your purchase. We have received your payment and our warehouse team is preparing your package.
          </p>
        </div>

        <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-[#F7F7F5] rounded-lg border border-[#E5E7EB] text-xs">
          <span className="text-[#667085]">Order Reference:</span>
          <span className="font-mono font-bold text-[#1F3A5F]">{order.orderNumber}</span>
          <OrderStatusBadge status={order.orderStatus} />
        </div>
      </div>

      {/* Order Details & Summary */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-xs space-y-6">
        <h2 className="text-base font-bold text-[#17202A] border-b border-[#E5E7EB] pb-3">
          Order Summary
        </h2>

        {/* Ordered Items */}
        <div className="divide-y divide-[#E5E7EB]">
          {order.items?.map((item, idx) => (
            <div key={idx} className="py-3 flex justify-between items-center text-xs">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded bg-[#F7F7F5] border border-[#E5E7EB] flex items-center justify-center text-gray-400 shrink-0">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <p className="font-semibold text-[#17202A]">{item.name}</p>
                  <p className="text-[#667085]">Quantity: {item.quantity}</p>
                </div>
              </div>
              <span className="font-bold text-[#17202A]">
                ₹{item.lineTotal?.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>

        {/* Address and Financial Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-[#E5E7EB] pt-6">
          <div className="text-xs text-[#667085] space-y-1">
            <h3 className="font-bold text-[#17202A] mb-2 uppercase tracking-wider text-[11px]">
              Shipping Destination
            </h3>
            <p className="font-semibold text-[#17202A]">{order.shippingAddress?.fullName}</p>
            <p>{order.shippingAddress?.addressLine1}</p>
            {order.shippingAddress?.addressLine2 && <p>{order.shippingAddress?.addressLine2}</p>}
            <p>
              {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.pincode}
            </p>
            <p>Phone: {order.shippingAddress?.phone}</p>
          </div>

          <div className="text-xs text-[#667085] space-y-2 border-t sm:border-t-0 sm:border-l border-[#E5E7EB] sm:pl-6 pt-4 sm:pt-0">
            <h3 className="font-bold text-[#17202A] mb-2 uppercase tracking-wider text-[11px]">
              Payment Summary
            </h3>
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-[#17202A]">₹{order.subtotal?.toLocaleString('en-IN')}</span>
            </div>
            {order.discountTotal > 0 && (
              <div className="flex justify-between text-[#2F6B4F]">
                <span>Discount Savings</span>
                <span>-₹{order.discountTotal?.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Shipping</span>
              <span className="text-[#2F6B4F] font-semibold">Free</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-[#17202A] border-t border-[#E5E7EB] pt-2">
              <span>Total Paid</span>
              <span className="text-[#1F3A5F]">₹{order.totalAmount?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-6 border-t border-[#E5E7EB]">
          <Link
            to="/catalog"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-xs font-semibold text-[#17202A] text-center hover:bg-gray-50 transition"
          >
            Continue Shopping
          </Link>
          <Link
            to="/orders"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#1F3A5F] text-white text-xs font-semibold flex items-center justify-center space-x-1.5 hover:bg-[#172D4A] transition shadow-xs"
          >
            <Package size={14} />
            <span>Track Order & History</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

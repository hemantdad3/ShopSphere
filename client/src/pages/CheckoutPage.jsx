import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, AlertCircle, ShoppingBag, ArrowLeft } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ordersApi, paymentsApi } from '../services/api';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { items, summary, clearCart } = useCart();

  const [shippingAddress, setShippingAddress] = useState({
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Prepopulate name if user exists
  useEffect(() => {
    if (user?.name) {
      setShippingAddress((prev) => ({ ...prev, fullName: user.name }));
    }
  }, [user]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white border border-[#E5E7EB] rounded-2xl text-center shadow-xs">
        <Lock size={32} className="text-[#1F3A5F] mx-auto mb-3" />
        <h2 className="text-base font-bold text-[#17202A]">Authentication Required</h2>
        <p className="text-xs text-[#667085] mt-1.5">
          Please sign in to proceed with checkout and reserve inventory.
        </p>
        <Link
          to="/login?redirect=/checkout"
          className="mt-5 inline-block px-5 py-2.5 bg-[#1F3A5F] text-white text-xs font-semibold rounded-lg hover:bg-[#172D4A] transition"
        >
          Sign In to Checkout
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white border border-[#E5E7EB] rounded-2xl text-center shadow-xs">
        <ShoppingBag size={32} className="text-gray-300 mx-auto mb-3" />
        <h2 className="text-base font-bold text-[#17202A]">Your Cart is Empty</h2>
        <p className="text-xs text-[#667085] mt-1.5">
          Add some items to your shopping cart before checking out.
        </p>
        <Link
          to="/catalog"
          className="mt-5 inline-block px-5 py-2.5 bg-[#1F3A5F] text-white text-xs font-semibold rounded-lg hover:bg-[#172D4A] transition"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  const handleInputChange = (e) => {
    setShippingAddress({
      ...shippingAddress,
      [e.target.name]: e.target.value,
    });
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create order & reserve inventory (15-min TTL)
      const { order } = await ordersApi.checkout(shippingAddress);

      // 2. Initiate payment session
      const paymentInitiation = await paymentsApi.initiate(order._id);
      const { razorpayOrderId, amount, currency, keyId } = paymentInitiation;

      // 3. Load Razorpay checkout modal
      const isLoaded = await loadRazorpayScript();

      if (isLoaded && window.Razorpay && !keyId.includes('xxxx')) {
        // Live Razorpay Checkout Modal
        const options = {
          key: keyId,
          amount: amount,
          currency: currency,
          name: 'ShopSphere',
          description: `Order ${order.orderNumber}`,
          order_id: razorpayOrderId,
          prefill: {
            name: shippingAddress.fullName,
            contact: shippingAddress.phone,
            email: user?.email || '',
          },
          theme: {
            color: '#1F3A5F',
          },
          handler: async (response) => {
            try {
              await paymentsApi.verify({
                orderId: order._id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              await clearCart();
              navigate(`/order-confirmation/${order._id}`);
            } catch (verErr) {
              setError(verErr.message);
            }
          },
          modal: {
            ondismiss: async () => {
              setLoading(false);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Development Mock Simulator (or fallback if placeholder key or adblockers block script)
        const mockPaymentId = `pay_sim_${Date.now()}`;
        const mockSignature = `sig_sim_${Date.now()}`;

        await paymentsApi.verify({
          orderId: order._id,
          razorpayOrderId: razorpayOrderId || `order_sim_${Date.now()}`,
          razorpayPaymentId: mockPaymentId,
          razorpaySignature: mockSignature,
        });

        await clearCart();
        navigate(`/order-confirmation/${order._id}`);
      }
    } catch (err) {
      setError(err.message || 'Checkout failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link
        to="/catalog"
        className="inline-flex items-center text-xs font-medium text-[#667085] hover:text-[#1F3A5F] transition"
      >
        <ArrowLeft size={14} className="mr-1.5" />
        Continue Shopping
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Form Column */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-xs">
          <div className="border-b border-[#E5E7EB] pb-4 mb-6">
            <h1 className="text-xl font-bold text-[#17202A]">Shipping & Delivery Address</h1>
            <p className="text-xs text-[#667085] mt-1">
              Please enter the physical destination where your order will be shipped.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3">
              <AlertCircle size={18} className="text-[#B54747] shrink-0 mt-0.5" />
              <p className="text-xs text-[#B54747] font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handlePlaceOrder} id="checkout-form" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#17202A] mb-1">
                  Recipient Full Name *
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={shippingAddress.fullName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. Alice Sharma"
                  className="w-full px-3.5 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17202A] mb-1">
                  Mobile Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={shippingAddress.phone}
                  onChange={handleInputChange}
                  required
                  placeholder="10-digit phone number"
                  className="w-full px-3.5 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#17202A] mb-1">
                Street Address (Line 1) *
              </label>
              <input
                type="text"
                name="addressLine1"
                value={shippingAddress.addressLine1}
                onChange={handleInputChange}
                required
                placeholder="Flat / House No., Building Name, Street"
                className="w-full px-3.5 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#17202A] mb-1">
                Landmark / Area (Line 2)
              </label>
              <input
                type="text"
                name="addressLine2"
                value={shippingAddress.addressLine2}
                onChange={handleInputChange}
                placeholder="Apartment, suite, landmark (optional)"
                className="w-full px-3.5 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#17202A] mb-1">
                  City *
                </label>
                <input
                  type="text"
                  name="city"
                  value={shippingAddress.city}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. Mumbai"
                  className="w-full px-3.5 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17202A] mb-1">
                  State *
                </label>
                <input
                  type="text"
                  name="state"
                  value={shippingAddress.state}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. Maharashtra"
                  className="w-full px-3.5 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-[#17202A] mb-1">
                  Pincode *
                </label>
                <input
                  type="text"
                  name="pincode"
                  value={shippingAddress.pincode}
                  onChange={handleInputChange}
                  required
                  placeholder="6-digit pincode"
                  className="w-full px-3.5 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Right Summary Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-xs space-y-5">
            <h2 className="text-base font-bold text-[#17202A] border-b border-[#E5E7EB] pb-3">
              Order Summary ({items.length} {items.length === 1 ? 'item' : 'items'})
            </h2>

            {/* Line items mini list */}
            <div className="divide-y divide-[#E5E7EB] max-h-60 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.productId} className="py-2.5 flex justify-between items-center text-xs">
                  <div className="pr-4">
                    <p className="font-semibold text-[#17202A] line-clamp-1">{item.name}</p>
                    <p className="text-[#667085] mt-0.5">Qty: {item.quantity}</p>
                  </div>
                  <span className="font-bold text-[#17202A] shrink-0">
                    ₹{item.lineTotal?.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>

            {/* Pricing breakdown */}
            <div className="border-t border-[#E5E7EB] pt-4 space-y-2 text-xs text-[#667085]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-[#17202A] font-semibold">
                  ₹{summary.subtotal?.toLocaleString('en-IN')}
                </span>
              </div>
              {summary.discountTotal > 0 && (
                <div className="flex justify-between text-[#2F6B4F]">
                  <span>Discount Applied</span>
                  <span>-₹{summary.discountTotal?.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping Fee</span>
                <span className="text-[#2F6B4F] font-semibold">FREE</span>
              </div>
              <div className="border-t border-[#E5E7EB] pt-3 flex justify-between text-base font-extrabold text-[#17202A]">
                <span>Total Due</span>
                <span className="text-[#1F3A5F]">
                  ₹{summary.finalTotal?.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Place Order & Pay Button */}
            <button
              type="submit"
              form="checkout-form"
              disabled={loading || !summary.isValidForCheckout}
              className="w-full py-3.5 px-4 rounded-xl bg-[#1F3A5F] text-white text-xs font-bold flex items-center justify-center space-x-2 hover:bg-[#172D4A] transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck size={16} />
              <span>{loading ? 'Processing Order...' : 'Reserve & Pay with Razorpay'}</span>
            </button>

            <div className="flex items-center justify-center space-x-2 text-[10px] text-[#667085] pt-1">
              <Lock size={12} />
              <span>Inventory is reserved immediately upon placement for 15 minutes.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

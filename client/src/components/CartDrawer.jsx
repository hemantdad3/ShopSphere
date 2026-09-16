import { X, Plus, Minus, Trash2, AlertTriangle, ArrowRight, ShoppingBag } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function CartDrawer() {
  const navigate = useNavigate();
  const {
    items,
    summary,
    totalItems,
    isDrawerOpen,
    closeDrawer,
    updateQuantity,
    removeItem,
    loading,
  } = useCart();

  if (!isDrawerOpen) return null;

  const handleCheckoutClick = () => {
    closeDrawer();
    navigate('/checkout');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-fadeIn"
        onClick={closeDrawer}
      />

      {/* Slide-out Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-[#E5E7EB] animate-slideInRight">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB]">
            <div className="flex items-center space-x-2">
              <ShoppingBag size={20} className="text-[#1F3A5F]" />
              <h2 className="text-base font-bold text-[#17202A]">
                Your Shopping Cart
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-[#667085]">
                {totalItems}
              </span>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
              aria-label="Close cart drawer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Warning Banner for Stock Degradation */}
          {summary.hasStockIssues && (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-start space-x-2.5">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Some items in your cart experienced inventory updates. Please review line items before checkout.
              </p>
            </div>
          )}

          {/* Cart Line Items */}
          <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-[#E5E7EB]">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-14 h-14 rounded-full bg-[#F7F7F5] flex items-center justify-center text-gray-400 mb-4">
                  <ShoppingBag size={28} />
                </div>
                <h3 className="text-sm font-semibold text-[#17202A]">Your cart is empty</h3>
                <p className="text-xs text-[#667085] mt-1 max-w-xs">
                  Discover our premium catalog and find items you love.
                </p>
                <Link
                  to="/catalog"
                  onClick={closeDrawer}
                  className="mt-5 inline-flex items-center text-xs font-semibold px-4 py-2 rounded-lg bg-[#1F3A5F] text-white hover:bg-[#172D4A] transition"
                >
                  Browse Catalog
                </Link>
              </div>
            ) : (
              items.map((item) => (
                <div key={item._id || item.productId} className="py-4 flex space-x-4">
                  {/* Thumbnail */}
                  <div className="w-18 h-18 rounded-lg bg-[#F7F7F5] border border-[#E5E7EB] overflow-hidden shrink-0 flex items-center justify-center">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ShoppingBag size={20} className="text-gray-300" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <Link
                          to={item.slug ? `/products/${item.slug}` : `/products/${item.productId}`}
                          onClick={closeDrawer}
                          className="text-xs font-semibold text-[#17202A] hover:text-[#1F3A5F] transition line-clamp-2"
                        >
                          {item.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="text-gray-400 hover:text-[#B54747] transition ml-2 p-1"
                          aria-label="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Pricing */}
                      <div className="flex items-baseline space-x-2 mt-1">
                        <span className="text-xs font-bold text-[#17202A]">
                          ₹{item.finalPrice?.toLocaleString('en-IN')}
                        </span>
                        {item.lineDiscount > 0 && (
                          <span className="text-[10px] text-gray-400 line-through">
                            ₹{item.unitPrice?.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>

                      {/* Stock Warning */}
                      {!item.isAvailable && (
                        <p className="text-[10px] text-amber-700 font-medium mt-1">
                          {item.issueReason}
                        </p>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="inline-flex items-center rounded-md border border-[#E5E7EB] bg-white">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="p-1 text-gray-500 hover:text-black hover:bg-gray-50 transition rounded-l-md disabled:opacity-40"
                          disabled={loading || item.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-xs font-semibold text-[#17202A]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="p-1 text-gray-500 hover:text-black hover:bg-gray-50 transition rounded-r-md disabled:opacity-40"
                          disabled={loading || item.quantity >= 10 || item.quantity >= item.availableStock}
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <span className="text-xs font-semibold text-[#17202A]">
                        ₹{item.lineTotal?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Summary & Checkout Action */}
          {items.length > 0 && (
            <div className="border-t border-[#E5E7EB] px-6 py-5 bg-[#F7F7F5]/40 space-y-3">
              <div className="space-y-1.5 text-xs text-[#667085]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-[#17202A]">
                    ₹{summary.subtotal?.toLocaleString('en-IN')}
                  </span>
                </div>
                {summary.discountTotal > 0 && (
                  <div className="flex justify-between text-[#2F6B4F]">
                    <span>Discount Savings</span>
                    <span>-₹{summary.discountTotal?.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="text-[#2F6B4F] font-medium">Free</span>
                </div>
                <div className="border-t border-[#E5E7EB] pt-2 flex justify-between text-sm font-bold text-[#17202A]">
                  <span>Total Amount</span>
                  <span className="text-[#1F3A5F]">
                    ₹{summary.finalTotal?.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckoutClick}
                disabled={!summary.isValidForCheckout || loading}
                className="w-full py-3 px-4 rounded-lg bg-[#1F3A5F] text-white text-xs font-semibold flex items-center justify-center space-x-2 hover:bg-[#172D4A] transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight size={14} />
              </button>

              <p className="text-[10px] text-center text-[#667085]">
                Taxes calculated at checkout. 100% secure payment with Razorpay.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

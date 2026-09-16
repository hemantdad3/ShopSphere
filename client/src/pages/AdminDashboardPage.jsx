import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, TrendingUp, Package, AlertTriangle, Users, Truck, ArrowUpRight } from 'lucide-react';
import { adminApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import OrderStatusBadge from '../components/OrderStatusBadge';
import Modal from '../components/Modal';

export default function AdminDashboardPage() {
  const { user, isAdmin } = useAuth();

  const [metrics, setMetrics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'inventory' | 'customers'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status Update Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [newStatus, setNewStatus] = useState('PROCESSING');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashData, ordersData, lowStockData, usersData] = await Promise.all([
        adminApi.getDashboard(),
        adminApi.getOrders({ limit: 20 }),
        adminApi.getLowStock(5),
        adminApi.getUsers({ limit: 20 }),
      ]);

      setMetrics(dashData.metrics);
      setOrders(ordersData.orders || []);
      setLowStockProducts(lowStockData.products || []);
      setCustomers(usersData.customers || []);
    } catch (err) {
      setError(err.message || 'Failed to load administrative analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white border border-[#E5E7EB] rounded-2xl text-center shadow-xs">
        <Shield size={36} className="text-[#B54747] mx-auto mb-3" />
        <h2 className="text-base font-bold text-[#17202A]">Access Forbidden (403)</h2>
        <p className="text-xs text-[#667085] mt-1.5">
          This area is strictly restricted to ShopSphere administrative operators.
        </p>
        <Link
          to="/"
          className="mt-5 inline-block px-5 py-2.5 bg-[#1F3A5F] text-white text-xs font-semibold rounded-lg hover:bg-[#172D4A] transition"
        >
          Return to Storefront
        </Link>
      </div>
    );
  }

  const handleOpenStatusModal = (order) => {
    setSelectedOrder(order);
    setCarrier(order.carrier || '');
    setTrackingNumber(order.trackingNumber || '');
    setStatusError(null);

    // Default next logical status
    if (order.orderStatus === 'CONFIRMED') setNewStatus('PROCESSING');
    else if (order.orderStatus === 'PROCESSING') setNewStatus('SHIPPED');
    else if (order.orderStatus === 'SHIPPED') setNewStatus('DELIVERED');
    else setNewStatus('DELIVERED');

    setStatusModalOpen(true);
  };

  const handleUpdateStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setUpdatingStatus(true);
    setStatusError(null);

    try {
      const payload = { status: newStatus };
      if (newStatus === 'SHIPPED') {
        payload.carrier = carrier.trim() || undefined;
        payload.trackingNumber = trackingNumber.trim() || undefined;
      }

      await adminApi.updateOrderStatus(selectedOrder._id, payload);
      setStatusModalOpen(false);
      await fetchAdminData();
    } catch (err) {
      setStatusError(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <Shield size={20} className="text-[#1F3A5F]" />
            <h1 className="text-2xl font-bold text-[#17202A] tracking-tight">
              Executive Admin Console
            </h1>
          </div>
          <p className="text-xs text-[#667085] mt-1">
            Real-time fulfillment pipeline, revenue aggregation, and warehouse inventory monitoring
          </p>
        </div>

        <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-[#2F6B4F] border border-emerald-200 self-start sm:self-auto">
          Logged in as: {user?.email}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white border border-[#E5E7EB] rounded-2xl p-6" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center text-xs text-[#B54747] font-medium">
          {error}
        </div>
      ) : (
        <>
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Revenue KPI */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#667085]">
                <span>Gross Revenue (Paid)</span>
                <TrendingUp size={16} className="text-[#2F6B4F]" />
              </div>
              <p className="text-2xl font-extrabold text-[#1F3A5F]">
                ₹{metrics?.revenue?.total?.toLocaleString('en-IN') || 0}
              </p>
              <div className="flex items-center space-x-3 text-[11px] text-[#667085] pt-1 border-t border-[#E5E7EB]/60">
                <span>Today: ₹{metrics?.revenue?.today?.toLocaleString('en-IN') || 0}</span>
                <span>·</span>
                <span>Month: ₹{metrics?.revenue?.month?.toLocaleString('en-IN') || 0}</span>
              </div>
            </div>

            {/* Orders KPI */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#667085]">
                <span>Total Orders</span>
                <Package size={16} className="text-[#1F3A5F]" />
              </div>
              <p className="text-2xl font-extrabold text-[#17202A]">
                {metrics?.orders?.total || 0}
              </p>
              <div className="flex items-center space-x-2 text-[10px] text-[#667085] pt-1 border-t border-[#E5E7EB]/60 overflow-hidden">
                <span className="text-[#2F6B4F] font-semibold">
                  {metrics?.orders?.breakdown?.DELIVERED || 0} Delivered
                </span>
                <span>·</span>
                <span className="text-blue-700 font-semibold">
                  {metrics?.orders?.breakdown?.CONFIRMED || 0} Paid
                </span>
              </div>
            </div>

            {/* Low Stock KPI */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#667085]">
                <span>Low Stock Alerts (≤5)</span>
                <AlertTriangle size={16} className="text-amber-600" />
              </div>
              <p className="text-2xl font-extrabold text-[#D97706]">
                {metrics?.inventory?.lowStockCount || 0}
              </p>
              <p className="text-[11px] text-[#667085] pt-1 border-t border-[#E5E7EB]/60">
                Out of Stock: <strong className="text-[#B54747]">{metrics?.inventory?.outOfStockCount || 0}</strong> products
              </p>
            </div>

            {/* Customer KPI */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#667085]">
                <span>Total Customers</span>
                <Users size={16} className="text-[#1F3A5F]" />
              </div>
              <p className="text-2xl font-extrabold text-[#17202A]">
                {metrics?.customers?.totalCustomers || 0}
              </p>
              <p className="text-[11px] text-[#667085] pt-1 border-t border-[#E5E7EB]/60">
                New (30 days): <strong className="text-[#2F6B4F]">{metrics?.customers?.newSignupsLast30Days || 0}</strong>
              </p>
            </div>
          </div>

          {/* Operational Tabs Navigation */}
          <div className="border-b border-[#E5E7EB] flex space-x-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`pb-3 transition cursor-pointer flex items-center space-x-2 ${
                activeTab === 'orders'
                  ? 'text-[#1F3A5F] border-b-2 border-[#1F3A5F]'
                  : 'text-[#667085] hover:text-[#17202A]'
              }`}
            >
              <Package size={15} />
              <span>Orders & Fulfillment ({orders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`pb-3 transition cursor-pointer flex items-center space-x-2 ${
                activeTab === 'inventory'
                  ? 'text-[#1F3A5F] border-b-2 border-[#1F3A5F]'
                  : 'text-[#667085] hover:text-[#17202A]'
              }`}
            >
              <AlertTriangle size={15} />
              <span>Low-Stock Alerts ({lowStockProducts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`pb-3 transition cursor-pointer flex items-center space-x-2 ${
                activeTab === 'customers'
                  ? 'text-[#1F3A5F] border-b-2 border-[#1F3A5F]'
                  : 'text-[#667085] hover:text-[#17202A]'
              }`}
            >
              <Users size={15} />
              <span>Customer Profiles ({customers.length})</span>
            </button>
          </div>

          {/* Tab 1: Orders Fulfillment Table */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F5] border-b border-[#E5E7EB] text-[#667085] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Order Number</th>
                      <th className="px-6 py-3 font-semibold">Customer</th>
                      <th className="px-6 py-3 font-semibold">Amount</th>
                      <th className="px-6 py-3 font-semibold">Payment</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold">Date</th>
                      <th className="px-6 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {orders.map((order) => {
                      const isTerminal =
                        order.orderStatus === 'DELIVERED' || order.orderStatus === 'CANCELLED';

                      return (
                        <tr key={order._id} className="hover:bg-gray-50/60 transition">
                          <td className="px-6 py-4 font-mono font-bold text-[#1F3A5F]">
                            {order.orderNumber}
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-[#17202A]">{order.customer?.name || 'Customer'}</p>
                            <p className="text-[11px] text-[#667085]">{order.customer?.email}</p>
                          </td>
                          <td className="px-6 py-4 font-bold text-[#17202A]">
                            ₹{order.totalAmount?.toLocaleString('en-IN')}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                order.paymentStatus === 'PAID'
                                  ? 'bg-emerald-50 text-[#2F6B4F]'
                                  : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              {order.paymentStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <OrderStatusBadge status={order.orderStatus} />
                          </td>
                          <td className="px-6 py-4 text-[#667085] text-[11px]">
                            {new Date(order.createdAt).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {!isTerminal ? (
                              <button
                                type="button"
                                onClick={() => handleOpenStatusModal(order)}
                                className="px-3 py-1.5 bg-[#1F3A5F] text-white text-xs font-semibold rounded-lg hover:bg-[#172D4A] transition cursor-pointer shadow-xs"
                              >
                                Update Status
                              </button>
                            ) : (
                              <span className="text-[11px] text-gray-400 font-medium">
                                Terminal
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Low-Stock Inventory Table */}
          {activeTab === 'inventory' && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F5] border-b border-[#E5E7EB] text-[#667085] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Product Name</th>
                      <th className="px-6 py-3 font-semibold">SKU</th>
                      <th className="px-6 py-3 font-semibold">Category</th>
                      <th className="px-6 py-3 font-semibold">Unit Price</th>
                      <th className="px-6 py-3 font-semibold">Stock Balance</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {lowStockProducts.map((p) => (
                      <tr key={p._id} className="hover:bg-gray-50/60 transition">
                        <td className="px-6 py-4 font-semibold text-[#17202A]">
                          <Link to={`/products/${p.slug || p._id}`} className="hover:text-[#1F3A5F]">
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 font-mono text-[11px] text-[#667085]">{p.sku}</td>
                        <td className="px-6 py-4 text-[#667085]">{p.category?.name || 'General'}</td>
                        <td className="px-6 py-4 font-semibold text-[#17202A]">
                          ₹{p.price?.toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              p.stock === 0
                                ? 'bg-rose-100 text-[#B54747]'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {p.stock} units
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {p.stock === 0 ? (
                            <span className="text-[11px] font-bold text-[#B54747]">Out of Stock</span>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-700">Reorder Urgently</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Customer Profiles Table */}
          {activeTab === 'customers' && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F5] border-b border-[#E5E7EB] text-[#667085] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Customer Name</th>
                      <th className="px-6 py-3 font-semibold">Email</th>
                      <th className="px-6 py-3 font-semibold">Total Orders</th>
                      <th className="px-6 py-3 font-semibold">Lifetime Paid Spend</th>
                      <th className="px-6 py-3 font-semibold">Member Since</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {customers.map((c) => (
                      <tr key={c._id} className="hover:bg-gray-50/60 transition">
                        <td className="px-6 py-4 font-semibold text-[#17202A]">{c.name}</td>
                        <td className="px-6 py-4 text-[#667085]">{c.email}</td>
                        <td className="px-6 py-4 font-bold text-[#17202A]">{c.totalOrders || 0}</td>
                        <td className="px-6 py-4 font-bold text-[#2F6B4F]">
                          ₹{c.totalSpent?.toLocaleString('en-IN') || 0}
                        </td>
                        <td className="px-6 py-4 text-[#667085] text-[11px]">
                          {new Date(c.createdAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Fulfillment Status Modal */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={`Advance Fulfillment: ${selectedOrder?.orderNumber}`}
      >
        <form onSubmit={handleUpdateStatusSubmit} className="space-y-4">
          <p className="text-xs text-[#667085]">
            Current Order Status:{' '}
            <strong className="text-[#17202A]">{selectedOrder?.orderStatus}</strong>
          </p>

          {statusError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-[#B54747]">
              {statusError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#17202A] mb-1">
              Target Status *
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
            >
              <option value="PROCESSING">PROCESSING (Packaging & Invoice)</option>
              <option value="SHIPPED">SHIPPED (Handed to Carrier)</option>
              <option value="DELIVERED">DELIVERED (Completed)</option>
              <option value="CANCELLED">CANCELLED (Administrative Abort)</option>
            </select>
          </div>

          {newStatus === 'SHIPPED' && (
            <div className="space-y-3 pt-2 border-t border-[#E5E7EB]">
              <div>
                <label className="block text-xs font-semibold text-[#17202A] mb-1">
                  Logistics Carrier Name (e.g. BlueDart, Delhivery)
                </label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="Carrier name"
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17202A] mb-1">
                  Tracking / AWB Number
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="AWB tracking number"
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F]"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={() => setStatusModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-[#667085] hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updatingStatus}
              className="px-5 py-2 text-xs font-semibold bg-[#1F3A5F] text-white rounded-lg hover:bg-[#172D4A] transition disabled:opacity-50"
            >
              {updatingStatus ? 'Updating...' : 'Save & Advance Status'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

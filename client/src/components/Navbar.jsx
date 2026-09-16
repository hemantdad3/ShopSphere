import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Heart, Search, User, LogOut, Package, Shield, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export default function Navbar() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { totalItems, openDrawer } = useCart();
  const { wishlistCount } = useWishlist();

  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalog?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/catalog');
    }
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 shrink-0">
            <Link to="/" className="flex items-center space-x-2.5 group">
              <span className="w-9 h-9 rounded-lg bg-[#1F3A5F] text-white flex items-center justify-center font-bold text-lg shadow-xs group-hover:bg-[#172D4A] transition">
                S
              </span>
              <div className="flex flex-col">
                <span className="font-bold text-xl tracking-tight text-[#17202A] leading-tight">
                  ShopSphere
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[#667085]">
                  Single-Vendor Store
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Search Bar */}
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, categories..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-[#F7F7F5] border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3A5F] focus:bg-white transition"
              />
              <Search className="absolute left-3 top-2.5 text-[#667085]" size={16} />
            </div>
          </form>

          {/* Desktop Nav Links & User Controls */}
          <div className="hidden md:flex items-center space-x-5">
            <Link
              to="/catalog"
              className="text-sm font-medium text-[#17202A] hover:text-[#1F3A5F] transition"
            >
              Browse Catalog
            </Link>

            {/* Wishlist Link */}
            <Link
              to="/wishlist"
              className="relative p-2 text-[#17202A] hover:text-[#1F3A5F] transition rounded-lg hover:bg-gray-50"
              aria-label="View Wishlist"
            >
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#1F3A5F] text-white text-[10px] font-bold flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart Drawer Trigger */}
            <button
              type="button"
              onClick={openDrawer}
              className="relative p-2 text-[#17202A] hover:text-[#1F3A5F] transition rounded-lg hover:bg-gray-50 cursor-pointer"
              aria-label="Open Shopping Cart"
            >
              <ShoppingBag size={20} />
              {totalItems > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#2F6B4F] text-white text-[10px] font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>

            {/* User Account Menu */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 p-1.5 rounded-lg border border-[#E5E7EB] hover:bg-gray-50 transition cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-[#1F3A5F]/10 text-[#1F3A5F] font-semibold text-xs flex items-center justify-center">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-[#17202A] max-w-[100px] truncate">
                    {user.name}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-[#E5E7EB] py-1.5 z-40 animate-fadeIn"
                    onMouseLeave={() => setUserMenuOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-[#E5E7EB]">
                      <p className="text-xs font-semibold text-[#17202A] truncate">{user.name}</p>
                      <p className="text-[11px] text-[#667085] truncate">{user.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-[#1F3A5F]">
                        {user.role}
                      </span>
                    </div>

                    <Link
                      to="/orders"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-xs text-[#17202A] hover:bg-gray-50 transition"
                    >
                      <Package size={14} className="mr-2.5 text-[#667085]" />
                      My Orders & Tracking
                    </Link>

                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center px-4 py-2 text-xs font-medium text-[#1F3A5F] hover:bg-blue-50/50 transition"
                      >
                        <Shield size={14} className="mr-2.5 text-[#1F3A5F]" />
                        Admin Dashboard
                      </Link>
                    )}

                    <div className="border-t border-[#E5E7EB] my-1" />

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2 text-xs text-[#B54747] hover:bg-rose-50 transition cursor-pointer"
                    >
                      <LogOut size={14} className="mr-2.5 text-[#B54747]" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg text-[#1F3A5F] hover:bg-gray-100 transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-[#1F3A5F] text-white hover:bg-[#172D4A] transition shadow-xs"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              type="button"
              onClick={openDrawer}
              className="relative p-2 text-[#17202A]"
              aria-label="Open Cart"
            >
              <ShoppingBag size={20} />
              {totalItems > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#2F6B4F] text-white text-[10px] font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#17202A] rounded-lg hover:bg-gray-100"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Search & Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-[#E5E7EB] space-y-3">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2 text-sm bg-[#F7F7F5] border border-[#E5E7EB] rounded-lg"
                />
                <Search className="absolute left-3 top-2.5 text-[#667085]" size={16} />
              </div>
            </form>

            <div className="flex flex-col space-y-2 pt-2">
              <Link
                to="/catalog"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium py-1.5 text-[#17202A]"
              >
                Browse Catalog
              </Link>
              <Link
                to="/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium py-1.5 text-[#17202A] flex items-center justify-between"
              >
                <span>Wishlist</span>
                {wishlistCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#1F3A5F] text-white text-xs">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              {isAuthenticated ? (
                <>
                  <Link
                    to="/orders"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm font-medium py-1.5 text-[#17202A]"
                  >
                    My Orders
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-sm font-semibold py-1.5 text-[#1F3A5F]"
                    >
                      Admin Dashboard
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="text-sm font-medium py-1.5 text-[#B54747] text-left"
                  >
                    Sign Out ({user.name})
                  </button>
                </>
              ) : (
                <div className="pt-2 flex flex-col space-y-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-center py-2 rounded-lg border border-[#E5E7EB] text-sm font-semibold text-[#1F3A5F]"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-center py-2 rounded-lg bg-[#1F3A5F] text-sm font-semibold text-white"
                  >
                    Create Account
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

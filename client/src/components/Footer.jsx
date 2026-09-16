import { Link } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, Lock, RefreshCcw } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-[#E5E7EB] mt-auto">
      {/* Platform Architecture Highlights */}
      <div className="border-b border-[#E5E7EB] bg-[#F7F7F5]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-start space-x-3">
              <ShieldCheck className="text-[#1F3A5F] shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-xs font-semibold text-[#17202A] uppercase tracking-wider">
                  Atomic Reservation
                </h4>
                <p className="text-xs text-[#667085] mt-1">
                  Prevents overselling under high concurrency with strict 15-minute TTL locks.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Lock className="text-[#1F3A5F] shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-xs font-semibold text-[#17202A] uppercase tracking-wider">
                  HMAC Security
                </h4>
                <p className="text-xs text-[#667085] mt-1">
                  Cryptographic SHA256 timing-safe verification for Razorpay payments & webhooks.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <RefreshCcw className="text-[#1F3A5F] shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-xs font-semibold text-[#17202A] uppercase tracking-wider">
                  Authoritative Pricing
                </h4>
                <p className="text-xs text-[#667085] mt-1">
                  Zero-trust server price recalculation protects against client-side tampering.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <CheckCircle2 className="text-[#1F3A5F] shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-xs font-semibold text-[#17202A] uppercase tracking-wider">
                  Verified Reviews
                </h4>
                <p className="text-xs text-[#667085] mt-1">
                  Reviews restricted exclusively to confirmed buyers of delivered orders.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-3">
            <span className="w-7 h-7 rounded bg-[#1F3A5F] text-white flex items-center justify-center font-bold text-sm">
              S
            </span>
            <span className="font-bold text-lg text-[#17202A]">ShopSphere</span>
            <span className="text-xs text-[#667085]">
              — Production-Grade E-Commerce Platform
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#667085]">
            <Link to="/catalog" className="hover:text-[#1F3A5F] transition">
              Catalog
            </Link>
            <Link to="/orders" className="hover:text-[#1F3A5F] transition">
              Orders & Tracking
            </Link>
            <Link to="/wishlist" className="hover:text-[#1F3A5F] transition">
              Wishlist
            </Link>
            <a
              href="http://localhost:5000/api/health"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#1F3A5F] transition inline-flex items-center"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#2F6B4F] mr-1.5" />
              API Health
            </a>
          </div>

          <p className="text-xs text-[#667085]">
            © {new Date().getFullYear()} ShopSphere. Built with React 19 & Node.js.
          </p>
        </div>
      </div>
    </footer>
  );
}

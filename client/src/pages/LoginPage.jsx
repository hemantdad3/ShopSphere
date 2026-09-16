import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email, password);
      navigate(redirectUrl);
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-xs space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#1F3A5F] text-white flex items-center justify-center font-bold text-xl mx-auto mb-3 shadow-xs">
            S
          </div>
          <h1 className="text-xl font-bold text-[#17202A]">Welcome to ShopSphere</h1>
          <p className="text-xs text-[#667085] mt-1">Sign in to your customer or administrative account</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-xs text-[#B54747]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#17202A] mb-1">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
                className="w-full pl-9 pr-3.5 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
              />
              <Mail size={15} className="absolute left-3 top-2.5 text-[#667085]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#17202A] mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your account password"
                className="w-full pl-9 pr-3.5 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
              />
              <Lock size={15} className="absolute left-3 top-2.5 text-[#667085]" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-[#1F3A5F] text-white text-xs font-semibold hover:bg-[#172D4A] transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Fast-Login Helper */}
        <div className="border-t border-[#E5E7EB] pt-4 space-y-2 text-xs">
          <p className="text-[11px] font-semibold text-[#667085] uppercase tracking-wider text-center">
            Demo Credentials (Quick Fill)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('customer@shopsphere.com', 'Customer@1234')}
              className="px-2 py-1.5 rounded-lg border border-[#E5E7EB] text-[11px] text-[#17202A] hover:bg-gray-50 transition"
            >
              Customer Demo
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('admin@shopsphere.com', 'Admin@1234')}
              className="px-2 py-1.5 rounded-lg border border-[#E5E7EB] text-[11px] text-[#1F3A5F] font-semibold hover:bg-blue-50/50 transition"
            >
              Admin Demo
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-[#667085]">
          Don't have an account yet?{' '}
          <Link to={`/register?redirect=${encodeURIComponent(redirectUrl)}`} className="text-[#1F3A5F] font-semibold hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}

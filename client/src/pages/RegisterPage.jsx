import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await register(name.trim(), email.trim(), password);
      navigate(redirectUrl);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-xs space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#1F3A5F] text-white flex items-center justify-center font-bold text-xl mx-auto mb-3 shadow-xs">
            S
          </div>
          <h1 className="text-xl font-bold text-[#17202A]">Create an Account</h1>
          <p className="text-xs text-[#667085] mt-1">
            Join ShopSphere for seamless ordering and delivery tracking
          </p>
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
              Full Name *
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. John Doe"
                className="w-full pl-9 pr-3.5 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
              />
              <User size={15} className="absolute left-3 top-2.5 text-[#667085]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#17202A] mb-1">
              Email Address *
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
              Password * (min 8 characters)
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Create a strong password"
                className="w-full pl-9 pr-3.5 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
              />
              <Lock size={15} className="absolute left-3 top-2.5 text-[#667085]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#17202A] mb-1">
              Confirm Password *
            </label>
            <div className="relative">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Repeat your password"
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
            {loading ? 'Creating Account...' : 'Register Account'}
          </button>
        </form>

        <div className="text-center text-xs text-[#667085]">
          Already have an account?{' '}
          <Link to={`/login?redirect=${encodeURIComponent(redirectUrl)}`} className="text-[#1F3A5F] font-semibold hover:underline">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
}

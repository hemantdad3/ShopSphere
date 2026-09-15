import { useState, useEffect } from 'react';

export default function App() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [apiUrl]);

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col justify-between text-[#17202A]">
      {/* Top Header / Brand Bar */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="w-8 h-8 rounded bg-[#1F3A5F] text-white flex items-center justify-center font-bold text-lg">
              S
            </span>
            <span className="font-semibold text-xl tracking-tight text-[#17202A]">
              ShopSphere
            </span>
            <span className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-[#667085] border border-gray-200">
              Single-Vendor E-Commerce
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs text-[#667085]">Phase 0 Baseline</span>
            <div className="h-4 w-px bg-gray-200" />
            <span className="inline-flex items-center text-xs font-medium text-[#2F6B4F]">
              <span className="w-2 h-2 rounded-full bg-[#2F6B4F] mr-1.5 animate-pulse" />
              Environment Ready
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex-1 flex flex-col justify-center">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-8 sm:p-10 shadow-sm">
          <div className="border-b border-[#E5E7EB] pb-6 mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1F3A5F]">
              Engineering Architecture
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#17202A] mt-1">
              ShopSphere Monorepo Scaffold
            </h1>
            <p className="text-sm text-[#667085] mt-2">
              Production-oriented single-vendor e-commerce platform built with Node.js/Express,
              MongoDB Atlas, and React.
            </p>
          </div>

          {/* Backend Status Check */}
          <div className="bg-[#F7F7F5] rounded border border-[#E5E7EB] p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#17202A] uppercase">
                Backend API Health Check
              </span>
              <span className="text-xs text-[#667085] font-mono">{apiUrl}/health</span>
            </div>

            {loading && (
              <p className="text-xs text-[#667085]">Checking server status...</p>
            )}

            {error && (
              <div className="text-xs text-[#B54747] flex items-center space-x-2">
                <span className="font-semibold">Offline / Awaiting Server:</span>
                <span>{error}</span>
              </div>
            )}

            {health && (
              <div className="text-xs space-y-1">
                <div className="flex items-center space-x-2 text-[#2F6B4F] font-semibold">
                  <span>✔ API Connected:</span>
                  <span>{health.message}</span>
                </div>
                <div className="text-[#667085] font-mono text-[11px]">
                  Environment: {health.env} | Server Timestamp: {health.timestamp}
                </div>
              </div>
            )}
          </div>

          {/* Next Steps Checklist */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#667085] mb-3">
              Implementation Milestones
            </h2>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-gray-50 border border-[#E5E7EB] rounded">
                <span className="font-semibold text-[#17202A] block mb-1">
                  Phase 0: Repository Scaffolding
                </span>
                <span className="text-[#2F6B4F] font-medium">✔ In Progress (Finalizing)</span>
              </div>

              <div className="p-3 bg-gray-50 border border-[#E5E7EB] rounded">
                <span className="font-semibold text-[#17202A] block mb-1">
                  Phase 1: Backend & MongoDB Connection
                </span>
                <span className="text-[#667085]">Next (Pairs with First Git Commit)</span>
              </div>

              <div className="p-3 bg-gray-50 border border-[#E5E7EB] rounded">
                <span className="font-semibold text-[#17202A] block mb-1">
                  Phase 2: Auth & RBAC (HTTP-only Cookies)
                </span>
                <span className="text-[#667085]">Scheduled</span>
              </div>

              <div className="p-3 bg-gray-50 border border-[#E5E7EB] rounded">
                <span className="font-semibold text-[#17202A] block mb-1">
                  Phase 3: Catalog & ImageKit
                </span>
                <span className="text-[#667085]">Scheduled</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] bg-white py-4 text-center text-xs text-[#667085]">
        ShopSphere &bull; SDE Placement E-Commerce Platform &bull; Built with Engineering Depth
      </footer>
    </div>
  );
}

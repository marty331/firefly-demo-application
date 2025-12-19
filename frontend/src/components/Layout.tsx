import { Outlet, Link, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-900 text-white py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold hover:text-gray-300">
            Adobe Firefly API Demo
          </Link>
          {!isHome && (
            <Link
              to="/"
              className="text-sm bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
            >
              ← Back to Scenarios
            </Link>
          )}
        </div>
      </header>
      
      <main className="flex-1">
        <Outlet />
      </main>
      
      <footer className="bg-gray-100 py-4 px-6 text-center text-sm text-gray-500">
        Demo Application for Adobe Firefly Services API
      </footer>
    </div>
  );
}

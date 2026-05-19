import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ecommerce Health Monitor',
  description: 'Monitor the health of your ecommerce stores',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-primary-600">
                  🏪 Ecommerce Health Monitor
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <a href="/stores" className="text-gray-600 hover:text-gray-900">Stores</a>
                <a href="/alerts" className="text-gray-600 hover:text-gray-900">Alerts</a>
                <a href="/settings" className="text-gray-600 hover:text-gray-900">Settings</a>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
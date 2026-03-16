import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-6xl font-bold text-gray-900">404</h1>
      <h2 className="text-2xl font-semibold text-gray-700">Page Not Found</h2>
      <p className="text-gray-500">The page you are looking for does not exist.</p>
      <Link
        href="/dashboard"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

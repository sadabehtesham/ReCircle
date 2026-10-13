import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mt-10 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-green-700 underline">Go home</Link>
    </div>
  );
}

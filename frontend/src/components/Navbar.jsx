import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import useUnread from '../hooks/useUnread';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const unread = useUnread();

  const handleLogout = async () => {
    setError('');
    try {
      await logout();
      navigate('/');
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <header className="border-b bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between p-4">
        <Link to="/" className="text-lg font-bold text-green-700">ReUseLoop</Link>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link to="/items">Browse</Link>
          {user ? (
            <>
              <Link to="/items/new">List an item</Link>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/my-listings">My Listings</Link>
              <Link to="/requests">My requests</Link>
              <Link to="/requests/incoming">Incoming</Link>
              <Link to="/loans">Loans</Link>
              <Link to="/notifications" className="flex items-center gap-1">
                Notifications
                {unread.count > 0 && (
                  <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">
                    {unread.count > 99 ? '99+' : unread.count}
                    <span className="sr-only"> unread</span>
                  </span>
                )}
              </Link>
              <Link to={`/users/${user._id}`}>Profile</Link>
              <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register" className="rounded-md bg-green-700 px-3 py-1.5 text-white hover:bg-green-800">Sign up</Link>
            </>
          )}
        </div>
      </nav>
      {(error || unread.error) && (
        <p role="alert" className="mx-auto max-w-5xl px-4 pb-3 text-sm text-red-600">{error || unread.error}</p>
      )}
    </header>
  );
}

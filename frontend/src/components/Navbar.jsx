import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

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
        <div className="flex items-center gap-4 text-sm">
          <Link to="/items">Browse</Link>
          {user ? (
            <>
              <Link to="/items/new">List an item</Link>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/requests">My requests</Link>
              <Link to="/requests/incoming">Incoming</Link>
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
      {error && <p role="alert" className="mx-auto max-w-5xl px-4 pb-3 text-sm text-red-600">{error}</p>}
    </header>
  );
}

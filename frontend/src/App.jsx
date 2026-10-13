import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import { useAuth } from './context/AuthContext';
import Marketplace from './pages/Marketplace';
import ItemDetail from './pages/ItemDetail';
import ItemForm from './pages/ItemForm';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Requests from './pages/Requests';

export default function App() {
  const { authError } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar />
      <main className="mx-auto max-w-5xl p-4">
        {authError && <p role="alert" className="mt-4 text-sm text-red-600">{authError}</p>}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/items" element={<Marketplace />} />
          <Route path="/items/:id" element={<ItemDetail />} />
          <Route path="/users/:id" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/items/new" element={<ItemForm />} />
            <Route path="/items/:id/edit" element={<ItemForm />} />
            <Route path="/profile/edit" element={<EditProfile />} />
            <Route path="/requests" element={<Requests role="borrower" />} />
            <Route path="/requests/incoming" element={<Requests role="owner" />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

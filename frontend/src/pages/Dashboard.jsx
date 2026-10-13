import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  return <h1 className="mt-6 text-2xl font-semibold">Welcome, {user.name}</h1>;
}

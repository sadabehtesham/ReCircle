import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../context/AuthContext';

const fields = [
  { id: 'email', label: 'College email', type: 'email', autoComplete: 'email' },
  { id: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from?.pathname || '/dashboard';

  return (
    <AuthForm
      title="Log in"
      submitLabel="Log in"
      fields={fields}
      action={async (v) => {
        await login(v);
        navigate(from, { replace: true });
      }}
      footer={<>No account? <Link to="/register" className="text-green-700 underline">Register</Link></>}
    />
  );
}

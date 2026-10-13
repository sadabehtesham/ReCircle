import { Link, useNavigate } from 'react-router-dom';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../context/AuthContext';

const fields = [
  { id: 'name', label: 'Full name', autoComplete: 'name' },
  { id: 'email', label: 'College email', type: 'email', autoComplete: 'email' },
  { id: 'college', label: 'College name' },
  { id: 'password', label: 'Password (min 8 characters)', type: 'password', minLength: 8, autoComplete: 'new-password' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthForm
      title="Create your account"
      submitLabel="Sign up"
      fields={fields}
      action={async (v) => {
        await register(v);
        navigate('/dashboard', { replace: true });
      }}
      footer={<>Already registered? <Link to="/login" className="text-green-700 underline">Log in</Link></>}
    />
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import Avatar from '../components/Avatar';
import Field from '../components/Field';
import { useAuth } from '../context/AuthContext';

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: user.name, college: user.college });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(user.profileImage);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(user.profileImage);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, user.profileImage]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const formData = new FormData();
    formData.append('name', values.name);
    formData.append('college', values.college);
    if (file) formData.append('image', file);
    try {
      const response = await api.patch('/users/me', formData);
      setUser(response.data.data.user);
      navigate(`/users/${user._id}`);
    } catch (requestError) {
      setError(errMsg(requestError));
      setBusy(false);
    }
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-semibold">Edit profile</h1>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-4">
        <Avatar user={{ ...user, profileImage: preview }} size="h-20 w-20" />
        <div>
          <label htmlFor="image" className="block text-sm font-medium text-gray-700">Profile photo</label>
          <input
            id="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setFile(event.target.files[0] || null)}
            className="mt-1 block text-sm"
          />
        </div>
      </div>
      <Field id="name" label="Full name" minLength={2} maxLength={60} value={values.name} onChange={updateField} />
      <Field id="college" label="College name" maxLength={100} value={values.college} onChange={updateField} />
      <p className="text-sm text-gray-600">Email: {user.email} (can't be changed)</p>
      <div className="flex gap-2">
        <button
          disabled={busy}
          className="rounded-md bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={() => navigate(-1)} className="rounded-md border px-4 py-2">Cancel</button>
      </div>
    </form>
  );
}

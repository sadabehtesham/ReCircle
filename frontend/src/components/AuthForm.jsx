import { useState } from 'react';
import Field from './Field';
import { errMsg } from '../api/client';

export default function AuthForm({ title, fields, action, submitLabel, footer }) {
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await action(values);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-sm space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {fields.map((f) => (
        <Field
          key={f.id}
          {...f}
          value={values[f.id] || ''}
          onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
        />
      ))}
      <button
        disabled={busy}
        className="w-full rounded-md bg-green-700 py-2 font-medium text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:opacity-60"
      >
        {busy ? 'Please wait…' : submitLabel}
      </button>
      <p className="text-center text-sm text-gray-600">{footer}</p>
    </form>
  );
}

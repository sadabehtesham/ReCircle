import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import Field from '../components/Field';
import Select from '../components/Select';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, CONDITIONS, LENDING } from '../utils/constants';

const empty = {
  title: '',
  description: '',
  category: 'textbooks',
  condition: 'good',
  lendingType: 'borrow',
  price: '',
  pickupLocation: '',
  listingStatus: 'available',
};

export default function ItemForm() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState(empty);
  const [existing, setExisting] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!id) return undefined;
    let live = true;
    api
      .get(`/items/${id}`)
      .then((response) => {
        if (!live) return;
        const item = response.data.data.item;
        if (item.ownerId._id !== user._id) {
          setForbidden(true);
          return;
        }
        setValues({ ...empty, ...item, price: item.price ?? '' });
        setExisting(item.images);
      })
      .catch((requestError) => {
        if (live) setError(errMsg(requestError));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id, user._id]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const toggleRemoved = (publicId) => {
    setRemoved((current) =>
      current.includes(publicId)
        ? current.filter((idToRemove) => idToRemove !== publicId)
        : [...current, publicId]
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const formData = new FormData();
    ['title', 'description', 'category', 'condition', 'pickupLocation'].forEach((key) => {
      formData.append(key, values[key]);
    });
    if (id) formData.append('listingStatus', values.listingStatus);
    else formData.append('lendingType', values.lendingType);
    if (values.lendingType === 'sell') formData.append('price', values.price);
    removed.forEach((publicId) => formData.append('removeImages', publicId));
    files.forEach((file) => formData.append('images', file));

    try {
      const response = await (id
        ? api.patch(`/items/${id}`, formData)
        : api.post('/items', formData));
      navigate(`/items/${response.data.data.item._id}`);
    } catch (requestError) {
      setError(errMsg(requestError));
      setBusy(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (forbidden) return <p role="alert" className="text-red-600">You can only edit your own listings.</p>;
  if (id && ['reserved', 'closed'].includes(values.listingStatus)) {
    return <p role="alert" className="text-red-600">This listing is in a transaction and cannot be changed.</p>;
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-2xl font-semibold">{id ? 'Edit listing' : 'List an item'}</h1>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <Field id="title" label="Title" minLength={3} maxLength={100} value={values.title} onChange={updateField} />
      <Field
        id="description"
        label="Description"
        as="textarea"
        rows={4}
        minLength={10}
        maxLength={1000}
        value={values.description}
        onChange={updateField}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select id="category" label="Category" options={CATEGORIES} value={values.category} onChange={updateField} />
        <Select id="condition" label="Condition" options={CONDITIONS} value={values.condition} onChange={updateField} />
        <Select
          id="lendingType"
          label="Type"
          options={LENDING}
          value={values.lendingType}
          onChange={updateField}
          disabled={Boolean(id)}
        />
        {values.lendingType === 'sell' && (
          <Field
            id="price"
            label="Price (₹)"
            type="number"
            min={0}
            max={100000}
            step={1}
            value={values.price}
            onChange={updateField}
          />
        )}
      </div>
      <Field
        id="pickupLocation"
        label="Campus pickup location"
        maxLength={100}
        value={values.pickupLocation}
        onChange={updateField}
      />
      {id && (
        <Select
          id="listingStatus"
          label="Availability"
          options={{ available: 'Available', unavailable: 'Not available right now' }}
          value={values.listingStatus}
          onChange={updateField}
        />
      )}

      {existing.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700">Current photos</p>
          <div className="mt-1 flex flex-wrap gap-3">
            {existing.map((image) => {
              const isRemoved = removed.includes(image.publicId);
              return (
                <div key={image.publicId}>
                  <img
                    src={image.url}
                    alt=""
                    className={`h-20 w-20 rounded object-cover ${isRemoved ? 'opacity-30' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => toggleRemoved(image.publicId)}
                    className="text-xs text-red-600 underline"
                  >
                    {isRemoved ? 'Undo' : 'Remove'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="images" className="block text-sm font-medium text-gray-700">
          {id ? 'Add photos' : 'Photos'} (up to 5 in total, 5 MB each)
        </label>
        <input
          id="images"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          required={!id}
          onChange={(event) => setFiles(Array.from(event.target.files))}
          className="mt-1 block w-full text-sm"
        />
      </div>

      <div className="flex gap-2">
        <button
          disabled={busy}
          className="rounded-md bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 disabled:opacity-60"
        >
          {busy ? 'Saving…' : id ? 'Save changes' : 'Publish listing'}
        </button>
        <button type="button" onClick={() => navigate(-1)} className="rounded-md border px-4 py-2">Cancel</button>
      </div>
    </form>
  );
}

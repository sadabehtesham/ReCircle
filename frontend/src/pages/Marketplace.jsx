import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import Field from '../components/Field';
import ItemCard from '../components/ItemCard';
import Pagination from '../components/Pagination';
import Select from '../components/Select';
import useDebounce from '../hooks/useDebounce';
import { CATEGORIES, CONDITIONS, LENDING } from '../utils/constants';

const SORTS = { newest: 'Newest', oldest: 'Oldest', title: 'Title A–Z' };

export default function Marketplace() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const debounced = useDebounce(search);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const query = params.toString();

  useEffect(() => {
    setSearch(params.get('search') || '');
  }, [params]);

  const set = (key, value) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        return next;
      },
      { replace: true }
    );

  useEffect(() => {
    if (debounced !== search) return;
    if (debounced !== (params.get('search') || '')) set('search', debounced);
  }, [debounced, search, params, setParams]);

  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    api
      .get(`/items${query ? `?${query}` : ''}`)
      .then((response) => {
        if (live) setData(response.data.data);
      })
      .catch((requestError) => {
        if (live) setError(errMsg(requestError));
      });
    return () => {
      live = false;
    };
  }, [query]);

  const filter = (id, label, options) => (
    <Select
      id={id}
      label={label}
      placeholder="All"
      options={options}
      value={params.get(id) || ''}
      onChange={(event) => set(id, event.target.value)}
    />
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Browse items</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field
          id="search"
          label="Search"
          required={false}
          maxLength={60}
          placeholder="e.g. calculator"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {filter('category', 'Category', CATEGORIES)}
        {filter('condition', 'Condition', CONDITIONS)}
        {filter('lendingType', 'Type', LENDING)}
        <Select
          id="sort"
          label="Sort by"
          options={SORTS}
          value={params.get('sort') || 'newest'}
          onChange={(event) => set('sort', event.target.value)}
        />
      </div>

      {error && <p role="alert" className="mt-6 text-red-600">{error}</p>}

      {!data && !error && (
        <div aria-busy="true" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      )}

      {data && (
        <>
          <p className="mt-6 text-sm text-gray-600">{data.total} item{data.total === 1 ? '' : 's'}</p>
          {data.items.length ? (
            <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.items.map((item) => <ItemCard key={item._id} item={item} />)}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border bg-white p-8 text-center">
              <p>No items match your search.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setParams({});
                }}
                className="mt-2 text-green-700 underline"
              >
                Clear filters
              </button>
            </div>
          )}
          <Pagination page={data.page} pages={data.pages} onChange={(nextPage) => set('page', String(nextPage))} />
        </>
      )}
    </div>
  );
}

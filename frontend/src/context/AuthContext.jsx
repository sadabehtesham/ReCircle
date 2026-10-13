import { createContext, useContext, useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((r) => setUser(r.data.data.user))
      .catch((error) => {
        if (error.response?.status !== 401) {
          setAuthError(errMsg(error));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const authenticate = (path) => async (body) => {
    const { data } = await api.post(path, body);
    setUser(data.data.user);
    setAuthError(null);
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    setAuthError(null);
  };

  const value = {
    user,
    setUser,
    loading,
    authError,
    login: authenticate('/auth/login'),
    register: authenticate('/auth/register'),
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

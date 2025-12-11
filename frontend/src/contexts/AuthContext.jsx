import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');

  const [user, setUser] = useState(storedUser ? JSON.parse(storedUser) : null);
  const [token, setToken] = useState(storedToken);
  const [loading, setLoading] = useState(Boolean(storedToken));

  // -------------------------
  // LOGIN
  // -------------------------
  const login = async ({ username, password, role }) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password, role });

      // Save token
      setToken(data.token);
      localStorage.setItem('token', data.token);

      // Save user with ROLE
      const userData = { id: data.user.id, role: data.user.role };
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));

      return data;
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // AUTO LOAD PROFILE WHEN TOKEN EXISTS
  // -------------------------
  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        setUser(null);
        return;
      }

      setLoading(true);
      try {
        const { data } = await api.get('/admin/users/profile');

        if (data?.profile) {
          const userData = {
            id:
              data.profile.admin_id ||
              data.profile.faculty_id ||
              data.profile.student_id,
            role: data.role,
          };

          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        }
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token]);

  // -------------------------
  // LOGOUT
  // -------------------------
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const value = useMemo(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// -------------------------
// HOOK EXPORT
// -------------------------
export const useAuth = () => useContext(AuthContext);

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('neuroswarm_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('neuroswarm_token'));
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setToken(null);
      setSessionExpired(true);
    };

    window.addEventListener('session-expired', handleSessionExpired);

    // Verify token validity on load
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data);
          localStorage.setItem('neuroswarm_user', JSON.stringify(res.data));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => {
      window.removeEventListener('session-expired', handleSessionExpired);
    };
  }, [token]);

  const login = async (email, password) => {
    setSessionExpired(false);
    const res = await api.post('/auth/login', { email, password });
    const { access_token, user: loggedUser } = res.data;
    localStorage.setItem('neuroswarm_token', access_token);
    localStorage.setItem('neuroswarm_user', JSON.stringify(loggedUser));
    setToken(access_token);
    setUser(loggedUser);
    return loggedUser;
  };

  const logout = () => {
    localStorage.removeItem('neuroswarm_token');
    localStorage.removeItem('neuroswarm_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        isAuthenticated: !!token && !!user,
        loading,
        sessionExpired,
        setSessionExpired,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, getToken, setToken, getProfileId, setProfileId } from './api.js';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [access, setAccess] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const [themeOverride, setThemeOverride] = useState(localStorage.getItem('kb_theme') || '');

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null); setProfile(null); setAccess(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get('/auth/me');
      setUser(me.user);
      setProfile(me.profile);
      setAccess(me.access);
      if (me.profile?.id) setProfileId(me.profile.id);
    } catch {
      setToken(null);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    api.get('/curriculum').then(setCurriculum).catch(() => {});
  }, [refresh]);

  const loginWithToken = useCallback(async (token, profileId) => {
    setToken(token);
    if (profileId) setProfileId(profileId);
    await refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    setToken(null);
    setProfileId(null);
    setUser(null);
    setProfile(null);
    setAccess(null);
  }, []);

  const selectProfile = useCallback(async (profileId, pin) => {
    const res = await api.post('/auth/profile', { profileId, pin });
    setProfileId(res.profile.id);
    await refresh();
    return res.profile;
  }, [refresh]);

  // Age-adaptive screens (PRD §8): young learners vs older students.
  const theme = themeOverride
    || (profile && curriculum
      ? (curriculum.classes.find((c) => c.id === profile.classId)?.ageBand === 'young' ? 'young' : 'elder')
      : 'elder');

  const setTheme = useCallback((t) => {
    setThemeOverride(t);
    localStorage.setItem('kb_theme', t);
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const value = useMemo(() => ({
    user, profile, access, curriculum, loading, theme, themeOverride,
    setTheme, refresh, loginWithToken, logout, selectProfile,
  }), [user, profile, access, curriculum, loading, theme, themeOverride, setTheme, refresh, loginWithToken, logout, selectProfile]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

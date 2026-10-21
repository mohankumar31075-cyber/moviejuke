import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Spinner } from './components/Layout.jsx';
import { useApp } from './store.jsx';
import Home from './pages/Home.jsx';
import Browse from './pages/Browse.jsx';
import TopicPage from './pages/TopicPage.jsx';
import QuizPage from './pages/QuizPage.jsx';
import Login from './pages/Login.jsx';
import ParentDash from './pages/ParentDash.jsx';
import TeacherDash from './pages/TeacherDash.jsx';
import CMS from './pages/CMS.jsx';
import Admin from './pages/Admin.jsx';
import Pricing from './pages/Pricing.jsx';
import Certificates, { VerifyPage } from './pages/Certificates.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import { LiveHub, LiveGame, JoinPage } from './pages/LivePage.jsx';

export default function App() {
  const { loading } = useApp();
  if (loading) return <div style={{ padding: 60 }}><Spinner /></div>;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/browse/:classId" element={<Browse />} />
        <Route path="/browse/:classId/:subjectId" element={<Browse />} />
        <Route path="/topic/:id" element={<TopicPage />} />
        <Route path="/quiz/:id" element={<QuizPage />} />
        <Route path="/live" element={<LiveHub />} />
        <Route path="/live/:code" element={<LiveGame />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/parent" element={<ParentDash />} />
        <Route path="/teacher" element={<TeacherDash />} />
        <Route path="/cms" element={<CMS />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/certificates" element={<Certificates />} />
        <Route path="/verify/:serial" element={<VerifyPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

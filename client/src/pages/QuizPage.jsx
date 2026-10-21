import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { QuizPlayer } from '../components/QuizPlayer.jsx';
import { TrialBanner } from '../components/Layout.jsx';
import { useApp } from '../store.jsx';

export default function QuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useApp();

  return (
    <div>
      <TrialBanner />
      {!user && (
        <div className="banner warn">
          <span>👋</span>
          <div>
            You are playing in guest mode — sign in to save scores, earn certificates and keep your trial time.{' '}
            <Link to="/login" style={{ color: 'inherit', fontWeight: 800 }}>Sign in →</Link>
          </div>
        </div>
      )}
      <QuizPlayer quizId={id} onExit={() => navigate(-1)} />
    </div>
  );
}

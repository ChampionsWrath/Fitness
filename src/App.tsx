import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useProfile, useTheme } from './hooks/useProfile';
import { useSyncStatus } from './hooks/useSync';
import { SyncBanner } from './components/SyncBanner';
import { useRoute } from './hooks/useRoute';
import { sync } from './sync/engine';
import { SupabaseBackend } from './sync/supabaseBackend';
import { ActiveWorkout } from './screens/ActiveWorkout';
import { ExerciseLibrary, ExercisePage } from './screens/ExerciseLibrary';
import { History, SessionDetail } from './screens/History';
import { FigureGallery } from './screens/FigureGallery';
import { FoodTab } from './screens/FoodTab';
import { FoodTargets } from './screens/FoodTargets';
import { Home } from './screens/Home';
import { IntervalGuide } from './screens/IntervalGuide';
import { LogPastWorkout } from './screens/LogPastWorkout';
import { Login } from './screens/Login';
import { Onboarding } from './screens/Onboarding';
import { Photos } from './screens/Photos';
import { ProgressTab } from './screens/ProgressTab';
import { Settings } from './screens/Settings';
import { WeightTracker } from './screens/WeightTracker';
import { WorkoutTab } from './screens/WorkoutTab';

export default function App() {
  const profile = useProfile();
  const auth = useAuth();
  const syncStatus = useSyncStatus();
  const { parts, navigate, back } = useRoute();
  useTheme(profile?.theme);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [parts.join('/')]);

  useEffect(() => {
    if (!auth.configured || auth.loading) return;
    sync.stop();
    void sync.start(auth.session ? new SupabaseBackend(auth.session.user.id) : null, auth.session ? undefined : 'Not signed in');
  }, [auth.configured, auth.loading, auth.session?.user.id]);

  if (parts[0] === 'figures') return <div className="app"><FigureGallery onBack={() => navigate('/exercises')} /></div>;
  // Cloud backup is configured: require sign-in before anything else so a
  // profile is always backed up to its owner's account, never anonymous.
  if (auth.configured) {
    if (auth.loading) return <div className="app" />;
    if (!auth.session) return <div className="app"><Login /></div>;
  }
  if (profile === undefined) return <div className="app" />;
  // Hold the onboarding screen back while a cloud restore is in flight.
  if (!profile && syncStatus.state === 'checking')
    return (
      <div className="app">
        <div className="screen no-nav" style={{ paddingTop: '40vh', textAlign: 'center' }}>
          <div className="eyebrow">Restoring your data</div>
          <p className="muted small" style={{ marginTop: 8 }}>
            One moment…
          </p>
        </div>
      </div>
    );
  if (!profile || !profile.onboardingComplete) return <div className="app"><Onboarding existing={profile} /></div>;

  const [root = 'home', a, b, c, d] = parts;
  let screen: React.ReactNode;
  switch (root) {
    case 'workout':
      if (a === 'session' && b && c === 'block' && d) screen = <IntervalGuide sessionId={b} index={Number(d)} />;
      else if (a === 'session' && b) screen = <ActiveWorkout sessionId={b} profile={profile} />;
      else if (a === 'day' && b) screen = <WorkoutTab profile={profile} date={b} />;
      else screen = <WorkoutTab profile={profile} />;
      break;
    case 'progress':
      if (a === 'weight') screen = <WeightTracker profile={profile} onBack={() => navigate('/progress')} />;
      else if (a === 'photos') screen = <Photos profile={profile} onBack={() => navigate('/progress')} />;
      else if (a === 'history' && b === 'new') screen = <LogPastWorkout profile={profile} onBack={() => navigate('/progress/history')} />;
      else if (a === 'history' && b) screen = <SessionDetail id={b} profile={profile} onBack={() => navigate('/progress/history')} justFinished={c === 'done'} />;
      else if (a === 'history') screen = <History profile={profile} onBack={() => navigate('/progress')} />;
      else screen = <ProgressTab profile={profile} />;
      break;
    case 'food':
      if (a === 'targets') screen = <FoodTargets profile={profile} onBack={() => navigate('/food')} />;
      else if (a === 'day' && b) screen = <FoodTab profile={profile} date={b} />;
      else screen = <FoodTab profile={profile} />;
      break;
    case 'exercises':
      if (a) screen = <ExercisePage id={a} profile={profile} onBack={back} />;
      else screen = <ExerciseLibrary profile={profile} />;
      break;
    case 'settings':
      screen = <Settings profile={profile} onBack={() => navigate('/home')} />;
      break;
    case 'figures':
      screen = <FigureGallery onBack={() => navigate('/exercises')} />;
      break;
    case 'onboarding':
      screen = <Onboarding existing={profile} />;
      break;
    default:
      screen = <Home profile={profile} />;
  }
  return (
    <div className="app">
      {screen}
      <SyncBanner />
    </div>
  );
}

import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter, NavLink, Routes, Route, useNavigate, Link, Navigate, useLocation
} from 'react-router-dom';
import {
  Activity, CalendarDays, Dumbbell, Home, Play, Plus, Settings,
  Footprints, Flame, Clock3, Pause, SkipForward, X, Check,
  ChevronRight, Search, LogOut, Mail, LockKeyhole, Sparkles,
  BarChart3, HeartPulse, Award, Bell, Zap, LayoutGrid, List,
  Trophy, CheckCircle2, TrendingUp, Target, Bike, Layers
} from 'lucide-react';
import { api, fromExercise, fromRecovery, fromSchedule, fromSession, getToken, loadAccount, setToken, toExercise, toSchedule } from './api.js';
import './styles.css';
import './polish.css';

/* ── Data ─────────────────────────────────────────────────── */
const exercises = [
  { id: 'jumping-jacks', name: 'Jumping Jacks', muscle: 'Cardio', level: 'Beginner', duration: 30, sets: 3, reps: '30 giây', met: 8, emoji: '⚡', color: '#E8F5D0', tip: 'Nhảy nhẹ, mở rộng tay chân đồng thời.', video: 'https://www.youtube.com/embed/c4DAnQ6DtF8' },
  { id: 'push-up', name: 'Push-up', muscle: 'Ngực & tay', level: 'Beginner', duration: 45, sets: 3, reps: '10 lần', met: 7, emoji: '💪', color: '#D6EEFF', tip: 'Giữ cơ thể thành một đường thẳng, hạ ngực có kiểm soát.', video: 'https://www.youtube.com/embed/IODxDxX7oi4' },
  { id: 'squat', name: 'Bodyweight Squat', muscle: 'Chân & mông', level: 'Beginner', duration: 45, sets: 3, reps: '15 lần', met: 5.5, emoji: '🏋️', color: '#EDE6FF', tip: 'Đẩy hông về sau, đầu gối hướng theo ngón chân.', video: 'https://www.youtube.com/embed/aclHkVaku9U' },
  { id: 'plank', name: 'Plank', muscle: 'Core', level: 'Beginner', duration: 30, sets: 3, reps: '30 giây', met: 3.8, emoji: '🧘', color: '#E0F7E0', tip: 'Siết core, không võng lưng, hít thở đều.', video: 'https://www.youtube.com/embed/pSHjTRCQxIw' },
  { id: 'mountain-climbers', name: 'Mountain Climbers', muscle: 'Toàn thân', level: 'Intermediate', duration: 30, sets: 3, reps: '30 giây', met: 8, emoji: '🔥', color: '#FFE8DA', tip: 'Vai nằm trên cổ tay và di chuyển đầu gối luân phiên.', video: 'https://www.youtube.com/embed/nmwgirgXLYM' },
  { id: 'glute-bridge', name: 'Glute Bridge', muscle: 'Chân & mông', level: 'Beginner', duration: 40, sets: 3, reps: '12 lần', met: 4, emoji: '🌿', color: '#FFF0DC', tip: 'Ép gót chân xuống sàn, siết mông ở đỉnh chuyển động.', video: 'https://www.youtube.com/embed/wPM8icPu6H8' },
];

const initial = {
  weight: null,
  streak: 0,
  xp: 0,
  level: 1,
  weeklyWorkoutGoal: null,
  planned: [],
  sessions: [],
  userExercises: [],
  recoveryLogs: [],
  plans: [],
  calorieEstimates: [],
  challenges: [
    { id: 'workouts', title: 'Tuần năng động', description: 'Hoàn thành 3 buổi tập tuần này', target: 3, reward: 120, type: 'workouts' },
  ],
};

/* ── Toast hook ───────────────────────────────────────────── */
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = 'default') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);
  return { toasts, show };
}

function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <CheckCircle2 size={15} />
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ── Progress Ring ────────────────────────────────────────── */
function Ring({ value = 0, color = 'var(--accent)', size = 160, children }) {
  const deg = Math.min(value, 100) * 3.6;
  return (
    <div className="ring" style={{ '--p': `${deg}deg`, '--ring-color': color, '--ring-size': `${size}px` }}>
      <div>{children}</div>
    </div>
  );
}

/* ── App Root ─────────────────────────────────────────────── */
/* ── Auth ─────────────────────────────────────────────────── */
function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(initial);
  const [authLoading, setAuthLoading] = useState(Boolean(getToken()));
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!getToken()) return undefined;
    let active = true;
    loadAccount().then(account => {
      if (!active) return;
      setUser(account.profile);
      setData({ ...initial, ...account.data });
      setAuthLoading(false);
    }).catch(error => {
      if (!active) return;
      setToken(null);
      setAuthLoading(false);
      setApiError(error.message);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const expireSession = () => {
      setUser(null);
      setData(initial);
    };
    window.addEventListener('homefit:unauthorized', expireSession);
    return () => window.removeEventListener('homefit:unauthorized', expireSession);
  }, []);

  const login = async credentials => {
    const result = await api(credentials.isSignup ? '/auth/register' : '/auth/login', {
      method: 'POST',
      auth: false,
      body: credentials.isSignup
        ? { name: credentials.name, email: credentials.email, password: credentials.password }
        : { email: credentials.email, password: credentials.password },
    });
    setToken(result.token);
    try {
      const account = await loadAccount();
      setUser(account.profile);
      setData({ ...initial, ...account.data });
      setApiError('');
    } catch (error) {
      setToken(null);
      throw error;
    }
  };

  const update = async patch => {
    try {
      let next = { ...patch };
      if (['weight', 'fitnessGoal', 'weeklyGoalType', 'weeklyGoalTarget'].some(key => patch[key] !== undefined)) {
        const profile = await api('/auth/me', {
          method: 'PATCH',
          body: {
            ...(patch.weight !== undefined ? { weightKg: patch.weight } : {}),
            ...(patch.fitnessGoal !== undefined ? { fitnessGoal: patch.fitnessGoal } : {}),
            ...(patch.weeklyGoalType !== undefined ? { weeklyGoalType: patch.weeklyGoalType } : {}),
            ...(patch.weeklyGoalTarget !== undefined ? { weeklyGoalTarget: patch.weeklyGoalTarget } : {}),
          },
        });
        setUser(profile);
        next = { ...next, weight: profile.weightKg, fitnessGoal: profile.fitnessGoal, weeklyGoalType: profile.weeklyGoalType, weeklyGoalTarget: profile.weeklyGoalTarget };
      }
      if (patch.userExercises) {
        const old = data.userExercises || [];
        const desired = patch.userExercises;
        const ids = new Set(desired.map(value => value.id));
        const saved = [];
        for (const value of desired) {
          const result = old.some(item => item.id === value.id)
            ? await api(`/exercises/${value.id}`, { method: 'PATCH', body: toExercise(value) })
            : await api('/exercises', { method: 'POST', body: toExercise(value) });
          saved.push(fromExercise(result));
        }
        for (const value of old) if (!ids.has(value.id)) await api(`/exercises/${value.id}`, { method: 'DELETE' });
        next.userExercises = saved;
      }

      const createdScheduleIds = {};
      if (patch.sessions) {
        const known = new Set((data.sessions || []).map(item => item.id).filter(Boolean));
        const additions = patch.sessions.filter(item => !item.id || !known.has(item.id));
        const sessions = [];
        for (const item of additions) {
          const completed = (patch.planned || data.planned || []).find(plan => plan.status === 'completed' &&
            (data.planned || []).some(previous => previous.id === plan.id && previous.status !== 'completed'));
          const schedule = completed && (data.planned || []).find(plan => plan.id === completed.id);
          const completedAt = item.date || new Date().toISOString();
          const result = await api('/sessions', {
            method: 'POST',
            body: {
              ...(schedule ? { scheduleId: schedule.id } : {}),
              title: item.title || schedule?.title || 'Workout',
              startedAt: new Date(new Date(completedAt).getTime() - Number(item.duration || 0) * 1000).toISOString(),
              completedAt,
              durationSeconds: Number(item.duration),
              exerciseIds: item.exerciseIds || schedule?.items || [],
              completedExercises: Number(item.completedExercises),
              ...(item.distanceKm != null ? { distanceKm: Number(item.distanceKm) } : {}),
            },
          });
          sessions.push(fromSession(result));
          if (schedule) next.planned = (patch.planned || data.planned).map(plan => plan.id === schedule.id ? { ...plan, status: 'completed' } : plan);
        }
        next.sessions = [...sessions, ...(data.sessions || []).filter(item => item.id)]
          .sort((first, second) => new Date(second.date) - new Date(first.date));
      }

      if (patch.planned) {
        const old = data.planned || [];
        const desired = next.planned || patch.planned;
        const saved = [];
        for (const value of desired) {
          if (value.status === 'completed') {
            saved.push(value);
            continue;
          }
          const previous = old.find(item => item.id === value.id);
          if (!previous) {
            const result = await api('/schedule', { method: 'POST', body: toSchedule(value) });
            const mapped = fromSchedule(result);
            createdScheduleIds[value.id] = mapped.id;
            saved.push(mapped);
          } else if (JSON.stringify(toSchedule(previous)) !== JSON.stringify(toSchedule(value))) {
            const result = await api(`/schedule/${value.id}`, { method: 'PATCH', body: toSchedule(value) });
            saved.push(fromSchedule(result));
          } else saved.push(previous);
        }
        const desiredIds = new Set(desired.map(item => item.id));
        for (const value of old) if (!desiredIds.has(value.id) && value.status !== 'completed') await api(`/schedule/${value.id}`, { method: 'DELETE' });
        next.planned = saved;
      }

      if (patch.recoveryLogs) {
        const latest = patch.recoveryLogs[0];
        if (latest) {
          const result = await api('/recovery', {
            method: 'PUT',
            body: {
              date: latest.date, sleep: Number(latest.sleep), quality: Number(latest.quality),
              energy: Number(latest.energy), fatigue: Number(latest.fatigue), soreness: Number(latest.soreness),
              mood: latest.mood || '', notes: latest.notes || '',
            },
          });
          next.recoveryLogs = [fromRecovery(result), ...patch.recoveryLogs.slice(1)];
        }
      }

      if (patch.calorieEstimates?.[0]) {
        const item = patch.calorieEstimates[0];
        const result = await api('/calorie-estimates', {
          method: 'POST',
          body: {
            exerciseCount: Number(item.count) || 0,
            ...(item.count ? { exerciseMinutes: Number(item.minutes) } : {}),
            intensity: item.intensity === 'high' ? 'vigorous' : item.intensity,
            ...(item.km ? { distanceKm: Number(item.km), distanceType: item.type } : {}),
            distanceIncludedInExercise: Boolean(item.distanceIncluded),
            bodyWeightKg: Number(item.weight),
          },
        });
        next.calorieEstimates = [result, ...(data.calorieEstimates || [])];
      }
      if (patch.sessions || patch.planned || patch.weight !== undefined || patch.weeklyGoalType !== undefined || patch.weeklyGoalTarget !== undefined) {
        next.dashboard = await api('/dashboard');
      }
      setData(current => ({ ...current, ...next }));
      setApiError('');
      return { ok: true, createdScheduleIds };
    } catch (error) {
      let message = error.message;
      if (!getToken()) {
        setUser(null);
        setData(initial);
      } else {
        try {
          const account = await loadAccount();
          setUser(account.profile);
          setData({ ...initial, ...account.data });
        } catch (refreshError) {
          message = `${message} Không thể đồng bộ lại trạng thái: ${refreshError.message}`;
        }
      }
      setApiError(message);
      return { ok: false, error: message };
    }
  };

  const logout = () => {
    setToken(null);
    setData(initial);
    setUser(null);
    setApiError('');
  };
  if (authLoading) return <div className="auth-layout"><p>Đang tải tài khoản HomeFit…</p></div>;
  return user
    ? <Shell data={data} update={update} user={user} logout={logout} apiError={apiError} />
    : <Login onLogin={login} apiError={apiError} />;
}

function Login({ onLogin, apiError }) {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async e => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Vui lòng nhập địa chỉ email hợp lệ.');
    if (password.length < 10) return setError('Mật khẩu cần ít nhất 10 ký tự.');
    if (isSignup && !name.trim()) return setError('Vui lòng nhập họ và tên.');
    setError('');
    try {
      await onLogin({ name: name.trim(), email, password, isSignup });
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="auth-layout">
      {/* Left brand panel */}
      <div className="auth-brand-panel">
        <div className="auth-logo">
          <div className="logo-mark"><Zap size={16} /></div>
          HomeFit
        </div>
        <div className="auth-tagline">
          <span className="eyebrow">Your home workout companion</span>
          <h1>Khỏe hơn<br /><em>mỗi ngày.</em></h1>
          <p>Tạo thói quen vận động bền vững, ngay tại nhà.</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-form-panel">
        <div className="auth-form-inner">
          <div className="auth-form-logo">
            <div className="logo-mark"><Zap size={14} /></div>
            HomeFit
          </div>
          <span className="eyebrow">Chào mừng bạn</span>
          <h2>{isSignup ? 'Tạo tài khoản' : 'Đăng nhập'}</h2>
          <p>{isSignup ? 'Bắt đầu hành trình khỏe mạnh của bạn.' : 'Tiếp tục hành trình luyện tập hôm nay.'}</p>

          <form onSubmit={submit} style={{ display: 'grid', gap: 'var(--sp-4)' }}>
            {isSignup && (
              <div className="auth-field">
                <label>Họ và tên</label>
                <input className="auth-field > input" value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Minh" required />
              </div>
            )}
            <div className="auth-field">
              <label>Email</label>
              <div className="auth-input-wrap">
                <Mail size={16} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@email.com" />
              </div>
            </div>
            <div className="auth-field">
              <label>Mật khẩu</label>
              <div className="auth-input-wrap">
                <LockKeyhole size={16} />
                <input type="password" minLength={10} value={password} onChange={e => setPassword(e.target.value)} placeholder="Tối thiểu 10 ký tự" />
              </div>
            </div>
            {(error || apiError) && <p className="form-error">{error || apiError}</p>}
            <button type="submit" className="auth-submit">
              {isSignup ? 'Tạo tài khoản' : 'Đăng nhập'}
              <ChevronRight size={16} />
            </button>
          </form>

          <p className="auth-switch">
            {isSignup ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
            <button className="auth-switch-btn" type="button" onClick={() => { setIsSignup(x => !x); setError(''); }}>
              {isSignup ? 'Đăng nhập' : 'Đăng ký ngay'}
            </button>
          </p>
          <small className="auth-note">Tài khoản được xác thực và lưu trên máy chủ HomeFit.</small>
        </div>
      </div>
    </div>
  );
}

/* ── Shell ────────────────────────────────────────────────── */
function Shell({ data, update, user, logout, apiError }) {
  const { toasts, show: showToast } = useToast();
  const initials = user.name.split(' ').map(x => x[0]).slice(-2).join('').toUpperCase();

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 17 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const dateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });

  const navItems = [
    [Home, 'Dashboard', '/'],
    [Sparkles, 'AI Coach', '/coach'],
    [Dumbbell, 'Workout Library', '/exercises'],
    [CalendarDays, 'My Schedule', '/schedule'],
    [Flame, 'Calorie Calculator', '/calories'],
    [BarChart3, 'Progress Analytics', '/analytics'],
    [Trophy, 'Challenges', '/challenges'],
    [HeartPulse, 'Recovery', '/recovery'],
    [Settings, 'Profile & Settings', '/settings'],
  ];

  return (
    <div className="app">
      <nav className="top-nav" aria-label="Điều hướng chính">
        <Link to="/" className="top-logo"><span><Zap size={15} /></span>HomeFit</Link>
        <div className="top-nav-links">
          {navItems.slice(0, 5).map(([Icon, label, path]) => (
            <NavLink key={path} to={path} end={path === '/'}><Icon size={16} />{label}</NavLink>
          ))}
        </div>
        <div className="top-account">
          <Link to="/workout" className="top-start"><Play size={14} fill="currentColor" /> Start workout</Link>
          <Link to="/settings" className="top-avatar" aria-label="Profile">{initials}</Link>
          <details className="top-more">
            <summary aria-label="Mở menu điều hướng"><List size={18} /><span>More</span></summary>
            <div className="top-more-menu">
              {navItems.map(([Icon, label, path]) => <NavLink key={path} to={path} end={path === '/'}><Icon size={16} />{label}</NavLink>)}
              <button onClick={logout}><LogOut size={16} /> Đăng xuất</button>
            </div>
          </details>
          <button className="top-logout" onClick={logout} aria-label="Đăng xuất"><LogOut size={16} /></button>
        </div>
      </nav>

      {/* Main */}
      <main className="content">
        {apiError && <p className="form-error" role="alert">{apiError}</p>}
        {apiError && <p className="form-error" role="alert">{apiError}</p>}
        {/* Header */}
        <header className="app-header">
          <div>
            <p className="greeting-date">{dateStr}</p>
            <h1>{greeting}, {user.name.split(' ')[0]}! 👋</h1>
          </div>
          <div className="header-right">
            <button className="notification-btn" aria-label="Thông báo">
              <Bell size={18} />
            </button>
            <Link to="/workout" className="header-start">
              <Play size={15} fill="currentColor" />
              <span className="start-label">Start Workout</span>
            </Link>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Dashboard data={data} user={user} />} />
          <Route path="/coach" element={<Coach data={data} update={update} showToast={showToast} />} />
          <Route path="/exercises" element={<Exercises data={data} update={update} showToast={showToast} />} />
          <Route path="/schedule" element={<Schedule data={data} update={update} showToast={showToast} />} />
          <Route path="/activity" element={<Navigate to="/calories" replace />} />
          <Route path="/calories" element={<CalorieCalculator data={data} update={update} showToast={showToast} />} />
          <Route path="/analytics" element={<Analytics data={data} />} />
          <Route path="/challenges" element={<Challenges data={data} />} />
          <Route path="/recovery" element={<Recovery data={data} update={update} showToast={showToast} />} />
          <Route path="/settings" element={<SettingsPage data={data} update={update} showToast={showToast} />} />
          <Route path="/workout" element={<Workout data={data} update={update} showToast={showToast} />} />
        </Routes>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="bottom-nav">
        <NavLink to="/" end><Home size={20} /><span>Home</span></NavLink>
        <NavLink to="/schedule"><CalendarDays size={20} /><span>Schedule</span></NavLink>
        <NavLink to="/workout" className="bottom-nav-float" aria-label="Start Workout"><Play size={20} fill="currentColor" /></NavLink>
        <NavLink to="/calories"><Flame size={20} /><span>Calories</span></NavLink>
        <NavLink to="/settings"><Settings size={20} /><span>Profile</span></NavLink>
      </nav>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

/* ── Calorie Calculator ───────────────────────────────────── */
function CalorieCalculator({ data, update, showToast }) {
  const [form, setForm] = useState({ exercises: '', distance: '', weight: data.weight || '', type: 'walk', intensity: 'moderate', minutes: '', distanceIncluded: false });
  const [result, setResult] = useState(null);
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const calculate = async event => {
    event.preventDefault();
    const weight = Number(form.weight);
    const count = Number(form.exercises || 0);
    const km = Number(form.distance || 0);
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(count) || count < 0 || !Number.isFinite(km) || km < 0 || (!count && !km)) return showToast('Nhập cân nặng hợp lệ và ít nhất một hoạt động.', 'error');
    if (count && form.minutes !== '' && (!Number.isFinite(Number(form.minutes)) || Number(form.minutes) <= 0)) return showToast('Thời lượng tập phải lớn hơn 0 phút.', 'error');
    const assumedDuration = count > 0 && form.minutes === '';
    const minutes = count ? Number(form.minutes || count * 3) : 0;
    const met = form.intensity === 'light' ? 3.5 : form.intensity === 'high' ? 8 : 5;
    const exerciseCalories = count ? met * 3.5 * weight / 200 * minutes : 0;
    const speedKph = form.type === 'run' ? 8 : 5;
    const distanceMinutes = km / speedKph * 60;
    const distanceMet = form.type === 'run' ? 8.3 : 3.3;
    const distanceIncluded = Boolean(form.distanceIncluded && count);
    const distanceCalories = km && !distanceIncluded ? distanceMet * 3.5 * weight / 200 * distanceMinutes : 0;
    const result = {
      total: Math.round(exerciseCalories + distanceCalories),
      exercise: Math.round(exerciseCalories),
      distance: Math.round(distanceCalories),
      minutes,
      distanceMinutes: Math.round(distanceMinutes),
      weight,
      count,
      km,
      type: form.type,
      intensity: form.intensity,
      distanceIncluded,
      assumedDuration,
    };
    const saved = await update({ calorieEstimates: [result, ...(data.calorieEstimates || [])] });
    if (!saved.ok) return showToast(saved.error, 'error');
    setResult(result);
  };
  const reset = () => {
    setForm({ exercises: '', distance: '', weight: data.weight || '', type: 'walk', intensity: 'moderate', minutes: '', distanceIncluded: false });
    setResult(null);
  };
  return (
    <section className="calculator-page">
      <div className="page-head"><span className="eyebrow">ESTIMATION TOOL</span><h2>Calorie Calculator</h2><p>Chỉ là ước tính từ thông tin bạn nhập; không phải số đo và không được cộng vào workout history.</p></div>
      <div className="calculator-grid">
        <form className="calculator-form" onSubmit={calculate}>
          <div className="form-section"><h3>Hoạt động</h3><div className="field-grid">
            <label>Số bài tập<input min="0" step="1" type="number" value={form.exercises} onChange={e => set('exercises', e.target.value)} placeholder="Ví dụ: 5" /></label>
            <label>Thời gian tập (phút)<input min="0" step=".1" type="number" value={form.minutes} onChange={e => set('minutes', e.target.value)} placeholder="Mặc định 3 phút/bài (ước tính)" /></label>
            <label>Quãng đường (km)<input min="0" step=".1" type="number" value={form.distance} onChange={e => set('distance', e.target.value)} placeholder="Ví dụ: 2.5" /></label>
            <label>Cân nặng (kg)<input min="1" max="500" step=".1" type="number" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="Cần để ước tính" /></label>
          </div></div>
          <div className="form-section"><h3>Cường độ và loại vận động</h3><div className="field-grid">
            <label>Cường độ bài tập<select value={form.intensity} onChange={e => set('intensity', e.target.value)}><option value="light">Nhẹ · 3.5 MET</option><option value="moderate">Trung bình · 5 MET</option><option value="high">Cao · 8 MET</option></select></label>
            <label>Quãng đường là<select value={form.type} onChange={e => set('type', e.target.value)}><option value="walk">Đi bộ · 5 km/h giả định</option><option value="run">Chạy · 8 km/h giả định</option></select></label>
          </div><label className="calorie-overlap"><input type="checkbox" checked={form.distanceIncluded} onChange={e => set('distanceIncluded', e.target.checked)} /> Quãng đường này đã nằm trong thời lượng bài tập — không cộng lần nữa.</label></div>
          <div className="calculator-actions"><button type="submit"><Flame size={16} /> Calculate Calories</button><button type="button" className="btn-secondary" onClick={reset}>Reset</button></div>
        </form>
        <div className="calculator-result">{result ? <>
          <span className="eyebrow">ESTIMATED · NOT MEASURED</span><b>{result.total}<small> kcal</small></b>
          <p>{result.weight} kg · {result.count ? `${result.count} bài tập, ${result.minutes} phút${result.assumedDuration ? ' (ước tính 3 phút/bài)' : ''}` : ''}{result.km ? `${result.count ? ' · ' : ''}${result.km} km ${result.type === 'run' ? 'chạy' : 'đi bộ'}` : ''}</p>
          <div className="result-breakdown"><span><small>Exercises · MET {result.intensity}</small><strong>{result.exercise} kcal</strong></span><span><small>Distance · {result.distanceIncluded ? 'đã loại trừ trùng lặp' : `${result.distanceMinutes} phút ước tính`}</small><strong>{result.distance} kcal</strong></span></div>
          <div className="calorie-note">Exercises: MET × 3.5 × cân nặng (kg) / 200 × phút. Nếu không nhập thời lượng, dùng giả định 3 phút/bài. Distance: đi bộ 3.3 MET ở 5 km/h hoặc chạy 8.3 MET ở 8 km/h. Hai phần chỉ được cộng khi là các hoạt động riêng biệt. Sai số cá nhân có thể đáng kể.</div>
        </> : <div className="result-empty"><Flame size={32}/><h3>Sẵn sàng để ước tính</h3><p>Nhập số bài tập hoặc quãng đường, cân nặng và giả định vận động.</p></div>}</div>
      </div>
    </section>
  );
}

/* ── Dashboard ────────────────────────────────────────────── */
function Dashboard({ data, user }) {
  const nav = useNavigate();
  const sessions = data.sessions || [];
  const serverDashboard = data.dashboard;
  const summary = serverDashboard?.summary;
  const today = new Date();
  const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);
  const isInRange = (session, start, end) => {
    const date = new Date(session.date);
    return Number.isFinite(date.getTime()) && date >= start && date < end;
  };
  const weeklySessions = sessions.filter(s => isInRange(s, monday, nextMonday));
  const minutesOf = list => Math.round(list.reduce((sum, s) => sum + (s.duration || 0), 0) / 60);
  const caloriesOf = list => list.reduce((sum, s) => sum + (Number.isFinite(s.calories) ? s.calories : 0), 0);
  const distanceOf = list => list.reduce((sum, s) => sum + (Number.isFinite(s.distanceKm) ? s.distanceKm : 0), 0);
  const exercisesOf = list => list.reduce((sum, s) => sum + (s.completedExercises || 0), 0);
  const weekMinutes = summary?.workoutMinutes ?? minutesOf(weeklySessions);
  const weekCalories = summary?.estimatedCalories ?? caloriesOf(weeklySessions);
  const weekDistance = summary?.distanceKm ?? distanceOf(weeklySessions);
  const hasDistance = serverDashboard?.availability?.distance ?? sessions.some(s => Number.isFinite(s.distanceKm));
  const weekHasDistance = summary ? summary.distanceKm !== null : weeklySessions.some(s => Number.isFinite(s.distanceKm));
  const weekHasCalories = summary ? summary.estimatedCalories !== null : weeklySessions.some(s => Number.isFinite(s.calories));
  const goalType = data.weeklyGoalType || 'sessions';
  const goalTarget = Number(data.weeklyGoalTarget || data.weeklyWorkoutGoal);
  const goalActual = serverDashboard?.goal?.actual ?? (goalType === 'minutes' ? weekMinutes : goalType === 'distance' ? weekDistance : goalType === 'exercises' ? exercisesOf(weeklySessions) : weeklySessions.length);
  const goalUnit = goalType === 'minutes' ? 'phút' : goalType === 'distance' ? 'km' : goalType === 'exercises' ? 'bài tập' : 'buổi';
  const goalHasData = goalType !== 'distance' || weekHasDistance;
  const next = (data.planned || [])
    .filter(p => p.status !== 'skipped' && p.date && new Date(`${p.date}T${p.time || '00:00'}`) >= today)
    .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`))[0];
  const greeting = today.getHours() < 12 ? 'Chào buổi sáng' : today.getHours() < 17 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const [chartMetric, setChartMetric] = useState('minutes');
  const chartOptions = [
    ['minutes', 'Thời lượng', 'phút', minutesOf],
    ['sessions', 'Buổi hoàn thành', 'buổi', list => list.length],
    ...(sessions.some(s => Number.isFinite(s.calories)) ? [['calories', 'Calo ước tính', 'kcal', caloriesOf]] : []),
    ...(hasDistance ? [['distance', 'Quãng đường', 'km', distanceOf]] : []),
  ];
  const selectedChart = chartOptions.find(option => option[0] === chartMetric) || chartOptions[0];
  const selectedChartHasData = selectedChart[0] === 'calories' ? weekHasCalories : selectedChart[0] === 'distance' ? weekHasDistance : (summary?.completedSessions ?? weeklySessions.length) > 0;
  const weekBars = Array.from({ length: 7 }, (_, i) => {
    const serverDay = serverDashboard?.daily?.[i];
    if (serverDay) return selectedChart[0] === 'minutes' ? serverDay.minutes
      : selectedChart[0] === 'sessions' ? serverDay.sessions
        : selectedChart[0] === 'calories' ? serverDay.calories
          : serverDay.distanceKm;
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + i);
    const end = new Date(day);
    end.setUTCDate(day.getUTCDate() + 1);
    return selectedChart[3](weeklySessions.filter(s => isInRange(s, day, end)));
  });
  const maxWeekValue = Math.max(...weekBars, 1);
  const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const noHistory = sessions.length === 0;
  const currentWeekLabel = `${monday.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', timeZone: 'UTC' })} – ${new Date(nextMonday.getTime() - 1).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' })} (UTC)`;

  return (
    <section className="dashboard">
      <div className="hero">
        <div className="hero-content">
          <span className="eyebrow">{today.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <h2>{greeting},<br /><em>{user?.name?.split(' ')[0] || 'bạn'}.</em></h2>
          <p>{data.fitnessGoal ? `Mục tiêu của bạn: ${data.fitnessGoal}.` : 'Bắt đầu từ một buổi tập nhỏ, phù hợp với nhịp sống của bạn.'}</p>
          {next && <p className="dashboard-next-plan">Buổi tiếp theo: <strong>{next.title}</strong> · {new Date(`${next.date}T${next.time || '00:00'}`).toLocaleString('vi-VN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
          <div className="hero-actions">
            <button className="hero-start" onClick={() => nav(next ? '/workout' : '/schedule')}>
            {next ? <Play size={16} fill="currentColor" /> : <Plus size={16} />} {next ? 'Start Workout' : 'Tạo lịch tập'}
            </button>
            <Link to="/schedule" className="hero-plan">
              View Schedule <ChevronRight size={14} />
            </Link>
          </div>
        </div>
        {!next && <div className="hero-visual"><Link to="/schedule" className="hero-start"><Plus size={16} /> Tạo lịch tập</Link></div>}
      </div>

      <div className="dashboard-section-heading">
        <div><span className="eyebrow">WEEKLY FITNESS SUMMARY</span><h3>Tuần từ {currentWeekLabel}</h3></div>
        <small>Nguồn: các buổi tập đã hoàn thành</small>
      </div>
      <div className="metrics-grid">
        {[
          [Clock3, 'Workout time', weekMinutes, 'phút', 'Tổng thời lượng thực tế của buổi tập đã hoàn thành.'],
          [CheckCircle2, 'Completed sessions', weeklySessions.length, 'buổi', 'Đếm các buổi đã lưu sau khi bạn kết thúc workout.'],
          [Flame, 'Estimated calories', weekHasCalories ? weekCalories : null, 'kcal', 'Ước tính từ workout đã hoàn thành; không gồm kết quả thử ở Calculator.'],
          ...(hasDistance ? [[Footprints, 'Distance traveled', weekHasDistance ? weekDistance.toFixed(1) : null, 'km', 'Chỉ cộng quãng đường được lưu trong workout.']] : []),
        ].map(([Icon, title, value, unit, description]) => (
          <div className="metric-card" key={title} title={description}>
            <div className="metric-icon-wrap"><Icon size={18} /></div>
            <div className="metric-label">{title}</div>
            <div className="metric-value">{noHistory || value === null ? '—' : value}<span> {noHistory || value === null ? 'Chưa có dữ liệu' : unit}</span></div>
            <small className="metric-source">{description}</small>
          </div>
        ))}
      </div>

      {noHistory && <div className="data-note">Hoàn thành buổi tập đầu tiên để bắt đầu thống kê tuần. Kết quả ở Calorie Calculator không được tính vào lịch sử workout.</div>}

      <div className="dash-two-col">
        <div className="card">
          <span className="eyebrow">GOAL PROGRESS</span><h3>Mục tiêu tuần</h3>
          {Number.isFinite(goalTarget) && goalTarget > 0 && goalHasData ? <><p>{goalActual} / {goalTarget} {goalUnit} · {Math.round(goalActual / goalTarget * 100)}% hoàn thành</p><div className="bar"><i style={{ width: `${Math.min(goalActual / goalTarget * 100, 100)}%` }} /></div></> : Number.isFinite(goalTarget) && goalTarget > 0 ? <p>Chưa có quãng đường được ghi nhận trong workout tuần này.</p> : <div className="empty-state compact"><p>Bạn chưa thiết lập mục tiêu tập luyện.</p><Link to="/settings" className="hero-start">Set My Goal <ChevronRight size={14} /></Link></div>}
        </div>
        <div className="card">
          <div className="dashboard-chart-heading"><div><span className="eyebrow">ACTIVITY CHART</span><h3>Hoạt động trong tuần</h3></div><select aria-label="Chỉ số biểu đồ" value={selectedChart[0]} onChange={e => setChartMetric(e.target.value)}>{chartOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          {selectedChartHasData ? <div className="dashboard-chart-container"><div className="chart-y-axis"><span>{maxWeekValue} {selectedChart[2]}</span><span>0</span></div><div className="chart-bar">
            {weekBars.map((n, i) => (
              <div key={i} className={i === ((today.getDay() + 6) % 7) ? 'today' : ''} title={`${dayLabels[i]}: ${n} ${selectedChart[2]}`}>
                <b>{n || ''}</b><i className={n ? '' : 'zero'} style={{ height: `${n / maxWeekValue * 100}%` }} /><small>{dayLabels[i]}</small>
              </div>
            ))}
          </div></div> : <div className="dashboard-chart-empty">Chưa có hoạt động đã lưu trong tuần này.</div>}
          <small className="metric-source">Đơn vị: {selectedChart[2]} · Dựa trên workout đã hoàn thành.</small>
        </div>
      </div>

      <div className="card recent-workouts"><div className="dashboard-chart-heading"><div><span className="eyebrow">RECENT WORKOUT HISTORY</span><h3>Buổi tập gần đây</h3></div><Link to="/analytics">Xem tất cả</Link></div>
        {sessions.length ? sessions.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map((s, i) => <div className="recent-workout-row" key={`${s.date}-${i}`}><Dumbbell size={17} /><div><strong>{s.title || 'Workout'}</strong><small>{new Date(s.date).toLocaleString('vi-VN')} · {Math.floor((s.duration || 0) / 60)} phút · {s.completedExercises || 0} bài</small></div><span>{Number.isFinite(s.calories) ? `~${s.calories} kcal` : 'Calo chưa ước tính'}</span></div>) : <div className="empty-state compact"><p>Buổi tập đã hoàn thành sẽ xuất hiện tại đây.</p><button onClick={() => nav('/workout')}><Play size={15} /> Hoàn thành buổi đầu tiên</button></div>}
      </div>
      <div className="dashboard-next-action"><Target size={19} /><div><strong>Việc nên làm tiếp theo</strong><p>{next ? `Bắt đầu buổi "${next.title}" theo lịch của bạn.` : data.planned?.length ? 'Chọn một buổi trong lịch sắp tới.' : 'Tạo lịch tập đầu tiên để có kế hoạch rõ ràng cho hôm nay.'}</p></div><Link to={next ? '/workout' : '/schedule'}>{next ? 'Bắt đầu' : 'Tạo lịch'} <ChevronRight size={14} /></Link></div>
    </section>
  );
}

/* ── Exercises (Workout Library) ──────────────────────────── */
const httpsUrl = value => {
  if (!value?.trim()) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
};

const youtubeEmbed = value => {
  if (!value || !httpsUrl(value)) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
    if (host !== 'youtube.com' && host !== 'm.youtube.com') return null;
    const id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
    return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
};

function Exercises({ data, update, showToast }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('Tất cả');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [view, setView] = useState('grid');
  const [video, setVideo] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState({});
  const allExercises = [...exercises, ...(data.userExercises || []).map(e => ({ ...e, source: 'user' }))];
  const groups = ['Tất cả', ...new Set(allExercises.map(e => e.muscle).filter(Boolean))];
  const shown = allExercises.filter(e => (sourceFilter === 'all' || (sourceFilter === 'user' ? e.source === 'user' : e.source !== 'user')) && (filter === 'Tất cả' || e.muscle === filter) && `${e.name} ${e.tip || ''}`.toLowerCase().includes(q.toLowerCase()));
  const openForm = exercise => {
    setEditing(exercise || null);
    setForm(exercise ? { ...exercise } : { name: '', muscle: '', tip: '', level: 'Beginner', equipment: '', sets: '', reps: '', duration: '', restTime: '', imageUrl: '', videoUrl: '', notes: '' });
    setFormOpen(true);
  };
  const saveExercise = async event => {
    event.preventDefault();
    const name = form.name?.trim();
    const instructions = form.tip?.trim();
    if (!name || !form.muscle?.trim() || !instructions) return showToast('Tên, nhóm cơ và hướng dẫn là bắt buộc.', 'error');
    if (!httpsUrl(form.imageUrl) || !httpsUrl(form.videoUrl)) return showToast('Ảnh và video chỉ chấp nhận URL HTTPS hợp lệ.', 'error');
    const saved = { ...form, id: editing?.id || `custom-${Date.now()}`, name, muscle: form.muscle.trim(), tip: instructions, color: '#eef4e7', source: 'user', duration: Number(form.duration) || 0, sets: Number(form.sets) || 0, met: 5 };
    const result = await update({ userExercises: editing ? (data.userExercises || []).map(e => e.id === editing.id ? saved : e) : [...(data.userExercises || []), saved] });
    if (!result.ok) return showToast(result.error, 'error');
    setFormOpen(false);
    showToast(editing ? 'Đã cập nhật bài tập cá nhân.' : 'Đã thêm bài tập cá nhân.', 'success');
  };
  const deleteExercise = async exercise => {
    const affected = (data.planned || []).filter(p => p.status !== 'completed' && p.items?.includes(exercise.id));
    const affectedMessage = affected.length ? ` Bài tập cũng sẽ bị gỡ khỏi ${affected.length} lịch tương lai; lịch không còn bài tập sẽ bị xóa.` : '';
    if (!window.confirm(`Xóa bài tập "${exercise.name}"?${affectedMessage}`)) return;
    const planned = (data.planned || []).map(p => p.status === 'completed' ? p : { ...p, items: (p.items || []).filter(id => id !== exercise.id) }).filter(p => p.status === 'completed' || p.items.length);
    const result = await update({ userExercises: (data.userExercises || []).filter(e => e.id !== exercise.id), planned });
    if (!result.ok) return showToast(result.error, 'error');
    setDetails(null);
    showToast('Đã xóa bài tập cá nhân.', 'success');
  };

  return (
    <section>
      <div className="page-head-row">
        <div><span className="eyebrow">BUILT-IN & PERSONAL</span><h2>Workout Library</h2><p>Tìm bài tập có sẵn hoặc xây dựng thư viện cá nhân.</p></div>
        <button onClick={() => openForm()}><Plus size={17} /> Add Exercise</button>
      </div>

      <div className="library-filters">
        <div className="search-wrap">
          <Search size={16} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm bài tập..." />
        </div>
        <button className={`filter-chip ${sourceFilter === 'all' ? 'active' : ''}`} onClick={() => setSourceFilter('all')}>Tất cả thư viện</button>
        <button className={`filter-chip ${sourceFilter === 'system' ? 'active' : ''}`} onClick={() => setSourceFilter('system')}>Built-in</button>
        <button className={`filter-chip ${sourceFilter === 'user' ? 'active' : ''}`} onClick={() => setSourceFilter('user')}>My Exercises</button>
        {groups.map(g => (
          <button key={g} className={`filter-chip ${filter === g ? 'active' : ''}`} onClick={() => setFilter(g)}>{g}</button>
        ))}
        <div className="view-toggle" style={{ marginLeft: 'auto' }}>
          <button className={`toggle-view ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')} aria-label="Grid view"><LayoutGrid size={15} /></button>
          <button className={`toggle-view ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')} aria-label="List view"><List size={15} /></button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Search size={22} /></div>
          <h3>{allExercises.length ? 'Không tìm thấy bài tập' : 'Thư viện cá nhân đang trống'}</h3>
          <p>{allExercises.length ? 'Thử từ khóa khác hoặc thêm bài tập của bạn.' : 'Thêm bài tập đầu tiên để lưu hướng dẫn và video.'}</p>
          <button className="filter-chip" onClick={() => { setQ(''); setFilter('Tất cả'); setSourceFilter('all'); }}>Đặt lại bộ lọc</button>
        </div>
      ) : (
        <div className={`exercise-grid ${view === 'list' ? 'list-view' : ''}`}>
          {shown.map(e => (
            <article className="exercise-card" key={e.id}>
              <div className="exercise-thumb" style={{ background: e.color }}>
                {e.imageUrl && httpsUrl(e.imageUrl) ? <img src={e.imageUrl} alt="" className="exercise-custom-image" /> : <div className="exercise-thumb-inner">{e.emoji || '🏋️'}</div>}
                <span className="exercise-level-badge">{e.source === 'user' ? 'My Exercise' : e.level}</span>
                {e.video && <button className="video-badge" onClick={() => setVideo({ ...e, videoUrl: e.video })}><Play size={12} fill="currentColor" /> Video demo</button>}
                {e.videoUrl && <button className="video-badge" onClick={() => setVideo(e)}><Play size={12} fill="currentColor" /> Video</button>}
              </div>
              <div className="exercise-body">
                <div className="exercise-meta">
                  <Layers size={11} /> {e.muscle}
                </div>
                <h3 className="exercise-name">{e.name}</h3>
                <div className="exercise-tags">
                  {e.sets > 0 && <span className="badge"><Layers size={10} /> {e.sets} hiệp</span>}
                  {e.reps && <span className="badge"><Clock3 size={10} /> {e.reps}</span>}
                </div>
                <p className="exercise-tip">{e.tip}</p>
                <div className="exercise-card-actions"><button className="exercise-start" onClick={() => setDetails(e)}>Chi tiết</button><Link to="/schedule" state={{ exerciseId: e.id }} className="exercise-start">Add to Schedule</Link>
                  {e.source === 'user' && <><button className="btn-ghost" onClick={() => openForm(e)}>Sửa</button><button className="btn-ghost" onClick={() => deleteExercise(e)}>Xóa</button></>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Video modal */}
      {video && (
        <div className="modal-backdrop" onMouseDown={() => setVideo(null)}>
          <div className="video-modal-box" onMouseDown={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setVideo(null)}><X size={16} /></button>
            <span className="eyebrow">Video hướng dẫn</span>
            <h2 style={{ marginTop: 'var(--sp-2)' }}>{video.name}</h2>
            <div className="video-frame">
              {youtubeEmbed(video.videoUrl || video.video) ? <iframe src={youtubeEmbed(video.videoUrl || video.video)} title={`Hướng dẫn ${video.name}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : httpsUrl(video.videoUrl || video.video) ? <a href={video.videoUrl || video.video} target="_blank" rel="noreferrer">Mở video trên website bên ngoài</a> : <p>Video này không có URL HTTPS hợp lệ để mở an toàn.</p>}
            </div>
            <p>💡 {video.tip}</p>
          </div>
        </div>
      )}
      {formOpen && <div className="modal-backdrop" onMouseDown={() => setFormOpen(false)}><form className="modal-box exercise-form" onSubmit={saveExercise} onMouseDown={e => e.stopPropagation()}><button type="button" className="close-btn" onClick={() => setFormOpen(false)}><X size={16} /></button><span className="eyebrow">MY EXERCISES</span><h2>{editing ? 'Chỉnh sửa bài tập' : 'Thêm bài tập'}</h2><div className="exercise-form-grid">
        <label>Tên bài tập *<input required value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
        <label>Nhóm cơ / thể loại *<input required value={form.muscle || ''} onChange={e => setForm(f => ({ ...f, muscle: e.target.value }))} placeholder="Ví dụ: Core, Cardio" /></label>
        <label>Độ khó<select value={form.level || 'Beginner'} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
        <label>Dụng cụ<input value={form.equipment || ''} onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))} /></label>
        <label>Sets<input type="number" min="0" value={form.sets || ''} onChange={e => setForm(f => ({ ...f, sets: e.target.value }))} /></label>
        <label>Reps / duration<input value={form.reps || ''} onChange={e => setForm(f => ({ ...f, reps: e.target.value }))} /></label>
        <label>Thời lượng (giây)<input type="number" min="0" value={form.duration || ''} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} /></label>
        <label>Thời gian nghỉ (giây)<input type="number" min="0" value={form.restTime || ''} onChange={e => setForm(f => ({ ...f, restTime: e.target.value }))} /></label>
        <label>Ảnh HTTPS URL<input type="url" value={form.imageUrl || ''} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} /></label>
        <label>Video HTTPS URL<input type="url" value={form.videoUrl || ''} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} placeholder="YouTube hoặc liên kết HTTPS" /></label>
        <label className="exercise-form-wide">Hướng dẫn *<textarea required value={form.tip || ''} onChange={e => setForm(f => ({ ...f, tip: e.target.value }))} rows="3" /></label>
        <label className="exercise-form-wide">Ghi chú cá nhân<textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows="2" /></label>
      </div><button type="submit"><Check size={16} /> Lưu bài tập</button></form></div>}
      {details && <div className="modal-backdrop" onMouseDown={() => setDetails(null)}><div className="modal-box" onMouseDown={e => e.stopPropagation()}><button className="close-btn" onClick={() => setDetails(null)}><X size={16} /></button><span className="eyebrow">{details.source === 'user' ? 'MY EXERCISE' : 'BUILT-IN EXERCISE'}</span><h2>{details.name}</h2><p>{details.muscle} · {details.level || 'Custom'}</p><p>{details.tip}</p>{details.notes && <p>Ghi chú: {details.notes}</p>}{details.equipment && <p>Dụng cụ: {details.equipment}</p>}{details.videoUrl && httpsUrl(details.videoUrl) && <a href={details.videoUrl} target="_blank" rel="noreferrer">Mở video</a>}<div className="exercise-card-actions">{details.source === 'user' && <><button onClick={() => { setDetails(null); openForm(details); }}>Sửa bài tập</button><button className="btn-destructive" onClick={() => deleteExercise(details)}>Xóa bài tập</button></>}<Link className="exercise-start" to="/schedule" state={{ exerciseId: details.id }} onClick={() => setDetails(null)}>Add to Schedule</Link></div></div></div>}
    </section>
  );
}

/* ── Schedule ─────────────────────────────────────────────── */
const dateKey = date => {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 10);
};

function Schedule({ data, update, showToast }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState('week');
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState([]);
  const [draft, setDraft] = useState({ title: '', date: dateKey(new Date()), time: '18:00', durationMinutes: 30 });
  const library = [...exercises, ...(data.userExercises || [])];
  useEffect(() => {
    if (!location.state?.exerciseId) return;
    setPick([location.state.exerciseId]);
    setDraft(d => ({ ...d, date: selectedDate, title: `Workout · ${library.find(e => e.id === location.state.exerciseId)?.name || 'tùy chỉnh'}` }));
    setEditing(null);
    setOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key]);

  const selected = new Date(`${selectedDate}T00:00:00`);
  const monday = new Date(selected);
  monday.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
  const period = mode === 'day' ? [selectedDate] : weekDates.map(dateKey);
  const visible = (data.planned || []).filter(p => p.date ? period.includes(p.date) : mode === 'day' && selectedDate === dateKey(new Date()));
  const sortPlans = list => list.slice().sort((a, b) => `${a.date || ''}T${a.time || ''}`.localeCompare(`${b.date || ''}T${b.time || ''}`));
  const openNew = () => {
    setEditing(null);
    setPick([]);
    setDraft({ title: '', date: selectedDate, time: '18:00', durationMinutes: 30 });
    setOpen(true);
  };
  const openEdit = plan => {
    setEditing(plan);
    setPick(Array.isArray(plan.items) ? plan.items : []);
    setDraft({ title: plan.title || '', date: plan.date || selectedDate, time: plan.time || '18:00', durationMinutes: plan.durationMinutes || 30 });
    setOpen(true);
  };
  const savePlan = async event => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.date || !draft.time || !Number(draft.durationMinutes) || !pick.length) return showToast('Vui lòng nhập tên, ngày, giờ, thời lượng và ít nhất một bài tập.', 'error');
    const nextPlan = { ...draft, title: draft.title.trim(), durationMinutes: Number(draft.durationMinutes), id: editing?.id || `plan-${Date.now()}`, items: pick, status: editing?.status || 'planned', planId: editing?.planId || null };
    const startMinute = hour => Number(hour.slice(0, 2)) * 60 + Number(hour.slice(3, 5));
    const start = startMinute(nextPlan.time);
    const overlaps = (data.planned || []).some(p => {
      if (p.id === editing?.id || p.date !== nextPlan.date || p.status === 'skipped' || !p.time) return false;
      const otherStart = startMinute(p.time);
      return start < otherStart + (p.durationMinutes || 30) && otherStart < start + nextPlan.durationMinutes;
    });
    if (overlaps && !window.confirm('Buổi tập này trùng giờ với một lịch khác. Bạn vẫn muốn lưu?')) return;
    const result = await update({ planned: editing ? data.planned.map(p => p.id === editing.id ? nextPlan : p) : [...data.planned, nextPlan] });
    if (!result.ok) return showToast(result.error, 'error');
    setOpen(false);
    showToast(editing ? 'Đã cập nhật lịch tập.' : 'Đã thêm buổi tập vào lịch.', 'success');
  };
  const removePlan = async plan => {
    if (!window.confirm(`Xóa buổi tập "${plan.title}" khỏi lịch?`)) return;
    const result = await update({ planned: data.planned.filter(p => p.id !== plan.id) });
    if (!result.ok) return showToast(result.error, 'error');
    showToast('Đã xóa buổi tập.', 'success');
  };
  const reorder = (index, offset) => setPick(current => {
    const next = [...current];
    const destination = index + offset;
    if (destination < 0 || destination >= next.length) return current;
    [next[index], next[destination]] = [next[destination], next[index]];
    return next;
  });
  const movePlan = async (plan, offset) => {
    const nextDate = new Date(`${plan.date || selectedDate}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + offset);
    const result = await update({ planned: data.planned.map(p => p.id === plan.id ? { ...p, date: dateKey(nextDate) } : p) });
    if (!result.ok) return showToast(result.error, 'error');
    showToast('Đã đổi ngày buổi tập.', 'success');
  };
  const duplicatePlan = async plan => {
    const nextDate = new Date(`${plan.date || selectedDate}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + 7);
    const result = await update({ planned: [...data.planned, { ...plan, id: `plan-${Date.now()}`, date: dateKey(nextDate), status: 'planned' }] });
    if (!result.ok) return showToast(result.error, 'error');
    showToast('Đã sao chép buổi tập sang tuần sau.', 'success');
  };
  const changeStatus = async (plan, status) => {
    const result = await update({ planned: data.planned.map(p => p.id === plan.id ? { ...p, status } : p) });
    if (!result.ok) showToast(result.error, 'error');
  };

  return (
    <section>
      <div className="page-head-row">
        <div><span className="eyebrow">PLANNING</span><h2>My Schedule</h2><p>Lên lịch, chỉnh sửa hoặc sắp xếp lại buổi tập.</p></div>
        <button onClick={openNew}><Plus size={17} /> Add Workout</button>
      </div>
      <div className="schedule-controls"><div className="range-tabs"><button className={`tab-btn ${mode === 'week' ? 'active' : ''}`} onClick={() => setMode('week')}>Weekly</button><button className={`tab-btn ${mode === 'day' ? 'active' : ''}`} onClick={() => setMode('day')}>Daily</button></div><label>Ngày đang xem<input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} /></label></div>
      <div className="week-strip">
        {weekDates.map((date, i) => <button key={i} className={`week-day ${dateKey(date) === dateKey(new Date()) ? 'today' : ''} ${dateKey(date) === selectedDate ? 'selected' : ''}`} onClick={() => setSelectedDate(dateKey(date))}><small>{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][i]}</small><b>{date.getDate()}</b>{(data.planned || []).some(p => p.date === dateKey(date) && p.status !== 'skipped') && <span className="dot" />}</button>)}
      </div>
      <div className="schedule-section">
        <h3>{mode === 'day' ? selected.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Các buổi trong tuần'}</h3>
        {sortPlans(visible).length ? sortPlans(visible).map(p => <article className="plan-item schedule-plan" key={p.id}>
          <span className="plan-time">{p.time || '—'}</span><div className="plan-icon-wrap"><Dumbbell size={20} /></div>
          <div className="plan-details"><b>{p.title}</b><p>{p.date ? new Date(`${p.date}T00:00:00`).toLocaleDateString('vi-VN') : 'Chưa đặt ngày'} · {p.durationMinutes || 30} phút · {(p.items || []).length} bài · <span className={`status-${p.status || 'planned'}`}>{p.status || 'planned'}</span></p>
            <div className="scheduled-exercises">{(p.items || []).map((id, i) => <span key={`${id}-${i}`}>{i + 1}. {library.find(e => e.id === id)?.name || 'Bài tập đã lưu'}</span>)}</div>
          </div>
          <div className="schedule-actions">
            {p.status !== 'completed' && <Link to="/workout" state={{ scheduleId: p.id }} className="circle-btn" aria-label="Bắt đầu workout"><Play size={16} fill="currentColor" /></Link>}
            {p.status !== 'completed' && <><button className="btn-ghost" onClick={() => openEdit(p)}>Sửa</button><button className="btn-ghost" onClick={() => movePlan(p, -1)}>−1 ngày</button><button className="btn-ghost" onClick={() => movePlan(p, 1)}>+1 ngày</button><button className="btn-ghost" onClick={() => duplicatePlan(p)}>Sao chép</button>
              {p.status === 'skipped' ? <button className="btn-ghost" onClick={() => changeStatus(p, 'planned')}>Khôi phục</button> : <button className="btn-ghost" onClick={() => changeStatus(p, 'skipped')}>Bỏ qua</button>}
              <button className="btn-destructive" onClick={() => removePlan(p)}>Xóa</button></>}
            {p.status === 'completed' && <span>Đã hoàn thành · lịch sử được giữ nguyên</span>}
          </div>
        </article>) : <div className="empty-state"><div className="empty-icon"><CalendarDays size={22} /></div><h3>Chưa có lịch tập</h3><p>Tạo lịch của riêng bạn; không có buổi tập mẫu nào được thêm sẵn.</p><button onClick={openNew}><Plus size={16} /> Add Workout</button></div>}
      </div>
      {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal-box schedule-form" onSubmit={savePlan} onMouseDown={e => e.stopPropagation()}><button type="button" className="close-btn" onClick={() => setOpen(false)}><X size={16} /></button><span className="eyebrow">{editing ? 'EDIT WORKOUT' : 'NEW WORKOUT'}</span><h2>{editing ? 'Chỉnh sửa lịch tập' : 'Tạo buổi tập'}</h2><div className="exercise-form-grid"><label>Tên buổi tập *<input required value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} /></label><label>Ngày *<input required type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} /></label><label>Giờ bắt đầu *<input required type="time" value={draft.time} onChange={e => setDraft(d => ({ ...d, time: e.target.value }))} /></label><label>Thời lượng dự kiến (phút) *<input required type="number" min="1" max="600" value={draft.durationMinutes} onChange={e => setDraft(d => ({ ...d, durationMinutes: e.target.value }))} /></label></div><h3>Bài tập và thứ tự</h3><div className="exercise-picker">{library.map(e => <label key={e.id} className={`picker-item ${pick.includes(e.id) ? 'selected' : ''}`}><input type="checkbox" checked={pick.includes(e.id)} onChange={() => setPick(list => list.includes(e.id) ? list.filter(id => id !== e.id) : [...list, e.id])} />{e.emoji || '🏋️'} {e.name}</label>)}</div><ol className="exercise-order-list">{pick.map((id, index) => <li key={`${id}-${index}`}><span>{library.find(e => e.id === id)?.name || 'Bài tập'}</span><button type="button" className="btn-ghost" disabled={index === 0} onClick={() => reorder(index, -1)}>Move Up</button><button type="button" className="btn-ghost" disabled={index === pick.length - 1} onClick={() => reorder(index, 1)}>Move Down</button></li>)}</ol><button type="submit"><Check size={16} /> {editing ? 'Lưu thay đổi' : 'Add Workout'}</button></form></div>}
    </section>
  );
}

/* ── Settings ─────────────────────────────────────────────── */
function SettingsPage({ data, update, showToast }) {
  const [weight, setWeight] = useState(data.weight || '');
  const [fitnessGoal, setFitnessGoal] = useState(data.fitnessGoal || 'Duy trì sức khỏe');
  const [weeklyGoalType, setWeeklyGoalType] = useState(data.weeklyGoalType || 'sessions');
  const [weeklyGoalTarget, setWeeklyGoalTarget] = useState(data.weeklyGoalTarget || data.weeklyWorkoutGoal || '');
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');

  const save = async () => {
    const result = await update({ weight: Number(weight) > 0 ? Number(weight) : null });
    if (!result.ok) return showToast(result.error, 'error');
    showToast('Đã lưu thay đổi thành công!', 'success');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sections = [
    { id: 'personal', label: 'Thông tin cá nhân', icon: Settings },
    { id: 'goals', label: 'Mục tiêu tập luyện', icon: Target },
    { id: 'metrics', label: 'Chỉ số cơ thể', icon: Activity },
  ];

  return (
    <section>
      <div className="page-head">
        <span className="eyebrow">Cá nhân hóa</span>
        <h2>Profile & Settings</h2>
        <p>Cập nhật thông tin giúp ước tính chính xác hơn.</p>
      </div>

      <div className="settings-layout">
        {/* Left nav */}
        <div>
          <div className="profile-header">
            <div className="profile-avatar-lg">HF</div>
            <h3>Thành viên HomeFit</h3>
            <p>Hành trình khỏe mạnh</p>
          </div>
          <div className="settings-nav">
            {sections.map(s => (
              <button
                key={s.id}
                className={`settings-nav-item ${activeSection === s.id ? 'active' : ''}`}
                onClick={() => setActiveSection(s.id)}
              >
                <s.icon size={16} /> {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="settings-panel">
          {activeSection === 'personal' && (
            <>
              <h3>Thông tin cá nhân</h3>
              <div className="settings-form">
                <label>Cân nặng (kg)<input type="number" value={weight} onChange={e => setWeight(e.target.value)} /></label>
                <div className="settings-form-actions">
                  <button onClick={save}><Check size={16} /> {saved ? 'Đã lưu!' : 'Lưu thay đổi'}</button>
                  <button className="btn-ghost" onClick={() => setWeight(data.weight || '')}>Hủy</button>
                </div>
              </div>
            </>
          )}
          {activeSection === 'goals' && (
            <>
              <h3>Mục tiêu tập luyện</h3>
              <div className="settings-form">
                <label>
                  Mục tiêu chính
                  <select value={fitnessGoal} onChange={e => setFitnessGoal(e.target.value)}>
                    <option>Duy trì sức khỏe</option>
                    <option>Giảm mỡ</option>
                    <option>Tăng cơ</option>
                    <option>Tăng sức bền</option>
                  </select>
                </label>
                <label>Loại mục tiêu tuần<select value={weeklyGoalType} onChange={e => setWeeklyGoalType(e.target.value)}><option value="sessions">Số buổi hoàn thành</option><option value="minutes">Số phút tập</option><option value="distance">Quãng đường (km)</option><option value="exercises">Số bài tập hoàn thành</option></select></label>
                <label>Mục tiêu mỗi tuần<input type="number" min="1" max="10000" value={weeklyGoalTarget} onChange={e => setWeeklyGoalTarget(e.target.value)} placeholder="Nhập mục tiêu của bạn" /></label>
                <div className="settings-form-actions">
                  <button onClick={async () => {
                    const target = Number(weeklyGoalTarget);
                    if (!Number.isFinite(target) || target <= 0) return showToast('Nhập mục tiêu tuần hợp lệ.', 'error');
                    const result = await update({ fitnessGoal, weeklyGoalType, weeklyGoalTarget: target });
                    if (!result.ok) return showToast(result.error, 'error');
                    showToast('Đã cập nhật mục tiêu!', 'success');
                  }}><Check size={16} /> Lưu thay đổi</button>
                </div>
              </div>
            </>
          )}
          {activeSection === 'metrics' && (
            <>
              <h3>Chỉ số cơ thể</h3>
              <div className="settings-form">
                <label>Cân nặng (kg)<input type="number" value={weight} onChange={e => setWeight(e.target.value)} /></label>
                <div className="data-note">Chỉ số cơ thể giúp ước tính calo tiêu hao chính xác hơn. Không dùng để chẩn đoán y khoa.</div>
                <div className="settings-form-actions">
                  <button onClick={save}><Check size={16} /> Lưu</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Live Workout ─────────────────────────────────────────── */
function Workout({ data, update, showToast }) {
  const nav = useNavigate();
  const location = useLocation();
  const library = [...exercises, ...(data.userExercises || [])];
  const selectedPlan = data.planned.find(p => p.id === location.state?.scheduleId) || data.planned
    .filter(p => p.status !== 'completed' && p.status !== 'skipped')
    .sort((a, b) => `${a.date || ''}T${a.time || ''}`.localeCompare(`${b.date || ''}T${b.time || ''}`))[0];
  const items = selectedPlan?.items?.map(id => library.find(e => e.id === id)).filter(Boolean) || [];
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distanceKm, setDistanceKm] = useState('');
  const [done, setDone] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const e = items[index];

  const finish = async () => {
    if (!elapsed) return showToast('Bắt đầu và hoàn thành ít nhất một phần buổi tập trước khi lưu.', 'error');
    if (distanceKm !== '' && (!Number.isFinite(Number(distanceKm)) || Number(distanceKm) <= 0)) return showToast('Quãng đường phải lớn hơn 0 km.', 'error');
    setRunning(false);
    setDone(true);
    const completedItems = items.slice(0, index + 1);
    const averageMet = completedItems.reduce((sum, item) => sum + (item.met || 5), 0) / completedItems.length;
    const session = {
      date: new Date().toISOString(),
      title: selectedPlan?.title || 'Workout',
      duration: elapsed,
      completedExercises: completedItems.length,
      exerciseIds: completedItems.map(item => item.id),
      ...(distanceKm !== '' ? { distanceKm: Number(distanceKm) } : {}),
      ...(Number.isFinite(Number(data.weight)) && Number(data.weight) > 0 ? { calories: Math.round(averageMet * 3.5 * Number(data.weight) / 200 * (elapsed / 60)) } : {}),
    };
    const result = await update({
      sessions: [...data.sessions, session],
      ...(selectedPlan ? { planned: data.planned.map(p => p.id === selectedPlan.id ? { ...p, status: 'completed', sessionId: session.date } : p) } : {}),
    });
    if (!result.ok) return showToast(result.error, 'error');
    setDone(true);
  };

  if (!items.length) return <div className="empty-state"><div className="empty-icon"><Dumbbell size={22} /></div><h3>Chưa có workout để bắt đầu</h3><p>Chọn bài tập từ thư viện và tạo lịch trước khi bắt đầu. Không có bài tập mẫu nào được chạy thay bạn.</p><Link to="/schedule" className="hero-start">Tạo lịch tập <ChevronRight size={14} /></Link></div>;

  if (done) return (
    <div className="workout-summary">
      <div className="summary-icon"><CheckCircle2 size={36} /></div>
      <span className="eyebrow">Hoàn thành tuyệt vời</span>
      <h2 className="summary-title">Bạn vừa làm rất tốt!</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 'var(--sp-4)' }}>Buổi tập đã được lưu vào lịch sử của bạn.</p>
      <div className="summary-stats">
        <div className="summary-stat">
          <b>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</b>
          <small>thời gian thực</small>
        </div>
        <div className="summary-stat">
          <b>{index + 1}/{items.length}</b>
          <small>bài tập</small>
        </div>
        {distanceKm && <div className="summary-stat"><b>{Number(distanceKm).toFixed(1)}</b><small>km đã ghi nhận</small></div>}
        {Number.isFinite(Number(data.weight)) && Number(data.weight) > 0 && <div className="summary-stat"><b>{Math.round((items.slice(0, index + 1).reduce((sum, item) => sum + (item.met || 5), 0) / (index + 1)) * 3.5 * Number(data.weight) / 200 * (elapsed / 60))}</b><small>kcal ước tính</small></div>}
      </div>
      {(!data.weight || !Number.isFinite(Number(data.weight))) && <p>Calorie estimate unavailable: add your weight in Profile & Settings.</p>}
      <button onClick={() => nav('/')}><Home size={16} /> Về tổng quan</button>
    </div>
  );

  const progress = (index / items.length) * 100;

  return (
    <div className="workout-page">
      <div className="workout-topbar">
        <button className="back-btn" onClick={() => running ? setShowConfirm(true) : nav('/')}>
          <X size={16} /> Thoát
        </button>
        <div className="workout-progress-bar">
          <i style={{ width: `${progress}%` }} />
        </div>
        <span className="workout-step-label">BÀI {index + 1} / {items.length}</span>
      </div>

      <h2 className="workout-exercise-name">{e.name}</h2>
      <p className="workout-sets">{e.sets ? `${e.sets} hiệp${e.reps ? ` × ${e.reps}` : ''}` : e.reps || (e.duration ? `${e.duration} giây mỗi lượt` : 'Thực hiện theo hướng dẫn')}{e.restTime ? ` · Nghỉ ${e.restTime} giây giữa các hiệp` : ''}</p>

      <div className="workout-visual" style={{ background: e.color || '#eef4e7' }}>
        {e.imageUrl ? <img src={e.imageUrl} alt={e.name} /> : <span style={{ fontSize: '80px' }}>{e.emoji || '🏋️'}</span>}
        <span className="status-tag">{running ? '● Đang tập' : 'Sẵn sàng bắt đầu'}</span>
      </div>

      <div className="workout-timer">
        {Math.floor(elapsed / 60)}<small>:</small>{String(elapsed % 60).padStart(2, '0')}
      </div>
      <label className="workout-distance-entry">Quãng đường đã di chuyển (km, tùy chọn)<input aria-label="Quãng đường đã di chuyển tính bằng km" type="number" min="0.1" step="0.1" value={distanceKm} onChange={e => setDistanceKm(e.target.value)} placeholder="Chỉ nhập số đo của buổi này" /></label>

      <div className="technique-tip">
        💡 {e.tip}
      </div>

      <div className="workout-controls">
        <button className="workout-ctrl secondary" onClick={() => setIndex(i => Math.max(i - 1, 0))}>
          <SkipForward size={16} style={{ transform: 'scaleX(-1)' }} />
        </button>
        <button className={`workout-ctrl play-pause ${running ? 'running' : ''}`} onClick={() => setRunning(x => !x)}>
          {running ? <><Pause size={20} fill="currentColor" /> Tạm dừng</> : <><Play size={20} fill="currentColor" /> Bắt đầu</>}
        </button>
        <button
          className="workout-ctrl secondary"
          onClick={() => index === items.length - 1 ? finish() : setIndex(i => i + 1)}
        >
          {index === items.length - 1 ? <><Check size={16} /> Kết thúc</> : <><SkipForward size={16} /> Tiếp</>}
        </button>
      </div>

      {/* Exit confirmation */}
      {showConfirm && (
        <div className="modal-backdrop" onMouseDown={() => setShowConfirm(false)}>
          <div className="modal-box" style={{ maxWidth: 380 }} onMouseDown={e => e.stopPropagation()}>
            <h2>Thoát buổi tập?</h2>
                <p>Tiến độ hiện tại sẽ không được lưu nếu bạn thoát sớm.</p>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
              <button className="btn-destructive" onClick={() => nav('/')}>Thoát</button>
              <button className="btn-ghost" onClick={() => setShowConfirm(false)}>Tiếp tục tập</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── AI Coach ─────────────────────────────────────────────── */
function Coach({ data, update, showToast }) {
  const nav = useNavigate();
  const [minutes, setMinutes] = useState(30);
  const [focus, setFocus] = useState('Toàn thân');

  const library = focus === 'Cardio'
    ? exercises.filter(e => e.muscle === 'Cardio' || e.muscle === 'Toàn thân')
    : focus === 'Core'
    ? exercises.filter(e => e.muscle === 'Core' || e.muscle === 'Toàn thân')
    : exercises;
  const count = minutes <= 15 ? 3 : minutes <= 30 ? 4 : 5;
  const plan = library.slice(0, count);

  const save = async (start = false) => {
    const id = `plan-${Date.now()}`;
    let workoutPlan;
    try {
      workoutPlan = await api('/plans', {
        method: 'POST',
        body: { name: `${focus} · ${minutes} phút`, description: 'Kế hoạch được tạo từ Workout Coach.', exerciseIds: plan.map(e => e.id), estimatedDurationMinutes: minutes },
      });
    } catch (error) {
      return showToast(error.message, 'error');
    }
    const result = await update({ planned: [...data.planned, { id, title: `${focus} · ${minutes} phút`, date: dateKey(new Date()), time: '19:00', durationMinutes: minutes, status: 'planned', items: plan.map(e => e.id), planId: workoutPlan._id }] });
    if (!result.ok) {
      try { await api(`/plans/${workoutPlan._id}`, { method: 'DELETE' }); } catch (error) { showToast(`Kế hoạch đã lưu nhưng chưa tạo được lịch: ${result.error}. Không thể dọn kế hoạch: ${error.message}`, 'error'); return; }
      return showToast(result.error, 'error');
    }
    const scheduleId = result.createdScheduleIds[id] || id;
    showToast('Kế hoạch đã được lưu vào lịch!', 'success');
    nav(start ? '/workout' : '/schedule', start ? { state: { scheduleId } } : undefined);
  };

  return (
    <section>
      {/* Hero */}
      <div className="coach-hero">
        <div>
          <span className="eyebrow">Rule-based Personal Coach</span>
          <h2>Kế hoạch hợp với <em>nhịp sống của bạn.</em></h2>
          <p>Chọn thời lượng và trọng tâm. Coach dùng bài tập từ thư viện, không giả lập lời khuyên y tế.</p>
        </div>
        <div className="coach-hero-icon"><Sparkles size={60} /></div>
      </div>

      <div className="coach-layout">
        {/* Options */}
        <div className="card coach-options">
          <div>
            <span className="eyebrow">1. Thời gian rảnh</span>
            <div className="choice-row" style={{ marginTop: 'var(--sp-3)' }}>
              {[10, 15, 30, 45, 60].map(x => (
                <button key={x} className={`choice-btn ${minutes === x ? 'active' : ''}`} onClick={() => setMinutes(x)}>
                  {x} phút
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="eyebrow">2. Trọng tâm hôm nay</span>
            <div className="choice-row" style={{ marginTop: 'var(--sp-3)' }}>
              {['Toàn thân', 'Cardio', 'Core'].map(x => (
                <button key={x} className={`choice-btn ${focus === x ? 'active' : ''}`} onClick={() => setFocus(x)}>
                  {x}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Plan preview */}
        <div className="plan-preview">
          <div className="plan-preview-head">
            <span className="eyebrow">Gợi ý hôm nay</span>
            <h3>{focus} Recharge · {minutes} phút</h3>
            <p>{plan.length} bài · {plan[0]?.sets} hiệp mỗi bài · nghỉ 30 giây</p>
          </div>
          {plan.map((e, i) => (
            <div className="coach-ex-item" key={e.id}>
              <span className="coach-ex-num">{i + 1}</span>
              <div className="coach-ex-thumb" style={{ background: e.color }}>{e.emoji}</div>
              <div className="coach-ex-info">
                <strong>{e.name}</strong>
                <small>{e.sets} hiệp × {e.reps}</small>
              </div>
            </div>
          ))}
          <div className="coach-actions">
            <button className="btn-coach-save" onClick={save}><CalendarDays size={16} /> Lưu vào lịch</button>
            <button className="btn-coach-start" onClick={() => save(true)}><Play size={16} fill="currentColor" /> Lưu và bắt đầu</button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Analytics ────────────────────────────────────────────── */
function Analytics({ data }) {
  const sessions = data.sessions || [];
  const [range, setRange] = useState('7 ngày');
  const days = Number.parseInt(range, 10);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - days + 1);
  const rangeSessions = sessions.filter(s => {
    const date = new Date(s.date);
    return Number.isFinite(date.getTime()) && date >= from;
  });
  const totalMinutes = Math.round(rangeSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60);
  const calorieSessions = rangeSessions.filter(s => Number.isFinite(s.calories));
  const calories = calorieSessions.reduce((sum, s) => sum + s.calories, 0);
  const chartDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - 6 + i);
    const end = new Date(day);
    end.setDate(end.getDate() + 1);
    const value = sessions.filter(s => {
      const date = new Date(s.date);
      return Number.isFinite(date.getTime()) && date >= day && date < end;
    }).reduce((sum, s) => sum + (s.duration || 0), 0) / 60;
    return { label: day.toLocaleDateString('vi-VN', { weekday: 'short' }), value: Math.round(value) };
  });
  const maxChartValue = Math.max(...chartDays.map(day => day.value), 1);

  return (
    <section>
      <div className="page-head-row">
        <div>
          <span className="eyebrow">Insights</span>
          <h2>Progress Analytics</h2>
          <p>Chỉ số được tính từ hoạt động đã lưu của bạn.</p>
        </div>
        <div className="range-tabs">
          {['7 ngày', '30 ngày', '90 ngày'].map(r => (
            <button key={r} className={`tab-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
      </div>

      <div className="analytics-stats">
        <div className="insight-card">
          <div className="insight-icon" style={{ background: 'rgba(198,243,107,.2)', color: 'var(--primary)' }}>
            <Clock3 size={18} />
          </div>
          <p>Tổng thời lượng</p>
          <b>{rangeSessions.length ? totalMinutes : '—'} <small>{rangeSessions.length ? 'phút' : 'chưa có dữ liệu'}</small></b>
          <span>{range} · buổi tập đã hoàn thành</span>
        </div>
        <div className="insight-card">
          <div className="insight-icon" style={{ background: 'rgba(255,140,60,.12)', color: '#e07030' }}>
            <Flame size={18} />
          </div>
          <p>Calo ước tính</p>
          <b>{calorieSessions.length ? calories : '—'} <small>{calorieSessions.length ? 'kcal' : 'chưa có dữ liệu'}</small></b>
          <span>Ước tính từ workout; không gồm phép tính thử</span>
        </div>
        <div className="insight-card">
          <div className="insight-icon" style={{ background: 'rgba(160,120,255,.12)', color: '#8060d0' }}>
            <Dumbbell size={18} />
          </div>
          <p>Buổi hoàn thành</p>
          <b>{rangeSessions.length} <small>buổi</small></b>
          <span>{range} · trạng thái hoàn thành</span>
        </div>
      </div>

      <div className="card">
        <div className="chart-container" style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
            <div>
              <span className="eyebrow">Thời lượng vận động</span>
              <h3 style={{ marginTop: 'var(--sp-2)' }}>7 ngày gần đây</h3>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>phút</span>
          </div>
          {sessions.length ? <div className="wide-chart">
            {chartDays.map((day, i) => (
              <div key={i} title={`${day.label}: ${day.value} phút`}>
                <b>{day.value || ''}</b>
                <i style={{ height: `${day.value / maxChartValue * 100}%` }} />
                <small>{day.label}</small>
              </div>
            ))}
          </div> : <div className="dashboard-chart-empty">Hoàn thành buổi tập để tạo biểu đồ hoạt động.</div>}
        </div>
      </div>

      {!sessions.length && (
        <div className="data-note">
          Chỉ workout đã hoàn thành mới xuất hiện trong Analytics. Kết quả Calorie Calculator không phải buổi tập.
        </div>
      )}
    </section>
  );
}

/* ── Challenges ───────────────────────────────────────────── */
function Challenges({ data }) {
  const sessions = data.sessions || [];
  return (
    <section>
      <div className="page-head">
        <span className="eyebrow">Motivation</span>
        <h2>Challenges & Achievements</h2>
        <p>Tập đều đặn, không cần tập quá sức để giữ chuỗi.</p>
      </div>

      <div className="challenge-hero">
        <div className="award-icon"><Award size={26} /></div>
        <div className="challenge-hero-info">
          <span className="eyebrow">Cấp độ hiện tại</span>
          <h3>Level {data.level} · Đang tiến bộ</h3>
          <p>{data.xp} / 500 XP đến cấp tiếp theo</p>
          <div className="bar"><i style={{ width: `${Math.min(data.xp / 5, 100)}%` }} /></div>
        </div>
        <div className="challenge-streak">
          {data.streak}
          <small>ngày chuỗi</small>
        </div>
      </div>

      <div className="challenge-grid">
        {data.challenges.map(c => {
          const value = sessions.length;
          const percent = Math.min(100, value / c.target * 100);
          return (
            <article className="challenge-card" key={c.id}>
              <div className="challenge-card-header">
                <Zap size={20} />
                <span className="xp-badge">+{c.reward} XP</span>
              </div>
              <h3>{c.title}</h3>
              <p>{c.description}</p>
              <div className="bar"><i style={{ width: `${percent}%` }} /></div>
              <small>{Math.min(value, c.target).toLocaleString('vi-VN')} / {c.target.toLocaleString('vi-VN')}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ── Recovery ─────────────────────────────────────────────── */
function Recovery({ data, update, showToast }) {
  const [logs, setLogs] = useState(data.recoveryLogs || []);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ sleep: 7, quality: 3, energy: 3, fatigue: 3, soreness: 2, mood: 'Bình thường', notes: '' });

  const save = async e => {
    e.preventDefault();
    const entry = { ...form, id: Date.now(), date: new Date().toISOString() };
    const next = [entry, ...logs.filter(x => new Date(x.date).toDateString() !== new Date().toDateString())];
    const result = await update({ recoveryLogs: next });
    if (!result.ok) return showToast(result.error, 'error');
    setLogs(next);
    setEditing(false);
  };

  const current = logs[0];
  const recommendation = !current
    ? 'Hãy ghi lại cảm nhận hôm nay để nhận gợi ý phù hợp.'
    : current.soreness >= 7 || current.fatigue >= 4
    ? 'Bạn đang báo đau cơ hoặc mệt cao. Hãy cân nhắc nghỉ ngơi hoặc vận động nhẹ, và dừng tập nếu xuất hiện triệu chứng đáng lo ngại.'
    : current.sleep < 6 || current.energy <= 2
    ? 'Giấc ngủ hoặc năng lượng hôm nay thấp. Bạn có thể giảm cường độ và ưu tiên hồi phục.'
    : 'Các chỉ số tự khai báo đang ổn định. Bạn có thể tiếp tục kế hoạch nếu cảm thấy sẵn sàng.';

  return (
    <section className="recovery-page">
      <div className="page-head-row">
        <div>
          <span className="eyebrow">Recovery Check-in</span>
          <h2>Phục hồi thông minh</h2>
          <p>Dữ liệu tự khai báo — không phải chẩn đoán y khoa.</p>
        </div>
        <button onClick={() => setEditing(true)}><Plus size={16} /> Log hôm nay</button>
      </div>

      {!current ? (
        <div className="empty-state">
          <div className="empty-icon"><HeartPulse size={22} /></div>
          <h3>Chưa có check-in hôm nay</h3>
          <p>Chỉ mất vài giây để theo dõi giấc ngủ, năng lượng và đau cơ.</p>
          <button onClick={() => setEditing(true)}><Plus size={16} /> Ghi recovery hôm nay</button>
        </div>
      ) : (
        <>
          <div className="recovery-summary-card">
            <div>
              <span className="eyebrow">Check-in gần nhất</span>
              <h3>{new Date(current.date).toLocaleDateString('vi-VN')}</h3>
              <p>{recommendation}</p>
            </div>
            <div className="recovery-vitals">
              <div className="vital-chip"><b>{current.sleep}h</b><small>ngủ</small></div>
              <div className="vital-chip"><b>{current.energy}/5</b><small>năng lượng</small></div>
              <div className="vital-chip"><b>{current.soreness}/10</b><small>đau cơ</small></div>
            </div>
          </div>

          <div className="recovery-grid">
            <div className="recovery-article">
              <div className="article-icon"><HeartPulse size={20} /></div>
              <h3>Gợi ý hôm nay</h3>
              <p>{recommendation}</p>
              <button className="btn-secondary" style={{ marginTop: 'var(--sp-4)' }} onClick={() => setEditing(true)}>
                Chỉnh sửa check-in
              </button>
            </div>
            <div className="recovery-article">
              <div className="article-icon"><Activity size={20} /></div>
              <h3>Lịch sử</h3>
              <p>{logs.length} bản ghi lưu trong hồ sơ trên thiết bị này. Hiện chưa có API đồng bộ.</p>
              <button className="btn-secondary" style={{ marginTop: 'var(--sp-4)' }} disabled>Xem 7 ngày (sắp có)</button>
            </div>
          </div>
        </>
      )}

      {editing && (
        <div className="modal-backdrop" onMouseDown={() => setEditing(false)}>
          <form className="recovery-form" onSubmit={save} onMouseDown={e => e.stopPropagation()}>
            <button type="button" className="close-btn" onClick={() => setEditing(false)}><X size={16} /></button>
            <span className="eyebrow">Daily Check-in</span>
            <h2>Hôm nay bạn thấy thế nào?</h2>
            {[
              ['sleep', 'Thời gian ngủ (giờ)', 0, 14],
              ['quality', 'Chất lượng ngủ (1–5)', 1, 5],
              ['energy', 'Năng lượng (1–5)', 1, 5],
              ['fatigue', 'Mệt mỏi (1–5)', 1, 5],
              ['soreness', 'Đau cơ (0–10)', 0, 10],
            ].map(([k, l, min, max]) => (
              <label key={k}>
                {l}
                <input type="number" min={min} max={max} value={form[k]} onChange={e => setForm({ ...form, [k]: Number(e.target.value) })} />
              </label>
            ))}
            <label>
              Tâm trạng
              <select value={form.mood} onChange={e => setForm({ ...form, mood: e.target.value })}>
                <option>Bình thường</option>
                <option>Tích cực</option>
                <option>Áp lực</option>
                <option>Uể oải</option>
              </select>
            </label>
            <label>
              Ghi chú (không bắt buộc)
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </label>
            <button type="submit"><Check size={16} /> Lưu check-in</button>
          </form>
        </div>
      )}
    </section>
  );
}

/* ── Mount ────────────────────────────────────────────────── */
createRoot(document.getElementById('root')).render(
  <BrowserRouter><App /></BrowserRouter>
);

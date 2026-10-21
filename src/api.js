const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const TOKEN_KEY = 'homefit-token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = token => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('Không thể kết nối HomeFit API. Kiểm tra server và cấu hình VITE_API_URL.');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && auth) {
      setToken(null);
      window.dispatchEvent(new Event('homefit:unauthorized'));
    }
    throw new Error(payload?.error?.message || `API lỗi (${response.status}).`);
  }
  return payload?.data;
}

const dateParts = date => {
  const value = new Date(date);
  return {
    date: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
    time: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`,
  };
};

const localDateTime = (date, time) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = (time || '00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
};

export const fromExercise = value => ({
  ...value,
  id: value._id,
  tip: value.instructions,
  level: value.difficulty,
  duration: value.durationSeconds,
  restTime: value.restSeconds,
  videoUrl: value.videoUrl,
  source: 'user',
  color: '#eef4e7',
});

export const toExercise = value => ({
  name: value.name,
  muscle: value.muscle,
  instructions: value.tip,
  description: value.description || '',
  difficulty: value.level || 'Beginner',
  equipment: value.equipment || '',
  exerciseType: value.exerciseType || '',
  sets: Number(value.sets) || 0,
  reps: value.reps || '',
  durationSeconds: Number(value.duration) || 0,
  restSeconds: Number(value.restTime) || 0,
  imageUrl: value.imageUrl || '',
  videoUrl: value.videoUrl || '',
  notes: value.notes || '',
  met: Number(value.met) || 5,
});

export const fromSchedule = value => {
  const parts = dateParts(value.startAt);
  return { id: value._id, title: value.title, date: parts.date, time: parts.time, durationMinutes: value.durationMinutes, items: value.exerciseIds || [], status: value.status, planId: value.planId };
};

export const toSchedule = value => ({
  title: value.title,
  startAt: localDateTime(value.date, value.time),
  durationMinutes: Number(value.durationMinutes) || 30,
  exerciseIds: value.items || [],
  status: value.status === 'skipped' ? 'skipped' : 'planned',
  ...(value.planId ? { planId: value.planId } : { planId: null }),
});

export const fromSession = value => ({
  id: value._id,
  date: value.completedAt,
  title: value.title,
  duration: value.durationSeconds,
  completedExercises: value.completedExercises,
  exerciseIds: value.exerciseIds,
  ...(value.distanceKm != null ? { distanceKm: value.distanceKm } : {}),
  ...(value.estimatedCalories != null ? { calories: value.estimatedCalories } : {}),
});

export const fromRecovery = value => ({
  id: value._id,
  date: value.date,
  sleep: value.sleepHours,
  quality: value.sleepQuality,
  energy: value.energy,
  fatigue: value.fatigue,
  soreness: value.soreness,
  mood: value.mood,
  notes: value.notes,
});

export async function loadAccount() {
  const [profile, exerciseData, plans, schedule, sessions, recoveryLogs, calorieEstimates, dashboard] = await Promise.all([
    api('/auth/me'),
    api('/exercises'),
    api('/plans'),
    api('/schedule'),
    api('/sessions?limit=100'),
    api('/recovery'),
    api('/calorie-estimates'),
    api('/dashboard'),
  ]);
  return {
    profile,
    data: {
      weight: profile.weightKg,
      fitnessGoal: profile.fitnessGoal,
      weeklyGoalType: profile.weeklyGoalType,
      weeklyGoalTarget: profile.weeklyGoalTarget,
      weeklyWorkoutGoal: profile.weeklyGoalType === 'sessions' ? profile.weeklyGoalTarget : null,
      planned: schedule.map(fromSchedule),
      sessions: sessions.map(fromSession),
      userExercises: exerciseData.map(fromExercise),
      recoveryLogs: recoveryLogs.map(fromRecovery),
      plans,
      calorieEstimates,
      dashboard,
    },
  };
}

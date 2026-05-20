const API_URL = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('token');
}

export async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.details = data.details;
    throw err;
  }

  return data;
}

export const authApi = {
  signup: (body) => api('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => api('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => api('/api/auth/me'),
  searchUsers: (q) => api(`/api/auth/users/search?q=${encodeURIComponent(q)}`),
};

export const projectApi = {
  list: () => api('/api/projects'),
  get: (id) => api(`/api/projects/${id}`),
  create: (body) => api('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  addMember: (projectId, body) =>
    api(`/api/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify(body) }),
  removeMember: (projectId, userId) =>
    api(`/api/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
};

export const taskApi = {
  list: (projectId) => api(`/api/tasks/project/${projectId}`),
  create: (projectId, body) =>
    api(`/api/tasks/project/${projectId}`, { method: 'POST', body: JSON.stringify(body) }),
  update: (taskId, body) =>
    api(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (taskId) => api(`/api/tasks/${taskId}`, { method: 'DELETE' }),
};

export const dashboardApi = {
  get: (projectId) => api(`/api/dashboard/project/${projectId}`),
};

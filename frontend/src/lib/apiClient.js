const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api/v1';
const AUTH_BASE = `${API_BASE}/auth`;

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getHeaders = (extraHeaders = {}, includeJson = true) => {
  const token = localStorage.getItem('token');
  const headers = { ...extraHeaders };

  if (includeJson && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  const response = await fetch(`${AUTH_BASE}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    return null;
  }

  const payload = await parseJsonSafe(response);
  if (!payload?.access_token) return null;

  localStorage.setItem('token', payload.access_token);
  if (payload.refresh_token) {
    localStorage.setItem('refreshToken', payload.refresh_token);
  }

  return payload.access_token;
};

const request = async (path, options = {}, retry = true) => {
  const { raw = false, includeJson = true, headers: extraHeaders = {}, ...rest } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: getHeaders(extraHeaders, includeJson),
  });

  if (response.status === 401 && retry) {
    const renewed = await refreshAccessToken();
    if (renewed) {
      return request(path, options, false);
    }
  }

  if (!response.ok) {
    const err = await parseJsonSafe(response);
    throw new Error(err?.detail || `Request failed (${response.status})`);
  }

  if (raw) return response;
  return parseJsonSafe(response);
};

export const apiClient = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  postForm: (path, formData) => request(path, {
    method: 'POST',
    body: formData,
    includeJson: false,
  }),
};

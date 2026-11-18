/**
 * ============================================================
 * AMOUR AFFAIRS — API Client
 * ============================================================
 * Centralized API client with JWT token management,
 * automatic refresh, and type-safe request/response handling.
 * ============================================================
 */

// ── Types ──

export interface AuthResponse {
  user: { id: number; email: string; name: string; role: string };
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface APIError {
  error: string;
}

// ── Configuration ──

// API base URL — change this per environment
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// ── Token Management ──

const TOKEN_KEY = 'aa_access_token';
const REFRESH_KEY = 'aa_refresh_token';
const USER_KEY = 'aa_user';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): AuthResponse['user'] | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function storeAuth(data: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(REFRESH_KEY, data.refresh_token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getStoredToken();
}


// ── Core Fetch Wrapper ──

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth.php?action=refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearAuth();
      return false;
    }

    const data: AuthResponse = await res.json();
    storeAuth(data);
    return true;
  } catch {
    clearAuth();
    return false;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown> | FormData;
  auth?: boolean; // default true
  raw?: boolean;  // return raw Response
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, auth = true, raw = false } = options;

  const headers: Record<string, string> = {};

  // Add auth header
  if (auth) {
    const token = getStoredToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Build request init
  const init: RequestInit = { method, headers };

  if (body) {
    if (body instanceof FormData) {
      // Let browser set Content-Type with boundary for multipart
      init.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }

  let res = await fetch(`${API_BASE}/${endpoint}`, init);

  // Handle 401 — try refresh
  if (res.status === 401 && auth && !isRefreshing) {
    isRefreshing = true;
    refreshPromise = refreshAccessToken();
    const refreshed = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshed) {
      // Retry with new token
      headers['Authorization'] = `Bearer ${getStoredToken()}`;
      res = await fetch(`${API_BASE}/${endpoint}`, { ...init, headers });
    } else {
      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Session expired');
    }
  } else if (res.status === 401 && auth && isRefreshing) {
    // Wait for ongoing refresh
    const refreshed = await refreshPromise;
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getStoredToken()}`;
      res = await fetch(`${API_BASE}/${endpoint}`, { ...init, headers });
    } else {
      throw new Error('Session expired');
    }
  }

  if (raw) return res as unknown as T;

  const data = await res.json();

  if (!res.ok) {
    throw new Error((data as APIError).error || `API Error: ${res.status}`);
  }

  return data as T;
}


/**
 * Multipart upload with real upload-progress reporting. `fetch` cannot report
 * upload progress, so file uploads go through XMLHttpRequest instead — the
 * `onProgress` callback receives 0–100 as the bytes leave the browser. Mirrors
 * apiRequest's auth + single 401→refresh→retry behaviour.
 */
export function apiUpload<T = unknown>(
  endpoint: string,
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<T> {
  const send = (allowRetry: boolean): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/${endpoint}`);

      const token = getStoredToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        // Once the bytes are up, the server is processing — hold at 100.
        xhr.upload.onload = () => onProgress(100);
      }

      xhr.onload = async () => {
        // Expired token — refresh once and retry the whole upload.
        if (xhr.status === 401 && allowRetry) {
          const refreshed = await refreshAccessToken();
          if (refreshed) { resolve(await send(false)); return; }
          if (typeof window !== 'undefined') window.location.href = '/login';
          reject(new Error('Session expired'));
          return;
        }
        let data: unknown = null;
        try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data as T);
        } else {
          reject(new Error((data as APIError)?.error || `Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.ontimeout = () => reject(new Error('Upload timed out'));
      xhr.send(formData);
    });

  return send(true);
}


// ── Convenience Methods ──

export const api = {
  get: <T = unknown>(endpoint: string, auth = true) =>
    apiRequest<T>(endpoint, { method: 'GET', auth }),

  post: <T = unknown>(endpoint: string, body: Record<string, unknown> | FormData, auth = true) =>
    apiRequest<T>(endpoint, { method: 'POST', body, auth }),

  put: <T = unknown>(endpoint: string, body: Record<string, unknown>, auth = true) =>
    apiRequest<T>(endpoint, { method: 'PUT', body, auth }),

  delete: <T = unknown>(endpoint: string, auth = true) =>
    apiRequest<T>(endpoint, { method: 'DELETE', auth }),
};


// ── Auth API ──

export const authAPI = {
  login: (email: string, password: string) =>
    apiRequest<AuthResponse>('auth.php?action=login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),

  logout: () =>
    apiRequest('auth.php?action=logout', { method: 'POST' }),

  me: () =>
    apiRequest<{ user: AuthResponse['user'] & { last_login?: string | null; created_at?: string | null } }>(
      'auth.php?action=me'
    ),

  changePassword: (current_password: string, new_password: string) =>
    apiRequest<{ message: string }>('auth.php?action=change-password', {
      method: 'POST',
      body: { current_password, new_password },
    }),

  refresh: () => refreshAccessToken(),
};


// ── Asset URL Helper ──

// /uploads/... paths returned by the API live on the API host,
// not on the dashboard origin — resolve them against the API base.
const ASSET_BASE = API_BASE.replace(/\/api\/?$/, '');

export function assetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${ASSET_BASE}${path}`;
}


// ── Resource APIs ──

export const galleryAPI = {
  list: (params?: { category?: string; featured?: number; all?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.featured !== undefined) qs.set('featured', String(params.featured));
    if (params?.all) qs.set('all', '1');
    return api.get<{ images: unknown[]; total: number }>(`gallery.php?${qs}`);
  },
  get: (id: number) => api.get(`gallery.php?id=${id}`),
  upload: (formData: FormData) => api.post('gallery.php', formData),
  update: (id: number, data: Record<string, unknown>) => api.put(`gallery.php?id=${id}`, data),
  delete: (id: number) => api.delete(`gallery.php?id=${id}`),
  reorder: (orders: { id: number; sort_order: number }[]) =>
    api.post('gallery.php?action=reorder', { orders } as unknown as Record<string, unknown>),
};

export const albumsAPI = {
  list: (params?: { type?: string; all?: boolean; withPhotos?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.all) qs.set('all', '1');
    if (params?.withPhotos) qs.set('with_photos', '1');
    return api.get<{ albums: unknown[]; total: number }>(`albums.php?${qs}`);
  },
  // all=1 so the dashboard can open hidden albums and see hidden photos
  get: (id: number) => api.get(`albums.php?id=${id}&all=1`),
  create: (formData: FormData) => api.post('albums.php', formData),
  update: (id: number, data: Record<string, unknown>) => api.put(`albums.php?id=${id}`, data),
  delete: (id: number) => api.delete(`albums.php?id=${id}`),
  addPhotos: (id: number, formData: FormData) => api.post(`albums.php?action=photos&id=${id}`, formData),
  setCover: (id: number, formData: FormData) => api.post(`albums.php?action=cover&id=${id}`, formData),
  reorder: (orders: { id: number; sort_order: number }[]) =>
    api.post('albums.php?action=reorder', { orders } as unknown as Record<string, unknown>),

  // Sections — the ritual filters inside a folder (Haldi, Mehendi, …).
  // Note the id in update/remove is the SECTION id, not the album id.
  sections: {
    create: (albumId: number, name: string) =>
      api.post<AlbumSection>(`albums.php?action=sections&id=${albumId}`, { name }),
    update: (sectionId: number, data: { name?: string; is_active?: number; sort_order?: number }) =>
      api.put<AlbumSection>(`albums.php?action=sections&id=${sectionId}`, data),
    /** Deleting a section releases its photos to unsorted — it never deletes them. */
    remove: (sectionId: number) =>
      api.delete<{ message: string; released: number }>(`albums.php?action=sections&id=${sectionId}`),
    reorder: (albumId: number, orders: { id: number; sort_order: number }[]) =>
      api.post(`albums.php?action=sections_reorder&id=${albumId}`, { orders } as unknown as Record<string, unknown>),
    /** Move photos into a section, or back to unsorted with sectionId null. */
    assign: (albumId: number, photoIds: number[], sectionId: number | null) =>
      api.post<{ moved: number; section_id: number | null }>(
        `albums.php?action=assign&id=${albumId}`,
        { photo_ids: photoIds, section_id: sectionId } as unknown as Record<string, unknown>,
      ),
  },
};

export interface AlbumSection {
  id: number;
  album_id: number;
  name: string;
  sort_order: number;
  is_active: number;
  photo_count?: number;
}

export const filmsAPI = {
  list: (params?: { featured?: number; all?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.featured !== undefined) qs.set('featured', String(params.featured));
    if (params?.all) qs.set('all', '1');
    return api.get<{ films: unknown[]; total: number }>(`films.php?${qs}`);
  },
  get: (id: number) => api.get(`films.php?id=${id}`),
  create: (data: Record<string, unknown>) => api.post('films.php', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`films.php?id=${id}`, data),
  delete: (id: number) => api.delete(`films.php?id=${id}`),
  reorder: (orders: { id: number; sort_order: number }[]) =>
    api.post('films.php?action=reorder', { orders } as unknown as Record<string, unknown>),
};

export const packagesAPI = {
  list: (params?: { category?: string; all?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.all) qs.set('all', '1');
    return api.get<{ packages: unknown[]; total: number }>(`packages.php?${qs}`);
  },
  get: (id: number) => api.get(`packages.php?id=${id}`),
  create: (data: Record<string, unknown>) => api.post('packages.php', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`packages.php?id=${id}`, data),
  delete: (id: number) => api.delete(`packages.php?id=${id}`),
};

export const teamAPI = {
  list: (all = false) => {
    const qs = all ? '?all=1' : '';
    return api.get<{ team: unknown[]; total: number }>(`team.php${qs}`);
  },
  get: (id: number) => api.get(`team.php?id=${id}`),
  create: (formData: FormData) => api.post('team.php', formData),
  update: (id: number, data: Record<string, unknown>) => api.put(`team.php?id=${id}`, data),
  delete: (id: number) => api.delete(`team.php?id=${id}`),
};

export const testimonialsAPI = {
  list: (params?: { featured?: number; all?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.featured !== undefined) qs.set('featured', String(params.featured));
    if (params?.all) qs.set('all', '1');
    return api.get<{ testimonials: unknown[]; total: number }>(`testimonials.php?${qs}`);
  },
  get: (id: number) => api.get(`testimonials.php?id=${id}`),
  create: (formData: FormData) => api.post('testimonials.php', formData),
  update: (id: number, data: Record<string, unknown>) => api.put(`testimonials.php?id=${id}`, data),
  setPhoto: (id: number, formData: FormData) => api.post(`testimonials.php?action=photo&id=${id}`, formData),
  delete: (id: number) => api.delete(`testimonials.php?id=${id}`),
};

export const faqsAPI = {
  list: (all = false) => {
    const qs = all ? '?all=1' : '';
    return api.get<{ faqs: unknown[]; total: number }>(`faqs.php${qs}`, !all ? false : true);
  },
  get: (id: number) => api.get(`faqs.php?id=${id}`),
  create: (data: Record<string, unknown>) => api.post('faqs.php', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`faqs.php?id=${id}`, data),
  delete: (id: number) => api.delete(`faqs.php?id=${id}`),
  reorder: (orders: { id: number; sort_order: number }[]) =>
    api.post('faqs.php?action=reorder', { orders } as unknown as Record<string, unknown>),
};

export const guidesAPI = {
  list: (all = false) => {
    const qs = all ? '?all=1' : '';
    return api.get<{ guides: unknown[]; total: number }>(`guides.php${qs}`, all);
  },
  get: (id: number) => api.get(`guides.php?id=${id}`),
  create: (data: Record<string, unknown>) => api.post('guides.php', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`guides.php?id=${id}`, data),
  setCover: (id: number, formData: FormData, onProgress?: (p: number) => void) =>
    apiUpload(`guides.php?action=cover&id=${id}`, formData, onProgress),
  delete: (id: number) => api.delete(`guides.php?id=${id}`),
};

export const caseStudiesAPI = {
  list: (all = false) => {
    const qs = all ? '?all=1' : '';
    return api.get<{ case_studies: unknown[]; total: number }>(`case_studies.php${qs}`, all);
  },
  get: (id: number) => api.get(`case_studies.php?id=${id}`),
  create: (data: Record<string, unknown>) => api.post('case_studies.php', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`case_studies.php?id=${id}`, data),
  setCover: (id: number, formData: FormData, onProgress?: (p: number) => void) =>
    apiUpload(`case_studies.php?action=cover&id=${id}`, formData, onProgress),
  addGallery: (id: number, formData: FormData, onProgress?: (p: number) => void) =>
    apiUpload(`case_studies.php?action=gallery&id=${id}`, formData, onProgress),
  delete: (id: number) => api.delete(`case_studies.php?id=${id}`),
};

export const leadMagnetsAPI = {
  list: (all = false) => {
    const qs = all ? '?all=1' : '';
    return api.get<{ lead_magnets: unknown[]; total: number }>(`lead_magnets.php${qs}`, all);
  },
  get: (id: number) => api.get(`lead_magnets.php?id=${id}`),
  create: (data: Record<string, unknown>) => api.post('lead_magnets.php', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`lead_magnets.php?id=${id}`, data),
  uploadFile: (id: number, formData: FormData, onProgress?: (p: number) => void) =>
    apiUpload(`lead_magnets.php?action=file&id=${id}`, formData, onProgress),
  setCover: (id: number, formData: FormData, onProgress?: (p: number) => void) =>
    apiUpload(`lead_magnets.php?action=cover&id=${id}`, formData, onProgress),
  delete: (id: number) => api.delete(`lead_magnets.php?id=${id}`),
};

export const settingsAPI = {
  getAll: () => api.get<{ settings: Record<string, string> }>('settings.php', false),
  getGroup: (group: string) => api.get<{ settings: Record<string, string> }>(`settings.php?group=${group}`, false),
  update: (settings: Record<string, string>) => api.put('settings.php', { settings }),
  // Upload an image for settings-backed content (e.g. the About-page founder
  // photo). Returns the stored path to persist as a `site_*` setting value.
  uploadImage: (formData: FormData) =>
    api.post<{ file_path: string; thumbnail_path: string | null }>('settings.php?action=upload', formData),
};

export const bookingsAPI = {
  list: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return api.get<{ bookings: unknown[]; total: number }>(`bookings.php${qs}`);
  },
  get: (id: number) => api.get(`bookings.php?id=${id}`),
  create: (data: Record<string, unknown>) => api.post('bookings.php', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`bookings.php?id=${id}`, data),
  delete: (id: number) => api.delete(`bookings.php?id=${id}`),
  stats: () => api.get<{ stats: Record<string, unknown> }>('bookings.php?action=stats'),
};

export const leadsAPI = {
  list: (params?: { stage?: string; source?: string }) => {
    const qs = new URLSearchParams();
    if (params?.stage) qs.set('stage', params.stage);
    if (params?.source) qs.set('source', params.source);
    return api.get<{ leads: unknown[]; total: number }>(`leads.php?${qs}`);
  },
  get: (id: number) => api.get(`leads.php?id=${id}`),
  create: (data: Record<string, unknown>) => api.post('leads.php', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`leads.php?id=${id}`, data),
  delete: (id: number) => api.delete(`leads.php?id=${id}`),
};

export interface TrafficData {
  range: string;
  totals: { views: number; visitors: number; sessions: number };
  prev_totals: { views: number; visitors: number; sessions: number } | null;
  engagement: { bounce_rate: number | null; pages_per_session: number | null };
  series: { date: string; label: string; views: number; visitors: number }[];
  top_pages: { path: string; views: number; visitors: number }[];
  sources: { source: string; views: number }[];
  devices: { device: string; views: number }[];
  browsers: { browser: string; views: number }[];
  countries: { country: string; views: number }[];
}

export const analyticsAPI = {
  // First-party website traffic. range: 7d | 30d | 90d | 12m | all
  traffic: (range = '30d') => api.get<TrafficData>(`analytics.php?range=${range}`),
};

export const clientsAPI = {
  list: (params?: { type?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.search) qs.set('search', params.search);
    return api.get<{ clients: unknown[]; total: number }>(`clients.php?${qs}`);
  },
  get: (id: number) => api.get(`clients.php?id=${id}`),
  create: (data: Record<string, unknown>) => api.post('clients.php', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`clients.php?id=${id}`, data),
  /** What a delete would touch — drives the confirmation dialog. */
  impact: (id: number) => api.get<ClientDeleteImpact>(`clients.php?id=${id}&action=impact`),
  /** mode "keep" detaches bookings/invoices/payments; "all" deletes them too. */
  delete: (id: number, mode: 'keep' | 'all' = 'keep') =>
    api.delete<{ message: string; mode: string; removed: Record<string, number> }>(`clients.php?id=${id}&mode=${mode}`),
};

export interface ClientDeleteImpact {
  client_id: number;
  name: string;
  bookings: number;
  invoices: number;
  transactions: number;
  payments_total: number;
  special_dates: number;
  greetings: number;
}

// CRM — client special dates, festivals, greeting templates & send log.
// Response shapes live in @/lib/crm (UpcomingResponse, ClientDate, Festival).
export const crmAPI = {
  upcoming: (days = 30) => api.get(`crm.php?action=upcoming&days=${days}`),
  dates: {
    list: (clientId: number) => api.get<{ dates: unknown[] }>(`crm.php?action=dates&client_id=${clientId}`),
    create: (data: Record<string, unknown>) => api.post('crm.php?action=dates', data),
    update: (id: number, data: Record<string, unknown>) => api.put(`crm.php?action=dates&id=${id}`, data),
    delete: (id: number) => api.delete(`crm.php?action=dates&id=${id}`),
  },
  festivals: {
    list: () => api.get<{ festivals: unknown[] }>('crm.php?action=festivals'),
    create: (data: Record<string, unknown>) => api.post('crm.php?action=festivals', data),
    update: (id: number, data: Record<string, unknown>) => api.put(`crm.php?action=festivals&id=${id}`, data),
    delete: (id: number) => api.delete(`crm.php?action=festivals&id=${id}`),
  },
  greetings: (festivalId: number, year: number) =>
    api.get<{ client_ids: number[]; year: number }>(`crm.php?action=greetings&festival_id=${festivalId}&year=${year}`),
  logSend: (data: {
    client_date_id?: number;
    festival_id?: number;
    client_id?: number;
    occasion_year: number;
    message: string;
  }) => api.post('crm.php?action=log', data as unknown as Record<string, unknown>),
  templates: {
    get: () => api.get<{ templates: Record<string, string> }>('crm.php?action=templates'),
    save: (templates: Record<string, string>) =>
      api.put<{ templates: Record<string, string> }>('crm.php?action=templates', { templates }),
  },
};

// CRM Families — one record per family with husband/wife/child members.
// Response shapes live in @/lib/families. Festivals + templates are shared
// config served by crmAPI (crm.php).
export const familiesAPI = {
  list: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return api.get<{ families: unknown[]; total: number }>(`families.php${qs}`);
  },
  get: (id: number) => api.get(`families.php?id=${id}`),
  create: (data: Record<string, unknown>) => api.post("families.php", data),
  update: (id: number, data: Record<string, unknown>) => api.put(`families.php?id=${id}`, data),
  delete: (id: number) => api.delete(`families.php?id=${id}`),
  upcoming: (days = 30) => api.get(`families.php?action=upcoming&days=${days}`),
  logSend: (data: {
    family_id: number;
    occasion: "birthday" | "anniversary" | "festival";
    family_member_id?: number;
    festival_id?: number;
    occasion_year: number;
    message: string;
  }) => api.post("families.php?action=log", data as unknown as Record<string, unknown>),
};

export const paymentsAPI = {
  invoices: {
    list: (status?: string) => {
      const qs = status ? `&status=${status}` : '';
      return api.get<{ invoices: unknown[]; total: number }>(`payments.php?type=invoices${qs}`);
    },
    get: (id: number) => api.get(`payments.php?type=invoices&id=${id}`),
    create: (data: Record<string, unknown>) => api.post('payments.php?type=invoices', data),
    update: (id: number, data: Record<string, unknown>) => api.put(`payments.php?type=invoices&id=${id}`, data),
    delete: (id: number) => api.delete(`payments.php?type=invoices&id=${id}`),
  },
  transactions: {
    list: () => api.get<{ transactions: unknown[]; total: number }>('payments.php?type=transactions'),
    create: (data: Record<string, unknown>) => api.post('payments.php?type=transactions', data),
    delete: (id: number) => api.delete(`payments.php?type=transactions&id=${id}`),
  },
  stats: () => api.get<{ stats: Record<string, unknown> }>('payments.php?type=stats'),
};

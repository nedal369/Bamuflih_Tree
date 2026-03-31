import axios from 'axios';
import type { Member, TreeNode, SubtreeResponse, Stats, AuthResponse, ExcelUploadResponse, User, Marriage, RelationshipResult, SearchResult, FamilyHead, EventReport } from '../types';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (error.response?.status === 403 && error.response?.data?.error === 'رمز غير صالح') {
      // Expired or invalid JWT token - redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (username: string, password: string) =>
  api.post<AuthResponse>('/auth/login', { username, password }).then(r => r.data);

export const register = (username: string, password: string, full_name: string) =>
  api.post('/auth/register', { username, password, full_name }).then(r => r.data);

export const getUsers = () =>
  api.get<User[]>('/auth/users').then(r => r.data);

export const createUser = (data: { username: string; password: string; full_name?: string; role?: string; member_id?: number | null; permission_type?: string; allowed_subtrees?: number[] }) =>
  api.post<User>('/auth/users', data).then(r => r.data);

export const updateUserStatus = (id: number, data: { status?: string; role?: string; member_id?: number | null; permission_type?: string; allowed_subtrees?: number[] }) =>
  api.put<User>(`/auth/users/${id}/status`, data).then(r => r.data);

export const deleteUser = (id: number) =>
  api.delete(`/auth/users/${id}`).then(r => r.data);

export const toggleFundSubscriber = (id: number, value: boolean) =>
  api.put(`/auth/users/${id}/fund-subscriber`, { is_fund_subscriber: value }).then(r => r.data);

// Members
export const getMembers = () =>
  api.get<Member[]>('/members').then(r => r.data);

export const getMembersTree = () =>
  api.get<TreeNode[]>('/members?format=tree').then(r => r.data);

export const getMember = (id: number) =>
  api.get<Member>(`/members/${id}`).then(r => r.data);

export const getMemberSubtree = (id: number) =>
  api.get<SubtreeResponse>(`/members/${id}/subtree`).then(r => r.data);

export const createMember = (data: Partial<Member>) =>
  api.post<Member>('/members', data).then(r => r.data);

export const updateMember = (id: number, data: Partial<Member>) =>
  api.put<Member>(`/members/${id}`, data).then(r => r.data);

export const deleteMember = (id: number) =>
  api.delete(`/members/${id}`).then(r => r.data);

// Marriages
export const addMarriage = (memberId: number, data: Partial<Marriage>) =>
  api.post<Marriage>(`/members/${memberId}/marriages`, data).then(r => r.data);

export const updateMarriage = (id: number, data: Partial<Marriage>) =>
  api.put<Marriage>(`/members/marriages/${id}`, data).then(r => r.data);

export const deleteMarriage = (id: number) =>
  api.delete(`/members/marriages/${id}`).then(r => r.data);

// Stats
export const getStats = () =>
  api.get<Stats>('/stats').then(r => r.data);

// Upload
export const uploadExcel = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<ExcelUploadResponse>('/upload/excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const importExcelData = (data: Record<string, string>[]) =>
  api.post('/upload/excel/import', { data }).then(r => r.data);

export const downloadExcel = () =>
  api.get('/upload/excel/download', { responseType: 'blob' }).then(r => {
    const url = window.URL.createObjectURL(new Blob([r.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'family_tree.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  });

export const uploadFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/upload/file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

// Relationship finder
export const findRelationship = (id1: number, id2: number) =>
  api.get<RelationshipResult>(`/members/relationship/${id1}/${id2}`).then(r => r.data);

// Advanced search
export const searchMembers = (params: Record<string, string>) => {
  const query = new URLSearchParams(params).toString();
  return api.get<SearchResult>(`/members/search/advanced?${query}`).then(r => r.data);
};

// GEDCOM
export const downloadGedcom = () =>
  api.get('/gedcom/download', { responseType: 'blob' }).then(r => {
    const url = window.URL.createObjectURL(new Blob([r.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bamuflih_tree.ged';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  });

export const importGedcom = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/gedcom/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

// Notifications
export const getNotifications = () =>
  api.get('/notifications').then(r => r.data);

// Member photo upload
export const uploadMemberPhoto = (memberId: number, file: File) => {
  const formData = new FormData();
  formData.append('photo', file);
  return api.post(`/members/${memberId}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

// Activity Log
export const getActivityLog = (params?: { page?: number; entity_type?: string; action?: string }) => {
  const query = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : '';
  return api.get(`/activity-log${query}`).then(r => r.data);
};

export const revertActivity = (id: number) =>
  api.post(`/activity-log/${id}/revert`).then(r => r.data);

// Allied Families
export const getAlliedFamilies = () =>
  api.get('/families').then(r => r.data);

export const getAlliedFamily = (id: number) =>
  api.get(`/families/${id}`).then(r => r.data);

export const createAlliedFamily = (data: { name: string; description?: string }) =>
  api.post('/families', data).then(r => r.data);

export const updateAlliedFamily = (id: number, data: { name?: string; description?: string }) =>
  api.put(`/families/${id}`, data).then(r => r.data);

export const deleteAlliedFamily = (id: number) =>
  api.delete(`/families/${id}`).then(r => r.data);

export const addFamilyMember = (familyId: number, data: Record<string, unknown>) =>
  api.post(`/families/${familyId}/members`, data).then(r => r.data);

// Fund Family Heads & Calculator
export const getFamilyHeads = (childAgeMax?: number, youngAgeMax?: number) => {
  const params = new URLSearchParams();
  if (childAgeMax !== undefined) params.set('child_age_max', String(childAgeMax));
  if (youngAgeMax !== undefined) params.set('young_age_max', String(youngAgeMax));
  const query = params.toString();
  return api.get<FamilyHead[]>(`/fund/family-heads${query ? '?' + query : ''}`).then(r => r.data);
};

export const calculateFamilies = (eventId: number, familyHeadIds: number[]) =>
  api.post(`/fund/events/${eventId}/calculate-families`, { family_head_ids: familyHeadIds }).then(r => r.data);

export const getEventReport = (eventId: number) =>
  api.get<EventReport>(`/fund/events/${eventId}/report`).then(r => r.data);

export default api;

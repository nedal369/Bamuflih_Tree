import axios from 'axios';
import type { Member, TreeNode, SubtreeResponse, Stats, AuthResponse, ExcelUploadResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (username: string, password: string) =>
  api.post<AuthResponse>('/auth/login', { username, password }).then(r => r.data);

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

export const uploadFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/upload/file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export default api;

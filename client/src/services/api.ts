import axios from 'axios';
import type { Member, TreeNode, SubtreeResponse, Stats, AuthResponse, ExcelUploadResponse, User, Marriage } from '../types';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Don't clear on 403 for pending users
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
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

export default api;

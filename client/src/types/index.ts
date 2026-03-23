export interface Member {
  id: number;
  name: string;
  father_id: number | null;
  gender: 'male' | 'female';
  birth_date: string | null;
  death_date: string | null;
  bio: string | null;
  phone: string | null;
  generation: number;
  created_at: string;
  updated_at: string;
}

export interface TreeNode extends Member {
  children: TreeNode[];
}

export interface SubtreeResponse {
  member: Member;
  ancestors: Member[];
  tree: TreeNode;
}

export interface Stats {
  totalMembers: number;
  maleCount: number;
  femaleCount: number;
  livingCount: number;
  deceasedCount: number;
  maxGeneration: number;
  generationDistribution: { generation: number; count: number }[];
  branches: { id: number; name: string; descendants_count: number; total_descendants: number }[];
}

export interface User {
  id: number;
  username: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ExcelUploadResponse {
  message: string;
  data: Record<string, string>[];
  columns: string[];
  filename: string;
}

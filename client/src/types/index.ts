export interface Member {
  id: number;
  name: string;
  father_id: number | null;
  gender: 'male' | 'female';
  birth_date: string | null;
  death_date: string | null;
  bio: string | null;
  phone: string | null;
  mother_name: string | null;
  city: string | null;
  nationality: string | null;
  occupation: string | null;
  generation: number;
  marriages?: Marriage[];
  created_at: string;
  updated_at: string;
}

export interface Marriage {
  id: number;
  husband_id: number;
  wife_id: number | null;
  wife_name: string;
  status: 'married' | 'divorced' | 'widowed' | 'deceased';
  marriage_order: number;
}

export interface TreeNode extends Member {
  children: TreeNode[];
  marriages?: Marriage[];
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
  cityDistribution: { city: string; count: number }[];
  marriageStats: { status: string; count: number }[];
}

export interface User {
  id: number;
  username: string;
  full_name: string | null;
  role: 'admin' | 'member' | 'pending';
  member_id: number | null;
  status: 'approved' | 'pending' | 'rejected';
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

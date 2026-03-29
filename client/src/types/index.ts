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
  work_type: string | null;
  work_place: string | null;
  photo: string | null;
  whatsapp: string | null;
  twitter: string | null;
  instagram: string | null;
  snapchat: string | null;
  tiktok: string | null;
  family_id: number | null;
  family_name?: string;
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
  workTypeDistribution: { work_type: string; count: number }[];
  workPlaceDistribution: { work_place: string; count: number }[];
  nationalityDistribution: { nationality: string; count: number }[];
  occupationDistribution: { occupation: string; count: number }[];
  averageChildrenPerMember: number;
  ageDistribution: { range: string; count: number }[];
  youngestMember: { name: string; birth_date: string } | null;
  oldestMember: { name: string; birth_date: string } | null;
  mostChildren: { name: string; count: number } | null;
  mostDescendants: { name: string; count: number } | null;
  timelineData: { decade: string; count: number }[];
}

export interface RelationshipResult {
  person1: { id: number; name: string };
  person2: { id: number; name: string };
  relationship: string;
  lca: { id: number; name: string } | null;
  path: { id: number; name: string }[];
}

export interface SearchResult {
  total: number;
  members: Member[];
  facets: {
    city: Record<string, number>;
    work_type: Record<string, number>;
    occupation: Record<string, number>;
    nationality: Record<string, number>;
  };
}

export interface User {
  id: number;
  username: string;
  full_name: string | null;
  role: 'admin' | 'member' | 'pending';
  member_id: number | null;
  status: 'approved' | 'pending' | 'rejected';
  permission_type: 'full_tree' | 'own_subtree' | 'custom_subtrees';
  allowed_subtrees: number[];
  is_fund_subscriber?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Notification {
  type: 'birthday_today' | 'birthday_upcoming' | 'new_member';
  member_id: number;
  name: string;
  photo: string | null;
  gender: 'male' | 'female';
  message: string;
  date: string;
  days_until?: number;
  priority: number;
}

export interface ActivityLog {
  id: number;
  action: 'create' | 'update' | 'delete' | 'import';
  entity_type: 'member' | 'marriage' | 'family';
  entity_id: number | null;
  entity_name: string | null;
  details: string | null;
  old_data: string | null;
  new_data: string | null;
  user_id: number | null;
  username: string | null;
  created_at: string;
}

export interface AlliedFamily {
  id: number;
  name: string;
  description: string | null;
  member_count?: number;
  created_at: string;
}

export interface FamilyHead {
  id: number;
  name: string;
  generation: number;
  is_fund_subscriber: boolean;
  family_members: FamilyMember[];
  adult_count: number;
  young_count: number;
  child_count: number;
  total_members: number;
}

export interface FamilyMember {
  id: number | null;
  name: string;
  relationship: 'head' | 'wife' | 'child';
  category: 'adult' | 'young' | 'child';
}

export interface EventFamily {
  id?: number;
  head_member_id?: number;
  head_name: string;
  is_subscriber: boolean;
  adult_count: number;
  young_count: number;
  child_count: number;
  total_members: number;
  total_cost: number;
}

export interface EventRates {
  subscriber_adult: number;
  non_subscriber_adult: number;
  subscriber_young: number;
  non_subscriber_young: number;
  subscriber_child: number;
  non_subscriber_child: number;
}

export interface EventReport {
  event: { name: string; date: string | null; description: string | null };
  cost_breakdown: { dinner: number; venue: number; hospitality: number; other: number };
  subscriber_exemptions: string[];
  non_subscriber_surcharge: number;
  rates: EventRates;
  summary: {
    total_families: number;
    subscriber_families: number;
    non_subscriber_families: number;
    total_adults: number;
    total_young: number;
    total_children: number;
    total_people: number;
    grand_total: number;
  };
  families: EventFamily[];
}

export interface ExcelUploadResponse {
  message: string;
  data: Record<string, string>[];
  columns: string[];
  filename: string;
}

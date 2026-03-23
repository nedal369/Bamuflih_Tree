import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMemberSubtree } from '../services/api';
import type { SubtreeResponse } from '../types';
import SubTreeView from '../components/tree/SubTreeView';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SubtreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getMemberSubtree(Number(id))
      .then(setData)
      .catch(() => setError('لم يتم العثور على العضو'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner size="lg" />;
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-text-secondary text-lg mb-4">{error || 'لم يتم العثور على العضو'}</p>
        <Link to="/" className="text-primary font-medium no-underline hover:underline">العودة للشجرة</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Link to="/" className="inline-flex items-center gap-2 text-primary text-sm font-medium no-underline hover:underline mb-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        العودة للشجرة
      </Link>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <SubTreeView data={data} onClose={() => {}} />
      </div>
    </div>
  );
}

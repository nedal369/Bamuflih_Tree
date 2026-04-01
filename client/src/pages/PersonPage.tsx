import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMemberSubtree, uploadMemberPhoto } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { SubtreeResponse } from '../types';
import SubTreeView from '../components/tree/SubTreeView';
import LoadingSpinner from '../components/common/LoadingSpinner';

function calculateAge(birthDateStr: string | null, deathDateStr?: string | null): string | null {
  if (!birthDateStr) return null;
  const parsed = parseDateStr(birthDateStr);
  if (!parsed) return null;

  const endDate = deathDateStr ? parseDateStr(deathDateStr) : null;
  const end = endDate ? new Date(endDate.year, endDate.month - 1, endDate.day) : new Date();
  const birth = new Date(parsed.year, parsed.month - 1, parsed.day);

  let age = end.getFullYear() - birth.getFullYear();
  const monthDiff = end.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? String(age) : null;
}

function parseDateStr(str: string): { year: number; month: number; day: number } | null {
  if (!str) return null;
  str = str.trim();
  let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return { year: +match[1], month: +match[2], day: +match[3] };
  match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (match) return { year: +match[3], month: +match[2], day: +match[1] };
  return null;
}

function SocialButton({ href, label, color, icon }: { href: string; label: string; color: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium no-underline text-white transition-transform hover:scale-105 active:scale-95"
      style={{ backgroundColor: color }}
    >
      {icon}
      <span className="hidden min-[400px]:inline">{label}</span>
    </a>
  );
}

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [data, setData] = useState<SubtreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  const reload = () => {
    if (!id) return;
    setLoading(true);
    getMemberSubtree(Number(id))
      .then(setData)
      .catch(() => setError('لم يتم العثور على العضو'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [id]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploading(true);
    try {
      const result = await uploadMemberPhoto(Number(id), file);
      if (data) {
        setData({ ...data, member: { ...data.member, photo: result.photo } });
      }
    } catch {
      // ignore
    }
    setUploading(false);
  };

  if (loading) return <LoadingSpinner size="lg" />;
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-text-secondary text-lg mb-4">{error || 'لم يتم العثور على العضو'}</p>
        <Link to="/" className="text-primary font-medium no-underline hover:underline">العودة للشجرة</Link>
      </div>
    );
  }

  const member = data.member;
  const age = calculateAge(member.birth_date, member.death_date);
  const whatsappUrl = member.whatsapp ? `https://wa.me/${member.whatsapp.replace(/[^0-9]/g, '')}` : (member.phone ? `https://wa.me/${member.phone.replace(/[^0-9]/g, '')}` : null);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Link to="/" className="inline-flex items-center gap-2 text-primary text-sm font-medium no-underline hover:underline mb-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        العودة للشجرة
      </Link>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
          {/* Photo Section */}
          <div className="flex-shrink-0 relative group mx-auto sm:mx-0">
            {member.photo ? (
              <img
                src={member.photo}
                alt={member.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2"
                style={{ borderColor: member.gender === 'female' ? '#EC4899' : '#6366F1' }}
              />
            ) : (
              <div
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-4xl sm:text-5xl"
                style={{
                  backgroundColor: member.gender === 'female' ? '#FDF2F8' : '#EEF2FF',
                  border: `2px solid ${member.gender === 'female' ? '#EC4899' : '#6366F1'}`,
                }}
              >
                {member.gender === 'female' ? '👩' : '👨'}
              </div>
            )}
            {/* Desktop: hover overlay */}
            {isAdmin && (
              <label className="absolute inset-0 items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hidden md:flex">
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                {uploading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </label>
            )}
            {/* Mobile: visible camera button */}
            {isAdmin && (
              <label className="md:hidden absolute -bottom-2 -left-2 w-9 h-9 bg-primary rounded-full flex items-center justify-center shadow-lg cursor-pointer">
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </label>
            )}
          </div>

          {/* Info Section */}
          <div className="flex-1">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap justify-center sm:justify-start">
              <h1 className="text-xl sm:text-2xl font-bold text-text m-0">{member.name}</h1>
              {member.is_fund_subscriber && (
                <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-lg font-medium">★ مشترك في الصندوق</span>
              )}
              {member.death_date && <span className="text-sm bg-gray-100 px-2 py-0.5 rounded-lg text-gray-500">متوفى 🕊️</span>}
              {age && (
                <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-xl font-medium">
                  {member.death_date ? `توفي عن عمر ${age} سنة` : `العمر: ${age} سنة`}
                </span>
              )}
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mt-4">
              {member.birth_date && (
                <InfoRow label="تاريخ الميلاد" value={member.birth_date} />
              )}
              {member.death_date && (
                <InfoRow label="تاريخ الوفاة" value={member.death_date} />
              )}
              <InfoRow label="الجيل" value={String(member.generation)} />
              {member.mother_name && <InfoRow label="الأم" value={member.mother_name} />}
              {member.city && <InfoRow label="المدينة" value={member.city} />}
              {member.nationality && <InfoRow label="الجنسية" value={member.nationality} />}
              {member.occupation && <InfoRow label="العمل" value={member.occupation} />}
              {member.work_type && <InfoRow label="نوع العمل" value={member.work_type} />}
              {member.work_place && <InfoRow label="جهة العمل" value={member.work_place} />}
              {member.phone && <InfoRow label="الهاتف" value={member.phone} />}
            </div>

            {member.bio && (
              <div className="mt-4 p-3 bg-surface rounded-xl">
                <p className="text-sm text-text-secondary m-0">{member.bio}</p>
              </div>
            )}

            {/* Marriages */}
            {member.marriages && member.marriages.length > 0 && (
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-text-secondary">الزواج:</span>
                {member.marriages.map((m, i) => {
                  const statusLabels: Record<string, string> = { married: 'متزوج', divorced: 'مطلق', widowed: 'أرمل', deceased: 'متوفاة' };
                  return (
                    <span key={i} className={`px-3 py-1 rounded-lg text-xs font-medium ${
                      m.status === 'divorced' ? 'bg-gray-100 text-gray-500' : 'bg-pink-50 text-pink-700'
                    }`}>
                      {m.wife_name} ({statusLabels[m.status] || m.status})
                    </span>
                  );
                })}
              </div>
            )}

            {/* Ancestors chain */}
            {data.ancestors.length > 0 && (
              <div className="mt-4 text-sm text-text-secondary">
                <span className="font-medium">السلسلة: </span>
                {data.ancestors.map((a, i) => (
                  <span key={a.id}>
                    <Link to={`/person/${a.id}`} className="text-primary no-underline hover:underline">{a.name}</Link>
                    {i < data.ancestors.length - 1 && ' ← '}
                  </span>
                ))}
                {' ← '}{member.name}
              </div>
            )}
          </div>
        </div>

        {/* Social Media & Communication Buttons */}
        {(whatsappUrl || member.twitter || member.instagram || member.snapchat || member.tiktok) && (
          <div className="mt-6 pt-5 border-t border-gray-100">
            <h3 className="text-sm font-medium text-text-secondary mb-3">التواصل</h3>
            <div className="flex gap-3 flex-wrap">
              {whatsappUrl && (
                <SocialButton
                  href={whatsappUrl}
                  label="واتساب"
                  color="#25D366"
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>}
                />
              )}
              {member.twitter && (
                <SocialButton
                  href={member.twitter.startsWith('http') ? member.twitter : `https://x.com/${member.twitter.replace('@', '')}`}
                  label="X"
                  color="#000"
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>}
                />
              )}
              {member.instagram && (
                <SocialButton
                  href={member.instagram.startsWith('http') ? member.instagram : `https://instagram.com/${member.instagram.replace('@', '')}`}
                  label="انستقرام"
                  color="#E4405F"
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>}
                />
              )}
              {member.snapchat && (
                <SocialButton
                  href={member.snapchat.startsWith('http') ? member.snapchat : `https://snapchat.com/add/${member.snapchat.replace('@', '')}`}
                  label="سناب شات"
                  color="#FFFC00"
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="#000"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.922-.26.082-.04.174-.06.27-.06.164 0 .333.063.458.178.18.161.195.417.03.602-.045.06-.06.12-.075.18-.12.312-.33.498-.5.572-.217.09-.42.18-.574.24-.014 0-.03.012-.044.012a.73.73 0 01-.076.092c-.06.075-.12.12-.18.18a.94.94 0 00-.18.27c-.03.09-.06.18-.06.27 0 .09.03.27.06.36.39.57 1.89 1.23 3.21 1.47.6.12 1.095.24 1.095.93 0 .42-.54.72-1.17.84-1.02.195-1.35.48-1.47.96-.042.21-.09.39-.102.57-.012.09-.012.27.15.42.09.09.24.15.39.15.06 0 .12-.015.18-.03.27-.06.54-.09.81-.09.36 0 .57.09.81.21.39.195.57.42.72.63.195.27.285.555.15.855-.105.24-.42.375-.69.375-.09 0-.165-.015-.24-.03-.51-.12-1.065-.195-1.59-.195-.225 0-.42.015-.615.045-.57.09-1.08.63-1.635 1.23-.78.84-1.68 1.785-3.345 1.785h-.12c-1.665 0-2.565-.945-3.345-1.785-.555-.6-1.065-1.14-1.635-1.23a4.368 4.368 0 00-.615-.045c-.51 0-1.05.075-1.56.195a.868.868 0 01-.27.03c-.27 0-.585-.135-.69-.375-.135-.3-.045-.585.15-.855.15-.21.33-.435.72-.63.24-.12.45-.21.81-.21.27 0 .54.03.81.09.06.015.12.03.18.03.15 0 .3-.06.39-.15.162-.15.162-.33.15-.42a3.722 3.722 0 00-.102-.57c-.12-.48-.45-.765-1.47-.96-.63-.12-1.17-.42-1.17-.84 0-.69.495-.81 1.095-.93 1.32-.24 2.82-.9 3.21-1.47.03-.09.06-.27.06-.36 0-.09-.03-.18-.06-.27a.94.94 0 00-.18-.27c-.06-.06-.12-.105-.18-.18a.73.73 0 01-.076-.092c-.014 0-.03-.012-.044-.012-.154-.06-.357-.15-.574-.24-.17-.074-.38-.26-.5-.572a.503.503 0 01-.075-.18c-.165-.185-.15-.441.03-.602a.588.588 0 01.458-.178c.096 0 .188.02.27.06.263.14.622.244.922.26.198 0 .326-.045.401-.09a15.33 15.33 0 01-.033-.57c-.104-1.628-.23-3.654.3-4.847C7.86 1.069 11.216.793 12.206.793z"/></svg>}
                />
              )}
              {member.tiktok && (
                <SocialButton
                  href={member.tiktok.startsWith('http') ? member.tiktok : `https://tiktok.com/@${member.tiktok.replace('@', '')}`}
                  label="تيك توك"
                  color="#010101"
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48v-7.13a8.16 8.16 0 004.77 1.52v-3.44a4.85 4.85 0 01-.81-.07 4.83 4.83 0 01-.38-.04v-3.83z"/></svg>}
                />
              )}
              {member.phone && (
                <a
                  href={`tel:${member.phone}`}
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium no-underline bg-gray-700 text-white transition-transform hover:scale-105 active:scale-95"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  اتصال
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Family Tree */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <SubTreeView data={data} onClose={() => {}} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-text-secondary">{label}:</span>
      <span className="font-medium text-text">{value}</span>
    </div>
  );
}

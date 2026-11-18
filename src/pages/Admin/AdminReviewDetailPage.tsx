import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAuthSession } from '../../api/client.ts';
import type { UserAccountSafe } from '../../types/archive.ts';
import { AdminSubmissionDetail } from './AdminSubmissionDetail.tsx';

export function AdminReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserAccountSafe | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchAuthSession()
      .then((res) => {
        if (!mounted) return;
        if (!res.authenticated || !res.user) {
          navigate('/admin/login', { replace: true });
          return;
        }
        setCurrentUser(res.user);
        setAuthChecking(false);
      })
      .catch(() => {
        if (mounted) navigate('/admin/login', { replace: true });
      });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (authChecking || !currentUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-muted">
        Đang xác thực quyền truy cập...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminSubmissionDetail
        submissionId={id || ''}
        currentUser={currentUser}
        onBack={() => navigate('/admin/kiem-duyet')}
      />
    </div>
  );
}

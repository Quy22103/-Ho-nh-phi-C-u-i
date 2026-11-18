import { CheckCircle2, Clock, HelpCircle } from 'lucide-react';
import type { VerificationLevel } from '../types/archive.ts';

interface VerificationBadgeProps {
  status: VerificationLevel | string | undefined;
  prefix?: string;
}

export function getVerificationMeta(status: string | undefined) {
  switch (status) {
    case 'da_kiem_chung':
      return {
        label: 'Đã kiểm chứng',
        bgClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
        Icon: CheckCircle2,
      };
    case 'chua_doc_duoc':
      return {
        label: 'Chưa đọc được',
        bgClass: 'bg-stone-100 text-stone-700 border-stone-300',
        Icon: HelpCircle,
      };
    case 'chua_kiem_chung':
    default:
      return {
        label: 'Chưa kiểm chứng',
        bgClass: 'bg-amber-50 text-amber-900 border-amber-200',
        Icon: Clock,
      };
  }
}

export function VerificationBadge({ status, prefix }: VerificationBadgeProps) {
  const meta = getVerificationMeta(status);
  const { Icon } = meta;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded whitespace-nowrap ${meta.bgClass}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{prefix ? `${prefix}: ${meta.label}` : meta.label}</span>
    </span>
  );
}

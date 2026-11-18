import type { ProcessingStatus } from '../types/archive.ts';

const STATUS_MAP: Record<
  ProcessingStatus,
  { label: string; cls: string }
> = {
  PENDING: {
    label: 'Chờ duyệt',
    cls: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  CHO_XAC_NHAN: {
    label: 'Chờ xác nhận',
    cls: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  DANG_KIEM_TRA: {
    label: 'Đang kiểm tra',
    cls: 'bg-sky-50 text-sky-900 border-sky-200',
  },
  CAN_BO_SUNG: {
    label: 'Cần bổ sung thông tin',
    cls: 'bg-orange-50 text-orange-900 border-orange-200',
  },
  DA_XAC_NHAN: {
    label: 'Đã xác nhận thông tin',
    cls: 'bg-teal-50 text-teal-900 border-teal-200',
  },
  TU_CHOI: {
    label: 'Từ chối',
    cls: 'bg-red-50 text-red-900 border-red-200',
  },
  CHO_CONG_KHAI: {
    label: 'Đã xác nhận, chờ công khai',
    cls: 'bg-indigo-50 text-indigo-900 border-indigo-200',
  },
  DA_CONG_KHAI: {
    label: 'Đã công khai',
    cls: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
};

export function getProcessingStatusLabel(status: ProcessingStatus): string {
  return STATUS_MAP[status]?.label || status;
}

export function ProcessingStatusBadge({
  status,
}: {
  status: ProcessingStatus;
}) {
  const meta = STATUS_MAP[status] || STATUS_MAP.CHO_XAC_NHAN;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-medium border rounded whitespace-nowrap ${meta.cls}`}
    >
      {meta.label} ({status})
    </span>
  );
}

import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  Maximize2,
  RotateCcw,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { ImageType, PublicImage } from '../types/archive.ts';

interface ArtifactImageViewerProps {
  title: string;
  images: PublicImage[];
  publicationAllowed: boolean;
  restrictionReason: string;
  selectedImageId: string;
  onSelectImage: (imageId: string) => void;
}

const IMAGE_TYPE_LABELS: Record<ImageType | string, string> = {
  toan_trang: 'Ảnh toàn trang',
  can_canh: 'Ảnh cận cảnh',
  can_canh_trai: 'Ảnh cận cảnh bên trái',
  can_canh_phai: 'Ảnh cận cảnh bên phải',
  can_canh_chu: 'Ảnh cận cảnh phần chữ',
  ban_dap: 'Ảnh bản dập',
  ban_sao: 'Ảnh bản sao',
  khac: 'Ảnh khác',
};

export function formatImageTypeLabel(type: string): string {
  return IMAGE_TYPE_LABELS[type] || 'Ảnh tư liệu';
}

export function ArtifactImageViewer({
  title,
  images,
  publicationAllowed,
  restrictionReason,
  selectedImageId,
  onSelectImage,
}: ArtifactImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [useHighRes, setUseHighRes] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  if (!publicationAllowed || images.length === 0) {
    const isTextOnlyNoImage = restrictionReason.includes('chưa đính kèm hình ảnh');
    return (
      <div className="border border-limestone bg-parchment/70 rounded-lg p-8 md:p-12 text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-ivory border border-limestone flex items-center justify-center text-bronze">
          <ShieldAlert className="w-6 h-6" aria-hidden="true" />
        </div>
        <h3 className="text-xl font-semibold text-walnut-deep mb-2">
          {isTextOnlyNoImage
            ? 'Hồ sơ văn bản (chưa đính kèm hình ảnh)'
            : 'Chưa đủ điều kiện công bố hình ảnh'}
        </h3>
        <p className="text-base text-ink max-w-xl mx-auto leading-relaxed">
          {restrictionReason ||
            'Tư liệu đang chờ xác nhận quyền công bố. Vui lòng quay lại sau.'}
        </p>
      </div>
    );
  }

  const activeImage =
    images.find((img) => img.image_id === selectedImageId) || images[0];

  const fullViewImages = images.filter((i) => i.image_type === 'toan_trang');
  const closeUpImages = images.filter((i) =>
    i.image_type.startsWith('can_canh')
  );

  const resetView = (targetZoom = 1) => {
    setZoom(targetZoom);
    setOffset({ x: 0, y: 0 });
  };

  const handleSelectImage = (img: PublicImage) => {
    onSelectImage(img.image_id);
    setLoadError(false);
    setUseHighRes(false);
    if (img.image_type.startsWith('can_canh')) {
      resetView(1.75);
    } else {
      resetView(1);
    }
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || zoom <= 1) return;
    setOffset({
      x: dragStartRef.current.ox + (e.clientX - dragStartRef.current.x),
      y: dragStartRef.current.oy + (e.clientY - dragStartRef.current.y),
    });
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  const currentSrc = useHighRes
    ? activeImage.original_url
    : activeImage.thumbnail_url;

  return (
    <div className="border border-limestone bg-ivory rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-parchment border-b border-limestone">
        <div className="flex flex-wrap items-center gap-2">
          {fullViewImages.length > 0 && (
            <button
              type="button"
              onClick={() => handleSelectImage(fullViewImages[0])}
              className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
                activeImage.image_type === 'toan_trang'
                  ? 'bg-walnut text-ivory border-walnut'
                  : 'bg-ivory text-ink border-limestone hover:bg-parchment'
              }`}
            >
              Ảnh toàn trang
            </button>
          )}
          {closeUpImages.length > 0 && (
            <button
              type="button"
              onClick={() => handleSelectImage(closeUpImages[0])}
              className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
                activeImage.image_type.startsWith('can_canh')
                  ? 'bg-walnut text-ivory border-walnut'
                  : 'bg-ivory text-ink border-limestone hover:bg-parchment'
              }`}
            >
              Ảnh cận cảnh đọc chữ
            </button>
          )}
          <span className="text-xs text-muted px-2">
            {formatImageTypeLabel(activeImage.image_type)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(2))))}
            disabled={zoom <= 1}
            aria-label="Thu nhỏ ảnh"
            className="p-2 rounded border border-limestone bg-ivory text-ink hover:bg-parchment disabled:opacity-40 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono tabular-nums px-2 text-ink">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, Number((z + 0.5).toFixed(2))))}
            disabled={zoom >= 4}
            aria-label="Phóng to ảnh"
            className="p-2 rounded border border-limestone bg-ivory text-ink hover:bg-parchment disabled:opacity-40 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => resetView(1)}
            aria-label="Đặt lại khung nhìn"
            className="p-2 rounded border border-limestone bg-ivory text-ink hover:bg-parchment transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setUseHighRes((prev) => !prev);
              setLoadError(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
              useHighRes
                ? 'bg-bronze text-ivory border-bronze'
                : 'bg-ivory text-walnut border-limestone hover:bg-parchment'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {useHighRes ? 'Đang xem bản gốc' : 'Tải ảnh độ phân giải cao'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-full h-[360px] sm:h-[460px] bg-stone-900/95 flex items-center justify-center overflow-hidden select-none touch-none ${
          zoom > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
      >
        {loadError ? (
          <div className="text-center px-6 py-8 text-stone-200">
            <p className="text-sm font-medium mb-1">
              Không tải được tệp ảnh từ kho lưu trữ
            </p>
            <p className="text-xs text-stone-400">
              Vui lòng kiểm tra đường dẫn tệp trong thư mục lưu trữ ảnh hoặc quyền công bố.
            </p>
          </div>
        ) : (
          <img
            src={currentSrc}
            alt={activeImage.caption || title}
            referrerPolicy="no-referrer"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onError={() => setLoadError(true)}
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
              transition: dragging ? 'none' : 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="max-h-full max-w-full object-contain"
          />
        )}
        {zoom > 1 && (
          <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/70 text-stone-100 text-xs rounded pointer-events-none">
            Kéo để di chuyển vùng đọc chữ
          </div>
        )}
      </div>

      {/* Caption & Source directly below image */}
      <div className="px-4 py-3 bg-parchment/50 border-t border-limestone text-sm space-y-1">
        <p className="text-ink font-medium">
          {activeImage.caption || 'Chưa có chú thích chi tiết cho ảnh này.'}
        </p>
        <p className="text-xs text-muted">
          Nguồn ảnh: {activeImage.source || 'Chưa ghi nhận nguồn ảnh'} · Loại ảnh:{' '}
          {formatImageTypeLabel(activeImage.image_type)}
        </p>
      </div>

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div className="px-4 py-3 bg-ivory border-t border-limestone flex items-center gap-3 overflow-x-auto">
          {images.map((img) => {
            const isSelected = img.image_id === activeImage.image_id;
            return (
              <button
                key={img.image_id}
                type="button"
                onClick={() => handleSelectImage(img)}
                className={`shrink-0 text-left rounded border p-1 transition-colors ${
                  isSelected
                    ? 'border-bronze bg-parchment'
                    : 'border-limestone bg-ivory hover:bg-parchment/60'
                }`}
              >
                <div className="w-20 h-14 bg-stone-200 rounded-sm overflow-hidden flex items-center justify-center">
                  <img
                    src={img.thumbnail_url}
                    alt={img.caption || formatImageTypeLabel(img.image_type)}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="block mt-1 text-[11px] text-ink truncate max-w-[80px]">
                  {formatImageTypeLabel(img.image_type)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

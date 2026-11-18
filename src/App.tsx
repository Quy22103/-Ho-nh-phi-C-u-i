import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout.tsx';
import { HomePage } from './pages/Home/HomePage.tsx';
import { DanhSachPage } from './pages/DanhSach/DanhSachPage.tsx';
import { ChiTietPage } from './pages/ChiTiet/ChiTietPage.tsx';
import { HoiDapPage } from './pages/HoiDap/HoiDapPage.tsx';
import { NguonTuLieuPage } from './pages/NguonTuLieu/NguonTuLieuPage.tsx';
import { GioiThieuPage } from './pages/GioiThieu/GioiThieuPage.tsx';
import { AdminLoginPage } from './pages/Admin/AdminLoginPage.tsx';
import { AdminDashboardPage } from './pages/Admin/AdminDashboardPage.tsx';
import { AdminReviewDetailPage } from './pages/Admin/AdminReviewDetailPage.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/danh-sach" element={<DanhSachPage />} />
          <Route path="/tu-lieu/:identifier" element={<ChiTietPage />} />
          <Route path="/hoi-dap" element={<HoiDapPage />} />
          <Route path="/nguon-tu-lieu" element={<NguonTuLieuPage />} />
          <Route path="/gioi-thieu" element={<GioiThieuPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={<AdminDashboardPage defaultTab="overview" />}
          />
          <Route
            path="/admin/kiem-duyet"
            element={<AdminDashboardPage defaultTab="pending" />}
          />
          <Route
            path="/admin/duyet-tu-lieu/:id"
            element={<AdminReviewDetailPage />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

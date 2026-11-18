import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  createInitialAdminAccount,
  needsInitialAdminSetup,
} from '../server/services/authService.ts';
import { appendAuditLog } from '../server/services/auditService.ts';

async function main() {
  const needsSetup = await needsInitialAdminSetup();
  if (!needsSetup) {
    console.log(
      'Hệ thống đã có tài khoản quản trị trong data/users.json. Không thể chạy khởi tạo lại.'
    );
    process.exit(0);
  }

  const rl = readline.createInterface({ input, output });
  try {
    console.log('=== KHỞI TẠO TÀI KHOẢN QUẢN TRỊ VIÊN BAN ĐẦU ===');
    const username = await rl.question('Tên đăng nhập (tối thiểu 3 ký tự): ');
    const email = await rl.question('Email quản trị: ');
    const fullName = await rl.question('Họ và tên hiển thị: ');
    const password = await rl.question('Mật khẩu (tối thiểu 8 ký tự): ');

    const created = await createInitialAdminAccount({
      username,
      email,
      full_name: fullName,
      password,
    });

    await appendAuditLog({
      ma_ho_so: 'HE_THONG',
      tai_khoan: created.username,
      vai_tro: 'ADMIN',
      hanh_dong: 'KHOI_TAO_QUAN_TRI_BAN_DAU',
      noi_dung_truoc: {},
      noi_dung_sau: { username: created.username, role: created.role },
      ly_do: 'Khởi tạo tài khoản ADMIN ban đầu qua CLI',
    });

    console.log(
      `Đã tạo tài khoản ADMIN thành công: ${created.username} (${created.email})`
    );
  } finally {
    rl.close();
  }
}

main().catch((err: unknown) => {
  console.error('Lỗi khởi tạo ADMIN:', (err as Error).message);
  process.exit(1);
});

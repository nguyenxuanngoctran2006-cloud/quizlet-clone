import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Bắt sự kiện lỗi ngầm của Pool để ngăn Node.js bị crash unhandled exception
pool.on('error', (err) => {
  console.error('⚠️ Phát hiện lỗi kết nối PostgreSQL ngầm (tự động bỏ qua):', err.message);
});

pool.connect()
  .then((client) => {
    console.log('💾 Đã kết nối cơ sở dữ liệu Supabase (PostgreSQL) ngon lành!');
    client.release();
  })
  .catch((err) => console.error('❌ Kết nối Supabase thất bại:', err));

export default pool;
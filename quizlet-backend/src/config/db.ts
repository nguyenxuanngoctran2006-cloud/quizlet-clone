import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Kết nối thông qua DATABASE_URL bảo mật từ file .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Thêm định nghĩa kiểu dữ liệu cho err, client, và release
pool.connect((err: Error | undefined, client: pg.PoolClient | undefined, release: () => void) => {
  if (err) {
    return console.error('❌ Kết nối Supabase thất bại rồi:', err.stack);
  }
  console.log('💾 Đã kết nối cơ sở dữ liệu Supabase (PostgreSQL) ngon lành!');
  release();
});

export default pool;
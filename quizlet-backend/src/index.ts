import express, { Request, Response } from 'express';
import pool from './config/db.js'; // Đường dẫn tới file db vừa tạo

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World! Quizlet Backend kết nối Supabase thành công.');
});

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});
import express, { Request, Response } from 'express';
import pool from './config/db.js';
import studySetRoutes from './routes/studySetRoutes.js'; // Import routes mới

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Sử dụng Routes cho cấu trúc /api/study-sets
app.use('/api/study-sets', studySetRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World! Quizlet Backend đã sẵn sàng API.');
});

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});
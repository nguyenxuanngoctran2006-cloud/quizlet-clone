import express, { Request, Response } from 'express';

const app = express();
const PORT = 5000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World! Quizlet Backend đã hoạt động.');
});

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});
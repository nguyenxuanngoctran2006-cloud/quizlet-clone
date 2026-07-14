import { Request, Response } from 'express';
import pool from '../config/db.js';

// 1. Tạo mới một Bộ học phần
export const createStudySet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description } = req.body;
    
    if (!title) {
      res.status(400).json({ error: 'Tiêu đề không được để trống!' });
      return;
    }

    const result = await pool.query(
      'INSERT INTO study_sets (title, description) VALUES ($1, $2) RETURNING *',
      [title, description]
    );

    res.status(201).json({
      message: 'Tạo bộ học phần thành công!',
      data: result.rows[0],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Lấy danh sách tất cả các Bộ học phần
export const getAllStudySets = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM study_sets ORDER BY created_at DESC');
    res.status(200).json({ data: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Lấy chi tiết một Bộ học phần kèm danh sách thẻ ghi nhớ bên trong
export const getStudySetById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Lấy thông tin bộ học phần
    const setQuery = await pool.query('SELECT * FROM study_sets WHERE id = $1', [id]);
    if (setQuery.rows.length === 0) {
      res.status(404).json({ error: 'Không tìm thấy bộ học phần này!' });
      return;
    }

    // Lấy các flashcards thuộc bộ này
    const cardsQuery = await pool.query('SELECT * FROM flashcards WHERE study_set_id = $1', [id]);

    res.status(200).json({
      study_set: setQuery.rows[0],
      flashcards: cardsQuery.rows,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Cập nhật thông tin Bộ học phần (Update)
export const updateStudySet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Tiêu đề không được để trống!' });
      return;
    }

    const result = await pool.query(
      'UPDATE study_sets SET title = $1, description = $2 WHERE id = $3 RETURNING *',
      [title, description, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Không tìm thấy bộ học phần để cập nhật!' });
      return;
    }

    res.status(200).json({
      message: 'Cập nhật bộ học phần thành công!',
      data: result.rows[0],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Xóa Bộ học phần (Delete)
export const deleteStudySet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM study_sets WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Không tìm thấy bộ học phần để xóa!' });
      return;
    }

    res.status(200).json({
      message: 'Xóa bộ học phần thành công!',
      data: result.rows[0],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
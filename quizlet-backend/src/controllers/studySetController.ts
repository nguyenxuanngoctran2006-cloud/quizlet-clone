import { readPdfText } from 'pdf-text-reader'; // Thư viện ESM chuẩn, dọn sạch hoàn toàn gạch đỏ!
import fs from 'fs';
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
    console.error("Lỗi tạo bộ thẻ:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// 2. Lấy danh sách toàn bộ Bộ học phần
export const getAllStudySets = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM study_sets ORDER BY created_at DESC');
    res.status(200).json({ data: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Lấy chi tiết Bộ học phần kèm danh sách Flashcard của nó
export const getStudySetById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const setQuery = await pool.query('SELECT * FROM study_sets WHERE id = $1', [id]);
    if (setQuery.rows.length === 0) {
      res.status(404).json({ error: 'Không tìm thấy bộ học phần này!' });
      return;
    }
    const cardsQuery = await pool.query('SELECT * FROM flashcards WHERE study_set_id = $1 ORDER BY id ASC', [id]);
    res.status(200).json({
      ...setQuery.rows[0],
      flashcards: cardsQuery.rows,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Cập nhật Bộ học phần
export const updateStudySet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const result = await pool.query(
      'UPDATE study_sets SET title = $1, description = $2 WHERE id = $3 RETURNING *',
      [title, description, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Không tìm thấy bộ học phần cần cập nhật!' });
      return;
    }
    res.status(200).json({ message: 'Cập nhật thành công!', data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Xóa Bộ học phần
export const deleteStudySet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM study_sets WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Không tìm thấy bộ học phần cần xóa!' });
      return;
    }
    res.status(200).json({ message: 'Xóa bộ học phần thành công!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 6. Import từ vựng thường (file CSV/TXT thông thường của bạn)
export const importFlashcards = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { flashcards } = req.body;
    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      res.status(400).json({ error: 'Dữ liệu flashcards không hợp lệ!' });
      return;
    }
    const values: any[] = [];
    const valueStrings: string[] = [];
    let count = 1;
    for (const card of flashcards) {
      valueStrings.push(`($${count}, $${count + 1}, $${count + 2})`);
      values.push(id, card.term, card.definition);
      count += 3;
    }
    const queryString = `
      INSERT INTO flashcards (study_set_id, term, definition) 
      VALUES ${valueStrings.join(', ')} 
      RETURNING *
    `;
    const result = await pool.query(queryString, values);
    res.status(201).json({
      message: `Nhập thành công ${result.rowCount} thẻ ghi nhớ!`,
      data: result.rows,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 7. Hàm đọc trực tiếp file PDF và tự bóc tách thông minh (Không cần AI, không lo lỗi Quota!)
export const importFlashcardsWithAI = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Vui lòng upload tài liệu PDF!' });
      return;
    }

    // Đọc trực tiếp chữ từ file PDF bằng thư viện ESM mới
    const textContent = await readPdfText({ filePath: file.path });

    if (!textContent) {
      res.status(400).json({ error: 'Không thể đọc được nội dung từ file PDF này!' });
      fs.unlinkSync(file.path);
      return;
    }

    // Tách dòng và chỉ giữ lại các dòng có dữ liệu
    const lines: string[] = textContent.split('\n').map((line: string) => line.trim()).filter(Boolean);
    const flashcards: { term: string; definition: string }[] = [];

    let tempTerm = '';
    let tempDefinition = '';

    for (const line of lines) {
      const currentLine = line.trim();
      if (!currentLine) continue;

      // 1. Phân tách linh hoạt: Hỗ trợ mọi loại dấu gạch ngang bao gồm gạch ngắn (-), gạch dài (–, —) hoặc dấu hai chấm (:)
      const separatorMatch = currentLine.match(/[-–—:]/);
      
      if (separatorMatch && separatorMatch.index !== undefined) {
        const separatorIndex = separatorMatch.index;
        const term = currentLine.substring(0, separatorIndex).trim();
        const def = currentLine.substring(separatorIndex + 1).trim();
        if (term && def) {
          flashcards.push({ term, definition: def });
        }
        continue;
      }

      // Biểu thức chính quy phát hiện chữ Nhật (Kanji, Hiragana, Katakana)
      const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/g.test(currentLine);

      // 2. TH ghép cặp dựa trên ngôn ngữ (Dành cho bộ thẻ Nhật - Việt dạng lưới không dấu gạch ngang)
      if (hasJapanese) {
        if (tempTerm) {
          tempTerm += ` / ${currentLine}`;
        } else {
          tempTerm = currentLine;
        }
      } 
      else {
        // Loại bỏ tiêu đề chung của trang PDF
        if (
          currentLine.toUpperCase().includes("BỘ THẺ") || 
          currentLine.toUpperCase().includes("FLASHCARD") || 
          currentLine.toUpperCase().includes("TIẾNG NHẬT")
        ) {
          continue;
        }

        if (tempTerm) {
          tempDefinition = currentLine;
          flashcards.push({ term: tempTerm, definition: tempDefinition });
          tempTerm = '';
          tempDefinition = '';
        }
      }
    }

    if (flashcards.length === 0) {
      res.status(400).json({ 
        error: 'Không tìm thấy từ vựng hợp lệ! Hãy đảm bảo file PDF của bạn chứa từ vựng tiếng Nhật và nghĩa tiếng Việt tương ứng.' 
      });
      fs.unlinkSync(file.path);
      return;
    }

    // Tiến hành Bulk Insert dữ liệu vào Supabase
    const values: any[] = [];
    const valueStrings: string[] = [];
    let count = 1;

    for (const card of flashcards) {
      valueStrings.push(`($${count}, $${count + 1}, $${count + 2})`);
      values.push(id, card.term, card.definition);
      count += 3;
    }

    const queryString = `
      INSERT INTO flashcards (study_set_id, term, definition) 
      VALUES ${valueStrings.join(', ')} 
      RETURNING *
    `;

    const result = await pool.query(queryString, values);
    fs.unlinkSync(file.path);

    res.status(201).json({
      message: `🎉 Đã quét file PDF thông minh và tự động tạo thành công ${result.rowCount} thẻ ghi nhớ!`,
      data: result.rows,
    });

  } catch (error: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Lỗi import PDF:", error);
    res.status(500).json({ error: error.message });
  }
};
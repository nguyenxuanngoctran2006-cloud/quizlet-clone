import { readPdfText } from 'pdf-text-reader';
import Groq from 'groq-sdk';
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

    // Bước 1: Đọc text thô trực tiếp từ PDF bằng thư viện offline local
    const textContent = await readPdfText({ filePath: file.path });

    if (!textContent || !textContent.trim()) {
      res.status(400).json({ error: 'Không thể bóc tách nội dung chữ từ file PDF này!' });
      fs.unlinkSync(file.path);
      return;
    }

    // Bước 2: Khởi tạo Groq Client
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Bước 3: Gửi text thô lên model văn bản Llama 3.3 70B siêu ổn định
    const chatCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile", // Model text chính thức cực mạnh và ổn định của Groq
      messages: [
        {
          role: "user",
          content: `Bạn là một trợ lý ảo phân tích văn bản học tập thông minh. 
Nhiệm vụ của bạn là đọc đoạn văn bản thô được bóc tách từ file PDF dưới đây. Đoạn văn bản này có thể chứa danh sách từ vựng được sắp xếp theo dạng lưới, hàng cột lộn xộn hoặc phân tách bởi dấu gạch ngang.
Hãy tìm kiếm, dịch thuật (nếu cần) và nhóm toàn bộ các cặp thuật ngữ/từ vựng cùng định nghĩa/nghĩa tiếng Việt tương ứng của chúng.

Yêu cầu đầu ra bắt buộc: Trả về một chuỗi định dạng JSON thuần túy, là một mảng các đối tượng chứa "term" (Từ vựng chính) và "definition" (Định nghĩa/Ý nghĩa tiếng Việt).
Không giải thích gì thêm, không bọc trong markdown \`\`\`json.
Định dạng mẫu: [{"term": "sleep", "definition": "ngủ"}, {"term": "桜 (さくら)", "definition": "Hoa anh đào"}]

Nội dung văn bản PDF cần phân tích:
${textContent}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const aiText = chatCompletion.choices[0]?.message?.content || "";
    
    // Bước 4: Parse kết quả JSON trả về từ Groq AI
    let parsedData: any;
    try {
      parsedData = JSON.parse(aiText.trim());
    } catch (parseError) {
      const cleanText = aiText.replace(/```json|```/g, '').trim();
      parsedData = JSON.parse(cleanText);
    }

    // Lấy mảng flashcards từ JSON (Hỗ trợ cấu trúc linh hoạt từ AI)
    let flashcards: { term: string; definition: string }[] = [];
    if (Array.isArray(parsedData)) {
      flashcards = parsedData;
    } else if (parsedData && Array.isArray(parsedData.flashcards)) {
      flashcards = parsedData.flashcards;
    } else if (parsedData && typeof parsedData === 'object') {
      const keys = Object.keys(parsedData);
      const firstKey = keys[0];
      if (firstKey && Array.isArray(parsedData[firstKey])) {
        flashcards = parsedData[firstKey];
      }
    }

    if (flashcards.length === 0) {
      res.status(400).json({ error: 'AI không tìm thấy hoặc không thể định dạng được từ vựng từ tài liệu này!' });
      fs.unlinkSync(file.path);
      return;
    }

    // Bước 5: Tiến hành Bulk Insert vào database Supabase
    const values: any[] = [];
    const valueStrings: string[] = [];
    let count = 1;

    for (const card of flashcards) {
      if (!card.term || !card.definition) continue;
      valueStrings.push(`($${count}, $${count + 1}, $${count + 2})`);
      values.push(id, card.term, card.definition);
      count += 3;
    }

    if (values.length === 0) {
      res.status(400).json({ error: 'Dữ liệu thẻ sau khi lọc bị trống!' });
      fs.unlinkSync(file.path);
      return;
    }

    const queryString = `
      INSERT INTO flashcards (study_set_id, term, definition) 
      VALUES ${valueStrings.join(', ')} 
      RETURNING *
    `;

    const result = await pool.query(queryString, values);
    fs.unlinkSync(file.path);

    res.status(201).json({
      message: `🎉 Groq AI đã chuẩn hóa văn bản thành công và tạo ${result.rowCount} thẻ ghi nhớ cực chuẩn!`,
      data: result.rows,
    });

  } catch (error: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Lỗi khi xử lý bằng Groq API:", error);
    res.status(500).json({ error: error.message });
  }
};
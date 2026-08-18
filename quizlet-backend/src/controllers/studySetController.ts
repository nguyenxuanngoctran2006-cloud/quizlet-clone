import { readPdfText } from 'pdf-text-reader';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';
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

// 3. Lấy chi tiết Bộ học phần kèm danh sách Flashcard
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
    res.status(200).json({ message: 'Cập nhật bộ học phần thành công!', data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Xóa Bộ học phần (và tự động xóa các thẻ thuộc bộ đó)
export const deleteStudySet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Bước 1: Xóa toàn bộ các thẻ từ vựng con trước để tránh lỗi ràng buộc khóa ngoại
    await pool.query('DELETE FROM flashcards WHERE study_set_id = $1', [id]);

    // Bước 2: Xóa bộ học phần chính
    const result = await pool.query('DELETE FROM study_sets WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Không tìm thấy bộ học phần cần xóa!' });
      return;
    }

    res.status(200).json({ message: 'Xóa bộ học phần thành công!' });
  } catch (error: any) {
    console.error('Lỗi khi xóa bộ học phần:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// 6. Import từ vựng hàng loạt từ file CSV / TXT
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

// 7. Bóc tách file PDF / DOCX / DOC / TXT và sử dụng Groq AI tạo từ vựng tự động
export const importFlashcardsWithAI = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Vui lòng upload tài liệu (PDF, DOC, DOCX hoặc TXT)!' });
      return;
    }

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    let textContent = '';

    // Bóc tách văn bản tùy thuộc vào định dạng file
    if (ext === 'pdf') {
      textContent = await readPdfText({ filePath: file.path });
    } else if (ext === 'docx' || ext === 'doc') {
      const docResult = await mammoth.extractRawText({ path: file.path });
      textContent = docResult.value;
    } else {
      // Đọc file thô dạng .txt / .csv
      textContent = fs.readFileSync(file.path, 'utf-8');
    }

    if (!textContent || !textContent.trim()) {
      res.status(400).json({ error: 'Không thể bóc tách nội dung chữ từ file này!' });
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return;
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const chatCompletion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "user",
          content: `Bạn là một trợ lý ảo phân tích văn bản học tập thông minh. 
Nhiệm vụ của bạn là đọc đoạn văn bản thô được bóc tách từ tài liệu dưới đây. Đoạn văn bản này có thể chứa danh sách từ vựng được sắp xếp theo dạng lưới, hàng cột lộn xộn hoặc phân tách bởi dấu gạch ngang.
Hãy tìm kiếm, dịch thuật (nếu cần) và nhóm toàn bộ các cặp thuật ngữ/từ vựng cùng định nghĩa/nghĩa tiếng Việt tương ứng của chúng.

Yêu cầu đầu ra bắt buộc: Trả về một chuỗi định dạng JSON thuần túy, là một mảng các đối tượng chứa "term" (Từ vựng chính) và "definition" (Định nghĩa/Ý nghĩa tiếng Việt).
Không giải thích gì thêm, không bọc trong markdown \`\`\`json.
Định dạng mẫu: [{"term": "sleep", "definition": "ngủ"}, {"term": "桜 (さくら)", "definition": "Hoa anh đào"}]

Nội dung văn bản tài liệu cần phân tích:
${textContent}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const aiText = chatCompletion.choices[0]?.message?.content || "";
    
    let parsedData: any;
    try {
      parsedData = JSON.parse(aiText.trim());
    } catch (parseError) {
      const cleanText = aiText.replace(/```json|```/g, '').trim();
      parsedData = JSON.parse(cleanText);
    }

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
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return;
    }

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
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return;
    }

    const queryString = `
      INSERT INTO flashcards (study_set_id, term, definition) 
      VALUES ${valueStrings.join(', ')} 
      RETURNING *
    `;

    const result = await pool.query(queryString, values);
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

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

// 8. Sửa nội dung của một thẻ từ vựng đơn lẻ
export const updateFlashcard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { term, definition } = req.body;
    const result = await pool.query(
      'UPDATE flashcards SET term = $1, definition = $2 WHERE id = $3 RETURNING *',
      [term, definition, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Không tìm thấy thẻ từ vựng cần cập nhật!' });
      return;
    }
    res.status(200).json({ message: 'Cập nhật từ vựng thành công!', data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 9. Xóa một thẻ từ vựng đơn lẻ
export const deleteFlashcard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM flashcards WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Không tìm thấy thẻ từ vựng cần xóa!' });
      return;
    }
    res.status(200).json({ message: 'Xóa từ vựng thành công!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 10. Quét chữ từ hình ảnh bằng Tesseract OCR
export const importFlashcardsFromImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Vui lòng upload file ảnh (PNG, JPG, JPEG)!' });
      return;
    }

    // 1. Tải worker Tesseract hỗ trợ Tiếng Nhật (jpn + jpn_vert), Tiếng Anh và Tiếng Việt
    const worker = await createWorker(['jpn', 'jpn_vert', 'eng', 'vie']);
    
    // Quét chữ từ file ảnh
    const ret = await worker.recognize(file.path);
    const textContent = ret.data.text;
    await worker.terminate();

    console.log("=== NỘI DUNG TESSERACT QUÉT THÔ ===");
    console.log(textContent);

    if (!textContent || !textContent.trim()) {
      res.status(400).json({ error: 'Tesseract không đọc được ký tự nào từ bức ảnh này!' });
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return;
    }

    // 2. Dùng Groq Llama 3.3 để bóc tách và khôi phục bảng dữ liệu lộn xộn từ Tesseract
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const chatCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `Bạn là một chuyên gia bóc tách dữ liệu từ văn bản OCR thô. 
Văn bản đầu vào được quét từ một BẢNG TỪ VỰNG Tiếng Nhật (gồm các cột Kanji, Âm Hán, Hiragana, Nghĩa Tiếng Việt).
Do kết quả OCR có thể bị mất định dạng cột hoặc các từ dính liền nhau, bạn hãy phân tích thông minh và trích xuất TẤT CẢ các cặp từ vựng.`
        },
        {
          role: "user",
          content: `Hãy phân tích đoạn văn bản OCR dưới đây và trích xuất toàn bộ danh sách từ vựng.

Quy tắc ghép:
- "term": Ghép Kanji và Hiragana/cách đọc (nếu có). Ví dụ: "男性 (だんせい)" hoặc "男性".
- "definition": Nghĩa tiếng Việt tương ứng (ví dụ: "đàn ông", "phụ nữ", "cao tuổi"...).

YÊU CẦU ĐẦU RA BẮT BỘC:
Trả về duy nhất một chuỗi JSON chuẩn có cấu trúc:
{
  "flashcards": [
    {"term": "男性 (だんせい)", "definition": "đàn ông"},
    {"term": "女性 (じょせい)", "definition": "phụ nữ"}
  ]
}
Không kèm lời giải thích, không dùng markdown block.

Dữ liệu OCR thô:
${textContent}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const aiText = chatCompletion.choices[0]?.message?.content || "";
    
    let parsedData: any;
    try {
      parsedData = JSON.parse(aiText.trim());
    } catch (parseError) {
      const cleanText = aiText.replace(/```json|```/g, '').trim();
      parsedData = JSON.parse(cleanText);
    }

    let flashcards: { term: string; definition: string }[] = [];
    if (Array.isArray(parsedData)) {
      flashcards = parsedData;
    } else if (parsedData && Array.isArray(parsedData.flashcards)) {
      flashcards = parsedData.flashcards;
    } else if (parsedData && typeof parsedData === 'object') {
      const keys = Object.keys(parsedData);
      if (keys[0] && Array.isArray(parsedData[keys[0]])) {
        flashcards = parsedData[keys[0]];
      }
    }

    if (flashcards.length === 0) {
      res.status(400).json({ error: 'AI không phân tích được từ vựng từ văn bản OCR. Vui lòng kiểm tra lại chất lượng ảnh!' });
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return;
    }

    // 3. Lưu danh sách bóc tách được vào CSDL Supabase
    const values: any[] = [];
    const valueStrings: string[] = [];
    let count = 1;

    for (const card of flashcards) {
      if (!card.term || !card.definition) continue;
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
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    res.status(201).json({
      message: `🎉 Tesseract OCR đã quét ảnh thành công! Đã thêm ${result.rowCount} từ vựng.`,
      data: result.rows,
    });

  } catch (error: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Lỗi Tesseract OCR:", error);
    res.status(500).json({ error: error.message });
  }
};

// 11. Xóa nhiều thẻ từ vựng cùng lúc (Bulk Delete)
export const deleteMultipleFlashcards = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cardIds } = req.body; // Nhận mảng các ID dạng: [1, 2, 3]

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      res.status(400).json({ error: 'Danh sách ID thẻ cần xóa không hợp lệ!' });
      return;
    }

    // Xóa tất cả flashcards có ID nằm trong mảng cardIds
    const result = await pool.query(
      'DELETE FROM flashcards WHERE id = ANY($1::int[]) RETURNING *',
      [cardIds]
    );

    res.status(200).json({
      message: `🎉 Đã xóa thành công ${result.rowCount} thẻ từ vựng!`,
      deletedCount: result.rowCount
    });
  } catch (error: any) {
    console.error('Lỗi khi xóa nhiều thẻ từ vựng:', error);
    res.status(500).json({ error: error.message });
  }
};
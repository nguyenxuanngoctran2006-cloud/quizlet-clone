import { Router } from 'express';
import multer from 'multer';
import { 
  createStudySet, 
  getAllStudySets, 
  getStudySetById, 
  updateStudySet, 
  deleteStudySet,
  importFlashcards,
  importFlashcardsWithAI,
  updateFlashcard,
  deleteFlashcard,
  importFlashcardsFromImage, // 👈 BỔ SUNG DÒNG NÀY ĐỂ KHÔNG BỊ BÁO LỖI UNDEFINED
  deleteMultipleFlashcards
} from '../controllers/studySetController.js';

// Cấu hình lưu trữ file upload tạm thời vào thư mục 'uploads/'
const upload = multer({ dest: 'uploads/' });

const router = Router();

// --- 1. ROUTES CHO BỘ HỌC PHẦN (STUDY SETS) ---
router.post('/', createStudySet);
router.get('/', getAllStudySets);
router.get('/:id', getStudySetById);
router.put('/:id', updateStudySet);
router.delete('/:id', deleteStudySet);

// --- 2. ROUTES IMPORT TỪ VỰNG ---
router.post('/:id/import', importFlashcards);
router.post('/:id/import-pdf', upload.single('file'), importFlashcardsWithAI);
router.post('/:id/import-image', upload.single('file'), importFlashcardsFromImage);

// --- 3. ROUTES SỬA & XÓA TỪNG THẺ TỪ VỰNG ---
router.put('/flashcards/:id', updateFlashcard);
router.delete('/flashcards/bulk-delete', deleteMultipleFlashcards);
router.delete('/flashcards/:id', deleteFlashcard);

export default router;
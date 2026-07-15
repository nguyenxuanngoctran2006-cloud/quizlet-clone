import { Router } from 'express';
import multer from 'multer';
import { 
  createStudySet, 
  getAllStudySets, 
  getStudySetById, 
  updateStudySet, 
  deleteStudySet,
  importFlashcards,
  importFlashcardsWithAI // Import hàm AI mới
} from '../controllers/studySetController.js';

// Cấu hình lưu trữ file upload tạm thời vào thư mục 'uploads/'
const upload = multer({ dest: 'uploads/' });

const router = Router();

router.post('/', createStudySet);
router.get('/', getAllStudySets);
router.get('/:id', getStudySetById);
router.put('/:id', updateStudySet);
router.delete('/:id', deleteStudySet);
router.post('/:id/import', importFlashcards);

// Định nghĩa Route AI Import: POST http://localhost:5000/api/study-sets/:id/import-ai
// upload.single('doc') nghĩa là Frontend sẽ gửi file lên trong một key tên là 'doc'
router.post('/:id/import-ai', upload.single('doc'), importFlashcardsWithAI);

export default router;
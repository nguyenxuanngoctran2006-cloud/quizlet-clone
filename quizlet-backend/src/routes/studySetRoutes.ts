import { Router } from 'express';
import { 
  createStudySet, 
  getAllStudySets, 
  getStudySetById, 
  updateStudySet, 
  deleteStudySet,
  importFlashcards // Import hàm mới
} from '../controllers/studySetController.js';

const router = Router();

router.post('/', createStudySet);
router.get('/', getAllStudySets);
router.get('/:id', getStudySetById);
router.put('/:id', updateStudySet);
router.delete('/:id', deleteStudySet);

// Đường dẫn API Import hàng loạt: POST http://localhost:5000/api/study-sets/:id/import
router.post('/:id/import', importFlashcards);

export default router;
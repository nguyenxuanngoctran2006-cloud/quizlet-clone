import { Router } from 'express';
import { 
  createStudySet, 
  getAllStudySets, 
  getStudySetById, 
  updateStudySet, 
  deleteStudySet 
} from '../controllers/studySetController.js';

const router = Router();

router.post('/', createStudySet);
router.get('/', getAllStudySets);
router.get('/:id', getStudySetById);
router.put('/:id', updateStudySet);      // PUT http://localhost:5000/api/study-sets/1 (Sửa bộ thẻ có id = 1)
router.delete('/:id', deleteStudySet);   // DELETE http://localhost:5000/api/study-sets/1 (Xóa bộ thẻ có id = 1)

export default router;
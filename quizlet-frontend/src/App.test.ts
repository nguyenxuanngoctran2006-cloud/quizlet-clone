import { describe, it, expect } from 'vitest';
// Import hàm chạy thông thường
import { generateQuiz } from './App'; 
// Import các interface bắt buộc phải có từ khoá "type" ở trước theo chuẩn strict mode
import type { Flashcard, QuizQuestion } from './App';

describe('Tính năng Quiz Mode', () => {
  it('nên tạo ra đúng 4 đáp án cho mỗi câu hỏi', () => {
    const mockCards: Flashcard[] = [
      { id: 1, term: 'A', definition: 'D1' },
      { id: 2, term: 'B', definition: 'D2' },
      { id: 3, term: 'C', definition: 'D3' },
      { id: 4, term: 'D', definition: 'D4' },
    ];

    const quiz: QuizQuestion[] = generateQuiz(mockCards);
    
    expect(quiz.length).toBe(4); // Có 4 câu hỏi
    expect(quiz[0].options.length).toBe(4); // Mỗi câu hỏi có 4 lựa chọn
  });

  it('phải chứa đáp án đúng trong các lựa chọn', () => {
    const mockCards: Flashcard[] = [
        { id: 1, term: 'A', definition: 'D1' },
        { id: 2, term: 'B', definition: 'D2' },
        { id: 3, term: 'C', definition: 'D3' },
        { id: 4, term: 'D', definition: 'D4' },
    ];
    const quiz: QuizQuestion[] = generateQuiz(mockCards);
    expect(quiz[0].options).toContain(quiz[0].correctAnswer);
  });
});
import { useEffect, useState } from 'react';
import axios from 'axios';
import Papa from 'papaparse';

// Khai báo Base URL backend Render
const API_BASE_URL = 'https://susu-quizlet.onrender.com/api/study-sets';

interface StudySet {
  id: number;
  title: string;
  description: string;
  created_at: string;
}

export interface Flashcard {
  id: number;
  term: string;
  definition: string;
}

export interface QuizQuestion {
  id: number;
  questionText: string;
  correctAnswer: string;
  options: string[];
}

// Interface phục vụ Chế độ Thuộc từ
interface PracticeProgress {
  card: Flashcard;
  termToDefPassed: boolean; // Đã trả lời đúng chiều Từ -> Nghĩa chưa
  defToTermPassed: boolean; // Đã trả lời đúng chiều Nghĩa -> Từ chưa
}

function App() {
  // --- STATES BỘ HỌC PHẦN & CARD ---
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingSet, setEditingSet] = useState<StudySet | null>(null);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const [selectedSet, setSelectedSet] = useState<StudySet | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [editTerm, setEditTerm] = useState<string>('');
  const [editDefinition, setEditDefinition] = useState<string>('');

  // STATE CHỌN NHIỀU CÁC TỪ VỰNG ĐỂ XÓA
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);

  // --- STATES IMPORT & AI ---
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);

  // --- STATES CHẾ ĐỘ QUIZ THƯỜNG ---
  const [isQuizMode, setIsQuizMode] = useState<boolean>(false);
  const [quizDirection, setQuizDirection] = useState<'termToDef' | 'defToTerm'>('termToDef');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);
  const [quizFinished, setQuizFinished] = useState<boolean>(false);

  // --- STATES CHẾ ĐỘ THUỘC TỪ (MASTERY MODE) ---
  const [isMasteryMode, setIsMasteryMode] = useState<boolean>(false);
  const [masteryList, setMasteryList] = useState<PracticeProgress[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<{
    cardId: number;
    direction: 'termToDef' | 'defToTerm';
    questionText: string;
    correctAnswer: string;
    options: string[];
  } | null>(null);
  const [masteryAnswer, setMasteryAnswer] = useState<string | null>(null);
  const [masteryFinished, setMasteryFinished] = useState<boolean>(false);

  // --- API FETCH DỮ LIỆU ---
  const fetchStudySets = () => {
    axios.get(`${API_BASE_URL}`)
      .then((res) => { setStudySets(res.data.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const fetchCardDetails = (setId: number) => {
    axios.get(`${API_BASE_URL}/${setId}`)
      .then((res) => setCards(res.data.flashcards))
      .catch((err) => console.error(err));
  };

  useEffect(() => { fetchStudySets(); }, []);

  const handleSelectSet = (set: StudySet) => {
    setSelectedSet(set);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsQuizMode(false);
    setIsMasteryMode(false);
    setCsvFile(null);
    setSelectedCardIds([]); // Reset lại danh sách từ được chọn khi chuyển bộ học phần
    fetchCardDetails(set.id);
  };

  // --- QUẢN LÝ BỘ HỌC PHẦN & TỪ VỰNG ---
  const handleSubmitSet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert('Vui lòng nhập tiêu đề!');

    if (editingSet) {
      axios.put(`${API_BASE_URL}/${editingSet.id}`, { title, description })
        .then(() => {
          setTitle(''); setDescription(''); setEditingSet(null); setShowForm(false);
          fetchStudySets();
        });
    } else {
      axios.post(`${API_BASE_URL}`, { title, description })
        .then(() => {
          setTitle(''); setDescription(''); setShowForm(false);
          fetchStudySets();
        });
    }
  };

  const handleEditSet = (e: React.MouseEvent, set: StudySet) => {
    e.stopPropagation();
    setEditingSet(set);
    setTitle(set.title);
    setDescription(set.description || '');
    setShowForm(true);
  };

  const handleDeleteSet = (e: React.MouseEvent, setId: number) => {
    e.stopPropagation();
    if (window.confirm('Bạn có chắc chắn muốn xóa bộ học phần này không?')) {
      axios.delete(`${API_BASE_URL}/${setId}`)
        .then(() => fetchStudySets())
        .catch((err) => console.error(err));
    }
  };

  const handleDeleteCard = (cardId: number) => {
    if (window.confirm('Xóa từ vựng này khỏi bộ học phần?')) {
      axios.delete(`${API_BASE_URL}/flashcards/${cardId}`)
        .then(() => {
          setSelectedCardIds((prev) => prev.filter((id) => id !== cardId));
          if (selectedSet) fetchCardDetails(selectedSet.id);
        });
    }
  };

  const handleSaveCardEdit = (cardId: number) => {
    axios.put(`${API_BASE_URL}/flashcards/${cardId}`, {
      term: editTerm,
      definition: editDefinition
    })
    .then(() => {
      setEditingCard(null);
      if (selectedSet) fetchCardDetails(selectedSet.id);
    });
  };

  // HÀM LOGIC CHO TÍNH NĂNG CHỌN NHIỀU & XÓA HÀNG LOẠT
  const handleToggleSelectCard = (cardId: number) => {
    setSelectedCardIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleSelectAllCards = () => {
    if (selectedCardIds.length === cards.length) {
      setSelectedCardIds([]);
    } else {
      setSelectedCardIds(cards.map((c) => c.id));
    }
  };

  const handleDeleteSelectedCards = () => {
    if (selectedCardIds.length === 0) return;

    if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedCardIds.length} từ vựng đã chọn không?`)) {
      axios.delete(`${API_BASE_URL}/flashcards/bulk-delete`, {
        data: { cardIds: selectedCardIds }
      })
      .then((res) => {
        alert(res.data.message || 'Đã xóa các từ vựng đã chọn!');
        setSelectedCardIds([]);
        if (selectedSet) fetchCardDetails(selectedSet.id);
      })
      .catch((err) => {
        console.error(err);
        alert(err.response?.data?.error || 'Có lỗi xảy ra khi xóa hàng loạt!');
      });
    }
  };

  // --- LOGIC CHẾ ĐỘ THUỘC TỪ (MASTERY MODE) ---
  const startMasteryMode = () => {
    if (cards.length < 4) {
      alert("Cần tối thiểu 4 từ vựng để bắt đầu Chế độ Thuộc từ!");
      return;
    }
    const initialProgress: PracticeProgress[] = cards.map((c) => ({
      card: c,
      termToDefPassed: false,
      defToTermPassed: false,
    }));

    setMasteryList(initialProgress);
    setIsMasteryMode(true);
    setMasteryFinished(false);
    setMasteryAnswer(null);

    generateNextMasteryQuestion(initialProgress);
  };

  const generateNextMasteryQuestion = (currentList: PracticeProgress[]) => {
    const unmasteredCards = currentList.filter(
      (item) => !item.termToDefPassed || !item.defToTermPassed
    );

    if (unmasteredCards.length === 0) {
      setMasteryFinished(true);
      return;
    }

    const randomItem = unmasteredCards[Math.floor(Math.random() * unmasteredCards.length)];

    let availableDirections: ('termToDef' | 'defToTerm')[] = [];
    if (!randomItem.termToDefPassed) availableDirections.push('termToDef');
    if (!randomItem.defToTermPassed) availableDirections.push('defToTerm');

    const direction = availableDirections[Math.floor(Math.random() * availableDirections.length)];
    const isTermToDef = direction === 'termToDef';

    const questionText = isTermToDef ? randomItem.card.term : randomItem.card.definition;
    const correctAnswer = isTermToDef ? randomItem.card.definition : randomItem.card.term;

    const otherAnswers = cards
      .filter((c) => c.id !== randomItem.card.id)
      .map((c) => (isTermToDef ? c.definition : c.term));

    const wrongOptions = [...otherAnswers].sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [correctAnswer, ...wrongOptions].sort(() => 0.5 - Math.random());

    setCurrentQuestion({
      cardId: randomItem.card.id,
      direction,
      questionText,
      correctAnswer,
      options,
    });
  };

  const handleMasterySubmit = (option: string) => {
    if (!currentQuestion || masteryAnswer !== null) return;
    setMasteryAnswer(option);

    const isCorrect = option === currentQuestion.correctAnswer;

    setTimeout(() => {
      let updatedList = [...masteryList];
      if (isCorrect) {
        updatedList = updatedList.map((item) => {
          if (item.card.id === currentQuestion.cardId) {
            return {
              ...item,
              termToDefPassed: currentQuestion.direction === 'termToDef' ? true : item.termToDefPassed,
              defToTermPassed: currentQuestion.direction === 'defToTerm' ? true : item.defToTermPassed,
            };
          }
          return item;
        });
      }

      setMasteryList(updatedList);
      setMasteryAnswer(null);
      generateNextMasteryQuestion(updatedList);
    }, 900);
  };

  // --- LOGIC TRỘN BÀI KIỂM TRA THƯỜNG ---
  const handleStartQuiz = (direction: 'termToDef' | 'defToTerm') => {
    if (cards.length < 4) return alert("Cần tối thiểu 4 từ vựng!");
    setQuizDirection(direction);

    const shuffledCards = [...cards].sort(() => 0.5 - Math.random());
    const generated: QuizQuestion[] = shuffledCards.map((currentCard) => {
      const isTermToDef = direction === 'termToDef';
      const questionText = isTermToDef ? currentCard.term : currentCard.definition;
      const correctAnswer = isTermToDef ? currentCard.definition : currentCard.term;

      const otherAnswers = cards
        .filter((c) => c.id !== currentCard.id)
        .map((c) => (isTermToDef ? c.definition : c.term));

      const wrongOptions = [...otherAnswers].sort(() => 0.5 - Math.random()).slice(0, 3);
      const options = [correctAnswer, ...wrongOptions].sort(() => 0.5 - Math.random());

      return { id: currentCard.id, questionText, correctAnswer, options };
    });

    setQuizQuestions(generated);
    setCurrentQuizIndex(0);
    setSelectedAnswer(null);
    setScore(0);
    setQuizFinished(false);
    setIsQuizMode(true);
  };

  const handleAnswerSubmit = (option: string) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(option);

    if (option === quizQuestions[currentQuizIndex].correctAnswer) {
      setScore((prev) => prev + 1);
    }

    setTimeout(() => {
      if (currentQuizIndex < quizQuestions.length - 1) {
        setCurrentQuizIndex((prev) => prev + 1);
        setSelectedAnswer(null);
      } else {
        setQuizFinished(true);
      }
    }, 900);
  };

  // --- PHÁT ÂM TTS ---
  const handleSpeak = (text: string) => {
  if (!('speechSynthesis' in window)) {
    alert('Trình duyệt của bạn không hỗ trợ tính năng phát âm!');
    return;
  }

  // 1. Hủy các câu thoại đang phát trước đó
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Kiểm tra nếu là tiếng Nhật
  const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/g.test(text);
  utterance.lang = hasJapanese ? 'ja-JP' : 'en-US';
  utterance.rate = 0.9; // Tốc độ đọc
  utterance.volume = 1.0; // Âm lượng tối đa

  // 2. Tìm danh sách giọng nói khả thi trên điện thoại
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const targetLang = hasJapanese ? 'ja' : 'en';
    // Ưu tiên chọn giọng nói chuẩn của hệ thống/Google trên mobile
    const matchedVoice = voices.find(
      (v) => v.lang.startsWith(targetLang) || v.lang.includes(targetLang)
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
  }

  // 3. Xử lý trường hợp bị treo queue trên iOS / Android
  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, 50);
};

  // --- IMPORT FILE & AI ---
  const handleImportFile = () => {
    if (!csvFile || !selectedSet) return alert('Vui lòng chọn file!');
    const ext = csvFile.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(csvFile, {
        header: true, skipEmptyLines: true,
        complete: (res) => sendDataToBackend(res.data)
      });
    } else if (ext === 'txt') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsed = text.split('\n').map((line) => {
          const parts = line.split('-');
          return parts.length >= 2 ? { term: parts[0].trim(), definition: parts.slice(1).join('-').trim() } : null;
        }).filter((item): item is { term: string; definition: string } => item !== null && item.term !== '');
        sendDataToBackend(parsed);
      };
      reader.readAsText(csvFile);
    }
  };

  const sendDataToBackend = (data: any[]) => {
    if (!selectedSet) return;
    axios.post(`${API_BASE_URL}/${selectedSet.id}/import`, { flashcards: data })
      .then(() => { alert('Import thành công!'); setCsvFile(null); fetchCardDetails(selectedSet.id); });
  };

  const handleImportWithAI = () => {
    if (!csvFile || !selectedSet) return alert('Vui lòng chọn file PDF, Word, TXT hoặc Ảnh!');
    
    const ext = csvFile.name.split('.').pop()?.toLowerCase();
    setIsAiProcessing(true);
    
    const formData = new FormData();
    formData.append('file', csvFile);

    const isImage = ['png', 'jpg', 'jpeg'].includes(ext || '');
    const endpoint = isImage 
      ? `${API_BASE_URL}/${selectedSet.id}/import-image`
      : `${API_BASE_URL}/${selectedSet.id}/import-pdf`;

    axios.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    .then((res) => { 
      setIsAiProcessing(false); 
      alert(res.data.message || 'Quét dữ liệu thành công!');
      setCsvFile(null); 
      fetchCardDetails(selectedSet.id); 
    })
    .catch((err) => {
      setIsAiProcessing(false);
      alert(err.response?.data?.error || 'Có lỗi xảy ra khi AI quét file!');
    });
  };

  const masteredCount = masteryList.filter((item) => item.termToDefPassed && item.defToTermPassed).length;

  // ==================== GIAO DIỆN XEM CHI TIẾT BỘ HỌC PHẦN ====================
  if (selectedSet) {
    return (
      <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <nav style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', padding: '16px 40px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 20px rgba(79,70,229,0.15)' }}>
          <span onClick={() => setSelectedSet(null)} style={{ fontSize: '18px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ← Trang chủ
          </span>
          <span style={{ fontSize: '20px', fontWeight: '800' }}>Quizlet Master ✨</span>
        </nav>

        <div style={{ maxWidth: '900px', margin: '30px auto', padding: '0 20px' }}>
          
          {/* NẾU ĐANG TRONG CHẾ ĐỘ THUỘC TỪ (MASTERY MODE) */}
          {isMasteryMode ? (
            <div style={{ backgroundColor: '#fff', padding: '36px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#8b5cf6' }}>
                  🧠 Chế Độ Luyện Thuộc Từ (Đã thuộc: {masteredCount} / {cards.length})
                </span>
                <button onClick={() => setIsMasteryMode(false)} style={{ background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
                  Thoát
                </button>
              </div>

              <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '10px', height: '10px', marginBottom: '30px', overflow: 'hidden' }}>
                <div style={{ width: `${(masteredCount / cards.length) * 100}%`, backgroundColor: '#8b5cf6', height: '100%', transition: 'width 0.3s' }}></div>
              </div>

              {!masteryFinished && currentQuestion ? (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '10px', color: '#64748b', fontWeight: '600', fontSize: '14px' }}>
                    {currentQuestion.direction === 'termToDef' ? '👉 Chiều 1: Nhìn Từ chọn Nghĩa' : '👈 Chiều 2: Nhìn Nghĩa chọn Từ'}
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '35px', borderRadius: '16px', fontSize: '30px', fontWeight: '800', textAlign: 'center', color: '#1e293b', border: '2px dashed #cbd5e1', marginBottom: '25px' }}>
                    {currentQuestion.questionText}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    {currentQuestion.options.map((option, idx) => {
                      let btnBg = '#fff';
                      let btnColor = '#334155';
                      let border = '2px solid #e2e8f0';

                      if (masteryAnswer !== null) {
                        if (option === currentQuestion.correctAnswer) {
                          btnBg = '#10b981'; btnColor = '#fff'; border = '2px solid #10b981';
                        } else if (option === masteryAnswer) {
                          btnBg = '#ef4444'; btnColor = '#fff'; border = '2px solid #ef4444';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          disabled={masteryAnswer !== null}
                          onClick={() => handleMasterySubmit(option)}
                          style={{ padding: '18px', borderRadius: '12px', background: btnBg, color: btnColor, border, fontSize: '16px', fontWeight: '700', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                        >
                          {idx + 1}. {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                  <h2 style={{ fontSize: '32px', color: '#10b981', margin: '0 0 10px 0' }}>🎉 Xuất sắc! Bạn đã thuộc 100% từ vựng!</h2>
                  <p style={{ color: '#64748b', fontSize: '16px', marginBottom: '30px' }}>Bạn đã trả lời đúng cả 2 chiều cho tất cả các từ trong bộ bài này.</p>
                  <button onClick={() => setIsMasteryMode(false)} style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', padding: '12px 32px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '16px' }}>
                    Quay lại Chế độ Học
                  </button>
                </div>
              )}
            </div>
          ) : isQuizMode && quizQuestions.length > 0 ? (
            /* CHẾ ĐỘ QUIZ THƯỜNG */
            <div style={{ backgroundColor: '#fff', padding: '36px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#6366f1', textTransform: 'uppercase' }}>
                  {quizDirection === 'termToDef' ? '🎯 Chế độ: Nhìn Từ -> Chọn Nghĩa' : '🔄 Chế độ: Nhìn Nghĩa -> Chọn Từ'}
                </span>
                <button onClick={() => setIsQuizMode(false)} style={{ background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
                  Thoát
                </button>
              </div>

              {!quizFinished ? (
                <div>
                  <div style={{ color: '#94a3b8', fontWeight: '700', textAlign: 'center', marginBottom: '10px' }}>
                    Câu {currentQuizIndex + 1} / {quizQuestions.length}
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '35px', borderRadius: '16px', fontSize: '30px', fontWeight: '800', textAlign: 'center', color: '#1e293b', border: '2px dashed #cbd5e1', marginBottom: '25px' }}>
                    {quizQuestions[currentQuizIndex]?.questionText}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    {quizQuestions[currentQuizIndex]?.options.map((option, idx) => {
                      let btnBg = '#fff';
                      let btnColor = '#334155';
                      let border = '2px solid #e2e8f0';

                      if (selectedAnswer !== null) {
                        if (option === quizQuestions[currentQuizIndex].correctAnswer) {
                          btnBg = '#10b981'; btnColor = '#fff'; border = '2px solid #10b981';
                        } else if (option === selectedAnswer) {
                          btnBg = '#ef4444'; btnColor = '#fff'; border = '2px solid #ef4444';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          disabled={selectedAnswer !== null}
                          onClick={() => handleAnswerSubmit(option)}
                          style={{ padding: '18px', borderRadius: '12px', background: btnBg, color: btnColor, border, fontSize: '16px', fontWeight: '700', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                        >
                          {idx + 1}. {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <h2 style={{ fontSize: '28px', color: '#1e293b' }}>🎉 Kết Quả Bài Kiểm Tra</h2>
                  <div style={{ fontSize: '60px', fontWeight: '900', color: '#6366f1', margin: '20px 0' }}>
                    {score} / {quizQuestions.length}
                  </div>
                  <button onClick={() => setIsQuizMode(false)} style={{ backgroundColor: '#6366f1', color: '#fff', border: 'none', padding: '12px 30px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>
                    Hoàn Thành
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* CHẾ ĐỘ XEM & HỌC BÌNH THƯỜNG */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0' }}>{selectedSet.title}</h1>
                  <p style={{ color: '#64748b', margin: 0 }}>{selectedSet.description || 'Không có mô tả.'}</p>
                </div>

                {cards.length >= 4 && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={startMasteryMode} style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
                      🧠 Học Thuộc Từ (2 Chiều)
                    </button>
                    <button onClick={() => handleStartQuiz('termToDef')} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
                      📝 Thi: Từ ➔ Nghĩa
                    </button>
                    <button onClick={() => handleStartQuiz('defToTerm')} style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(6,182,212,0.2)' }}>
                      🔄 Thi: Nghĩa ➔ Từ
                    </button>
                  </div>
                )}
              </div>

              {/* Vùng Import File */}
              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <input 
                  type="file" 
                  accept=".csv, .txt, .pdf, .doc, .docx, .png, .jpg, .jpeg, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)} 
                  style={{ fontSize: '14px' }} 
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleImportFile} style={{ backgroundColor: '#f1f5f9', color: '#334155', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Import CSV/TXT</button>
                  <button onClick={handleImportWithAI} disabled={isAiProcessing} style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>
                    {isAiProcessing ? '🤖 AI đang quét...' : '🤖 AI Import'}
                  </button>
                </div>
              </div>

              {/* Khung Flashcard lật 3D */}
              {cards.length > 0 && (
                <div>
                  <div className="flashcard-container" onClick={() => setIsFlipped(!isFlipped)}>
                    <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
                      <div className="flashcard-front" style={{ position: 'relative' }}>
                        <button onClick={(e) => { e.stopPropagation(); handleSpeak(cards[currentCardIndex]?.term || ''); }} style={{ position: 'absolute', top: '20px', right: '25px', background: 'none', border: 'none', fontSize: '26px', cursor: 'pointer' }}>🔊</button>
                        {cards[currentCardIndex]?.term}
                      </div>
                      <div className="flashcard-back">{cards[currentCardIndex]?.definition}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
                    <button disabled={currentCardIndex === 0} onClick={() => { setIsFlipped(false); setCurrentCardIndex(prev => prev - 1); }} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '700', cursor: 'pointer' }}>◀ Trước</button>
                    <span style={{ fontWeight: '800', color: '#475569' }}>{currentCardIndex + 1} / {cards.length}</span>
                    <button disabled={currentCardIndex === cards.length - 1} onClick={() => { setIsFlipped(false); setCurrentCardIndex(prev => prev + 1); }} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '700', cursor: 'pointer' }}>Sau ▶</button>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginTop: '12px' }}>
                    💡 Mẹo: Nhấn <b>Space</b> để lật thẻ, dùng <b>Mũi tên Trái/Phải</b> để chuyển bài nhanh.
                  </p>
                </div>
              )}

              {/* DANH SÁCH TỪ VỰNG CÓ CHẾ ĐỘ CHỌN NHIỀU & XÓA HÀNG LOẠT */}
              <div style={{ marginTop: '50px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', margin: 0 }}>
                    Danh sách từ vựng ({cards.length})
                  </h3>

                  {/* Nút Chọn tất cả & Xóa đã chọn */}
                  {cards.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button
                        onClick={handleSelectAllCards}
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        {selectedCardIds.length === cards.length ? '⬜ Bỏ chọn tất cả' : '☑️ Chọn tất cả'}
                      </button>

                      {selectedCardIds.length > 0 && (
                        <button
                          onClick={handleDeleteSelectedCards}
                          style={{
                            backgroundColor: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            fontSize: '14px',
                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                          }}
                        >
                          🗑️ Xóa {selectedCardIds.length} từ đã chọn
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {cards.map((card) => {
                    const isSelected = selectedCardIds.includes(card.id);

                    return (
                      <div
                        key={card.id}
                        style={{
                          backgroundColor: isSelected ? '#f0fdf4' : '#fff',
                          padding: '18px 24px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid #10b981' : '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                          transition: 'all 0.2s'
                        }}
                      >
                        {editingCard?.id === card.id ? (
                          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                            <input type="text" value={editTerm} onChange={(e) => setEditTerm(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                            <input type="text" value={editDefinition} onChange={(e) => setEditDefinition(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                            <button onClick={() => handleSaveCardEdit(card.id)} style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Lưu</button>
                            <button onClick={() => setEditingCard(null)} style={{ backgroundColor: '#94a3b8', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}>Hủy</button>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                              {/* Checkbox chọn từ */}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectCard(card.id)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }}
                              />

                              <button onClick={() => handleSpeak(card.term)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>🔊</button>
                              <span style={{ fontWeight: '700', fontSize: '18px', color: '#1e293b', width: '200px' }}>{card.term}</span>
                              <span style={{ color: '#64748b', fontSize: '16px' }}>{card.definition}</span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => { setEditingCard(card); setEditTerm(card.term); setEditDefinition(card.definition); }} style={{ background: '#f1f5f9', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>✏️ Sửa</button>
                              <button onClick={() => handleDeleteCard(card.id)} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>🗑️ Xóa</button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== GIAO DIỆN TRANG CHỦ ====================
  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <nav style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', padding: '16px 40px', color: '#fff', boxShadow: '0 4px 20px rgba(79,70,229,0.15)' }}>
        <span style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px' }}>Quizlet Master ✨</span>
      </nav>

      <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Bộ học phần của bạn</h2>
          <button onClick={() => { setShowForm(!showForm); setEditingSet(null); setTitle(''); setDescription(''); }} style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}>
            {showForm ? 'Đóng Form' : '+ Tạo bộ học phần mới'}
          </button>
        </div>

        {/* Form Thêm/Sửa Bộ học phần */}
        {showForm && (
          <form onSubmit={handleSubmitSet} style={{ backgroundColor: '#fff', padding: '28px', borderRadius: '16px', marginBottom: '30px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.03)' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1e293b' }}>{editingSet ? '✏️ Cập nhật bộ học phần' : '➕ Tạo bộ học phần mới'}</h3>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Tiêu đề (Ví dụ: Từ vựng Tiếng Nhật N3)' style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '15px', boxSizing: 'border-box' }} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Mô tả ngắn gọn...' style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '15px', height: '80px', boxSizing: 'border-box' }} />
            <button type="submit" style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>
              {editingSet ? 'Cập nhật' : 'Lưu bộ thẻ'}
            </button>
          </form>
        )}

        {/* Danh sách thẻ Học Phần trên trang chủ */}
        {loading ? (
          <p>Đang tải dữ liệu...</p>
        ) : studySets.length === 0 ? (
          <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '12px', textAlign: 'center', border: '2px dashed #dbdde2' }}>
            <p style={{ color: '#686c7d', fontSize: '16px', margin: 0 }}>Chưa có bộ học phần nào. Bạn hãy bấm tạo mới nhé!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
            {studySets.map((set) => (
              <div
                key={set.id}
                onClick={() => handleSelectSet(set)}
                style={{
                  backgroundColor: '#fff', borderRadius: '16px', padding: '24px',
                  border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s ease',
                  position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = '#6366f1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
              >
                <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '18px', fontWeight: '700' }}>{set.title}</h3>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px 0', minHeight: '40px' }}>{set.description || 'Không có mô tả.'}</p>
                
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>📅 {new Date(set.created_at).toLocaleDateString('vi-VN')}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={(e) => handleEditSet(e, set)} style={{ background: '#f1f5f9', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️ Sửa</button>
                    <button onClick={(e) => handleDeleteSet(e, set.id)} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>🗑️ Xóa</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

// HÀM NGOÀI PHỤC VỤ UNIT TEST
export const generateQuiz = (flashcards: Flashcard[]): QuizQuestion[] => {
  if (flashcards.length < 4) return [];
  return flashcards.map((currentCard) => {
    const otherDefinitions = flashcards
      .filter((c) => c.id !== currentCard.id)
      .map((c) => c.definition);

    const wrongAnswers = [...otherDefinitions].sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [currentCard.definition, ...wrongAnswers].sort(() => 0.5 - Math.random());

    return {
      id: currentCard.id,
      questionText: currentCard.term,
      correctAnswer: currentCard.definition,
      options,
    };
  });
};
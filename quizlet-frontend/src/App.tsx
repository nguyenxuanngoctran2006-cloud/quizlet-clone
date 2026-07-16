import { useEffect, useState } from 'react';
import axios from 'axios';
import Papa from 'papaparse'; // Import thư viện đọc file CSV

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
  term: string;
  correctAnswer: string;
  options: string[]; // Chứa 4 lựa chọn đã được xáo trộn
}

function App() {
  // States cho chế độ Quiz
  const [isQuizMode, setIsQuizMode] = useState<boolean>(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);
  const [quizFinished, setQuizFinished] = useState<boolean>(false);
  
  // State quản lý hiệu ứng chờ AI xử lý
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // States dành cho trang chi tiết bộ thẻ
  const [selectedSet, setSelectedSet] = useState<StudySet | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  // State quản lý file upload
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const fetchStudySets = () => {
    axios.get('http://localhost:5000/api/study-sets')
      .then((res) => { setStudySets(res.data.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchStudySets(); }, []);

  // Hàm tải lại chi tiết bộ thẻ (để cập nhật danh sách card sau khi import)
  const fetchCardDetails = (setId: number) => {
    axios.get(`http://localhost:5000/api/study-sets/${setId}`)
      .then((res) => {
        setCards(res.data.flashcards);
      })
      .catch((err) => console.error(err));
  };

  const handleSelectSet = (set: StudySet) => {
    setSelectedSet(set);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsQuizMode(false); // Reset chế độ Quiz khi đổi bộ học phần
    setCsvFile(null);
    fetchCardDetails(set.id);
  };

  const handleStartQuiz = () => {
    if (cards.length < 4) {
      alert("Bộ học phần cần tối thiểu 4 từ vựng để tạo bài tập trắc nghiệm!");
      return;
    }
    const generated = generateQuiz(cards);
    setQuizQuestions(generated);
    setCurrentQuizIndex(0);
    setSelectedAnswer(null);
    setScore(0);
    setQuizFinished(false);
    setIsQuizMode(true);
  };

  const handleAnswerSubmit = (option: string) => {
    if (selectedAnswer !== null) return; // Không cho bấm chọn lại
    
    setSelectedAnswer(option);
    if (option === quizQuestions[currentQuizIndex].correctAnswer) {
      setScore((prev) => prev + 1);
    }

    // Chờ 1 giây để người dùng nhìn đáp án đúng/sai rồi tự động chuyển câu
    setTimeout(() => {
      if (currentQuizIndex < quizQuestions.length - 1) {
        setCurrentQuizIndex((prev) => prev + 1);
        setSelectedAnswer(null);
      } else {
        setQuizFinished(true);
      }
    }, 1000);
  };

  // Hàm phát âm Text-to-Speech (TTS) sử dụng Web Speech API có sẵn của trình duyệt
  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const hasJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/g.test(text);
      
      if (hasJapanese) {
        utterance.lang = 'ja-JP'; // Giọng Nhật
      } else {
        utterance.lang = 'en-US'; // Giọng Mỹ
      }

      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Trình duyệt của bạn hiện tại không hỗ trợ tính năng phát âm!");
    }
  };

  // Lắng nghe sự kiện bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedSet || cards.length === 0 || isQuizMode) return; // Vô hiệu hóa phím tắt khi ở chế độ thi trắc nghiệm
      if (e.code === 'Space') {
        e.preventDefault(); 
        setIsFlipped(!isFlipped);
      } else if (e.code === 'ArrowRight') {
        if (currentCardIndex < cards.length - 1) {
          if (isFlipped) {
            setIsFlipped(false);
            setTimeout(() => setCurrentCardIndex(currentCardIndex + 1), 250);
          } else {
            setCurrentCardIndex(currentCardIndex + 1);
          }
        }
      } else if (e.code === 'ArrowLeft') {
        if (currentCardIndex > 0) {
          if (isFlipped) {
            setIsFlipped(false);
            setTimeout(() => setCurrentCardIndex(currentCardIndex - 1), 250);
          } else {
            setCurrentCardIndex(currentCardIndex - 1);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSet, cards, currentCardIndex, isFlipped, isQuizMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert('Vui lòng nhập tiêu đề!');
    axios.post('http://localhost:5000/api/study-sets', { title, description })
      .then(() => { setTitle(''); setDescription(''); setShowForm(false); fetchStudySets(); });
  };

  // Hàm xử lý đọc cả file CSV và TXT gửi lên Backend
  const handleImportFile = () => {
    if (!csvFile || !selectedSet) return alert('Vui lòng chọn file trước!');

    const fileExtension = csvFile.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          const parsedData = results.data;
          sendDataToBackend(parsedData);
        }
      });
    } 
    else if (fileExtension === 'txt') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        
        const parsedData = lines
          .map((line) => {
            const parts = line.split('-');
            if (parts.length >= 2) {
              return {
                term: parts[0]?.trim() || '',
                definition: parts.slice(1).join('-').trim() || ''
              };
            }
            return null;
          })
          .filter((card): card is { term: string; definition: string } => card !== null && card.term !== '' && card.definition !== '');

        if (parsedData.length === 0) {
          return alert('Không tìm thấy từ vựng hợp lệ trong file TXT! Định dạng chuẩn: "Từ - Định nghĩa"');
        }
        
        sendDataToBackend(parsedData);
      };
      reader.readAsText(csvFile);
    } else {
      alert('Định dạng file không hỗ trợ! Vui lòng chọn file .csv hoặc .txt');
    }
  };

  const sendDataToBackend = (data: any[]) => {
    if (!selectedSet) return;
    axios.post(`http://localhost:5000/api/study-sets/${selectedSet.id}/import`, {
      flashcards: data
    })
    .then((res) => {
      alert(res.data.message);
      setCsvFile(null);
      fetchCardDetails(selectedSet.id);
    })
    .catch((err) => {
      console.error(err);
      alert('Lỗi import dữ liệu. Hãy kiểm tra lại nội dung file!');
    });
  };

  const handleImportWithAI = () => {
    if (!csvFile || !selectedSet) return alert('Vui lòng chọn file trước!');

    const fileExtension = csvFile.name.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'pdf' && fileExtension !== 'txt') {
      return alert('Tính năng AI Import chỉ hỗ trợ file định dạng .pdf hoặc .txt!');
    }

    setIsAiProcessing(true);

    const formData = new FormData();
    formData.append('file', csvFile);

    axios.post(`http://localhost:5000/api/study-sets/${selectedSet.id}/import-pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    .then((res) => {
      setIsAiProcessing(false);
      alert(res.data.message);
      setCsvFile(null);
      fetchCardDetails(selectedSet.id);
    })
    .catch((err) => {
      setIsAiProcessing(false);
      console.error(err);
      alert(err.response?.data?.error || 'Có lỗi xảy ra trong quá trình AI phân tích file!');
    });
  };

  // --- GIAO DIỆN TRANG CHI TIẾT BỘ THẺ ---
  if (selectedSet) {
    return (
      <div>
        <nav style={{ backgroundColor: '#fff', padding: '15px 40px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span 
            onClick={() => setSelectedSet(null)} 
            style={{ fontSize: '24px', fontWeight: 'bold', color: '#4255ff', cursor: 'pointer', display: 'inline-block' }}
          >
            ← Quay lại trang chủ
          </span>
          {cards.length >= 4 && !isQuizMode && (
            <button
              onClick={handleStartQuiz}
              style={{
                backgroundColor: '#23b26d', color: '#fff', border: 'none',
                padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer',
                fontSize: '14px', boxShadow: '0 4px 8px rgba(35, 178, 109, 0.25)'
              }}
            >
              📝 Làm bài kiểm tra
            </button>
          )}
        </nav>

        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          
          {/* NẾU ĐANG TRONG CHẾ ĐỘ THI TRẮC NGHIỆM */}
          {isQuizMode && quizQuestions.length > 0 ? (
            <div style={{ textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '22px', color: '#303545', margin: 0 }}>📝 Trắc nghiệm: {selectedSet.title}</h3>
                <button 
                  onClick={() => setIsQuizMode(false)}
                  style={{ background: 'none', border: '1px solid #dbdde2', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', color: '#686c7d' }}
                >
                  Thoát kiểm tra
                </button>
              </div>

              {!quizFinished ? (
                <div>
                  <div style={{ marginBottom: '15px', color: '#939bb4', fontWeight: 'bold', textAlign: 'center' }}>
                    Câu hỏi {currentQuizIndex + 1} / {quizQuestions.length}
                  </div>
                  
                  {/* Khung câu hỏi */}
                  <div style={{ 
                    backgroundColor: '#fff', padding: '40px', borderRadius: '16px', 
                    fontSize: '32px', fontWeight: 'bold', marginBottom: '30px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.05)', textAlign: 'center',
                    border: '1px solid #e6e8eb'
                  }}>
                    {quizQuestions[currentQuizIndex]?.term}
                  </div>

                  {/* Danh sách 4 đáp án */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {quizQuestions[currentQuizIndex]?.options.map((option, idx) => {
                      let btnStyle: React.CSSProperties = {
                        padding: '16px', borderRadius: '12px', border: '1px solid #dbdde2',
                        backgroundColor: '#fff', fontSize: '16px', fontWeight: '600', cursor: 'pointer',
                        transition: 'all 0.2s', textAlign: 'left', width: '100%'
                      };

                      if (selectedAnswer !== null) {
                        if (option === quizQuestions[currentQuizIndex].correctAnswer) {
                          btnStyle.backgroundColor = '#23b26d'; // Đúng hiện màu Xanh
                          btnStyle.color = '#fff';
                          btnStyle.borderColor = '#23b26d';
                        } else if (option === selectedAnswer) {
                          btnStyle.backgroundColor = '#ff5656'; // Sai hiện màu Đỏ
                          btnStyle.color = '#fff';
                          btnStyle.borderColor = '#ff5656';
                        }
                      }

                      return (
                        <button 
                          key={idx} 
                          disabled={selectedAnswer !== null}
                          onClick={() => handleAnswerSubmit(option)}
                          style={btnStyle}
                        >
                          {idx + 1}. {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Kết quả bài thi */
                <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.05)', textAlign: 'center', border: '1px solid #e6e8eb' }}>
                  <h3 style={{ fontSize: '24px', margin: '0 0 10px 0', color: '#303545' }}>🎉 Hoàn thành bài kiểm tra!</h3>
                  <div style={{ fontSize: '16px', color: '#686c7d' }}>Số câu trả lời đúng của bạn là:</div>
                  <div style={{ fontSize: '54px', fontWeight: 'bold', color: '#4255ff', margin: '20px 0' }}>
                    {score} / {quizQuestions.length}
                  </div>
                  <p style={{ color: '#686c7d', marginBottom: '25px', fontSize: '15px' }}>
                    {score === quizQuestions.length ? 'Tuyệt vời! Bạn đã thuộc lòng 100% rồi! 🌟' : 'Hãy luyện tập thêm để đạt điểm tối đa nhé! 💪'}
                  </p>
                  <button 
                    onClick={() => setIsQuizMode(false)}
                    style={{ backgroundColor: '#4255ff', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '15px' }}
                  >
                    Quay lại Chế độ học thẻ
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* CHẾ ĐỘ HỌC FLASHCARD THÔNG THƯỜNG */
            <div>
              <h2 style={{ fontSize: '28px', color: '#303545', marginBottom: '10px' }}>{selectedSet.title}</h2>
              <p style={{ color: '#686c7d', marginBottom: '30px' }}>{selectedSet.description || 'Không có mô tả.'}</p>

              {/* Vùng chức năng Import File */}
              <div style={{ 
                backgroundColor: '#fff', padding: '24px', borderRadius: '12px', 
                marginBottom: '40px', display: 'flex', flexDirection: 'column', 
                alignItems: 'center', gap: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                border: '1px solid #e6e8eb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: '700', fontSize: '15px', color: '#303545' }}>📥 Nhập từ vựng thông minh:</span>
                  <input 
                    type="file" 
                    accept=".csv, .txt, .pdf"
                    disabled={isAiProcessing}
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    style={{ fontSize: '14px', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={handleImportFile}
                    disabled={isAiProcessing}
                    style={{ backgroundColor: '#f6f7fb', color: '#303545', border: '1px solid #dbdde2', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
                  >
                    Import Thường (CSV/TXT)
                  </button>

                  <button 
                    onClick={handleImportWithAI}
                    disabled={isAiProcessing}
                    style={{ backgroundColor: '#4255ff', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 8px rgba(66, 85, 255, 0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {isAiProcessing ? '🤖 AI đang quét tài liệu...' : '🤖 AI Import (PDF/TXT)'}
                  </button>
                </div>
                <span style={{ fontSize: '12px', color: '#939bb4' }}>
                  💡 Mẹo: Dùng <b>AI Import</b> để tải lên tài liệu học tập PDF, AI sẽ tự động đọc hiểu và nhặt từ vựng giải nghĩa cho bạn!
                </span>
              </div>
              
              {cards.length === 0 ? (
                <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '12px', border: '2px dashed #dbdde2' }}>
                  <p style={{ color: '#686c7d', margin: 0 }}>Bộ thẻ này chưa có từ vựng nào. Bạn hãy chọn file PDF/CSV ở trên để import nhé!</p>
                </div>
              ) : (
                <div>
                  <div className="flashcard-container" onClick={() => setIsFlipped(!isFlipped)}>
                    <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
                      
                      {/* MẶT TRƯỚC THẺ */}
                      <div className="flashcard-front" style={{ position: 'relative' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeak(cards[currentCardIndex]?.term || '');
                          }}
                          style={{
                            position: 'absolute',
                            top: '20px',
                            right: '25px',
                            background: 'none',
                            border: 'none',
                            fontSize: '24px',
                            cursor: 'pointer',
                            opacity: 0.6,
                            transition: 'opacity 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                          title="Phát âm từ vựng"
                        >
                          🔊
                        </button>
                        {cards[currentCardIndex]?.term}
                      </div>

                      {/* MẶT SAU THẺ */}
                      <div className="flashcard-back">{cards[currentCardIndex]?.definition}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px' }}>
                    <button 
                      disabled={currentCardIndex === 0}
                      onClick={() => { 
                        if (isFlipped) {
                          setIsFlipped(false);
                          setTimeout(() => setCurrentCardIndex(currentCardIndex - 1), 250);
                        } else {
                          setCurrentCardIndex(currentCardIndex - 1);
                        }
                      }}
                      style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #dbdde2', backgroundColor: '#fff', fontWeight: '600', cursor: currentCardIndex === 0 ? 'not-allowed' : 'pointer', opacity: currentCardIndex === 0 ? 0.5 : 1 }}
                    >
                      ◀ Trước
                    </button>
                    <span style={{ fontWeight: '700', fontSize: '18px', color: '#303545' }}>
                      {currentCardIndex + 1} / {cards.length}
                    </span>
                    <button 
                      disabled={currentCardIndex === cards.length - 1}
                      onClick={() => { 
                        if (isFlipped) {
                          setIsFlipped(false);
                          setTimeout(() => setCurrentCardIndex(currentCardIndex + 1), 250);
                        } else {
                          setCurrentCardIndex(currentCardIndex + 1);
                        }
                      }}
                      style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #dbdde2', backgroundColor: '#fff', fontWeight: '600', cursor: currentCardIndex === cards.length - 1 ? 'not-allowed' : 'pointer', opacity: currentCardIndex === cards.length - 1 ? 0.5 : 1 }}
                    >
                      Sau ▶
                    </button>
                  </div>
                  <p style={{ color: '#939bb4', fontSize: '14px', marginTop: '20px' }}>
                    💡 Mẹo: Nhấn phím <b>Space</b> để lật thẻ, dùng các phím <b>Mũi tên trái/phải</b> để chuyển bài nhanh.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- GIAO DIỆN TRANG CHỦ MẶC ĐỊNH ---
  return (
    <div>
      <nav style={{ backgroundColor: '#fff', padding: '15px 40px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#4255ff', letterSpacing: '-0.5px' }}>
          Quizlet <span style={{ color: '#3ccfcf' }}>Clone</span>
        </span>
      </nav>

      <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#303545', margin: 0 }}>Bộ học phần của bạn</h2>
          <button onClick={() => setShowForm(!showForm)} style={{ backgroundColor: '#4255ff', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
            {showForm ? 'Đóng Form' : '+ Tạo bộ thẻ mới'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', marginBottom: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '5px' }}>Tiêu đề bộ học phần</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Ví dụ: Từ vựng N3 - Chương 1' style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dbdde2', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '5px' }}>Mô tả (Không bắt buộc)</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Nhập mô tả ngắn gọn...' style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dbdde2', boxSizing: 'border-box', height: '80px' }} />
            </div>
            <button type="submit" style={{ backgroundColor: '#3ccfcf', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Lưu bộ thẻ</button>
          </form>
        )}
        
        {loading ? (
          <p>Đang tải dữ liệu từ đám mây...</p>
        ) : studySets.length === 0 ? (
          <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '12px', textAlign: 'center', border: '2px dashed #dbdde2' }}>
            <p style={{ color: '#686c7d', fontSize: '16px', margin: 0 }}>Chưa có dữ liệu bộ học phần nào trong Database.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
            {studySets.map((set) => (
              <div 
                key={set.id} 
                onClick={() => handleSelectSet(set)}
                style={{ 
                  backgroundColor: '#fff', borderRadius: '12px', padding: '24px', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)', cursor: 'pointer',
                  border: '1px solid #fff', transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = '#4255ff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#fff'; }}
              >
                <h3 style={{ margin: '0 0 8px 0', color: '#303545', fontSize: '18px', fontWeight: '600' }}>{set.title}</h3>
                <p style={{ color: '#686c7d', fontSize: '14px', margin: '0 0 24px 0', minHeight: '40px' }}>{set.description || 'Không có mô tả.'}</p>
                <div style={{ borderTop: '1px solid #f6f7fb', paddingTop: '12px', fontSize: '12px', color: '#939bb4' }}>
                  📅 Created: {new Date(set.created_at).toLocaleDateString('vi-VN')}
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

// HÀM NGOÀI ĐỘC LẬP: ĐÃ ĐƯỢC DI CHUYỂN RA NGOÀI COMPONENT APP ĐỂ EXPORT HỢP LỆ
export const generateQuiz = (flashcards: Flashcard[]): QuizQuestion[] => {
  if (flashcards.length < 4) return [];

  return flashcards.map((currentCard) => {
    // 1. Lấy tất cả các định nghĩa sai
    const otherDefinitions = flashcards
      .filter((card) => card.id !== currentCard.id)
      .map((card) => card.definition);

    // 2. Lấy ngẫu nhiên đúng 3 định nghĩa sai
    const wrongAnswers = [...otherDefinitions]
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    // 3. Gộp đáp án đúng và 3 đáp án sai
    const allOptions = [currentCard.definition, ...wrongAnswers];

    // 4. Xáo trộn ngẫu nhiên vị trí 4 đáp án
    const shuffledOptions = allOptions.sort(() => 0.5 - Math.random());

    return {
      id: currentCard.id,
      term: currentCard.term,
      correctAnswer: currentCard.definition,
      options: shuffledOptions,
    };
  });
};
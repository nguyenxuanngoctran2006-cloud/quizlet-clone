import { useEffect, useState } from 'react';
import axios from 'axios';
import Papa from 'papaparse'; // Import thư viện đọc file CSV

interface StudySet {
  id: number;
  title: string;
  description: string;
  created_at: string;
}

interface Flashcard {
  id: number;
  term: string;
  definition: string;
}

function App() {
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
    setCsvFile(null);
    fetchCardDetails(set.id);
  };

  // Lắng nghe sự kiện bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedSet || cards.length === 0) return;
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
  }, [selectedSet, cards, currentCardIndex, isFlipped]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert('Vui lòng nhập tiêu đề!');
    axios.post('http://localhost:5000/api/study-sets', { title, description })
      .then(() => { setTitle(''); setDescription(''); setShowForm(false); fetchStudySets(); });
  };

  // Hàm xử lý đọc file CSV và gửi lên Backend Bulk Insert
  const handleImportCSV = () => {
    if (!csvFile || !selectedSet) return alert('Vui lòng chọn file CSV trước!');

    // Dùng PapaParse để phân tích file
    Papa.parse(csvFile, {
      header: true, // Tự động lấy dòng đầu làm key (term, definition)
      skipEmptyLines: true,
      complete: function (results) {
        const parsedData = results.data; // Mảng dữ liệu [{term: '...', definition: '...'}, ...]
        
        // Gọi API Backend đã làm ở Giai đoạn 1
        axios.post(`http://localhost:5000/api/study-sets/${selectedSet.id}/import`, {
          flashcards: parsedData
        })
        .then((res) => {
          alert(res.data.message);
          setCsvFile(null);
          fetchCardDetails(selectedSet.id); // Tải lại danh sách từ mới lên màn hình
        })
        .catch((err) => {
          console.error(err);
          alert('Lỗi import dữ liệu. Hãy kiểm tra định dạng file!');
        });
      }
    });
  };

  // --- GIAO DIỆN TRANG CHI TIẾT BỘ THẺ ---
  if (selectedSet) {
    return (
      <div>
        <nav style={{ backgroundColor: '#fff', padding: '15px 40px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <span 
            onClick={() => setSelectedSet(null)} 
            style={{ fontSize: '24px', fontWeight: 'bold', color: '#4255ff', cursor: 'pointer', display: 'inline-block' }}
          >
            ← Quay lại trang chủ
          </span>
        </nav>

        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '28px', color: '#303545', marginBottom: '10px' }}>{selectedSet.title}</h2>
          <p style={{ color: '#686c7d', marginBottom: '30px' }}>{selectedSet.description || 'Không có mô tả.'}</p>

          {/* Vùng chức năng Import File CSV */}
          <div style={{ 
            backgroundColor: '#fff', padding: '20px', borderRadius: '12px', 
            marginBottom: '40px', display: 'flex', justifyContent: 'center', 
            alignItems: 'center', gap: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            border: '1px solid #e6e8eb'
          }}>
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#4f566b' }}>📥 Nhập từ vựng nhanh:</span>
            <input 
              type="file" 
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              style={{ fontSize: '14px' }}
            />
            <button 
              onClick={handleImportCSV}
              style={{
                backgroundColor: '#3ccfcf', color: '#fff', border: 'none', 
                padding: '8px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Import File
            </button>
          </div>

          {cards.length === 0 ? (
            <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '12px', border: '2px dashed #dbdde2' }}>
              <p style={{ color: '#686c7d', margin: 0 }}>Bộ thẻ này chưa có từ vựng nào. Bạn hãy chọn file CSV ở trên để import nhé!</p>
            </div>
          ) : (
            <div>
              <div className="flashcard-container" onClick={() => setIsFlipped(!isFlipped)}>
                <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
                  <div className="flashcard-front">{cards[currentCardIndex]?.term}</div>
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
                  style={{ 
                    padding: '12px 24px', borderRadius: '8px', border: '1px solid #dbdde2', 
                    backgroundColor: '#fff', fontWeight: '600', cursor: currentCardIndex === 0 ? 'not-allowed' : 'pointer',
                    opacity: currentCardIndex === 0 ? 0.5 : 1
                  }}
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
                  style={{ 
                    padding: '12px 24px', borderRadius: '8px', border: '1px solid #dbdde2', 
                    backgroundColor: '#fff', fontWeight: '600', cursor: currentCardIndex === cards.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: currentCardIndex === cards.length - 1 ? 0.5 : 1
                  }}
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
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Nhập mô tả ngắn gọn...' style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dbdde2', boxSizing: 'border-box', height: '60px' }} />
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
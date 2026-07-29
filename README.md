# 🌟 Quizlet Clone - Smart Flashcard App with AI

> **A Full-stack Flashcard Application powered by AI** / AIを活用したフルスタックの単語帳アプリケーション

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Groq AI](https://img.shields.io/badge/Groq_AI-F55036?style=for-the-badge&logo=groq&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-FCC72B?style=for-the-badge&logo=vitest&logoColor=white)

## 📖 Introduction (プロジェクト概要)
This is a comprehensive full-stack Quizlet Clone designed for language learners. The standout feature is the integration of **Groq AI (Llama 3.3 70B)**, which automatically parses and extracts vocabulary from PDF/TXT documents, converting them directly into interactive flashcards.

言語学習者のために開発されたフルスタックのQuizletクローンアプリです。最大の特徴は**Groq AI**の統合であり、PDFやTXTドキュメントから自動的に単語を抽出し、フラッシュカードに変換する機能を持っています。

## ✨ Key Features (主な機能)
*   **🧠 AI Smart Import:** Upload a PDF/TXT file and let AI extract terms and definitions automatically. (AIによるドキュメントの自動読み込みと単語抽出)
*   **🔄 3D Interactive Flashcards:** Smooth flip animations with a modern UI. (3Dフリップアニメーション付きのモダンなフラッシュカード)
*   **🔊 Text-to-Speech (TTS):** Auto-detects languages (e.g., Japanese, English) and pronounces terms correctly using Web Speech API. (Web Speech APIによる自動音声読み上げ機能)
*   **📝 Quiz Mode:** Automatically generates multiple-choice questions with randomized distractors for effective testing. (ランダムな選択肢を生成する自動テストモード)
*   **🧪 Unit Testing:** Built-in robust tests using Vitest to ensure logic reliability. (Vitestを用いたユニットテストによる品質保証)

## 🛠️ Tech Stack (技術スタック)
**Frontend:**
*   React.js, TypeScript, Vite
*   Axios, Papaparse (CSV parsing)
*   Vitest (Unit Testing)

**Backend & Database:**
*   Node.js, Express.js
*   Multer (File upload handling), pdf-text-reader
*   Groq AI API (`llama-3.3-70b-versatile`)
*   Supabase (PostgreSQL)

## 🚀 How to Run Locally (ローカルでの実行方法)

### 1. Clone the repository
```bash
git clone https://github.com/guyenxuanngoctran2006-cloud/quizlet-clone.git

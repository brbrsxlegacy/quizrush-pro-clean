import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, "public");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(publicPath));

app.get("/", (req, res) => res.sendFile(path.join(publicPath, "index.html")));
app.get("/mobile", (req, res) => res.sendFile(path.join(publicPath, "mobile", "index.html")));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "QuizRush PRO RENDER",
    publicExists: fs.existsSync(publicPath),
    indexExists: fs.existsSync(path.join(publicPath, "index.html")),
    hasGroqKey: Boolean(process.env.GROQ_API_KEY)
  });
});

app.post("/api/generate-quiz", async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ success: false, error: "GROQ_API_KEY eksik. Render Environment Variables içine ekle." });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const topic = String(req.body.topic || "Genel kültür").slice(0, 120);
    const grade = String(req.body.grade || "6").slice(0, 20);
    const count = Math.min(Math.max(Number(req.body.count || 8), 3), 20);
    const difficulty = String(req.body.difficulty || "orta").slice(0, 20);

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.55,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Sen Türkçe, okul seviyesine uygun quiz soruları üreten bir asistansın. Sadece geçerli JSON döndür." },
        { role: "user", content: `${grade}. sınıf seviyesinde "${topic}" konusunda ${difficulty} zorlukta ${count} adet çoktan seçmeli soru üret.

JSON:
{
  "title": "Quiz başlığı",
  "questions": [
    {
      "question": "Soru metni",
      "answers": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "Kısa açıklama"
    }
  ]
}` }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());

    if (!Array.isArray(parsed.questions)) throw new Error("AI questions listesi döndürmedi.");

    parsed.questions = parsed.questions.slice(0, count).map((q, i) => ({
      question: String(q.question || `Soru ${i + 1}`),
      answers: Array.isArray(q.answers) && q.answers.length === 4 ? q.answers.map(String) : ["A", "B", "C", "D"],
      correct: Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3 ? q.correct : 0,
      explanation: String(q.explanation || "")
    }));

    res.json({ success: true, quiz: parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message || "AI hatası" });
  }
});

app.use((req, res) => res.status(404).sendFile(path.join(publicPath, "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`QuizRush PRO çalışıyor: http://localhost:${PORT}`));

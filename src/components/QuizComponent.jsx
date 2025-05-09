// src/QuizComponent.jsx
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';

// — Hook para sincronizar con localStorage —  
function useLocalStorage(key, initial) {
  const [state, setState] = useState(() => {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : initial;
  });                                                               
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));               // persiste en localStorage :contentReference[oaicite:0]{index=0}
  }, [key, state]);
  return [state, setState];
}

// — Función de parseo robusto de MCQ —  
function parseMCQ(text) {
  if (!text) return null;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  let ql = lines[0].replace(/^Pregunta[:\s]?/i, '');
  if (ql.includes('A)')) ql = ql.split('A)')[0].trim();
  const question = ql;
  const options = {};
  lines.forEach(line => {
    const m = line.match(/^([A-D])\)\s*(.*)/);
    if (m) options[m[1]] = m[2].trim();
  });
  const ma = text.match(/Respuesta[:\s]*([A-D])/i);
  const answer = ma ? ma[1].toUpperCase() : null;
  return { question, options, answer };
}

export default function QuizComponent() {
  // — Estados del quiz —  
  const [name, setName] = useState('');                             // useState para estado :contentReference[oaicite:1]{index=1}
  const [stage, setStage] = useState('enterName');                  // etapas: enterName, quiz, results
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);

  // — AI & loading —  
  const [ai, setAi] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [loadingA, setLoadingA] = useState(false);
  const feedbackRef = useRef(null);

  // — Registros en localStorage —  
  const [records, setRecords] = useLocalStorage('quizRecords', []);
  // seleccionar mejor con reduce: score desc, time asc :contentReference[oaicite:2]{index=2}
  const best = records.reduce((b, r) => {
    if (!b) return r;
    if (r.score > b.score) return r;
    if (r.score === b.score && r.time < b.time) return r;
    return b;
  }, null);

  // inicializar Gemini AI
  useEffect(() => {
    const key = import.meta.env.VITE_GEMINI_API_KEY;
    if (key) setAi(new GoogleGenAI({ apiKey: key }));
  }, []);

  // — obtener pregunta —  
  const fetchQuestion = async () => {
    if (!ai) return;
    setLoadingQ(true);
    const prompt = `
      Genera una pregunta sobre reciclaje y los Objetivos de Desarrollo Sostenible (ODS),
      con 4 opciones (A, B, C, D) y la letra correcta al final.
      Formato: 'Pregunta? A) ... B) ... C) ... D) ... Respuesta: X'
    `;
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-2.0-flash-001',
        contents: prompt
      });
      const parsed = parseMCQ(res.text || '');
      if (parsed) setQuestions(qs => [...qs, parsed]);
      else throw new Error('Formato inesperado');
    } catch (e) {
      console.error('Error cargando pregunta:', e);
      alert('No se pudo cargar la pregunta.');
    } finally {
      setLoadingQ(false);
    }
  };

  // — enviar respuesta —  
  const submitAnswer = async letter => {
    if (!ai) return;
    setLoadingA(true);
    setUserAnswer(letter);
    const curr = questions[idx];
    const prompt = `
      ¿La respuesta "${letter}" es correcta para: "${curr.question}" con opciones
      ${Object.entries(curr.options).map(([L,T])=>`${L}) ${T}`).join(' ')}?
      Respuesta correcta: ${curr.answer}. Responde "Correcto" o "Incorrecto".
    `;
    try {
      const res = await ai.models.generateContent({ model: 'gemini-2.0-flash-001', contents: prompt });
      const correct = res.text.trim().toLowerCase().startsWith('correcto');
      const fb = feedbackRef.current;
      if (correct) {
        setScore(s => s + 1);
        fb.textContent = '¡Correcto!';
        fb.className = 'text-green-600';
      } else {
        fb.textContent = `Incorrecto. Era ${curr.answer}.`;
        fb.className = 'text-red-600';
      }
    } catch {
      const fb = feedbackRef.current;
      fb.textContent = 'Error verificando.';
      fb.className = 'text-yellow-600';
    } finally {
      setTimeout(() => {
        feedbackRef.current.textContent = '';
        setUserAnswer('');
        if (idx < questions.length - 1) {
          setIdx(i => i + 1);
          fetchQuestion();
        } else {
          setEndTime(Date.now());
          setStage('results');
          // — actualizar registros automáticamente —  
          const time = Math.floor((Date.now() - startTime) / 1000);
          setRecords(prev => {
            const exists = prev.find(r => r.name === name);
            let updated = [...prev];
            if (exists) {
              // reemplazar si mejoró según score o empate+tiempo mejor :contentReference[oaicite:3]{index=3}
              updated = prev.map(r => {
                if (r.name !== name) return r;
                if (score > r.score || (score === r.score && time < r.time)) {
                  return { name, score, time, date: new Date().toISOString() };
                }
                return r;
              });
            } else if (score > 0) {
              // solo agregar si obtuvo al menos 1 punto
              updated.push({ name, score, time, date: new Date().toISOString() });
            }
            return updated;
          });
        }
      }, 1500);
      setLoadingA(false);
    }
  };

  const timeTaken = startTime && endTime ? Math.floor((endTime - startTime)/1000) : 0;

  // — UI Handlers —  
  const handleStart = e => {
    e.preventDefault();
    if (!name.trim()) return alert('Ingresa tu nombre.');
    setStage('quiz');
    setStartTime(Date.now());
    fetchQuestion();
  };
  const handleRestart = () => {
    setQuestions([]);
    setIdx(0);
    setScore(0);
    setStartTime(null);
    setEndTime(null);
    setStage('enterName');
    setName('');
  };

  // — Render —  
  if (stage === 'enterName') {
    return (
      <div className="p-6 max-w-md mx-auto">
        {best && (
          <div className="mb-4 p-3 bg-blue-100 rounded">
            Mejor: <strong>{best.name}</strong> — Score: {best.score}, Tiempo: {best.time}s
          </div>
        )}
        <form onSubmit={handleStart} className="space-y-2">
          <input className="border p-2 w-full" placeholder="Tu nombre" value={name}
                 onChange={e=>setName(e.target.value)} />
          <button className="bg-blue-500 text-white py-2 w-full">Empezar</button>
        </form>
      </div>
    );
  }

  if (stage === 'results') {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <h2 className="text-2xl mb-2">Resultados</h2>
        <p>{name}, Score: {score}/{questions.length}</p>
        <p>Tiempo: {timeTaken}s</p>
        <button onClick={handleRestart}
                className="mt-4 bg-green-500 text-white py-2 px-4 rounded">
          Volver a jugar
        </button>
      </div>
    );
  }

  const curr = questions[idx];
  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="mb-4">Pregunta {idx+1}</h2>
      {loadingQ ? <p>Cargando pregunta…</p> : (
        <>
          <p className="mb-3">{curr.question}</p>
          <div className="space-y-2 mb-2">
            {Object.entries(curr.options).map(([L,T])=>(
              <button key={L}
                      onClick={()=>submitAnswer(L)}
                      disabled={!!userAnswer}
                      className="block w-full text-left border p-2 rounded">
                {L}) {T}
              </button>
            ))}
          </div>
          <div ref={feedbackRef} className="mb-2"></div>
          {loadingA && <p>Verificando…</p>}
        </>
      )}
      <p>Puntuación: {score}</p>
    </div>
  );
}

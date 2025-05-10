import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { saveScore, getBestScore } from '../services/scoreService';

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
  const [name, setName] = useState('');
  const [stage, setStage] = useState('enterName');
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [ai, setAi] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [loadingA, setLoadingA] = useState(false);
  const feedbackRef = useRef(null);
  const best = getBestScore();

  useEffect(() => {
    const key = import.meta.env.VITE_GEMINI_API_KEY;
    if (key) setAi(new GoogleGenAI({ apiKey: key }));
  }, []);

  const fetchQuestion = async () => {
    if (!ai) return;
    setLoadingQ(true);
    const prompt = `Genera una pregunta sobre reciclaje y los Objetivos de Desarrollo Sostenible (ODS),
      con 4 opciones (A, B, C, D) y la letra correcta al final.
      Formato: 'Pregunta? A) ... B) ... C) ... D) ... Respuesta: X`;
    try {
      const res = await ai.models.generateContent({ model: 'gemini-2.0-flash-001', contents: prompt });
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

  const submitAnswer = async letter => {
    if (!ai) return;
    setLoadingA(true);
    setUserAnswer(letter);
    const curr = questions[idx];
    const opts = Object.entries(curr.options).map(([L, T]) => `${L}) ${T}`).join(' ');
    const prompt = `¿La respuesta "${letter}" es correcta para: "${curr.question}" con opciones ${opts}? Respuesta correcta: ${curr.answer}. Responde "Correcto" o "Incorrecto".`;
    try {
      const res = await ai.models.generateContent({ model: 'gemini-2.0-flash-001', contents: prompt });
      const correct = res.text.trim().toLowerCase().startsWith('correcto');
      const fb = feedbackRef.current;
      fb.innerHTML = correct
        ? `<div class="flex items-center justify-center space-x-2">
            <svg class="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>¡Correcto!</span>
          </div>`
        : `<div class="flex items-center justify-center space-x-2">
            <svg class="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Incorrecto. Era ${curr.answer}.</span>
          </div>`;
      if (correct) setScore(s => s + 1);
    } catch {
      feedbackRef.current.innerHTML = `<div class="flex items-center justify-center space-x-2">
        <svg class="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.5-1.667 1.732-3L13.732 4c-.837-1.566-3.032-1.566-3.869 0L2.268 16c-.772 1.566.192 3 1.732 3z" />
        </svg>
        <span>Error verificando</span>
      </div>`;
    } finally {
      setTimeout(() => {
        feedbackRef.current.innerHTML = '';
        setUserAnswer('');
        if (idx < questions.length - 1) {
          setIdx(i => i + 1);
          fetchQuestion();
        } else {
          setEndTime(Date.now());
          setStage('results');
          const time = Date.now() - startTime;
          saveScore(name, score, time);
        }
        setLoadingA(false);
      }, 1500);
    }
  };

  const timeTaken = startTime && endTime ? (endTime - startTime) : 0;

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

  if (stage === 'enterName') {
    return (
      <div className="p-6 max-w-md mx-auto">
        {best && (
          <div className="mb-6 p-4 bg-orange-100 rounded-lg border border-orange-300 shadow-sm">
            <p className="font-semibold text-orange-700">Mejor Puntuación:</p>
            <p><strong>{best.name}</strong> — Score: {best.score}, Tiempo: {best.time}ms</p>
          </div>
        )}
        <form onSubmit={handleStart} className="space-y-4">
          <input
            className="w-full px-4 py-3 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Tu nombre"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 active:scale-95"
          >
            Empezar
          </button>
        </form>
      </div>
    );
  }

  if (stage === 'results') {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-lg text-center">
        <h2 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-700">¡Resultados!</h2>
        <div className="space-y-4">
          <p className="text-xl text-gray-800">
            <span className="font-semibold">{name}</span>, tu puntuación es:
          </p>
          <div className="flex flex-col items-center space-y-2">
            <p className="text-4xl font-bold text-orange-600">{score}/{questions.length}</p>
            <p className="text-lg text-gray-600">Tiempo: {timeTaken}ms</p>
          </div>
          <button
            onClick={handleRestart}
            className="w-full py-3 px-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg shadow-md transition duration-200 ease-in-out transform hover:scale-105 active:scale-95 animate-pulse"
          >
            ¡Volver a Jugar!
          </button>
        </div>
      </div>
    );
  }

  const curr = questions[idx];
  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-lg">
      <h2 className="mb-6 text-2xl font-semibold text-orange-600">Pregunta {idx + 1}</h2>
      {loadingQ ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
          <p className="ml-3 text-orange-600">Generando pregunta...</p>
        </div>
      ) : (
        <>
          <p className="mb-6 text-lg text-gray-800">{curr.question}</p>
          <div className="space-y-4 mb-6">
            {Object.entries(curr.options).map(([L, T]) => (
              <button
                key={L}
                onClick={() => submitAnswer(L)}
                disabled={!!userAnswer}
                className={`w-full px-5 py-4 rounded-lg transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 ${
                  userAnswer === L
                    ? 'bg-orange-100 border-2 border-orange-500'
                    : 'bg-white border border-orange-200 hover:border-orange-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-orange-700 font-medium">{L}) {T}</span>
                  {userAnswer === L && (
                    <svg
                      className={`w-5 h-5 ${userAnswer === curr.answer ? 'text-green-500' : 'text-red-500'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      {userAnswer === curr.answer ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      )}
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div ref={feedbackRef} className="mb-4 text-center min-h-[2rem]"></div>
          {loadingA && (
            <div className="flex justify-center items-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-orange-500"></div>
              <p className="text-orange-600">Verificando respuesta...</p>
            </div>
          )}
        </>
      )}
      <div className="flex justify-between items-center mt-6">
        <p className="text-orange-600 font-semibold">Puntuación: {score}</p>
        <button
          onClick={handleRestart}
          className="px-4 py-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition duration-200"
        >
          Reiniciar
        </button>
      </div>
    </div>
  );
}
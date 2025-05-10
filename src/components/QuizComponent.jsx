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
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const key = import.meta.env.VITE_GEMINI_API_KEY;
    if (key) setAi(new GoogleGenAI({ apiKey: key }));
  }, []);

  // Función para crear efecto de confeti
  const launchConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  };

  const fetchQuestion = async () => {
    if (!ai) return;
    setLoadingQ(true);
    const prompt = `Genera una pregunta sobre reciclaje y los Objetivos de Desarrollo Sostenible (ODS),
      con 4 opciones (A, B, C, D) y la letra correcta al final.
      Formato: 'Pregunta? A) ... B) ... C) ... D) ... Respuesta: X'`;
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
        ? `<div class="flex items-center justify-center space-x-2 animate-bounce-in">
            <img src="https://png.pngtree.com/png-vector/20200907/ourlarge/pngtree-hand-drawn-cartoon-garbage-recycling-illustration-png-image_2339683.jpg " 
                 class="w-6 h-6" alt="Correcto" />
            <span>¡Excelente elección ecológica!</span>
          </div>`
        : `<div class="flex items-center justify-center space-x-2 animate-shake">
            <img src="https://previews.123rf.com/images/juliarstudio/juliarstudio1703/juliarstudio170300261/73501688-green-reciclar-s%C3%ADmbolo-icono-de-dibujos-animados.jpg " 
                 class="w-6 h-6" alt="Incorrecto" />
            <span>Recuerda: ${curr.answer} es la opción correcta para proteger el planeta</span>
          </div>`;
      
      if (correct) {
        setScore(s => s + 1);
        launchConfetti();
      }
    } catch {
      feedbackRef.current.innerHTML = `<div class="flex items-center justify-center space-x-2 text-yellow-500">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.5-1.667 1.732-3L13.732 4c-.837-1.566-3.032-1.566-3.869 0L2.268 16c-.772 1.566.192 3 1.732 3z" />
        </svg>
        <span>Error verificando respuesta</span>
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

  // Componentes visuales reutilizables
  const RecyclingIcon = ({ className = "" }) => (
    <img src="https://png.pngtree.com/png-vector/20200907/ourlarge/pngtree-hand-drawn-cartoon-garbage-recycling-illustration-png-image_2339683.jpg " 
         className={`w-8 h-8 ${className}`} 
         alt="Reciclaje" />
  );

  const EarthIcon = () => (
    <img src="https://images.vexels.com/media/users/3/298393/isolated/preview/e27fffb6876723d92c921b52517c1b6b-reciclar-el-personaje-de-dibujos-animados-del-planeta-tierra.png "
         className="w-16 h-16 mx-auto mb-4"
         alt="Planeta Tierra" />
  );

  // Estilos animados (agregar al CSS global)
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes bounce-in {
        0% { transform: scale(0.8); opacity: 0; }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes shake {
        0% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        50% { transform: translateX(5px); }
        75% { transform: translateX(-5px); }
        100% { transform: translateX(0); }
      }
      .animate-bounce-in {
        animation: bounce-in 0.5s ease-out;
      }
      .animate-shake {
        animation: shake 0.5s;
      }
      .confetti {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 50;
        background: url('https://png.pngtree.com/png-vector/20200907/ourlarge/pngtree-hand-drawn-cartoon-garbage-recycling-illustration-png-image_2339683.jpg ') 
                    center center / contain no-repeat fixed;
        opacity: 0.1;
        transition: opacity 0.5s;
      }
      .confetti.show {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Confeti visual
  const Confetti = () => (
    <div className={`confetti ${showConfetti ? 'show' : ''}`}></div>
  );

  if (stage === 'enterName') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Confetti />
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden transform transition-all duration-300 hover:shadow-3xl">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-white text-center relative">
            <RecyclingIcon className="absolute top-4 right-4" />
            <h1 className="text-3xl font-bold mb-2">¡Bienvenido al Quiz Ecológico!</h1>
            <p className="opacity-90">Aprende a reciclar mientras te diviertes</p>
          </div>
          
          <div className="p-6">
            {best && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="font-semibold text-green-700">Mejor Puntuación:</p>
                <p className="flex items-center">
                  <EarthIcon />
                  <span className="ml-2"><strong>{best.name}</strong> — Score: {best.score}, Tiempo: {best.time}ms</span>
                </p>
              </div>
            )}
            
            <form onSubmit={handleStart} className="space-y-6">
              <div className="relative">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Tu nombre</label>
                <input
                  id="name"
                  className="w-full px-4 py-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
                  placeholder="Ingresa tu nombre"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <RecyclingIcon className="w-5 h-5 text-green-400" />
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-lg shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center group"
              >
                <span className="mr-2">🌱</span>
                Empezar el Reto Ecológico
                <span className="ml-2 transform transition-transform group-hover:rotate-12">♻️</span>
              </button>
            </form>
          </div>
          
          <div className="bg-green-50 p-4 text-center text-sm text-green-700">
            <p>Únete a millones de usuarios que están cambiando el mundo, un click a la vez</p>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'results') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Confetti />
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden transform transition-all duration-300 hover:shadow-3xl">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-white text-center relative">
            <EarthIcon />
            <h2 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-emerald-200">
              ¡Resultados del Reto Ecológico!
            </h2>
            <p className="opacity-90">Has completado {questions.length} preguntas</p>
          </div>
          
          <div className="p-6">
            <div className="space-y-6">
              <p className="text-xl text-gray-800 text-center">
                <span className="font-semibold">{name}</span>, has demostrado ser un verdadero defensor del planeta
              </p>
              
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <svg className="w-32 h-32" viewBox="0 0 100 100">
                    <circle
                      className="text-green-200"
                      strokeWidth="10"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="50"
                      cy="50"
                    />
                    <circle
                      className="text-emerald-500"
                      strokeWidth="10"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * score / questions.length)}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="50"
                      cy="50"
                    />
                    <text
                      x="50"
                      y="50"
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-2xl font-bold text-emerald-600"
                    >
                      {score}/{questions.length}
                    </text>
                  </svg>
                </div>
                
                <p className="text-lg text-gray-600 flex items-center">
                  <span className="mr-2">⏱️</span>
                  Tiempo total: {timeTaken}ms
                </p>
              </div>
              
              <button
                onClick={handleRestart}
                className="w-full py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-lg shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center group"
              >
                <span className="mr-2 transform group-hover:rotate-180 transition-transform">🔁</span>
                Volver a Jugar
                <span className="ml-2">🌱</span>
              </button>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 text-center text-sm text-green-700">
            <p>¡Cada punto que logras te acerca a ser un héroe del reciclaje!</p>
          </div>
        </div>
      </div>
    );
  }

  const curr = questions[idx];
  const progressPercent = ((idx + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Confetti />
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden transform transition-all duration-300 hover:shadow-3xl">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white relative">
          <div className="absolute top-2 right-4">
            <RecyclingIcon className="w-6 h-6" />
          </div>
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm">
              Pregunta {idx + 1} de {questions.length}
            </div>
            <div className="text-sm font-medium">
              Puntuación: {score}
            </div>
          </div>
          
          <div className="w-full bg-green-200 rounded-full h-2.5">
            <div 
              className="bg-white h-2.5 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
        
        <div className="p-6">
          {loadingQ ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
              <p className="text-emerald-600 text-lg font-medium">Generando pregunta...</p>
              <div className="flex space-x-2">
                <RecyclingIcon className="w-8 h-8" />
                <img 
                  src="https://previews.123rf.com/images/juliarstudio/juliarstudio1703/juliarstudio170300261/73501688-green-reciclar-s%C3%ADmbolo-icono-de-dibujos-animados.jpg " 
                  className="w-8 h-8" 
                  alt="Reciclaje" />
                <img 
                  src="https://images.vexels.com/media/users/3/298393/isolated/preview/e27fffb6876723d92c921b52517c1b6b-reciclar-el-personaje-de-dibujos-animados-del-planeta-tierra.png "
                  className="w-8 h-8" 
                  alt="Planeta Tierra" />
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200 shadow-inner">
                <p className="text-lg text-gray-800 leading-relaxed">{curr.question}</p>
              </div>
              
              <div className="space-y-3 mb-6">
                {Object.entries(curr.options).map(([L, T]) => (
                  <button
                    key={L}
                    onClick={() => submitAnswer(L)}
                    disabled={!!userAnswer}
                    className={`w-full px-5 py-4 rounded-lg transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] ${
                      userAnswer === L
                        ? 'bg-green-100 border-2 border-emerald-500 shadow-md'
                        : 'bg-white border border-green-200 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-700 font-medium flex items-center">
                        <span className="mr-2">{L}</span> {T}
                      </span>
                      {userAnswer === L && (
                        <svg
                          className={`w-6 h-6 ${userAnswer === curr.answer ? 'text-green-500' : 'text-red-500'}`}
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
                <div className="flex justify-center items-center space-x-3 py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-emerald-500"></div>
                  <p className="text-emerald-600 font-medium">Verificando tu elección ecológica...</p>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="bg-green-50 p-4 flex justify-between items-center">
          <button
            onClick={handleRestart}
            className="px-4 py-2 bg-green-100 text-emerald-700 rounded-lg hover:bg-green-200 transition duration-200 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reiniciar
          </button>
          
          <div className="text-sm text-green-700">
            ¡Ayuda al planeta aprendiendo!
          </div>
        </div>
      </div>
    </div>
  );
}
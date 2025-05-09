// services/scoreService.js

/**
 * Guarda un nuevo registro de puntuación en localStorage.
 * Cada registro incluye: nombre del jugador, puntuación, tiempo en segundos y fecha ISO.
 * @param {string} name - Nombre del jugador
 * @param {number} score - Puntuación obtenida
 * @param {number} time - Tiempo en segundos que tardó en completar el quiz
 */
export function saveScore(name, score, time) {
  const key = 'quizRecords';
  // 1) Leer registros previos
  const existing = localStorage.getItem(key);
  const records = existing ? JSON.parse(existing) : [];

  // 2) Crear nuevo registro
  const record = {
    name,
    score,
    time,
    date: new Date().toISOString(),
  };

  // 3) Añadir y persistir
  records.push(record);
  localStorage.setItem(key, JSON.stringify(records));
}

/**
 * Obtiene todos los registros guardados en localStorage.
 * @returns {Array<{name: string, score: number, time: number, date: string}>}
 */
export function getAllScores() {
  const existing = localStorage.getItem('quizRecords');
  return existing ? JSON.parse(existing) : [];
}

/**
 * Devuelve el registro con el menor tiempo (respuesta más rápida).
 * @returns {{name: string, score: number, time: number, date: string} | null}
 */
export function getBestScore() {
  const records = getAllScores();
  if (records.length === 0) return null;
  return records.reduce((best, curr) => (
    !best || curr.time < best.time ? curr : best
  ), null);
}
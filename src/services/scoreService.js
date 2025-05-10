// scoreService.js
// Servicio de persistencia de puntuaciones usando localStorage [[1]][[3]][[5]][[6]]

const STORAGE_KEY = 'quizBestScore';

export function saveScore(name, score, time) {
  const currentBest = getBestScore();
  
  // Comparación inteligente: prioriza mayor puntuación, luego menor tiempo [[7]]
  const isNewBest = !currentBest 
    || score > currentBest.score 
    || (score === currentBest.score && time < currentBest.time);
  
  if (isNewBest) {
    const newBest = { name, score, time };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newBest)); // [[5]]
  }
}

export function getBestScore() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : null; // [[3]]
}

// Lógica de limpieza opcional (no requerida por el componente actual)
export function clearScores() {
  localStorage.removeItem(STORAGE_KEY);
}
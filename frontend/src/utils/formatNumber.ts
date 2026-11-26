const percentFormat = new Intl.NumberFormat('ru-RU', { style: 'percent', maximumFractionDigits: 0 });
const scoreFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Доля от 0 до 1 в процентах: `0.73` → «73 %». */
export function formatPercent(fraction: number): string {
  return percentFormat.format(fraction);
}

/** Оценка от 0 до 1 с двумя знаками: `0.76` → «0,76». */
export function formatScore(score: number): string {
  return scoreFormat.format(score);
}

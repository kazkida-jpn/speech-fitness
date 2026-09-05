/** mm:ss for the live timer. */
export function formatTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** "3.2秒" for result rows. */
export function formatResultTime(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(1)}秒`;
}

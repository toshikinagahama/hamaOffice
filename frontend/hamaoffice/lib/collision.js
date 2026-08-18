// 円(アバター)と矩形(障害物)の衝突判定。
export function circleRectCollide(cx, cy, r, rect) {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

// X軸・Y軸を別々に判定して、ぶつからない軸だけ移動を適用する(壁ずり)。
// これがないと壁に斜めに突っ込んだ瞬間に完全停止してしまう。
export function resolveMove(x, y, dx, dy, radius, obstacles, bounds) {
  let nx = x + dx;
  if (obstacles.some((o) => circleRectCollide(nx, y, radius, o))) {
    nx = x;
  }

  let ny = y + dy;
  if (obstacles.some((o) => circleRectCollide(nx, ny, radius, o))) {
    ny = y;
  }

  nx = Math.max(bounds.minX + radius, Math.min(nx, bounds.maxX - radius));
  ny = Math.max(bounds.minY + radius, Math.min(ny, bounds.maxY - radius));

  return { x: nx, y: ny };
}

export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

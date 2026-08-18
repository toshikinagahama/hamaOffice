import { useEffect, useRef, useState, useCallback } from 'react';
import { resolveMove } from '../lib/collision';

const SPEED = 200; // px/sec
export const AVATAR_RADIUS = 16;

export function useKeyboardMovement(initialPos, obstacles, bounds, onMoved) {
  const [pos, setPos] = useState(initialPos);
  const posRef = useRef(initialPos);
  const keys = useRef({ up: false, down: false, left: false, right: false });
  // アバターを直接ドラッグ中はキーボード入力側のループを止めておく
  // (同時に動くとガクつくため)。
  const isDraggingRef = useRef(false);
  const onMovedRef = useRef(onMoved);
  onMovedRef.current = onMoved;

  const applyNext = useCallback((next) => {
    if (next.x !== posRef.current.x || next.y !== posRef.current.y) {
      posRef.current = next;
      setPos(next);
      onMovedRef.current && onMovedRef.current(next);
    }
  }, []);

  // アバターを直接タップ&ドラッグした時に、Konva 側から呼ぶ。
  // 壁との当たり判定は resolveMove をそのまま再利用する。
  const dragTo = useCallback(
    (targetX, targetY) => {
      isDraggingRef.current = true;
      const dx = targetX - posRef.current.x;
      const dy = targetY - posRef.current.y;
      const next = resolveMove(
        posRef.current.x,
        posRef.current.y,
        dx,
        dy,
        AVATAR_RADIUS,
        obstacles,
        bounds
      );
      applyNext(next);
      return next;
    },
    [obstacles, bounds, applyNext]
  );

  const endDrag = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    const keyMap = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
    };
    const onKeyDown = (e) => {
      const dir = keyMap[e.key];
      if (dir) {
        keys.current[dir] = true;
        e.preventDefault();
      }
    };
    const onKeyUp = (e) => {
      const dir = keyMap[e.key];
      if (dir) keys.current[dir] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    let rafId;
    let lastTs = null;

    const loop = (ts) => {
      if (lastTs == null) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.1);
      lastTs = ts;

      if (!isDraggingRef.current) {
        const k = keys.current;
        let dx = 0;
        let dy = 0;
        if (k.up) dy -= 1;
        if (k.down) dy += 1;
        if (k.left) dx -= 1;
        if (k.right) dx += 1;

        if (dx !== 0 || dy !== 0) {
          const len = Math.sqrt(dx * dx + dy * dy);
          dx = (dx / len) * SPEED * dt;
          dy = (dy / len) * SPEED * dt;
          const next = resolveMove(
            posRef.current.x,
            posRef.current.y,
            dx,
            dy,
            AVATAR_RADIUS,
            obstacles,
            bounds
          );
          applyNext(next);
        }
      }

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [obstacles, bounds, applyNext]);

  return { pos, posRef, dragTo, endDrag };
}

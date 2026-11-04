import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import type { TaskStatus } from "../../domain/types.ts";
import { TASK_STATUSES } from "./helpers.ts";

export function boardStatus(id: unknown): TaskStatus | undefined {
  return TASK_STATUSES.find((status) => status === id);
}

export const boardCollision: CollisionDetection = (args) => {
  const { pointerCoordinates: pointer, droppableContainers } = args;
  if (!pointer) return closestCenter(args);

  // Column rectangles can extend past the board's horizontal clipping edge.
  const board = droppableContainers[0]?.node.current?.parentElement;
  const rect = board?.getBoundingClientRect();
  if (
    !rect ||
    pointer.x < rect.left ||
    pointer.x >= rect.right ||
    pointer.y < rect.top ||
    pointer.y >= rect.bottom
  )
    return [];
  return pointerWithin(args);
};

// Keep scrolling confined to the board and tear it down on drop or navigation.
export function startBoardEdgeScroll(
  board: HTMLElement,
  pointer: PointerEvent,
) {
  let { clientX: x, clientY: y } = pointer;
  const move = (event: PointerEvent) => {
    if (event.pointerId !== pointer.pointerId) return;
    x = event.clientX;
    y = event.clientY;
  };
  const tick = () => {
    const { left, right, top, bottom } = board.getBoundingClientRect();
    if (x >= left && x < right && y >= top && y < bottom) {
      const edge = 36;
      const leftOverlap = Math.max(0, edge - (x - left));
      const rightOverlap = Math.max(0, edge - (right - x));
      board.scrollLeft += Math.round((rightOverlap - leftOverlap) / 3);
    }
    frame = requestAnimationFrame(tick);
  };
  let frame = requestAnimationFrame(tick);
  document.addEventListener("pointermove", move);
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("pointermove", move);
  };
}

export const boardKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates, context },
) => {
  if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") return;
  event.preventDefault();

  const current =
    boardStatus(context.over?.id) ??
    boardStatus(context.active?.data.current?.status);
  const index = current ? TASK_STATUSES.indexOf(current) : -1;
  const target = TASK_STATUSES[index + (event.code === "ArrowLeft" ? -1 : 1)];
  const column = target && context.droppableRects.get(target);
  const card = context.collisionRect;
  if (index < 0 || !column || !card) return;

  return {
    x:
      currentCoordinates.x +
      column.left +
      column.width / 2 -
      (card.left + card.width / 2),
    y: currentCoordinates.y,
  };
};

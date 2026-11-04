import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Check, Circle, GripVertical } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AppLink } from "../../components/AppLink.tsx";
import { StatusBadge } from "../../components/StatusBadge.tsx";
import {
  TASK_PRIORITY_MESSAGE_KEYS,
  TASK_STATUS_MESSAGE_KEYS,
} from "../../domain/labels.ts";
import type { Task, TaskStatus, TeamMember } from "../../domain/types.ts";
import { isTaskOverdue } from "../../domain/workspace.ts";
import { useI18n } from "../../i18n/index.ts";
import { tasksHref } from "../../routes.ts";
import { getTaskStatusTone } from "../../utils/statusTone.ts";
import { groupTasksByStatus } from "./helpers.ts";
import {
  boardCollision,
  boardKeyboardCoordinates,
  boardStatus,
  startBoardEdgeScroll,
} from "./boardDrag.ts";
import "./taskBoard.css";

interface TaskBoardProps {
  eventId: string;
  now: Date;
  tasks: readonly Task[];
  members: readonly Pick<TeamMember, "id" | "name">[];
  timeZone?: string;
  selectedTaskId: string | null;
  onOpen: (taskId: string) => void;
  movableTaskIds: ReadonlySet<string>;
  moveDisabled: boolean;
  onMove: (taskId: string, status: TaskStatus) => void;
}

function BoardColumn({
  status,
  activeStatus,
  children,
}: {
  status: TaskStatus;
  activeStatus: TaskStatus | undefined;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className="task-board__column"
      aria-labelledby={`task-board-${status}`}
      data-drop-target={(isOver && activeStatus !== status) || undefined}
    >
      {children}
    </section>
  );
}

function BoardCard({
  task,
  selected,
  canMove,
  moveDisabled,
  children,
}: {
  task: Task;
  selected: boolean;
  canMove: boolean;
  moveDisabled: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({
      id: task.id,
      data: { status: task.status, title: task.title },
      disabled: !canMove || moveDisabled,
      attributes: {
        roleDescription: t("tasks.board.dragHandle"),
      },
    });
  return (
    <li
      ref={setNodeRef}
      className="task-board__card"
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
      data-movable={canMove || undefined}
    >
      {children}
      {canMove && (
        <button
          {...attributes}
          {...listeners}
          ref={setActivatorNodeRef}
          id={`task-board-move-${task.id}`}
          type="button"
          className="task-board__handle"
          aria-label={t("tasks.board.move", { title: task.title })}
        >
          <GripVertical size={18} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

export function TaskBoard({
  eventId,
  now,
  tasks,
  members,
  timeZone,
  selectedTaskId,
  onOpen,
  movableTaskIds,
  moveDisabled,
  onMove,
}: TaskBoardProps) {
  const { formatNumber, formatTaskDeadline, t } = useI18n(timeZone);
  const memberById = new Map(members.map((member) => [member.id, member]));
  const [drag, setDrag] = useState<{ task: Task; pointer?: PointerEvent }>();
  const boardRef = useRef<HTMLElement>(null);
  const keyboardFocus = useRef<HTMLButtonElement | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: boardKeyboardCoordinates,
      scrollBehavior: "auto",
    }),
  );

  useEffect(() => {
    if (drag?.pointer && boardRef.current)
      return startBoardEdgeScroll(boardRef.current, drag.pointer);
  }, [drag]);

  useEffect(() => {
    const previous = keyboardFocus.current;
    if (!previous || moveDisabled) return;
    keyboardFocus.current = null;
    if (previous.isConnected || document.activeElement !== document.body)
      return;
    const next = document.getElementById(previous.id) ?? boardRef.current;
    next?.focus();
  }, [moveDisabled, tasks]);

  function getMove({ active, over }: Pick<DragEndEvent, "active" | "over">) {
    const destination = boardStatus(over?.id);
    const task = tasks.find(({ id }) => id === active.id);
    if (
      !destination ||
      !task ||
      moveDisabled ||
      !movableTaskIds.has(task.id) ||
      task.status !== drag?.task.status ||
      task.status === destination
    )
      return;
    return { task, destination };
  }

  function finishDrag(event: DragEndEvent) {
    const move = getMove(event);
    setDrag(undefined);
    if (!move) return;
    if (
      event.activatorEvent instanceof KeyboardEvent &&
      document.activeElement instanceof HTMLButtonElement
    ) {
      keyboardFocus.current = document.activeElement;
    }
    onMove(move.task.id, move.destination);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollision}
      autoScroll={false}
      accessibility={{
        restoreFocus: false,
        screenReaderInstructions: { draggable: t("tasks.board.instructions") },
        announcements: {
          onDragStart: ({ active }) =>
            t("tasks.board.pickedUp", {
              title: active.data.current?.title ?? "",
            }),
          onDragOver: ({ over }) => {
            const status = boardStatus(over?.id);
            return status
              ? t("tasks.board.over", {
                  status: t(TASK_STATUS_MESSAGE_KEYS[status]),
                })
              : undefined;
          },
          onDragEnd: (event) => {
            const move = getMove(event);
            return move
              ? t("tasks.board.moveRequested", {
                  status: t(TASK_STATUS_MESSAGE_KEYS[move.destination]),
                })
              : t("tasks.board.moveCancelled");
          },
          onDragCancel: () => t("tasks.board.moveCancelled"),
        },
      }}
      onDragStart={({ active, activatorEvent }) => {
        const task = tasks.find(({ id }) => id === active.id);
        if (task)
          setDrag({
            task,
            pointer:
              activatorEvent instanceof PointerEvent
                ? activatorEvent
                : undefined,
          });
      }}
      onDragCancel={() => setDrag(undefined)}
      onDragEnd={finishDrag}
    >
      <section
        ref={boardRef}
        className="task-board"
        aria-label={t("tasks.board.label")}
        tabIndex={0}
      >
        {groupTasksByStatus(tasks).map(({ status, tasks: columnTasks }) => (
          <BoardColumn
            key={status}
            status={status}
            activeStatus={drag?.task.status}
          >
            <h2 id={`task-board-${status}`}>
              <StatusBadge
                compact
                tone={getTaskStatusTone(status)}
                label={t(TASK_STATUS_MESSAGE_KEYS[status])}
              />
              <span>{formatNumber(columnTasks.length)}</span>
            </h2>
            {columnTasks.length === 0 ? (
              <p className="task-board__empty">{t("tasks.board.empty")}</p>
            ) : (
              <ul className="task-board__cards" role="list">
                {columnTasks.map((task) => {
                  const overdue = isTaskOverdue(task, now);
                  const AcceptanceIcon = task.acknowledged ? Check : Circle;
                  const selected = selectedTaskId === task.id;

                  return (
                    <BoardCard
                      key={task.id}
                      task={task}
                      selected={selected}
                      canMove={movableTaskIds.has(task.id)}
                      moveDisabled={moveDisabled}
                    >
                      <AppLink
                        className="task-board__link"
                        href={tasksHref(eventId, task.id, "board")}
                        draggable={false}
                        onNavigate={() => onOpen(task.id)}
                        data-task-focus-key={`task-board:${task.id}`}
                        aria-current={selected ? "location" : undefined}
                        aria-label={t("common.openTaskNamed", {
                          title: task.title,
                        })}
                      >
                        {task.title}
                      </AppLink>
                      <div className="task-board__meta">
                        <span
                          className={`task-priority task-priority--${task.priority}`}
                        >
                          {t(TASK_PRIORITY_MESSAGE_KEYS[task.priority])}
                        </span>
                        <time dateTime={task.deadline}>
                          {formatTaskDeadline(task.deadline, task.deadlineTime)}
                        </time>
                        {overdue && (
                          <span className="task-deadline__overdue">
                            {t("taskDetails.overdue")}
                          </span>
                        )}
                      </div>
                      <div className="task-board__meta">
                        <span>
                          {memberById.get(task.ownerId)?.name ??
                            t("common.unassigned")}
                        </span>
                        <span
                          className={`task-acceptance ${task.acknowledged ? "task-acceptance--accepted" : ""}`}
                        >
                          <AcceptanceIcon size={13} aria-hidden="true" />
                          {task.acknowledged
                            ? t("taskDetails.acknowledged")
                            : t("taskDetails.acknowledgementNeeded")}
                        </span>
                      </div>
                    </BoardCard>
                  );
                })}
              </ul>
            )}
          </BoardColumn>
        ))}
      </section>
      {createPortal(
        <DragOverlay dropAnimation={null} zIndex={30}>
          {drag && (
            <div className="task-board__preview" aria-hidden="true">
              {drag.task.title}
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

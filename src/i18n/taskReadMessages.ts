export const TASK_READ_EN_MESSAGES = {
  "tasks.remote.context": "Event task workspace",
  "tasks.remote.readOnlyShort": "Read only",
  "tasks.remote.notice": "Server tasks · read only",
  "tasks.remote.split": "Tasks: server data · Dashboard and Team: demo",
  "tasks.remote.loading": "Loading your event and tasks…",
  "tasks.remote.error": "Tasks could not be loaded. Please try again.",
  "tasks.remote.forbidden":
    "You cannot access these event tasks. Please try again or contact the organizer.",
  "tasks.remote.retry": "Try again",
  "tasks.remote.empty.title": "No tasks for this event",
  "tasks.remote.empty.description":
    "This event has no tasks yet. Tasks will appear here when they are available.",
  "tasks.remote.noEvent.title": "No accessible event",
  "tasks.remote.noEvent.description":
    "Your account has no active event membership. Contact the organizer to arrange access.",
  "tasks.remote.readOnly":
    "Task actions are not connected yet. This view is read only.",
} as const;

export const TASK_READ_BG_MESSAGES = {
  "tasks.remote.context": "Работно пространство за задачи",
  "tasks.remote.readOnlyShort": "Само преглед",
  "tasks.remote.notice": "Задачи от сървъра · само преглед",
  "tasks.remote.split": "Задачи: данни от сървъра · Табло и Екип: демо",
  "tasks.remote.loading": "Зареждане на събитието и задачите…",
  "tasks.remote.error": "Задачите не можаха да се заредят. Опитайте отново.",
  "tasks.remote.forbidden":
    "Нямате достъп до задачите за това събитие. Опитайте отново или се свържете с организатора.",
  "tasks.remote.retry": "Нов опит",
  "tasks.remote.empty.title": "Няма задачи за това събитие",
  "tasks.remote.empty.description":
    "За събитието все още няма задачи. Те ще се покажат тук, когато са налични.",
  "tasks.remote.noEvent.title": "Няма достъпно събитие",
  "tasks.remote.noEvent.description":
    "Акаунтът ви няма активно участие в събитие. Свържете се с организатора за достъп.",
  "tasks.remote.readOnly":
    "Действията по задачите още не са свързани. В момента е достъпен само преглед.",
} satisfies Record<keyof typeof TASK_READ_EN_MESSAGES, string>;

export const TASK_READ_EN_MESSAGES = {
  "tasks.remote.context": "Event task workspace",
  "tasks.remote.readOnlyShort": "Read only",
  "tasks.remote.notice": "Server tasks",
  "tasks.actions.assignment": "Assign responsibility",
  "tasks.actions.accept": "Accept responsibility",
  "tasks.actions.withdraw": "Withdraw acceptance",
  "tasks.actions.pending": "Saving and refreshing task…",
  "tasks.actions.conflict":
    "This task changed elsewhere. The current state is shown. Please review it and act again if needed.",
  "tasks.actions.conflict-refresh-failed":
    "This task changed elsewhere. Refresh before trying again; the displayed state may be out of date.",
  "tasks.actions.refresh-failed":
    "The current task state could not be refreshed. Refresh before making another change.",
  "tasks.actions.invalid":
    "This change could not be saved. Check your selection and try again.",
  "tasks.actions.unauthenticated": "Your session ended. Please sign in again.",
  "tasks.actions.forbidden":
    "You are not permitted to make this change. The current task state is shown.",
  "tasks.actions.not-found":
    "The task or selected member is no longer available in this event.",
  "tasks.actions.unavailable":
    "The change could not be confirmed. Review the current state and try again if needed.",
  "tasks.actions.refresh": "Refresh task",
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
  "tasks.remote.notice": "Задачи от сървъра",
  "tasks.actions.assignment": "Възлагане на отговорност",
  "tasks.actions.accept": "Приемане на отговорността",
  "tasks.actions.withdraw": "Оттегляне на приемането",
  "tasks.actions.pending": "Запазване и обновяване на задачата…",
  "tasks.actions.conflict":
    "Задачата е променена от друг потребител. Показано е текущото състояние. Прегледайте го и повторете действието, ако е необходимо.",
  "tasks.actions.conflict-refresh-failed":
    "Задачата е променена от друг потребител. Обновете преди нов опит; показаното състояние може да е остаряло.",
  "tasks.actions.refresh-failed":
    "Текущото състояние не можа да се обнови. Обновете преди друга промяна.",
  "tasks.actions.invalid":
    "Промяната не можа да се запази. Проверете избора и опитайте отново.",
  "tasks.actions.unauthenticated": "Сесията ви приключи. Влезте отново.",
  "tasks.actions.forbidden":
    "Нямате право на тази промяна. Показано е текущото състояние на задачата.",
  "tasks.actions.not-found":
    "Задачата или избраният участник вече не е достъпен за това събитие.",
  "tasks.actions.unavailable":
    "Промяната не можа да се потвърди. Прегледайте текущото състояние и опитайте отново, ако е необходимо.",
  "tasks.actions.refresh": "Обновяване на задачата",
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

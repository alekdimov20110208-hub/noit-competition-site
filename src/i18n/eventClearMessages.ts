export const CLEAR_EN_MESSAGES = {
  "events.clear": "Clear all tasks",
  "events.clear.description":
    "All current Tasks, including completed Tasks, leave this Event’s active workspace. The Event stays active. Task records, Team, Changes, Plan B, links, notifications and History remain. Reminders stop for removed Tasks. Restoring Tasks and Undo are unavailable.",
  "events.clear.count":
    "Reviewed Tasks: {count} · Completed: {completed} · Linked Changes: {changes} · Configured reminders: {reminders}",
  "events.clear.empty":
    "This Event has no active Tasks. Confirming this review records a safe zero-result operation without changing the Event or History.",
  "events.clear.confirmation": "Type the Event name to confirm",
  "events.clear.exact":
    "Match the name above exactly, including capital letters and spaces.",
  "events.clear.invalid": "The name must match the current Event name exactly.",
  "events.clear.conflict":
    "The Event or reviewed Task scope changed. Reload the review, check the new counts and type the name again. Nothing was cleared by this request.",
  "events.clear.reload": "Reload the Task review",
  "events.clear.pending": "Clearing reviewed Tasks…",
  "events.clear.permission":
    "Access is unavailable. Refresh Event Management or sign in again.",
  "events.clear.unavailable":
    "The review or command is unavailable. Clearing is blocked until a fresh review succeeds.",
  "events.clear.uncertain":
    "The result is uncertain. Recover this original operation before starting another Clear. Recovery uses the same reviewed scope and cannot remove Tasks added after an accepted Clear.",
  "events.clear.recover": "Recover clear result",
  "events.clear.recoveryNotice":
    "A Task clear result needs recovery for {name}.",
  "events.clear.success":
    "Cleared {count} Tasks from {name}. The Event remains active and its records are retained.",
  "events.clear.noop":
    "No Tasks were cleared from {name}. The reviewed scope was empty.",
  "events.clear.refreshFailed":
    "The clear result is confirmed ({count} Tasks), but current Event reads failed. Refresh before continuing.",
  "events.clear.removedLinks":
    "{active} active linked Tasks; {count} removed Task references retained in History.",
  "events.clear.already": "This Event is archived. Tasks cannot be cleared.",
  "events.clear.historyLoading": "Loading retained Task…",
  "events.clear.historyNotice":
    "This Task was removed from active views. This retained record is read-only. Reminder settings are inactive; restoring and editing are unavailable.",
  "events.clear.historyMetadata":
    "Version {version} · Removed {removed} by {actor}. Names and text reflect the retained current record; missing past states are not reconstructed.",
  "events.clear.historyResponsibility":
    "Responsible: {assignee} · Accepted: {accepted} · Deadline: {deadline}",
  "events.clear.historyError":
    "Retained Task data could not be loaded. Try again.",
  "events.clear.originalCount":
    "Original reviewed Task count: {count}. Recovery uses the held original review.",
  "events.clear.referencesBound":
    "The first {count} retained references are shown. All relationships remain in History.",
  "history.task.removed": "Task removed from active workspace",
  "history.event.tasksCleared": "Event Tasks cleared",
} as const;
export const CLEAR_BG_MESSAGES: Record<keyof typeof CLEAR_EN_MESSAGES, string> =
  {
    "events.clear": "Изчистване на всички задачи",
    "events.clear.description":
      "Всички текущи задачи, включително завършените, се премахват от активния изглед на това събитие. Събитието остава активно. Записите на задачите, екипът, промените, план Б, връзките, известията и историята се запазват. Напомнянията за премахнатите задачи спират. Няма възстановяване на задачи или отмяна.",
    "events.clear.count":
      "Прегледани задачи: {count} · Завършени: {completed} · Свързани промени: {changes} · Настроени напомняния: {reminders}",
    "events.clear.empty":
      "Събитието няма активни задачи. Потвърждението записва безопасна операция с нулев резултат, без промяна на събитието или историята.",
    "events.clear.confirmation": "Въведете името на събитието за потвърждение",
    "events.clear.exact":
      "Въведете точно показаното име, включително главните букви и интервалите.",
    "events.clear.invalid":
      "Името трябва да съвпада точно с текущото име на събитието.",
    "events.clear.conflict":
      "Събитието или прегледаният обхват на задачите е променен. Заредете нов преглед, проверете броя и въведете името отново. Тази заявка не е изчистила задачи.",
    "events.clear.reload": "Нов преглед на задачите",
    "events.clear.pending": "Изчистване на прегледаните задачи…",
    "events.clear.permission":
      "Достъпът е недостъпен. Опреснете управлението на събитията или влезте отново.",
    "events.clear.unavailable":
      "Прегледът или операцията е недостъпна. Изчистването е блокирано до успешен нов преглед.",
    "events.clear.uncertain":
      "Резултатът е неясен. Проверете тази първоначална операция, преди да започнете друго изчистване. Проверката използва същия прегледан обхват и не премахва задачи, добавени след прието изчистване.",
    "events.clear.recover": "Проверка на резултата от изчистване",
    "events.clear.recoveryNotice":
      "Резултатът от изчистването на задачи за {name} изисква проверка.",
    "events.clear.success":
      "Изчистени са {count} задачи от {name}. Събитието остава активно и записите се запазват.",
    "events.clear.noop":
      "Не са изчистени задачи от {name}. Прегледаният обхват е празен.",
    "events.clear.refreshFailed":
      "Резултатът е потвърден ({count} задачи), но текущите данни за събитието не са заредени. Опреснете преди да продължите.",
    "events.clear.removedLinks":
      "{active} активни свързани задачи; {count} връзки към премахнати задачи са запазени в историята.",
    "events.clear.already":
      "Събитието е архивирано. Задачите не могат да бъдат изчистени.",
    "events.clear.historyLoading": "Зареждане на запазената задача…",
    "events.clear.historyNotice":
      "Задачата е премахната от активните изгледи. Запазеният запис е само за четене. Настройките за напомняния са неактивни; няма възстановяване или редактиране.",
    "events.clear.historyMetadata":
      "Версия {version} · Премахната на {removed} от {actor}. Имената и текстът са от запазения текущ запис; липсващи минали състояния не се възстановяват.",
    "events.clear.historyResponsibility":
      "Отговорник: {assignee} · Приета: {accepted} · Срок: {deadline}",
    "events.clear.historyError":
      "Запазените данни за задачата не могат да бъдат заредени. Опитайте отново.",
    "events.clear.originalCount":
      "Първоначално прегледани задачи: {count}. Проверката използва запазения първоначален преглед.",
    "events.clear.referencesBound":
      "Показани са първите {count} запазени връзки. Всички връзки остават в историята.",
    "history.task.removed": "Задача е премахната от активния изглед",
    "history.event.tasksCleared": "Задачите на събитието са изчистени",
  };

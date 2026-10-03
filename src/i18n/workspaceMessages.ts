export const WORKSPACE_EN_MESSAGES = {
  "workspace.notice": "Server workspace",
  "workspace.source": "Dashboard · Tasks · Team: server data",
  "workspace.loading": "Loading the Event, tasks and team…",
  "workspace.error": "The workspace could not be loaded. Try again.",
  "workspace.stale":
    "The latest workspace data could not be confirmed. Refresh before relying on these summaries.",
  "workspace.forbidden":
    "You do not have access to this Event. Try again or contact the organizer.",
  "workspace.event.start": "Event starts",
  "workspace.event.end": "Event ends",
  "workspace.event.detailsUnavailable": "Additional Event details not recorded",
  "workspace.event.locationUnavailable": "Location not recorded",
  "workspace.changes.title": "No recorded change responses",
  "workspace.changes.description":
    "There are no saved Changes or Plan B responses for this Event.",
  "workspace.templates.title": "No saved templates",
  "workspace.templates.description":
    "Templates are not connected to this workspace.",
};
export const WORKSPACE_BG_MESSAGES = {
  "workspace.notice": "Данни от сървъра",
  "workspace.source": "Табло · Задачи · Екип: данни от сървъра",
  "workspace.loading": "Зареждане на събитието, задачите и екипа…",
  "workspace.error":
    "Работното пространство не можа да се зареди. Опитайте отново.",
  "workspace.stale":
    "Последните данни не можаха да се потвърдят. Обновете, преди да разчитате на тези обобщения.",
  "workspace.forbidden":
    "Нямате достъп до това събитие. Опитайте отново или се свържете с организатора.",
  "workspace.event.start": "Начало на събитието",
  "workspace.event.end": "Край на събитието",
  "workspace.event.detailsUnavailable":
    "Няма записани допълнителни данни за събитието",
  "workspace.event.locationUnavailable": "Няма записано място",
  "workspace.changes.title": "Няма записани реакции на промени",
  "workspace.changes.description":
    "За това събитие няма запазени промени или реакции по План Б.",
  "workspace.templates.title": "Няма запазени шаблони",
  "workspace.templates.description":
    "Шаблоните не са свързани с това работно пространство.",
} satisfies Record<keyof typeof WORKSPACE_EN_MESSAGES, string>;

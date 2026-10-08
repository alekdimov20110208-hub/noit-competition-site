export const NOTIFICATION_EN_MESSAGES = {
  "reminders.title": "Reminders",
  "reminders.day": "1 day before",
  "reminders.hour": "1 hour before",
  "reminders.minutes": "15 minutes before",
  "reminders.requiresTime": "Add a deadline time to use reminders.",
  "reminders.removeTime": "Removing the deadline time also clears reminders.",
  "reminders.error":
    "Choose up to three reminder presets and add a valid deadline time.",
  "notifications.title": "Notifications",
  "notifications.unread": "{count} unread",
  "notifications.unreadItem": "Unread",
  "notifications.readItem": "Read",
  "notifications.allRead": "Mark all as read",
  "notifications.empty": "No notifications for this event.",
  "notifications.assigned": "Assigned to you",
  "notifications.day": "Reminder · 1 day before",
  "notifications.hour": "Reminder · 1 hour before",
  "notifications.minutes": "Reminder · 15 minutes before",
  "notifications.due": "Due {deadline}",
  "notifications.loading": "Loading notifications…",
  "notifications.error": "Notifications could not be loaded. Try again.",
  "notifications.writeError": "Read state could not be saved. Try again.",
  "notifications.retry": "Refresh notifications",
  "notifications.close": "Close notifications",
} as const;
export const NOTIFICATION_BG_MESSAGES: Record<
  keyof typeof NOTIFICATION_EN_MESSAGES,
  string
> = {
  "reminders.title": "Напомняния",
  "reminders.day": "1 ден преди срока",
  "reminders.hour": "1 час преди срока",
  "reminders.minutes": "15 минути преди срока",
  "reminders.requiresTime":
    "Добавете час към срока, за да използвате напомняния.",
  "reminders.removeTime": "Премахването на часа изчиства и напомнянията.",
  "reminders.error":
    "Изберете до три напомняния и добавете валиден час към срока.",
  "notifications.title": "Известия",
  "notifications.unread": "Непрочетени известия: {count}",
  "notifications.unreadItem": "Непрочетено",
  "notifications.readItem": "Прочетено",
  "notifications.allRead": "Прочитане на всички",
  "notifications.empty": "Няма известия за това събитие.",
  "notifications.assigned": "Възложена на вас",
  "notifications.day": "Напомняне · 1 ден преди срока",
  "notifications.hour": "Напомняне · 1 час преди срока",
  "notifications.minutes": "Напомняне · 15 минути преди срока",
  "notifications.due": "Срок {deadline}",
  "notifications.loading": "Зареждане на известия…",
  "notifications.error":
    "Известията не могат да бъдат заредени. Опитайте отново.",
  "notifications.writeError": "Прочитането не е запазено. Опитайте отново.",
  "notifications.retry": "Обновяване на известията",
  "notifications.close": "Затваряне на известията",
};
export function reminderPresetKey(offset: number) {
  return offset === 1440
    ? "reminders.day"
    : offset === 60
      ? "reminders.hour"
      : "reminders.minutes";
}
export function reminderNotificationKey(offset: number) {
  return offset === 1440
    ? "notifications.day"
    : offset === 60
      ? "notifications.hour"
      : "notifications.minutes";
}

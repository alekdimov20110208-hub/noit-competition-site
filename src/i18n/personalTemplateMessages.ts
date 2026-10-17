export const PERSONAL_TEMPLATE_EN_MESSAGES = {
  "templates.t3.builtin": "Built-in",
  "templates.t3.mine": "My Templates",
  "templates.t3.private":
    "Private to your account. Saved versions remain reusable when source Tasks change.",
  "templates.t3.empty":
    "No saved templates yet. Choose an active Event where you are an Organizer to save its Tasks.",
  "templates.t3.saveFrom": "Save Tasks from this Event as a template",
  "templates.t3.chooseEvent":
    "Choose an active Organizer Event to save a template. Ownership of a template never grants Event access.",
  "templates.t3.loading": "Loading templates…",
  "templates.t3.retry": "Retry",
  "templates.t3.more": "Load more",
  "templates.t3.back": "Back to My Templates",
  "templates.t3.source": "Select source Tasks (up to 50)",
  "templates.t3.noTasks": "This Event has no available Tasks.",
  "templates.t3.review": "Review reusable content",
  "templates.t3.name": "Template name",
  "templates.t3.description": "Template description (optional)",
  "templates.t3.title": "Reviewed Task title",
  "templates.t3.category": "Category",
  "templates.t3.priority": "Priority",
  "templates.t3.context": "Reusable Task description (optional)",
  "templates.t3.sensitive":
    "Descriptions start empty. Review titles and descriptions for names, contacts and Event-specific decisions. Automatic personal-data detection is not provided.",
  "templates.t3.original": "Review original description",
  "templates.t3.include": "Include this description for editing",
  "templates.t3.includeConfirm":
    "I reviewed this description and choose to include the edited text.",
  "templates.t3.offset":
    "{days} calendar days from Event start · local time: {time}",
  "templates.t3.confirm":
    "I reviewed all selected reusable content and approve saving a private template.",
  "templates.t3.save": "Save private template",
  "templates.t3.saving": "Saving…",
  "templates.t3.saved":
    "Template saved in your private library. No source Tasks were changed.",
  "templates.t3.open": "Open template",
  "templates.t3.count": "{count} reusable Tasks · version {version}",
  "templates.t3.select": "Select template items to reuse",
  "templates.t3.uncertain":
    "Save is not confirmed. The original request and key are retained in this browser tab. Retry it to recover the durable result; do not start another Save.",
  "templates.t3.recover": "Recover original Save",
  "templates.t3.error.unavailable":
    "The private library could not be loaded. Retry when the backend is available.",
  "templates.t3.error.uncertain":
    "The backend result is unknown. Recover the same Save request.",
  "templates.t3.error.conflict":
    "Source Event or Tasks changed. Load the source again and review the current content.",
  "templates.t3.error.forbidden":
    "An active Organizer membership in an active Event is required.",
  "templates.t3.error.invalid":
    "The content or server response is invalid. Check the fields and reload the source.",
  "templates.t3.error.key-reused":
    "This operation key is bound to a different request. Saving is blocked; keep the operation ID for investigation.",
  "templates.t3.error.unauthenticated": "Your session ended. Sign in again.",
} as const;
export const PERSONAL_TEMPLATE_BG_MESSAGES: Record<
  keyof typeof PERSONAL_TEMPLATE_EN_MESSAGES,
  string
> = {
  "templates.t3.builtin": "Вградени",
  "templates.t3.mine": "Моите шаблони",
  "templates.t3.private":
    "Частни за Вашия профил. Запазените версии могат да се използват и след промяна на изходните задачи.",
  "templates.t3.empty":
    "Все още нямате запазени шаблони. Изберете активно събитие, в което сте организатор, за да запазите негови задачи.",
  "templates.t3.saveFrom": "Запазване на задачи от това събитие като шаблон",
  "templates.t3.chooseEvent":
    "Изберете активно събитие, в което сте организатор. Собствеността върху шаблон не дава достъп до събития.",
  "templates.t3.loading": "Зареждане на шаблони…",
  "templates.t3.retry": "Нов опит",
  "templates.t3.more": "Зареждане на още",
  "templates.t3.back": "Към моите шаблони",
  "templates.t3.source": "Изберете изходни задачи (до 50)",
  "templates.t3.noTasks": "Няма налични задачи в това събитие.",
  "templates.t3.review": "Преглед на съдържанието за повторна употреба",
  "templates.t3.name": "Име на шаблона",
  "templates.t3.description": "Описание на шаблона (незадължително)",
  "templates.t3.title": "Прегледано заглавие на задачата",
  "templates.t3.category": "Категория",
  "templates.t3.priority": "Приоритет",
  "templates.t3.context": "Описание за повторна употреба (незадължително)",
  "templates.t3.sensitive":
    "Описанията започват празни. Проверете заглавията и описанията за имена, контакти и решения за конкретното събитие. Няма автоматично откриване на лични данни.",
  "templates.t3.original": "Преглед на оригиналното описание",
  "templates.t3.include": "Включване на описанието за редактиране",
  "templates.t3.includeConfirm":
    "Прегледах описанието и избирам да включа редактирания текст.",
  "templates.t3.offset":
    "{days} календарни дни от началото · местен час: {time}",
  "templates.t3.confirm":
    "Прегледах избраното съдържание и потвърждавам запазването на частен шаблон.",
  "templates.t3.save": "Запазване на частен шаблон",
  "templates.t3.saving": "Запазване…",
  "templates.t3.saved":
    "Шаблонът е запазен в частната Ви библиотека. Изходните задачи не са променени.",
  "templates.t3.open": "Отваряне на шаблона",
  "templates.t3.count":
    "{count} задачи за повторна употреба · версия {version}",
  "templates.t3.select": "Изберете елементи за повторна употреба",
  "templates.t3.uncertain":
    "Запазването не е потвърдено. Оригиналната заявка и ключът се пазят в този раздел на браузъра. Повторете я за проверка на резултата; не започвайте ново запазване.",
  "templates.t3.recover": "Проверка на оригиналното запазване",
  "templates.t3.error.unavailable":
    "Частната библиотека не може да бъде заредена. Опитайте отново при достъпен сървър.",
  "templates.t3.error.uncertain":
    "Резултатът от сървъра е неизвестен. Проверете същата заявка за запазване.",
  "templates.t3.error.conflict":
    "Събитието или задачите са променени. Заредете източника отново и прегледайте актуалното съдържание.",
  "templates.t3.error.forbidden":
    "Необходимо е активно членство като организатор в активно събитие.",
  "templates.t3.error.invalid":
    "Съдържанието или отговорът е невалиден. Проверете полетата и заредете източника отново.",
  "templates.t3.error.key-reused":
    "Този ключ е обвързан с друга заявка. Запазването е блокирано; запазете номера на операцията за проверка.",
  "templates.t3.error.unauthenticated":
    "Сесията Ви е приключила. Влезте отново.",
};

export const EVENT_EN_MESSAGES = {
  "events.switch": "Switch event",
  "events.none": "No events yet",
  "events.choose": "Choose an event",
  "events.loading": "Loading events…",
  "events.create": "Create event",
  "events.edit": "Edit event",
  "events.create.description":
    "Set the event basics. You will be its Organizer.",
  "events.edit.description": "Update this event’s name, dates and timezone.",
  "events.empty.description":
    "Create your first event to open its Dashboard, Tasks and Team.",
  "events.name": "Event name",
  "events.startDate": "Start date",
  "events.endDate": "End date",
  "events.timezone": "Timezone",
  "events.timezone.help":
    "Choose the region or city where the event takes place. Dates follow this timezone.",
  "events.name.help": "Up to 200 characters.",
  "events.save": "Save event",
  "events.pending": "Saving event…",
  "events.fresh":
    "This event starts with your Organizer membership and no tasks. Task authoring is not yet available.",
  "events.validation.name": "Enter an event name of 1–200 characters.",
  "events.validation.date": "Enter a valid calendar date (YYYY-MM-DD).",
  "events.validation.dateOrder": "End date must be on or after the start date.",
  "events.validation.timezone":
    "Choose a valid timezone, such as Europe/Sofia.",
  "events.error.invalid": "Check the event fields and try again.",
  "events.error.unauthenticated": "Your session expired. Sign in again.",
  "events.error.forbidden":
    "You cannot edit this event. Only its Organizers can change these details.",
  "events.error.not-found": "This event is not available to you.",
  "events.error.unavailable":
    "The event could not be saved. Check your connection and try again.",
  "events.error.conflict":
    "Event details changed elsewhere. The latest details are now shown. Review them and save again explicitly.",
  "events.error.conflictRefresh":
    "Event details changed elsewhere. Load the latest details before saving again.",
  "events.reload": "Load latest details",
  "events.permission": "Only an Organizer of this event can edit its details.",
};

export const EVENT_BG_MESSAGES = {
  "events.switch": "Смяна на събитие",
  "events.none": "Все още няма събития",
  "events.choose": "Изберете събитие",
  "events.loading": "Зареждане на събития…",
  "events.create": "Създаване на събитие",
  "events.edit": "Редактиране на събитието",
  "events.create.description":
    "Въведете основните данни. Ще бъдете организатор на събитието.",
  "events.edit.description":
    "Променете името, датите и часовата зона на това събитие.",
  "events.empty.description":
    "Създайте първото си събитие, за да отворите неговото табло, задачи и екип.",
  "events.name": "Име на събитието",
  "events.startDate": "Начална дата",
  "events.endDate": "Крайна дата",
  "events.timezone": "Часова зона",
  "events.timezone.help":
    "Изберете региона или града, където ще се проведе събитието. Датите следват тази часова зона.",
  "events.name.help": "До 200 знака.",
  "events.save": "Запазване на събитието",
  "events.pending": "Запазване на събитието…",
  "events.fresh":
    "Новото събитие започва с вашето членство като организатор и без задачи. Създаването на задачи все още не е налично.",
  "events.validation.name": "Въведете име на събитието от 1 до 200 знака.",
  "events.validation.date": "Въведете валидна календарна дата (ГГГГ-ММ-ДД).",
  "events.validation.dateOrder":
    "Крайната дата трябва да е на или след началната.",
  "events.validation.timezone":
    "Изберете валидна часова зона, например Europe/Sofia.",
  "events.error.invalid": "Проверете полетата и опитайте отново.",
  "events.error.unauthenticated": "Сесията ви изтече. Влезте отново.",
  "events.error.forbidden":
    "Не можете да редактирате това събитие. Само неговите организатори могат да променят тези данни.",
  "events.error.not-found": "Това събитие не е достъпно за вас.",
  "events.error.unavailable":
    "Събитието не можа да се запази. Проверете връзката си и опитайте отново.",
  "events.error.conflict":
    "Данните за събитието са променени другаде. Показани са последните данни. Прегледайте ги и запазете отново изрично.",
  "events.error.conflictRefresh":
    "Данните за събитието са променени другаде. Заредете последните данни, преди да запазите отново.",
  "events.reload": "Зареждане на последните данни",
  "events.permission":
    "Само организатор на това събитие може да редактира данните му.",
} satisfies Record<keyof typeof EVENT_EN_MESSAGES, string>;

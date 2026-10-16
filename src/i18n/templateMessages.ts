export const TEMPLATE_EN_MESSAGES = {
  "templates.t1.eyebrow": "Event templates · T1",
  "templates.t1.description":
    "Choose a starter checklist and preview its deadlines for your Event.",
  "templates.t1.curated": "Curated starter · v{version}",
  "templates.t1.seminar.title": "International Aikido seminar",
  "templates.t1.seminar.description":
    "A focused starting point for welcoming a guest instructor and preparing the first training day. Adapt the suggested dates and times to the actual travel and seminar programme before future application.",
  "templates.t1.scope":
    "Preview only. Selection stays on this page and resets when you leave or switch Events. No Tasks are created and no template is saved.",
  "templates.t1.event": "Deadline preview for",
  "templates.t1.start": "Event starts {date} · {timezone}",
  "templates.t1.organizer": "Organizer · preview only",
  "templates.t1.member":
    "Member · you can explore this preview. Task creation requires an Organizer in a later stage.",
  "templates.t1.archived":
    "Archived Event · preview only. Tasks cannot be added to an archived Event.",
  "templates.t1.noEvent":
    "No accessible Event selected. You can explore and select items; actual dates need an accessible Event with a start date.",
  "templates.t1.loading":
    "Loading authorized Event context. Actual dates will appear after it is verified.",
  "templates.t1.error":
    "Event context could not be verified. Actual dates are hidden; you can still explore the starter.",
  "templates.t1.denied":
    "This Event is unavailable or access is denied. Actual dates are hidden. Choose an accessible Event from Event Management.",
  "templates.t1.manage": "Event Management",
  "templates.t1.retry": "Retry Event read",
  "templates.t1.items": "Choose checklist items",
  "templates.t1.selected": "{selected} of {total} items selected",
  "templates.t1.all": "Select all",
  "templates.t1.none": "Deselect all",
  "templates.t1.empty":
    "No items selected. Select an item to include it in your proposed checklist.",
  "templates.t1.deadline": "Proposed deadline",
  "templates.t1.needsEvent": "Select an accessible Event to resolve the date",
  "templates.t1.invalidDate":
    "Cannot resolve this deadline: the Event date or resulting date is invalid.",
  "templates.t1.before.one": "{count} calendar day before Event start",
  "templates.t1.before.other": "{count} calendar days before Event start",
  "templates.t1.after.one": "{count} calendar day after Event start",
  "templates.t1.after.other": "{count} calendar days after Event start",
  "templates.t1.dayZero": "On the Event start date",
  "templates.t1.dateOnly": "Date only · no time set",
  "templates.t1.localTime": "Suggested local time: {time}",
  "templates.t1.reminders": "No reminders",
  "templates.t1.next":
    "Applying this checklist comes in Stage T2. This stage only previews your selection.",
  "templates.t1.category.team": "Team coordination",
  "templates.t1.category.transport": "Transport",
  "templates.t1.category.accommodation": "Accommodation",
  "templates.t1.category.training": "Training preparation",
  "templates.t1.team.title": "Coordinate the organizing team",
  "templates.t1.team.context":
    "Review the programme, responsibilities and contact chain with the team. Agree who coordinates travel, accommodation and the dojo.",
  "templates.t1.pickup.title": "Pick up the instructor at the airport",
  "templates.t1.pickup.context":
    "Confirm the flight, meeting point, driver and contact number. The day before the seminar is a starting suggestion; use the actual arrival schedule. No pickup time is assumed.",
  "templates.t1.hotel.title": "Coordinate hotel check-in",
  "templates.t1.hotel.context":
    "Confirm the booking and reception arrangements for the guest instructor. Check the hotel's actual check-in time and coordinate the transfer from the airport.",
  "templates.t1.training.title": "Prepare the first training session",
  "templates.t1.training.context":
    "Check dojo access, tatami, changing areas and the agreed equipment before participants arrive. Adjust the suggested time to the first session.",
} as const;

export const TEMPLATE_BG_MESSAGES: Record<
  keyof typeof TEMPLATE_EN_MESSAGES,
  string
> = {
  "templates.t1.eyebrow": "Шаблони за събития · T1",
  "templates.t1.description":
    "Изберете начален списък със задачи и прегледайте сроковете за вашето събитие.",
  "templates.t1.curated": "Подготвен начален шаблон · v{version}",
  "templates.t1.seminar.title": "Международен семинар по айкидо",
  "templates.t1.seminar.description":
    "Начална подготовка за посрещане на гост-инструктор и първия тренировъчен ден. Преди бъдещо прилагане съобразете предложените дати и часове с пътуването и действителната програма.",
  "templates.t1.scope":
    "Само преглед. Изборът остава на тази страница и се нулира при напускане или смяна на събитието. Не се създават задачи и не се запазва шаблон.",
  "templates.t1.event": "Преглед на сроковете за",
  "templates.t1.start": "Начало: {date} · {timezone}",
  "templates.t1.organizer": "Организатор · само преглед",
  "templates.t1.member":
    "Участник · можете да разглеждате този преглед. Създаването на задачи ще изисква организатор в следващ етап.",
  "templates.t1.archived":
    "Архивирано събитие · само преглед. В архивирано събитие не могат да се добавят задачи.",
  "templates.t1.noEvent":
    "Няма избрано достъпно събитие. Можете да разглеждате и избирате елементи; конкретните дати изискват достъпно събитие с начална дата.",
  "templates.t1.loading":
    "Зарежда се разрешеният контекст на събитието. Конкретните дати ще се покажат след проверката му.",
  "templates.t1.error":
    "Контекстът на събитието не може да бъде проверен. Конкретните дати са скрити; началният шаблон остава достъпен за преглед.",
  "templates.t1.denied":
    "Събитието е недостъпно или достъпът е отказан. Конкретните дати са скрити. Изберете достъпно събитие от управлението на събития.",
  "templates.t1.manage": "Управление на събития",
  "templates.t1.retry": "Повторно зареждане на събитието",
  "templates.t1.items": "Изберете задачи от списъка",
  "templates.t1.selected": "Избрани: {selected} от {total}",
  "templates.t1.all": "Избиране на всички",
  "templates.t1.none": "Премахване на избора",
  "templates.t1.empty":
    "Няма избрани елементи. Изберете елемент, за да го включите в предложения списък.",
  "templates.t1.deadline": "Предложен срок",
  "templates.t1.needsEvent":
    "Изберете достъпно събитие за изчисляване на датата",
  "templates.t1.invalidDate":
    "Срокът не може да се изчисли: началната или получената дата е невалидна.",
  "templates.t1.before.one": "{count} календарен ден преди началото",
  "templates.t1.before.other": "{count} календарни дни преди началото",
  "templates.t1.after.one": "{count} календарен ден след началото",
  "templates.t1.after.other": "{count} календарни дни след началото",
  "templates.t1.dayZero": "В началния ден на събитието",
  "templates.t1.dateOnly": "Само дата · без зададен час",
  "templates.t1.localTime": "Предложен местен час: {time}",
  "templates.t1.reminders": "Без напомняния",
  "templates.t1.next":
    "Прилагането на този списък предстои в етап T2. Този етап показва само преглед на избора.",
  "templates.t1.category.team": "Координация на екипа",
  "templates.t1.category.transport": "Транспорт",
  "templates.t1.category.accommodation": "Настаняване",
  "templates.t1.category.training": "Подготовка на тренировката",
  "templates.t1.team.title": "Координиране на организаторския екип",
  "templates.t1.team.context":
    "Прегледайте програмата, отговорностите и реда за връзка с екипа. Уточнете кой координира пътуването, настаняването и залата.",
  "templates.t1.pickup.title": "Посрещане на инструктора на летището",
  "templates.t1.pickup.context":
    "Потвърдете полета, мястото за среща, шофьора и телефона за връзка. Денят преди семинара е начално предложение; съобразете го с пристигането. Не се предполага час за посрещане.",
  "templates.t1.hotel.title": "Координиране на настаняването в хотела",
  "templates.t1.hotel.context":
    "Потвърдете резервацията и посрещането на гост-инструктора на рецепцията. Проверете действителния час за настаняване и съгласувайте трансфера от летището.",
  "templates.t1.training.title": "Подготовка на първата тренировка",
  "templates.t1.training.context":
    "Проверете достъпа до залата, татамито, съблекалните и уговореното оборудване преди пристигането на участниците. Съобразете предложения час с първата тренировка.",
};

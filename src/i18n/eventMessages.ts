export const EVENT_EN_MESSAGES = {
  "events.archive": "Archive event",
  "events.archive.danger": "Danger zone",
  "events.archive.description":
    "Archiving makes this event read-only and stops reminders. Tasks, Team, Changes, invitations, notifications and History are preserved. This action cannot be undone here.",
  "events.archive.confirmation": "Type the event name to confirm",
  "events.archive.exact":
    "Match the displayed name exactly, including case and spaces.",
  "events.archive.pending": "Archiving…",
  "events.archive.invalid":
    "The confirmation must match the current event name exactly.",
  "events.archive.permission":
    "Your session or event access changed. Archiving is unavailable.",
  "events.archive.conflict":
    "The event changed. Load its current details, review them and type its name again before confirming.",
  "events.archive.reload": "Load current event details",
  "events.archive.unavailable":
    "The event could not be prepared for archiving. Return to Event Management and refresh its details.",
  "events.archive.uncertain":
    "Archiving may already have completed. Recover this same request to confirm its result; do not start another archive action.",
  "events.archive.recover": "Recover archive result",
  "events.archive.recoveryNotice":
    "An archive result for “{name}” needs confirmation.",
  "events.archive.already":
    "This event is already archived and remains read-only.",
  "events.archive.success":
    "“{name}” is archived. Open Archived to view its preserved workspace and History.",
  "events.archive.refreshFailed":
    "“{name}” is archived. The list could not be refreshed; reload Event Management to view it.",
  "history.event.archived": "Event archived",
  "events.archive.historical":
    "Historical workspace: this event is archived and read-only. Its records and History are preserved.",
  "events.duplicate": "Duplicate event",
  "events.duplicate.description":
    "Review the basics for a new independent event.",
  "events.duplicate.suffix": " (copy)",
  "events.duplicate.source": "Source event: {name}",
  "events.duplicate.boundary":
    "Copies event basics only. Tasks and team access are not copied.",
  "events.duplicate.dates":
    "Choose start and end dates for the new event. Source dates are not filled in.",
  "events.duplicate.permission":
    "Only an Organizer of the source event can duplicate it.",
  "events.duplicate.retry": "Retry this duplication",
  "events.duplicate.conflict":
    "The source event changed. Its latest version has been loaded. Review your new event details and submit again explicitly.",
  "events.duplicate.uncertain":
    "This duplication may already have completed. Retry the same request to recover its result. Its reviewed fields are held until the result is confirmed.",
  "events.duplicate.keyReused":
    "This request identity was already used with different details. No new duplication was performed.",
  "history.present": "Text present",
  "history.absent": "No text",
  "history.field.status": "Status",
  "history.task.reassigned": "Task reassigned",
  "history.target.record": "Related record",
  "history.title": "Event history",
  "history.order": "Newest recorded actions first. Times use {timezone}.",
  "history.scope":
    "This is the recorded operational history, not a complete audit of every past action. Actor names and related titles are current; full past Decision, Response and Plan B text is not retained.",
  "history.loading": "Loading history…",
  "history.error":
    "History could not be loaded. Retry to read the latest records.",
  "history.empty": "No recorded actions",
  "history.empty.description":
    "No operational history has been recorded for this event.",
  "history.count": "Loaded records: {count}",
  "history.older": "Load older records",
  "history.refresh": "Refresh history",
  "history.actor": "By {actor}",
  "history.version": "Recorded version: {version}",
  "history.versions": "Recorded versions: {previous} → {version}",
  "history.fields": "Changed fields: {fields}",
  "history.unknown": "Recorded action: {action}",
  "history.event.created": "Event created",
  "history.event.updated": "Event details updated",
  "history.task.created": "Task created",
  "history.task.updated": "Task details updated",
  "history.task.assigned": "Task assigned",
  "history.task.unassigned": "Task assignment removed",
  "history.task.accepted": "Task responsibility accepted",
  "history.task.withdrawn": "Task acceptance withdrawn",
  "history.task.status": "Task status changed",
  "history.change.created": "Change recorded",
  "history.change.updated": "Change updated",
  "history.invitation.created": "Invitation created",
  "history.invitation.revoked": "Invitation revoked",
  "history.invitation.accepted": "Invitation accepted",
  "history.target.task": "Task",
  "history.target.change": "Change",
  "history.target.event": "Event",
  "history.target.invitation": "Invitation",
  "history.field.title": "Title",
  "history.field.category": "Category",
  "history.field.context": "Context",
  "history.field.deadline": "Due date",
  "history.field.time": "Due time",
  "history.field.priority": "Priority",
  "history.field.reminders": "Reminders",
  "history.field.assignee": "Assignee",
  "history.field.owner": "Response owner",
  "history.field.tasks": "Affected tasks",
  "history.field.decision": "Decision",
  "history.field.response": "Response",
  "history.field.planB": "Plan B",
  "events.manage": "Manage",
  "events.backToManagement": "Back to Event Management",
  "events.details": "Event details",
  "events.required": "All four fields are required.",
  "events.schedule": "Dates and timezone",
  "events.dates.help":
    "Choose the first and last calendar day of the event. A one-day event uses the same date twice.",
  "events.management.title": "Event Management",
  "events.management.description":
    "Open and manage the events you have access to.",
  "events.filter": "Event status",
  "events.active": "Active",
  "events.archived": "Archived",
  "events.search": "Search by event name",
  "events.accessRole": "Your access role",
  "events.role.organizer": "Organizer",
  "events.role.member": "Member",
  "events.open": "Open event",
  "events.openArchived": "Open archived workspace",
  "events.list.error":
    "Events could not be loaded. Check your connection and try again.",
  "events.list.count": "Events: {count}",
  "events.filtered.empty": "No matching events",
  "events.filtered.description":
    "Try another name or change the status filter.",
  "events.active.empty": "No active events",
  "events.active.description":
    "Create an event or select Archived to view historical workspaces.",
  "events.archived.empty": "No archived events",
  "events.archived.description":
    "Archived events you have access to will appear here.",
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
    "Choose the region or city where the event takes place. Task due times and reminders use this timezone; calendar dates do not shift.",
  "events.name.help": "Up to 200 characters.",
  "events.save": "Save event",
  "events.pending": "Saving event…",
  "events.fresh":
    "This event starts with your Organizer membership and no tasks. After creating it, add tasks from Tasks.",
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
  "events.archive": "Архивиране на събитието",
  "events.archive.danger": "Опасни действия",
  "events.archive.description":
    "Архивирането прави събитието достъпно само за преглед и спира напомнянията. Задачите, екипът, промените, поканите, известията и историята се запазват. Тук няма възстановяване на активно събитие.",
  "events.archive.confirmation": "Въведете името на събитието за потвърждение",
  "events.archive.exact":
    "Спазете точно показаното име, включително главни букви и интервали.",
  "events.archive.pending": "Архивиране…",
  "events.archive.invalid":
    "Потвърждението трябва да съвпада точно с текущото име на събитието.",
  "events.archive.permission":
    "Сесията или достъпът ви до събитието са променени. Архивирането е недостъпно.",
  "events.archive.conflict":
    "Събитието е променено. Заредете текущите данни, прегледайте ги и въведете името отново преди потвърждение.",
  "events.archive.reload": "Зареждане на текущите данни",
  "events.archive.unavailable":
    "Събитието не може да бъде подготвено за архивиране. Върнете се в управлението и обновете данните.",
  "events.archive.uncertain":
    "Архивирането може вече да е завършило. Проверете резултата със същата заявка; не започвайте друго архивиране.",
  "events.archive.recover": "Проверка на резултата",
  "events.archive.recoveryNotice":
    "Резултатът от архивирането на „{name}“ изисква проверка.",
  "events.archive.already":
    "Събитието вече е архивирано и остава достъпно само за преглед.",
  "events.archive.success":
    "„{name}“ е архивирано. Отворете „Архивирани“ за запазеното работно пространство и историята.",
  "events.archive.refreshFailed":
    "„{name}“ е архивирано. Списъкът не е обновен; презаредете управлението, за да го видите.",
  "history.event.archived": "Събитието е архивирано",
  "events.archive.historical":
    "Историческо работно пространство: събитието е архивирано и достъпно само за преглед. Записите и историята са запазени.",
  "events.duplicate": "Дублиране на събитие",
  "events.duplicate.description":
    "Прегледайте основните данни за ново независимо събитие.",
  "events.duplicate.suffix": " (копие)",
  "events.duplicate.source": "Изходно събитие: {name}",
  "events.duplicate.boundary":
    "Копират се само основните данни. Задачите и достъпът на екипа не се копират.",
  "events.duplicate.dates":
    "Изберете начална и крайна дата за новото събитие. Датите на източника не се попълват.",
  "events.duplicate.permission":
    "Само Организатор на изходното събитие може да го дублира.",
  "events.duplicate.retry": "Повторен опит за това дублиране",
  "events.duplicate.conflict":
    "Изходното събитие е променено. Заредена е последната му версия. Прегледайте данните за новото събитие и потвърдете отново.",
  "events.duplicate.uncertain":
    "Дублирането може вече да е завършило. Повторете същата заявка, за да получите резултата. Прегледаните полета се запазват до потвърждаването му.",
  "events.duplicate.keyReused":
    "Идентификаторът на заявката вече е използван с други данни. Не е извършено ново дублиране.",
  "history.present": "Има текст",
  "history.absent": "Няма текст",
  "history.field.status": "Статус",
  "history.task.reassigned": "Превъзложена задача",
  "history.target.record": "Свързан запис",
  "history.title": "История на събитието",
  "history.order":
    "Последните записани действия са първи. Часовете са в {timezone}.",
  "history.scope":
    "Това е записаната оперативна история, а не пълен одит на всички минали действия. Имената на авторите и заглавията са текущите; пълните минали текстове на Решение, Реакция и План Б не се пазят.",
  "history.loading": "Зареждане на историята…",
  "history.error":
    "Историята не можа да се зареди. Опитайте отново, за да прочетете последните записи.",
  "history.empty": "Няма записани действия",
  "history.empty.description":
    "За това събитие няма записана оперативна история.",
  "history.count": "Заредени записи: {count}",
  "history.older": "Зареждане на по-стари записи",
  "history.refresh": "Обновяване на историята",
  "history.actor": "Автор: {actor}",
  "history.version": "Записана версия: {version}",
  "history.versions": "Записани версии: {previous} → {version}",
  "history.fields": "Променени полета: {fields}",
  "history.unknown": "Записано действие: {action}",
  "history.event.created": "Създадено събитие",
  "history.event.updated": "Променени данни за събитието",
  "history.task.created": "Създадена задача",
  "history.task.updated": "Променени данни за задача",
  "history.task.assigned": "Възложена задача",
  "history.task.unassigned": "Премахнато възлагане на задача",
  "history.task.accepted": "Приета отговорност за задача",
  "history.task.withdrawn": "Оттеглено приемане на задача",
  "history.task.status": "Променен статус на задача",
  "history.change.created": "Записана промяна",
  "history.change.updated": "Редактирана промяна",
  "history.invitation.created": "Създадена покана",
  "history.invitation.revoked": "Оттеглена покана",
  "history.invitation.accepted": "Приета покана",
  "history.target.task": "Задача",
  "history.target.change": "Промяна",
  "history.target.event": "Събитие",
  "history.target.invitation": "Покана",
  "history.field.title": "Заглавие",
  "history.field.category": "Категория",
  "history.field.context": "Контекст",
  "history.field.deadline": "Краен срок",
  "history.field.time": "Час на крайния срок",
  "history.field.priority": "Приоритет",
  "history.field.reminders": "Напомняния",
  "history.field.assignee": "Отговорник",
  "history.field.owner": "Отговорник за реакцията",
  "history.field.tasks": "Засегнати задачи",
  "history.field.decision": "Решение",
  "history.field.response": "Реакция",
  "history.field.planB": "План Б",
  "events.manage": "Управление",
  "events.backToManagement": "Към управление на събития",
  "events.details": "Данни за събитието",
  "events.required": "И четирите полета са задължителни.",
  "events.schedule": "Дати и часова зона",
  "events.dates.help":
    "Изберете първия и последния календарен ден на събитието. За еднодневно събитие въведете една и съща дата.",
  "events.management.title": "Управление на събития",
  "events.management.description":
    "Отваряйте и управлявайте събитията, до които имате достъп.",
  "events.filter": "Състояние на събитията",
  "events.active": "Активни",
  "events.archived": "Архивирани",
  "events.search": "Търсене по име на събитие",
  "events.accessRole": "Вашата роля за достъп",
  "events.role.organizer": "Организатор",
  "events.role.member": "Член",
  "events.open": "Отваряне на събитието",
  "events.openArchived": "Отваряне на архивираното събитие",
  "events.list.error":
    "Събитията не можаха да се заредят. Проверете връзката си и опитайте отново.",
  "events.list.count": "Събития: {count}",
  "events.filtered.empty": "Няма съвпадащи събития",
  "events.filtered.description":
    "Опитайте друго име или променете филтъра за състояние.",
  "events.active.empty": "Няма активни събития",
  "events.active.description":
    "Създайте събитие или изберете „Архивирани“, за да отворите минали събития.",
  "events.archived.empty": "Няма архивирани събития",
  "events.archived.description":
    "Тук ще се показват архивираните събития, до които имате достъп.",
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
    "Изберете региона или града, където ще се проведе събитието. Часовете за задачи и напомнянията използват тази зона; календарните дати не се изместват.",
  "events.name.help": "До 200 знака.",
  "events.save": "Запазване на събитието",
  "events.pending": "Запазване на събитието…",
  "events.fresh":
    "Новото събитие започва с вашето членство като организатор и без задачи. След създаването му можете да добавяте задачи от „Задачи“.",
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

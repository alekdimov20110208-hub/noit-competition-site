export const TEMPLATE_APPLICATION_EN_MESSAGES = {
  "templates.t2.heading": "Review and apply selected items",
  "templates.t2.scope":
    "Selection is temporary. Review the server's proposed Tasks below before confirming. Applying adds Tasks to this Event; it does not save a personal template.",
  "templates.t2.member":
    "Member · server review is available. Applying requires an active Organizer.",
  "templates.t2.organizer": "Organizer · review and confirm before applying",
  "templates.t2.adds":
    "Application adds new Tasks. Existing Tasks are never replaced, merged or deleted. A new confirmed application can create duplicates.",
  "templates.t2.needsEvent":
    "An accessible Event is required for server review.",
  "templates.t2.review": "Review selected items",
  "templates.t2.reviewing": "Loading server review…",
  "templates.t2.duplicates":
    "Existing active Tasks with matching names in this review language: {count}. They remain unchanged; review possible duplicates before adding Tasks.",
  "templates.t2.initial":
    "Unassigned · unaccepted · not started · no reminders",
  "templates.t2.localTime": "Time is local to this Event",
  "templates.t2.changed":
    "Selection, language or Event context changed. Request a new review before confirming.",
  "templates.t2.readOnly":
    "This is a read-only review. Only an active Organizer can apply to an active Event.",
  "templates.t2.confirm":
    "I confirm adding {count} new Tasks to {name} with the exact fields shown above.",
  "templates.t2.apply": "Confirm and add Tasks",
  "templates.t2.applying": "Confirming operation…",
  "templates.t2.recovery":
    "An application attempt is held for recovery. Retry this same operation to retrieve its accepted result or complete it once. Changing the selection cannot change this held request. Do not start another application in a different tab while recovery is pending.",
  "templates.t2.recover": "Recover the same operation",
  "templates.t2.operation": "Operation: {id}",
  "templates.t2.accepted": "Application confirmed by the server",
  "templates.t2.success":
    "Created Tasks: {count}. The server confirmed this operation; retries reuse its original result.",
  "templates.t2.openTasks": "Open Event Tasks",
  "templates.t2.openCreated": "Open created Task {number}",
  "templates.t2.new": "Start a separate application",
  "templates.t2.refresh": "Refresh Event data",
  "templates.t2.refreshFailed":
    "Creation is confirmed, but the current workspace could not be refreshed. Refresh before continuing.",
  "templates.t2.error.invalid":
    "The review or request could not be validated. No success is assumed. If an operation is held, preserve its key and recover it after the problem is resolved.",
  "templates.t2.error.unauthenticated":
    "Your session expired. Sign in again to recover any held operation.",
  "templates.t2.error.forbidden":
    "Current Organizer permission is required. A held operation remains recoverable with the same key once access is restored.",
  "templates.t2.error.archived":
    "The Event is archived. Application and recovery are blocked; no new Tasks were added by this request.",
  "templates.t2.error.unavailable":
    "Server review or application is unavailable, or Event access changed. T2 may require backend activation. No persistence is assumed; a held operation keeps its key.",
  "templates.t2.error.conflict":
    "The reviewed Event, template or matching Task set changed. This request was rejected. Request a fresh review and explicitly confirm a new attempt.",
  "templates.t2.error.key-reused":
    "This operation key belongs to a different request. Application is blocked. Preserve the key for investigation; no new key will be generated automatically.",
  "templates.t2.error.uncertain":
    "The outcome is uncertain. The request may have committed. Recover the same operation; do not create a new attempt.",
  "history.template.applied": "Template applied",
  "history.template.origin":
    "Template {template} v{version} · operation {operation}",
} as const;
export const TEMPLATE_APPLICATION_BG_MESSAGES: Record<
  keyof typeof TEMPLATE_APPLICATION_EN_MESSAGES,
  string
> = {
  "templates.t2.heading": "Преглед и прилагане на избраните елементи",
  "templates.t2.scope":
    "Изборът е временен. Прегледайте предложените от сървъра задачи по-долу, преди да потвърдите. Прилагането добавя задачи към това събитие; не запазва личен шаблон.",
  "templates.t2.member":
    "Участник · сървърният преглед е достъпен. Прилагането изисква активен организатор.",
  "templates.t2.organizer":
    "Организатор · прегледайте и потвърдете преди прилагане",
  "templates.t2.adds":
    "Прилагането добавя нови задачи. Съществуващите задачи не се заменят, сливат или изтриват. Ново потвърдено прилагане може да създаде дубликати.",
  "templates.t2.needsEvent": "Сървърният преглед изисква достъпно събитие.",
  "templates.t2.review": "Преглед на избраните",
  "templates.t2.reviewing": "Зареждане на сървърния преглед…",
  "templates.t2.duplicates":
    "Съществуващи активни задачи със съвпадащи имена на езика на прегледа: {count}. Те остават непроменени; проверете възможните дубликати преди добавяне.",
  "templates.t2.initial":
    "Без отговорник · неприета · незапочната · без напомняния",
  "templates.t2.localTime": "Часът е местен за това събитие",
  "templates.t2.changed":
    "Изборът, езикът или контекстът на събитието е променен. Поискайте нов преглед преди потвърждение.",
  "templates.t2.readOnly":
    "Този преглед е само за четене. Само активен организатор може да прилага към активно събитие.",
  "templates.t2.confirm":
    "Потвърждавам добавянето на {count} нови задачи към {name} с точно показаните по-горе полета.",
  "templates.t2.apply": "Потвърждаване и добавяне на задачи",
  "templates.t2.applying": "Потвърждаване на операцията…",
  "templates.t2.recovery":
    "Има запазен опит за възстановяване на резултата. Повторете същата операция, за да получите приетия резултат или да я завършите еднократно. Промяната на избора не променя задържаната заявка. Не започвайте друго прилагане в различен раздел, докато възстановяването е висящо.",
  "templates.t2.recover": "Възстановяване на същата операция",
  "templates.t2.operation": "Операция: {id}",
  "templates.t2.accepted": "Прилагането е потвърдено от сървъра",
  "templates.t2.success":
    "Създадени задачи: {count}. Сървърът потвърди операцията; повторните заявки връщат първоначалния резултат.",
  "templates.t2.openTasks": "Към задачите на събитието",
  "templates.t2.openCreated": "Отваряне на създадена задача {number}",
  "templates.t2.new": "Начало на отделно прилагане",
  "templates.t2.refresh": "Обновяване на данните за събитието",
  "templates.t2.refreshFailed":
    "Създаването е потвърдено, но текущото работно пространство не може да се обнови. Обновете преди да продължите.",
  "templates.t2.error.invalid":
    "Прегледът или заявката не може да се валидира. Не се приема успех. Ако има задържана операция, запазете ключа и възстановете резултата след отстраняване на проблема.",
  "templates.t2.error.unauthenticated":
    "Сесията е изтекла. Влезте отново, за да възстановите задържаната операция.",
  "templates.t2.error.forbidden":
    "Изисква се текущо право на организатор. Задържаната операция може да се възстанови със същия ключ след възстановяване на достъпа.",
  "templates.t2.error.archived":
    "Събитието е архивирано. Прилагането и възстановяването са блокирани; тази заявка не добави нови задачи.",
  "templates.t2.error.unavailable":
    "Сървърният преглед или прилагането е недостъпно, или достъпът до събитието е променен. Възможно е T2 да изисква активиране на backend. Не се предполага запис; задържаната операция запазва ключа си.",
  "templates.t2.error.conflict":
    "Прегледаното събитие, шаблонът или съвпадащите задачи са променени. Заявката е отхвърлена. Поискайте нов преглед и изрично потвърдете нов опит.",
  "templates.t2.error.key-reused":
    "Ключът на операцията принадлежи на различна заявка. Прилагането е блокирано. Запазете ключа за проверка; няма да се генерира автоматично нов ключ.",
  "templates.t2.error.uncertain":
    "Резултатът е неясен. Възможно е заявката да е записана. Възстановете същата операция; не започвайте нов опит.",
  "history.template.applied": "Приложен шаблон",
  "history.template.origin":
    "Шаблон {template} v{version} · операция {operation}",
};

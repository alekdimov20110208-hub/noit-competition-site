export const CHANGE_EN_MESSAGES = {
  "change.state.decision-pending": "Decision pending",
  "change.state.decision-recorded": "Decision recorded",
  "change.state.plan-b-prepared": "Plan B prepared",
  "change.attention.kind": "Change coordination",
  "change.attention.needs-owner": "Assign a response owner",
  "change.attention.needs-owner.help":
    "This change has no one coordinating its response.",
  "change.attention.needs-decision": "Coordinate a decision",
  "change.attention.needs-decision.help":
    "You coordinate this change; no decision is recorded yet.",
  "change.attention.needs-response": "Coordinate the response",
  "change.attention.needs-response.help":
    "You coordinate this change; the operational response is not recorded yet.",
  "change.decision.description": "What we decided.",
  "change.response.description": "What we are doing based on the decision.",
  "change.planB.description":
    "Fallback if the primary response cannot proceed.",
  "change.coordination": "Decision and response",
  "change.coordination.help":
    "Record the agreed approach and the coordination underway. Task changes are made separately.",
  "change.decision": "Decision",
  "change.decision.help":
    "What have we decided to do? Optional; clear the field to remove it.",
  "change.decision.empty": "No decision recorded yet.",
  "change.decision.author": "Decision authored by",
  "change.response": "Response",
  "change.response.help":
    "What operational action or coordination is being carried out? Optional; clear the field to remove it.",
  "change.response.empty": "No response recorded yet.",
  "change.planB": "Plan B",
  "change.planB.help":
    "Fallback if the primary response cannot proceed. Used only by explicit coordination.",
  "change.planB.empty": "No Plan B recorded.",
  "change.validation.decision":
    "Enter 1–2,000 characters for the decision, or clear the field.",
  "change.validation.response":
    "Enter 1–5,000 characters for the response, or clear the field.",
  "change.validation.planB":
    "Enter 1–5,000 characters for Plan B, or clear the field.",
  "change.title": "Changes",
  "change.description": "What changed, and the work it affects in this event.",
  "change.record": "Record change",
  "change.edit": "Edit change",
  "change.back": "All changes",
  "change.empty": "No changes recorded",
  "change.empty.organizer":
    "Record an operational change and connect it to the tasks it affects.",
  "change.empty.member":
    "Operational changes recorded for this event will appear here.",
  "change.readOnly":
    "Organizers record and edit changes. You can read the current impact, decision, response and Plan B.",
  "change.owner": "Response owner",
  "change.noOwner": "Response unassigned",
  "change.owner.help":
    "Coordinates the response to this change. Task ownership remains unchanged.",
  "change.reporter": "Recorded by",
  "change.created": "Recorded",
  "change.updated": "Updated",
  "change.what": "What changed",
  "change.impact": "Operational impact",
  "change.impact.help":
    "People, deadlines and statuses reflect the tasks as they are now.",
  "change.tasks": "Affected tasks",
  "change.tasks.count": "Affected tasks: {count}",
  "change.tasks.empty": "No affected tasks selected.",
  "change.people": "Currently responsible people",
  "change.people.empty": "Affected tasks have no assigned people.",
  "change.deadlines": "Affected deadlines",
  "change.deadlines.empty": "No deadlines on affected tasks.",
  "change.noDeadline": "No deadline",
  "change.title.label": "Change title",
  "change.context": "Context",
  "change.context.empty": "No additional context recorded.",
  "change.select.help":
    "Select the tasks affected by this change. Their current responsibilities and deadlines are shown below.",
  "change.select.empty":
    "This event has no tasks yet. You can record a change without linking tasks.",
  "change.save": "Save change",
  "change.saving": "Saving…",
  "change.refresh": "Refresh impact",
  "change.loading": "Loading changes…",
  "change.error.unavailable": "Changes could not be loaded. Try again.",
  "change.error.not-found":
    "This change or event is unavailable to your account.",
  "change.error.forbidden":
    "You do not have permission to perform this action.",
  "change.error.unauthenticated": "Your session has ended. Sign in again.",
  "change.error.invalid":
    "The change could not be verified. Refresh and try again.",
  "change.error.conflict":
    "This change has been edited elsewhere. Your draft has not been saved. Load the latest version before editing again.",
  "change.save.unavailable":
    "The save could not be confirmed. Your draft is retained. Check the latest changes before retrying.",
  "change.reload": "Load latest version",
  "change.reloaded": "Latest version loaded. Review it before saving again.",
  "change.validation.title": "Enter a title of 1–200 characters.",
  "change.validation.context": "Use up to 5,000 characters of context.",
  "change.validation.owner":
    "Choose an active member of this event or leave the response unassigned.",
  "change.validation.tasks":
    "Choose up to 1,000 current tasks from this event.",
  "change.owner.unavailable":
    "Current owner unavailable — choose an active member",
  "change.responsible": "Responsible",
  "change.deadline": "Deadline",
  "change.status": "Status",
} as const;
export const CHANGE_BG_MESSAGES = {
  "change.state.decision-pending": "Очаква решение",
  "change.state.decision-recorded": "Има записано решение",
  "change.state.plan-b-prepared": "Има подготвен План Б",
  "change.attention.kind": "Координация на промяна",
  "change.attention.needs-owner": "Определете отговорник за реакцията",
  "change.attention.needs-owner.help":
    "Все още няма човек, който да координира реакцията към тази промяна.",
  "change.attention.needs-decision": "Координирайте решение",
  "change.attention.needs-decision.help":
    "Координирате тази промяна; все още няма записано решение.",
  "change.attention.needs-response": "Координирайте реакцията",
  "change.attention.needs-response.help":
    "Координирате тази промяна; текущата реакция все още не е записана.",
  "change.decision.description": "Какво решихме.",
  "change.response.description": "Какво правим въз основа на решението.",
  "change.planB.description":
    "Резервен вариант, ако основната реакция не може да се осъществи.",
  "change.coordination": "Решение и реакция",
  "change.coordination.help":
    "Запишете уговореното решение и текущата координация. Задачите се променят отделно.",
  "change.decision": "Решение",
  "change.decision.help":
    "Какво решихме да направим? Незадължително; изчистете полето, за да премахнете решението.",
  "change.decision.empty": "Все още няма записано решение.",
  "change.decision.author": "Решението е записано от",
  "change.response": "Реакция",
  "change.response.help":
    "Какви действия или координация се извършват? Незадължително; изчистете полето, за да премахнете реакцията.",
  "change.response.empty": "Все още няма записана реакция.",
  "change.planB": "План Б",
  "change.planB.help":
    "Резервен вариант, ако основната реакция не може да се осъществи. Прилага се само след изрична координация.",
  "change.planB.empty": "Няма записан План Б.",
  "change.validation.decision":
    "Въведете решение от 1 до 2 000 знака или изчистете полето.",
  "change.validation.response":
    "Въведете реакция от 1 до 5 000 знака или изчистете полето.",
  "change.validation.planB":
    "Въведете План Б от 1 до 5 000 знака или изчистете полето.",
  "change.title": "Промени",
  "change.description": "Какво се е променило и кои задачи в събитието засяга.",
  "change.record": "Регистрирай промяна",
  "change.edit": "Редактирай промяната",
  "change.back": "Всички промени",
  "change.empty": "Няма регистрирани промени",
  "change.empty.organizer":
    "Регистрирайте оперативна промяна и посочете задачите, които тя засяга.",
  "change.empty.member":
    "Тук ще се показват оперативните промени, регистрирани за събитието.",
  "change.readOnly":
    "Организаторите регистрират и редактират промените. Можете да преглеждате текущото въздействие, решението, реакцията и План Б.",
  "change.owner": "Отговорник за реакцията",
  "change.noOwner": "Няма отговорник за реакцията",
  "change.owner.help":
    "Координира реакцията към тази промяна. Отговорниците по задачите не се променят.",
  "change.reporter": "Регистрирана от",
  "change.created": "Регистрирана",
  "change.updated": "Обновена",
  "change.what": "Какво се промени",
  "change.impact": "Въздействие върху работата",
  "change.impact.help":
    "Хората, сроковете и статусите отразяват текущото състояние на задачите.",
  "change.tasks": "Засегнати задачи",
  "change.tasks.count": "Засегнати задачи: {count}",
  "change.tasks.empty": "Няма избрани засегнати задачи.",
  "change.people": "Текущи отговорници по задачите",
  "change.people.empty": "Засегнатите задачи нямат определени отговорници.",
  "change.deadlines": "Засегнати срокове",
  "change.deadlines.empty": "Засегнатите задачи нямат срокове.",
  "change.noDeadline": "Няма срок",
  "change.title.label": "Заглавие на промяната",
  "change.context": "Контекст",
  "change.context.empty": "Няма допълнителен контекст.",
  "change.select.help":
    "Изберете засегнатите задачи. По-долу са показани текущите им отговорници и срокове.",
  "change.select.empty":
    "В събитието все още няма задачи. Можете да регистрирате промяна без засегнати задачи.",
  "change.save": "Запази промяната",
  "change.saving": "Запазване…",
  "change.refresh": "Обнови въздействието",
  "change.loading": "Зареждане на промените…",
  "change.error.unavailable":
    "Промените не могат да бъдат заредени. Опитайте отново.",
  "change.error.not-found":
    "Промяната или събитието не са достъпни за Вашия акаунт.",
  "change.error.forbidden": "Нямате права за това действие.",
  "change.error.unauthenticated": "Сесията Ви е изтекла. Влезте отново.",
  "change.error.invalid":
    "Промяната не може да бъде проверена. Обновете и опитайте отново.",
  "change.error.conflict":
    "Промяната е редактирана от друг. Черновата Ви не е запазена. Заредете последната версия преди нова редакция.",
  "change.save.unavailable":
    "Запазването не може да бъде потвърдено. Черновата Ви е запазена във формуляра. Проверете последните промени преди нов опит.",
  "change.reload": "Зареди последната версия",
  "change.reloaded":
    "Последната версия е заредена. Прегледайте я преди запазване.",
  "change.validation.title": "Въведете заглавие от 1 до 200 знака.",
  "change.validation.context": "Използвайте до 5 000 знака за контекста.",
  "change.validation.owner":
    "Изберете активен участник от събитието или оставете реакцията без отговорник.",
  "change.validation.tasks": "Изберете до 1 000 текущи задачи от това събитие.",
  "change.owner.unavailable":
    "Текущият отговорник е неактивен — изберете активен участник",
  "change.responsible": "Отговорник",
  "change.deadline": "Срок",
  "change.status": "Статус",
} satisfies Record<keyof typeof CHANGE_EN_MESSAGES, string>;

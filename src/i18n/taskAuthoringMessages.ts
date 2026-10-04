export const TASK_AUTHORING_EN_MESSAGES = {
  "tasks.authoring.create": "Create task",
  "tasks.authoring.edit": "Edit task details",
  "tasks.authoring.save": "Save task details",
  "tasks.authoring.title": "Title",
  "tasks.authoring.category": "Category (optional)",
  "tasks.authoring.context": "Context (optional)",
  "tasks.authoring.deadline": "Deadline",
  "tasks.authoring.priority": "Priority",
  "tasks.authoring.assignee": "Assignee (optional)",
  "tasks.authoring.help":
    "Assignment does not imply acceptance. The assignee accepts responsibility separately.",
  "tasks.authoring.dateHelp":
    "Calendar date in the event timezone. Preparation tasks may be due before the event.",
  "tasks.authoring.textError": "Check this field and its length.",
  "tasks.authoring.dateError": "Enter a valid calendar date.",
  "tasks.authoring.assigneeError": "Choose an active member of this event.",
  "tasks.authoring.priorityError": "Choose a supported priority.",
  "tasks.authoring.invalid": "Check the task fields and try again.",
  "tasks.authoring.pending": "Saving and refreshing task…",
  "tasks.authoring.conflict":
    "This task changed elsewhere. Latest details are shown. Review them before saving again.",
  "tasks.authoring.reload": "Load latest details",
  "tasks.authoring.conflictRefresh":
    "Latest details could not be loaded. Load them before saving again.",
  "tasks.authoring.unavailable":
    "The save could not be confirmed. Review the task list before trying again.",
} as const;
export const TASK_AUTHORING_BG_MESSAGES = {
  "tasks.authoring.create": "Създаване на задача",
  "tasks.authoring.edit": "Редактиране на задачата",
  "tasks.authoring.save": "Запазване на задачата",
  "tasks.authoring.title": "Заглавие",
  "tasks.authoring.category": "Категория (незадължително)",
  "tasks.authoring.context": "Контекст (незадължително)",
  "tasks.authoring.deadline": "Краен срок",
  "tasks.authoring.priority": "Приоритет",
  "tasks.authoring.assignee": "Отговорник (незадължително)",
  "tasks.authoring.help":
    "Възлагането не означава приемане. Отговорникът приема отговорността отделно.",
  "tasks.authoring.dateHelp":
    "Календарна дата в часовата зона на събитието. Подготвителните задачи може да са преди него.",
  "tasks.authoring.textError": "Проверете полето и дължината му.",
  "tasks.authoring.dateError": "Въведете валидна календарна дата.",
  "tasks.authoring.assigneeError": "Изберете активен участник в това събитие.",
  "tasks.authoring.priorityError": "Изберете допустим приоритет.",
  "tasks.authoring.invalid":
    "Проверете полетата на задачата и опитайте отново.",
  "tasks.authoring.pending": "Запазване и обновяване на задачата…",
  "tasks.authoring.conflict":
    "Задачата е променена от друг потребител. Показани са актуалните данни. Прегледайте ги преди ново запазване.",
  "tasks.authoring.reload": "Зареждане на актуалните данни",
  "tasks.authoring.conflictRefresh":
    "Актуалните данни не можаха да се заредят. Заредете ги преди ново запазване.",
  "tasks.authoring.unavailable":
    "Запазването не можа да се потвърди. Прегледайте списъка със задачи преди нов опит.",
} satisfies Record<keyof typeof TASK_AUTHORING_EN_MESSAGES, string>;

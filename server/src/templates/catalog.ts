// Authoritative immutable v1 snapshot of the accepted T1 blueprint.
// Server tests enforce parity with T1; runtime never imports frontend modules.
export const SEMINAR_BLUEPRINT = {
  id: "international-aikido-seminar",
  version: 1,
  items: [
    {
      id: "team-briefing",
      priority: "important",
      dayOffset: -7,
      deadlineTime: null,
      reminderOffsets: [],
      text: {
        en: {
          title: "Coordinate the organizing team",
          category: "Team coordination",
          context:
            "Review the programme, responsibilities and contact chain with the team. Agree who coordinates travel, accommodation and the dojo.",
        },
        bg: {
          title: "Координиране на организаторския екип",
          category: "Координация на екипа",
          context:
            "Прегледайте програмата, отговорностите и реда за връзка с екипа. Уточнете кой координира пътуването, настаняването и залата.",
        },
      },
    },
    {
      id: "instructor-airport-pickup",
      priority: "important",
      dayOffset: -1,
      deadlineTime: null,
      reminderOffsets: [],
      text: {
        en: {
          title: "Pick up the instructor at the airport",
          category: "Transport",
          context:
            "Confirm the flight, meeting point, driver and contact number. The day before the seminar is a starting suggestion; use the actual arrival schedule. No pickup time is assumed.",
        },
        bg: {
          title: "Посрещане на инструктора на летището",
          category: "Транспорт",
          context:
            "Потвърдете полета, мястото за среща, шофьора и телефона за връзка. Денят преди семинара е начално предложение; съобразете го с пристигането. Не се предполага час за посрещане.",
        },
      },
    },
    {
      id: "hotel-check-in",
      priority: "normal",
      dayOffset: -1,
      deadlineTime: "15:00",
      reminderOffsets: [],
      text: {
        en: {
          title: "Coordinate hotel check-in",
          category: "Accommodation",
          context:
            "Confirm the booking and reception arrangements for the guest instructor. Check the hotel's actual check-in time and coordinate the transfer from the airport.",
        },
        bg: {
          title: "Координиране на настаняването в хотела",
          category: "Настаняване",
          context:
            "Потвърдете резервацията и посрещането на гост-инструктора на рецепцията. Проверете действителния час за настаняване и съгласувайте трансфера от летището.",
        },
      },
    },
    {
      id: "training-session-preparation",
      priority: "important",
      dayOffset: 0,
      deadlineTime: "08:30",
      reminderOffsets: [],
      text: {
        en: {
          title: "Prepare the first training session",
          category: "Training preparation",
          context:
            "Check dojo access, tatami, changing areas and the agreed equipment before participants arrive. Adjust the suggested time to the first session.",
        },
        bg: {
          title: "Подготовка на първата тренировка",
          category: "Подготовка на тренировката",
          context:
            "Проверете достъпа до залата, татамито, съблекалните и уговореното оборудване преди пристигането на участниците. Съобразете предложения час с първата тренировка.",
        },
      },
    },
  ],
} as const;

import { parseTaskAuthoring } from "../tasks/model.ts";

export type Localized = { bg: string; en: string };
export interface CuratedItem {
  id: string;
  priority: "normal" | "important" | "critical";
  dayOffset: number;
  deadlineTime: string | null;
  reminderOffsets: readonly number[];
  text: {
    bg: { title: string; category: string; context: string };
    en: { title: string; category: string; context: string };
  };
}
export interface CuratedTemplate {
  kind: "curated";
  id: string;
  version: number;
  name: Localized;
  description: Localized;
  audience: Localized;
  category:
    | "aikido"
    | "examinations"
    | "camps"
    | "community"
    | "logistics"
    | "tournaments"
    | "workshops"
    | "courses";
  difficulty: "beginner" | "standard" | "advanced";
  durationDays: number | null;
  items: CuratedItem[];
}
const categories = {
  planning: { bg: "Планиране", en: "Planning" },
  venue: { bg: "Зала и оборудване", en: "Venue and equipment" },
  programme: { bg: "Програма", en: "Programme" },
  people: { bg: "Екип и участници", en: "Team and participants" },
  safety: { bg: "Безопасност", en: "Safety" },
  communication: { bg: "Комуникация", en: "Communication" },
  travel: { bg: "Пътуване и настаняване", en: "Travel and accommodation" },
  administration: { bg: "Администрация", en: "Administration" },
  review: { bg: "Обратна връзка", en: "Feedback" },
} as const;

// Original editorial content, authored together in BG and EN. No event-specific
// travel times, grading rules, fees or personal information are supplied.
function task(
  id: string,
  dayOffset: number,
  category: keyof typeof categories,
  titleBg: string,
  titleEn: string,
  contextBg: string,
  contextEn: string,
  priority: CuratedItem["priority"] = "normal",
): CuratedItem {
  return {
    id,
    dayOffset,
    priority,
    deadlineTime: null,
    reminderOffsets: [],
    text: {
      bg: {
        title: titleBg,
        category: categories[category].bg,
        context: contextBg,
      },
      en: {
        title: titleEn,
        category: categories[category].en,
        context: contextEn,
      },
    },
  };
}
function template(
  id: string,
  category: CuratedTemplate["category"],
  difficulty: CuratedTemplate["difficulty"],
  durationDays: number | null,
  name: Localized,
  description: Localized,
  audience: Localized,
  items: CuratedItem[],
): CuratedTemplate {
  return {
    kind: "curated",
    id: `curated-${id}`,
    version: 1,
    category,
    difficulty,
    durationDays,
    name,
    description,
    audience,
    items,
  };
}

export const CURATED_TEMPLATES: readonly CuratedTemplate[] = [
  template(
    "aikido-first-day",
    "aikido",
    "beginner",
    1,
    {
      bg: "Първи еднодневен айкидо семинар",
      en: "First one-day Aikido seminar",
    },
    {
      bg: "Ясен старт за малък семинар: подходяща зала, достъпна програма и спокойно посрещане.",
      en: "A clear starting plan for a small seminar: suitable space, an accessible programme and a calm welcome.",
    },
    {
      bg: "За организатор без предишен семинарен опит, с подкрепа от инструктор. Подходящ за един местен клуб.",
      en: "For a first-time organizer supported by an instructor. Suitable for a single local club.",
    },
    [
      task(
        "agree-purpose",
        -28,
        "planning",
        "Уточнете целта и нивото с инструктора",
        "Agree the purpose and level with the instructor",
        "Уточнете за кого е семинарът и какъв опит се очаква. Потвърдете участието на инструктора преди покани.",
        "Agree who the seminar serves and what experience is expected. Confirm the instructor before inviting participants.",
        "important",
      ),
      task(
        "reserve-dojo",
        -21,
        "venue",
        "Потвърдете залата и достъпа",
        "Confirm the dojo and access",
        "Проверете капацитета на татамито, съблекалните, достъпността и времето за подготовка. Поискайте потвърждение от залата.",
        "Check mat capacity, changing areas, accessibility and setup access. Obtain confirmation from the venue.",
        "important",
      ),
      task(
        "shape-programme",
        -14,
        "programme",
        "Подредете заниманията и почивките",
        "Outline sessions and breaks",
        "С инструктора определете продължителността, почивките и нужната екипировка. Не задавайте техники без неговото съгласие.",
        "Agree session length, breaks and equipment with the instructor. Do not prescribe techniques without their agreement.",
      ),
      task(
        "invite-participants",
        -12,
        "communication",
        "Изпратете ясна покана и начин за записване",
        "Send a clear invitation and registration method",
        "Посочете потвърдените място, програма, ниво и контакт. Уточнете условията за участие и срока за отговор, без да обещавате непотвърдени цени.",
        "Share confirmed location, programme, level and contact. Clarify participation terms and a response deadline without promising unconfirmed fees.",
      ),
      task(
        "check-safety",
        -7,
        "safety",
        "Уточнете помощта при инцидент",
        "Agree incident assistance",
        "Потвърдете кой оказва първа помощ, къде е аптечката и как се достига до изходите. Уточнете местните изисквания с домакина.",
        "Confirm first-aid support, the kit location and clear exits. Check local requirements with the host.",
        "important",
      ),
      task(
        "brief-helpers",
        -3,
        "people",
        "Разпределете посрещането и подредбата",
        "Allocate welcome and setup duties",
        "Определете кой отваря залата, посреща хората и проверява оборудването. Изпратете кратка последна информация на записаните.",
        "Agree who opens the venue, welcomes people and checks equipment. Send registered participants a short final briefing.",
      ),
      task(
        "prepare-mats",
        0,
        "venue",
        "Проверете татамито преди първото занимание",
        "Check the mats before the first session",
        "Проверете чистотата, закрепването на татамито, свободните проходи и водата. При проблем потърсете инструктора преди започване.",
        "Check cleanliness, mat stability, clear walkways and water. Raise problems with the instructor before starting.",
        "important",
      ),
      task(
        "close-and-listen",
        1,
        "review",
        "Приключете организацията и съберете впечатления",
        "Close the arrangements and gather feedback",
        "Потвърдете връщането на ключове и оборудване. Попитайте инструктора и участниците какво да запазите или промените за следващ път.",
        "Confirm return of keys and equipment. Ask the instructor and participants what to retain or change next time.",
      ),
    ],
  ),
  template(
    "aikido-local",
    "aikido",
    "standard",
    null,
    { bg: "Местен айкидо семинар", en: "Local Aikido seminar" },
    {
      bg: "Практичен план за клубен семинар с гостуващ инструктор и участници от района.",
      en: "A practical club seminar plan with a visiting instructor and participants from the area.",
    },
    {
      bg: "За клубен организатор с малък екип. Уточнете броя дни и адаптирайте задачите около края на събитието.",
      en: "For a club organizer with a small team. Confirm the number of days and adapt tasks around the event finish.",
    },
    [
      task(
        "instructor-agreement",
        -42,
        "planning",
        "Потвърдете ангажимента на инструктора",
        "Confirm the instructor agreement",
        "Уточнете датите, целевата група, разходите и условията при промяна. Запишете само потвърдените договорености.",
        "Agree dates, audience, expenses and change arrangements. Record confirmed agreements only.",
        "important",
      ),
      task(
        "venue-capacity",
        -35,
        "venue",
        "Осигурете зала с подходящ капацитет",
        "Secure a venue with suitable capacity",
        "Проверете площта за безопасна практика, достъпа по дни и оборудването. Уточнете условията за ползване с домакина.",
        "Check safe practice space, daily access and equipment. Confirm usage terms with the host.",
        "important",
      ),
      task(
        "session-plan",
        -28,
        "programme",
        "Съгласувайте тренировъчната програма",
        "Agree the training programme",
        "Уточнете групите, заниманията и почивките с инструктора. Отделете време за регистрация и подреждане.",
        "Agree groups, sessions and breaks with the instructor. Allow registration and setup time.",
      ),
      task(
        "registration-terms",
        -21,
        "administration",
        "Обявете записването и условията",
        "Publish registration and participation terms",
        "Потвърдете такси, срокове, отказ и необходимите данни преди публикуване. Събирайте само нужната информация.",
        "Confirm fees, deadlines, cancellation terms and required data before publication. Collect only necessary information.",
      ),
      task(
        "local-arrival",
        -14,
        "travel",
        "Уточнете пристигането на госта",
        "Coordinate the guest arrival",
        "Попитайте инструктора за действителния маршрут и нуждите от трансфер или нощувка. Потвърдете кой координира всяка договореност.",
        "Ask the instructor for the actual route and any transfer or overnight needs. Confirm who coordinates each arrangement.",
      ),
      task(
        "venue-safety",
        -7,
        "safety",
        "Проверете безопасността и помощта",
        "Check safety and assistance",
        "Прегледайте татамито, изходите, аптечката и реда при инцидент с отговорника на залата. Изяснете приложимите местни изисквания.",
        "Review mats, exits, first aid and incident procedures with the venue contact. Clarify applicable local requirements.",
        "important",
      ),
      task(
        "team-rota",
        -5,
        "people",
        "Съгласувайте дежурствата на екипа",
        "Agree team duty coverage",
        "Осигурете посрещане, регистрация и подготовка за всяко занимание. Проверете кой поема задачата при отсъствие.",
        "Cover welcome, registration and setup for every session. Agree backup coverage for absences.",
      ),
      task(
        "final-information",
        -2,
        "communication",
        "Изпратете окончателните указания",
        "Send final joining instructions",
        "Потвърдете адреса, достъпа, екипировката и последната програма. Посочете контакт за промени и проверете въпросите за достъпност.",
        "Confirm address, access, equipment and the latest programme. Share a change contact and check accessibility questions.",
      ),
      task(
        "opening-check",
        0,
        "venue",
        "Проверете готовността преди отваряне",
        "Check readiness before opening",
        "Потвърдете присъствието на екипа и инструктора, подредбата и списъка за регистрация. Уточнете с домакина връщането на залата след последното занимание.",
        "Confirm team and instructor attendance, setup and the registration list. Agree venue handover after the final session with the host.",
        "important",
      ),
    ],
  ),
  template(
    "aikido-international-full",
    "aikido",
    "advanced",
    null,
    {
      bg: "Международен айкидо семинар — цялостен план",
      en: "International Aikido seminar — comprehensive",
    },
    {
      bg: "По-подробна подготовка за международен гост, няколко клуба и многоезична комуникация.",
      en: "Detailed preparation for an international guest, several clubs and multilingual communication.",
    },
    {
      bg: "За опитен клубен екип с международни гости. Това е нов разширен шаблон, отделен от оригиналната кратка основа.",
      en: "For an experienced club team hosting international guests. This is a new expanded template, separate from the original short starter.",
    },
    [
      task(
        "host-agreement",
        -90,
        "planning",
        "Потвърдете поканата и отговорностите",
        "Confirm the invitation and responsibilities",
        "Съгласувайте датите, обхвата и условията с инструктора и домакините. Уточнете кой одобрява промени и разходи.",
        "Agree dates, scope and terms with the instructor and hosts. Clarify who approves changes and expenses.",
        "important",
      ),
      task(
        "capacity-booking",
        -75,
        "venue",
        "Резервирайте зала за всички занимания",
        "Reserve the venue for all sessions",
        "Проверете достъп, капацитет, татами и ограничения за всяка дата. Потвърдете времето за монтаж и освобождаване.",
        "Check access, capacity, mats and restrictions for each date. Confirm setup and handover windows.",
        "important",
      ),
      task(
        "expense-plan",
        -60,
        "administration",
        "Прегледайте разходите и условията за участие",
        "Review expenses and participation terms",
        "Съберете актуални оферти за зала, гост и оборудване. Одобрете таксите и резерва за промени преди обявяване.",
        "Obtain current venue, guest and equipment quotes. Approve participation fees and a contingency allowance before announcing them.",
      ),
      task(
        "travel-requirements",
        -56,
        "travel",
        "Проверете изискванията за пътуване с госта",
        "Check travel requirements with the guest",
        "Помолете госта да потвърди документите и приложимите изисквания чрез официални източници. Уточнете кой изпраща необходимата покана; не обещавайте разрешение за влизане.",
        "Ask the guest to confirm documents and applicable requirements through official sources. Agree who supplies any invitation; do not promise entry permission.",
      ),
      task(
        "multilingual-programme",
        -45,
        "programme",
        "Съгласувайте програмата и езиковата подкрепа",
        "Agree the programme and language support",
        "Потвърдете заниманията, почивките и нуждата от превод с инструктора. Уточнете кой превежда организационните съобщения.",
        "Confirm sessions, breaks and interpretation needs with the instructor. Agree who translates organizational messages.",
      ),
      task(
        "club-invitations",
        -42,
        "communication",
        "Изпратете потвърдената покана до клубовете",
        "Send the confirmed invitation to clubs",
        "Дайте ясни условия, контакти и начин за записване на необходимите езици. Обозначете всеки все още непотвърден детайл.",
        "Provide clear terms, contacts and registration in the needed languages. Label every detail still awaiting confirmation.",
      ),
      task(
        "lodging-options",
        -35,
        "travel",
        "Потвърдете настаняването на госта",
        "Confirm guest accommodation",
        "Уточнете нуждите на госта и реалните условия на мястото за настаняване. Проверете резервацията, плащането и часа за приемане директно с домакина.",
        "Agree guest needs and the actual lodging terms. Check reservation, payment and arrival arrangements directly with the accommodation host.",
      ),
      task(
        "arrival-transfers",
        -21,
        "travel",
        "Планирайте трансферите по потвърдения маршрут",
        "Plan transfers from the confirmed itinerary",
        "Вземете актуалния маршрут, срещите и нужния багаж. Определете шофьор и резервен контакт; проверете повторно при промяна на пътуването.",
        "Obtain the current itinerary, meeting points and baggage needs. Agree a driver and backup contact; recheck after travel changes.",
      ),
      task(
        "registration-review",
        -14,
        "people",
        "Прегледайте записването и капацитета",
        "Review registration against capacity",
        "Сравнете потвърдените участници с безопасния капацитет. Уточнете заявките за достъпност и езикова подкрепа, без да разпространявате лични данни.",
        "Compare confirmed attendance with safe capacity. Clarify accessibility and language support requests without circulating personal data.",
      ),
      task(
        "safety-coverage",
        -10,
        "safety",
        "Потвърдете помощта и реда при инцидент",
        "Confirm assistance and incident procedures",
        "Проверете първата помощ, изходите и комуникацията между залата и екипа. Съгласувайте приложимите изисквания с домакина.",
        "Check first aid, exits and communication between venue and team. Agree applicable requirements with the host.",
        "important",
      ),
      task(
        "team-rehearsal",
        -7,
        "people",
        "Разиграйте посрещането с екипа",
        "Rehearse arrival coordination with the team",
        "Прегледайте контакти, регистрация, превод и заместници. Уточнете кой съобщава промени, включително при закъснение на госта.",
        "Review contacts, registration, interpretation and backups. Agree who communicates changes, including a guest delay.",
      ),
      task(
        "final-joining-pack",
        -3,
        "communication",
        "Изпратете многоезичните указания за пристигане",
        "Send multilingual joining instructions",
        "Потвърдете адресите, програмата, нужната екипировка и организационния контакт. Проверете съгласуваността между езиковите версии.",
        "Confirm addresses, programme, equipment and the coordination contact. Check that language versions agree.",
      ),
      task(
        "guest-readiness",
        -1,
        "travel",
        "Проверете пристигането и готовността на госта",
        "Recheck guest arrival and readiness",
        "Свържете се с госта и координатора по действителния график. Потвърдете трансфера, настаняването и първата среща, без да предполагате часове.",
        "Contact the guest and coordinator against the actual itinerary. Confirm transfer, lodging and the first meeting without assuming times.",
      ),
      task(
        "opening-handover",
        0,
        "venue",
        "Потвърдете готовността и плана за приключване",
        "Confirm opening readiness and closing arrangements",
        "Проверете залата, превода и регистрацията преди отваряне. Съгласувайте проверка след последното занимание, връщане на оборудване и обратния трансфер според действителния край.",
        "Check venue, interpretation and registration before opening. Agree final-session checks, equipment return and departure transfer against the actual finish.",
        "important",
      ),
    ],
  ),
  template(
    "aikido-kyu-examination",
    "examinations",
    "standard",
    1,
    { bg: "Изпит за кю по айкидо", en: "Aikido kyu examination" },
    {
      bg: "Организационна подготовка за клубен изпит, без да предписва изисквания на федерация.",
      en: "Club examination organization without prescribing federation grading requirements.",
    },
    {
      bg: "За клубен организатор и отговорния инструктор. Изпитните правила се потвърждават с компетентната организация.",
      en: "For a club organizer and supervising instructor. Confirm grading rules with the responsible organization.",
    },
    [
      task(
        "grading-authority",
        -42,
        "planning",
        "Потвърдете изпитващите и приложимите правила",
        "Confirm examiners and applicable rules",
        "Потърсете актуалните правила от съответната организация. Потвърдете правомощията на изпитващите, датата и начина за подаване на документи.",
        "Obtain current rules from the relevant organization. Confirm examiner authority, date and document submission method.",
        "important",
      ),
      task(
        "candidate-readiness",
        -28,
        "people",
        "Проверете допускането на кандидатите с инструктора",
        "Check candidate eligibility with the instructor",
        "Нека инструкторът потвърди готовността и необходимите условия за всеки кандидат. Не приемайте, че срокове, възраст или тренировъчен стаж са еднакви навсякъде.",
        "Have the instructor confirm readiness and required conditions for each candidate. Do not assume uniform age, attendance or waiting-period rules.",
      ),
      task(
        "exam-space",
        -21,
        "venue",
        "Осигурете зала и място за комисията",
        "Arrange space for practice and examiners",
        "Проверете татамито, зоната за изчакване и достъпа за изпитващите. Съгласувайте нужната подредба.",
        "Check mats, waiting space and examiner access. Agree the required layout.",
      ),
      task(
        "exam-documents",
        -14,
        "administration",
        "Съберете потвърдените документи и заявления",
        "Collect confirmed documents and applications",
        "Проверете формуляри, съгласия и такси според актуалните указания. Ограничете достъпа до личните данни на кандидатите.",
        "Check forms, consents and fees against current instructions. Restrict access to candidate personal data.",
      ),
      task(
        "exam-order",
        -7,
        "programme",
        "Съгласувайте реда и партньорите",
        "Agree the running order and partners",
        "Уточнете групите, нуждата от уке и времето за загряване с инструктора. Изпратете само потвърдения ред на участниците.",
        "Agree groups, any uke needs and warm-up time with the instructor. Share the confirmed running order with participants.",
      ),
      task(
        "exam-safety",
        -3,
        "safety",
        "Проверете условията за безопасно провеждане",
        "Check safe examination arrangements",
        "Уточнете първата помощ и реда при неразположение. Потвърдете чисто татами и свободни проходи със залата.",
        "Agree first aid and the response to someone feeling unwell. Confirm clean mats and clear walkways with the venue.",
        "important",
      ),
      task(
        "exam-opening",
        0,
        "administration",
        "Проверете присъствието и документите преди изпита",
        "Check attendance and documents before grading",
        "Потвърдете кандидатите и изпитващите, подгответе нужните протоколи. Само компетентните изпитващи определят резултатите.",
        "Confirm candidates and examiners and prepare the required records. Only authorized examiners determine results.",
      ),
      task(
        "exam-records",
        1,
        "administration",
        "Предайте потвърдените резултати по установения ред",
        "Submit confirmed results through the agreed process",
        "Проверете протоколите с изпитващите и уточнете крайния срок за подаване. Уведомете кандидатите по подходящ личен канал.",
        "Check records with the examiners and confirm the submission deadline. Notify candidates through a suitable private channel.",
      ),
    ],
  ),
  template(
    "aikido-dan-preparation",
    "examinations",
    "advanced",
    null,
    {
      bg: "Подготовка за изпит за дан по айкидо",
      en: "Aikido dan examination preparation",
    },
    {
      bg: "Координация на подготовката, документите и партньорите преди потвърден изпит.",
      en: "Coordinate preparation, documents and partners ahead of a confirmed examination.",
    },
    {
      bg: "За инструктор или клубен координатор, подкрепящ кандидат. Не замества техническа подготовка или правилник за изпит.",
      en: "For an instructor or club coordinator supporting a candidate. This does not replace technical instruction or grading regulations.",
    },
    [
      task(
        "dan-requirements",
        -90,
        "planning",
        "Проверете актуалните изисквания за съответния дан",
        "Verify current requirements for the intended dan grade",
        "Потвърдете организацията, степента, изпитващите и сроковете от официалните им указания. Обсъдете готовността с отговорния инструктор.",
        "Confirm organization, grade, examiners and deadlines from their official instructions. Discuss readiness with the supervising instructor.",
        "important",
      ),
      task(
        "preparation-plan",
        -75,
        "programme",
        "Съгласувайте индивидуален план с инструктора",
        "Agree an individual plan with the instructor",
        "Определете прегледи на напредъка и тренировъчни възможности. Техническото съдържание и натоварването се определят от инструктора.",
        "Set progress reviews and training opportunities. The instructor determines technical content and training load.",
      ),
      task(
        "uke-availability",
        -60,
        "people",
        "Потвърдете партньорите за подготовка",
        "Confirm preparation partners",
        "Уточнете нуждата от уке, тяхната наличност и резервен вариант. Съгласувайте безопасно натоварване с инструктора.",
        "Agree any uke needs, partner availability and a backup. Coordinate safe training load with the instructor.",
      ),
      task(
        "dan-application",
        -45,
        "administration",
        "Проверете заявленията и необходимите удостоверения",
        "Check applications and required records",
        "Потвърдете какви документи, подписи и такси действително се изискват. Адаптирайте този предложен срок към официалния краен срок.",
        "Confirm the documents, signatures and fees actually required. Adapt this suggested date to the official submission deadline.",
        "important",
      ),
      task(
        "dan-travel",
        -28,
        "travel",
        "Уточнете пътуването при външен изпит",
        "Coordinate travel for an external examination",
        "Ако изпитът е извън клуба, потвърдете място, транспорт и нужда от нощувка. Ако не е необходимо пътуване, изключете тази задача.",
        "If grading is away from the club, confirm venue, transport and overnight needs. Deselect this task when travel is unnecessary.",
      ),
      task(
        "readiness-review",
        -14,
        "programme",
        "Проведете преглед на готовността с инструктора",
        "Review readiness with the instructor",
        "Обсъдете техническата и организационната готовност без гаранция за резултат. Уточнете оставащите въпроси с изпитващата организация.",
        "Review technical and organizational readiness without guaranteeing an outcome. Clarify remaining questions with the grading organization.",
      ),
      task(
        "dan-final-brief",
        -3,
        "communication",
        "Потвърдете финалните указания и екипировката",
        "Confirm final instructions and equipment",
        "Проверете програмата, пристигането, документите и договорената екипировка. Потвърдете участието на партньорите и контакт за промени.",
        "Check programme, arrival, documents and agreed equipment. Confirm partners and a contact for changes.",
      ),
      task(
        "dan-day-check",
        0,
        "people",
        "Проверете организационната готовност в деня на изпита",
        "Check examination-day arrangements",
        "Потвърдете регистрацията, партньорите и указанията на организатора. Следвайте решенията на инструктора и изпитващите; не променяйте изискванията по този шаблон.",
        "Confirm registration, partners and organizer instructions. Follow the instructor and examiners; this template does not change grading requirements.",
      ),
    ],
  ),
  template(
    "weekend-training-camp",
    "camps",
    "advanced",
    2,
    {
      bg: "Уикенд тренировъчен лагер",
      en: "Weekend martial-arts training camp",
    },
    {
      bg: "Двудневен лагер с тренировки, настаняване, хранене и отговорности между заниманията.",
      en: "A two-day camp covering training, lodging, meals and responsibilities between sessions.",
    },
    {
      bg: "За екип с опит в семинари, който планира и престой. При друга продължителност прегледайте задачите след началото.",
      en: "For a team experienced in seminars that also coordinates a stay. Review after-start tasks if the duration differs.",
    },
    [
      task(
        "camp-host",
        -60,
        "planning",
        "Потвърдете мястото и условията за лагера",
        "Confirm the camp location and terms",
        "Проверете тренировъчното пространство, нощувките и достъпността. Уточнете капацитета и условията за отказ преди покани.",
        "Check practice space, overnight accommodation and accessibility. Agree capacity and cancellation terms before invitations.",
        "important",
      ),
      task(
        "camp-programme",
        -45,
        "programme",
        "Съгласувайте натоварването и почивките",
        "Agree training load and rest periods",
        "С инструкторите подредете заниманията, почивките и свободното време. Уточнете как се съобщава промяна при неподходящи условия.",
        "Arrange sessions, rest and free time with instructors. Agree how changes are communicated when conditions are unsuitable.",
      ),
      task(
        "camp-registration",
        -35,
        "administration",
        "Отворете записването с ясни условия",
        "Open registration with clear terms",
        "Потвърдете включените услуги, такси, срокове и отказ. Ако участват непълнолетни, уточнете необходимите съгласия и отговорности с клуба.",
        "Confirm included services, fees, deadlines and cancellation terms. If minors attend, clarify required consents and responsibilities with the club.",
      ),
      task(
        "camp-meals",
        -21,
        "travel",
        "Потвърдете настаняването и храненето",
        "Confirm lodging and meal arrangements",
        "Уточнете реалните часове и условия с домакина. Поискайте нужната информация за хранене по личен канал и я споделете само с отговорните хора.",
        "Confirm actual times and terms with the host. Request necessary dietary information privately and share it only with responsible staff.",
      ),
      task(
        "camp-safety",
        -14,
        "safety",
        "Съгласувайте помощта и надзора между тренировките",
        "Agree assistance and supervision between sessions",
        "Уточнете първа помощ, спешни контакти и граници на отговорност. Потвърдете специфичните правила на мястото, включително за непълнолетни.",
        "Agree first aid, emergency contacts and responsibility boundaries. Confirm venue-specific rules, including those for minors.",
        "important",
      ),
      task(
        "camp-transport",
        -10,
        "travel",
        "Координирайте пристигането и отпътуването",
        "Coordinate arrival and departure",
        "Потвърдете маршрути и точки за среща с участниците. Проверете кой организира транспорта и как се съобщават закъснения.",
        "Confirm routes and meeting points with participants. Agree transport responsibility and how delays are reported.",
      ),
      task(
        "camp-pack",
        -5,
        "communication",
        "Изпратете програма и списък за подготовка",
        "Send the programme and preparation list",
        "Посочете потвърдените условия, екипировка и контакти. Отделете личната подготовка от вещите, които осигурява организаторът.",
        "Share confirmed arrangements, equipment and contacts. Distinguish personal preparation from organizer-supplied items.",
      ),
      task(
        "camp-arrival",
        0,
        "people",
        "Проверете пристигането и въведете участниците",
        "Check arrivals and brief participants",
        "Потвърдете стаите, тренировъчните зони и реда за помощ. Проверете с домакина безопасността преди първото занимание.",
        "Confirm rooms, training areas and assistance arrangements. Check safety with the host before the first session.",
      ),
      task(
        "camp-second-day",
        1,
        "venue",
        "Проверете втория ден и освобождаването на мястото",
        "Check day two and venue handover",
        "Преди заниманията проверете условията и състоянието на оборудването. Потвърдете действителните часове за освобождаване и връщането на ключове.",
        "Before sessions, check conditions and equipment. Confirm actual checkout and handover times and key return.",
      ),
      task(
        "camp-follow-up",
        3,
        "review",
        "Приключете договореностите и обсъдете лагера",
        "Close arrangements and review the camp",
        "Проверете оставащите договорености с домакина и екипа. Съберете обратна връзка; при лагер над два дни преместете тази задача след реалния край.",
        "Check outstanding arrangements with host and team. Gather feedback; for camps longer than two days move this task after the actual finish.",
      ),
    ],
  ),
  template(
    "dojo-open-day",
    "community",
    "beginner",
    1,
    {
      bg: "Отворени врати и демонстрация в доджото",
      en: "Dojo open day and demonstration",
    },
    {
      bg: "Посрещане на нови посетители с ясна демонстрация, безопасна среда и лесна следваща стъпка.",
      en: "Welcome new visitors with a clear demonstration, a safe environment and an easy next step.",
    },
    {
      bg: "За клуб, който представя практиката си пред начинаещи и семейства. Участието в пробна практика се съгласува с инструктора.",
      en: "For a club introducing its practice to newcomers and families. Agree any trial participation with the instructor.",
    },
    [
      task(
        "open-day-format",
        -28,
        "programme",
        "Уточнете формата и демонстрацията с инструктора",
        "Agree the format and demonstration with the instructor",
        "Определете какво зрителите ще наблюдават и дали има пробна практика. Съобразете съдържанието с начинаещи посетители.",
        "Decide what visitors will watch and whether trial practice is offered. Adapt the content for newcomers.",
      ),
      task(
        "visitor-space",
        -21,
        "venue",
        "Отделете безопасно място за посетителите",
        "Arrange safe visitor space",
        "Проверете капацитет, достъпност и видимост без пресичане на тренировъчната зона. Уточнете място за обувки и лични вещи.",
        "Check capacity, accessibility and sightlines without crossing the practice area. Agree space for shoes and belongings.",
        "important",
      ),
      task(
        "visitor-invitation",
        -14,
        "communication",
        "Публикувайте покана с ясни условия",
        "Publish an invitation with clear participation terms",
        "Дайте потвърдени място, програма и контакт. Посочете дали се изисква записване и каква екипировка е нужна за пробната част.",
        "Share confirmed venue, programme and contact. State whether registration and any trial-session equipment are needed.",
      ),
      task(
        "demonstration-rehearsal",
        -7,
        "programme",
        "Репетирайте демонстрацията и обясненията",
        "Rehearse the demonstration and explanations",
        "Проверете преходите и разбираемите обяснения с демонстриращите. Инструкторът определя безопасното съдържание и партньорите.",
        "Check transitions and understandable explanations with demonstrators. The instructor determines safe content and partners.",
      ),
      task(
        "visitor-safety",
        -5,
        "safety",
        "Потвърдете помощта и правилата за пробната част",
        "Confirm assistance and trial participation rules",
        "Уточнете първата помощ, изходите и нужните съгласия с клуба. При снимане обяснете избора на посетителите и приложимия ред за съгласие.",
        "Agree first aid, exits and required consents with the club. If taking photos, explain visitor choices and the applicable consent process.",
        "important",
      ),
      task(
        "welcome-team",
        -2,
        "people",
        "Подгответе посрещането и отговорите на въпроси",
        "Prepare the welcome team and questions",
        "Разпределете посрещане, насочване и разговор след демонстрацията. Подгответе потвърдена информация за първа тренировка.",
        "Allocate welcome, wayfinding and conversation after the demonstration. Prepare confirmed first-training information.",
      ),
      task(
        "open-doors-check",
        0,
        "venue",
        "Проверете зоните и посрещнете посетителите",
        "Check the zones and welcome visitors",
        "Проверете табелите, проходите и разграничението на зрители и практикуващи. Обяснете правилата преди началото.",
        "Check signs, walkways and separation of spectators and practitioners. Explain the rules before starting.",
      ),
      task(
        "visitor-follow-up",
        2,
        "review",
        "Изпратете следващи стъпки на пожелалите контакт",
        "Send next steps to visitors who requested contact",
        "Свържете се само с хората, поискали информация. Дайте потвърдени възможности за начинаещи и обсъдете с екипа наученото от деня.",
        "Contact only people who requested information. Share confirmed beginner opportunities and review what the team learned.",
      ),
    ],
  ),
  template(
    "guest-instructor-logistics",
    "logistics",
    "standard",
    null,
    { bg: "Логистика за гост-инструктор", en: "Guest instructor logistics" },
    {
      bg: "Фокусиран план за пътуване, настаняване и контакт с гост, без предположени часове.",
      en: "A focused guest travel, accommodation and contact plan without assumed times.",
    },
    {
      bg: "За координатор на гост към вече планирано събитие. Началната дата е опорна точка; сверете всички действия с реалния маршрут.",
      en: "For a guest coordinator supporting an already planned event. The start date is a reference; check every action against the actual itinerary.",
    },
    [
      task(
        "guest-needs",
        -42,
        "planning",
        "Уточнете нуждите и отговорностите с госта",
        "Agree needs and responsibilities with the guest",
        "Потвърдете дати, работен език, разходи и организационен контакт. Поискайте само информацията, необходима за договорената помощ.",
        "Confirm dates, working language, expenses and a coordination contact. Request only information needed for the agreed support.",
      ),
      task(
        "guest-documents",
        -35,
        "administration",
        "Проверете нужната подкрепа за пътуването",
        "Check any travel documentation support",
        "Попитайте госта дали е нужна покана или друг документ от домакина. Гостът потвърждава актуалните изисквания чрез официални източници.",
        "Ask whether the guest needs a host invitation or other document. The guest confirms current requirements through official sources.",
      ),
      task(
        "guest-stay",
        -28,
        "travel",
        "Потвърдете резервацията и условията за престой",
        "Confirm the reservation and stay arrangements",
        "Уточнете реални дати, достъпност, плащане и приемане с мястото за настаняване. Ако не се изисква нощувка, изключете тази задача.",
        "Confirm actual dates, accessibility, payment and arrival arrangements with the lodging host. Deselect this task if no overnight stay is needed.",
      ),
      task(
        "guest-route",
        -14,
        "travel",
        "Получете потвърдения маршрут",
        "Obtain the confirmed itinerary",
        "Потвърдете действителните спирки, пристигане и отпътуване. Не записвайте паспортни или други ненужни лични данни в общите задачи.",
        "Confirm actual stops, arrival and departure. Do not put passport details or other unnecessary personal data in shared tasks.",
        "important",
      ),
      task(
        "guest-driver",
        -10,
        "travel",
        "Определете посрещане и резервен контакт",
        "Agree pickup and a backup contact",
        "Съгласувайте точките за среща, превозното средство и багажа с госта и шофьора. Проверете как се реагира при закъснение.",
        "Agree meeting points, vehicle and baggage with the guest and driver. Check the response to delays.",
      ),
      task(
        "guest-briefing",
        -5,
        "communication",
        "Изпратете кратък организационен план на госта",
        "Send the guest a short coordination brief",
        "Дайте потвърдените адреси, програма и контакти. Уточнете времето за почивка и придвижване според наличността на госта.",
        "Share confirmed addresses, programme and contacts. Agree rest and transfer time around guest availability.",
      ),
      task(
        "guest-reconfirm",
        -1,
        "travel",
        "Сверете посрещането с актуалния маршрут",
        "Recheck pickup against the current itinerary",
        "Потвърдете последните промени с госта, шофьора и домакина. Изпълнете посрещането по реалния график, който може да е на друга дата.",
        "Confirm recent changes with guest, driver and host. Carry out pickup on the actual schedule, which may fall on another date.",
        "important",
      ),
      task(
        "guest-departure-plan",
        0,
        "travel",
        "Потвърдете обратното пътуване и приключването",
        "Confirm departure and closing arrangements",
        "Сверете отпътуването, освобождаването на настаняването и договорените разходи. Планирайте изпълнението по действителния край на гостуването.",
        "Check departure, checkout and agreed expenses. Plan execution against the actual end of the visit.",
      ),
    ],
  ),
  template(
    "local-martial-arts-tournament",
    "tournaments",
    "advanced",
    1,
    {
      bg: "Местен турнир по бойни изкуства",
      en: "Local martial-arts tournament",
    },
    {
      bg: "Организация на местен турнир според потвърдените правила на съответната дисциплина.",
      en: "Organize a local tournament under the confirmed rules of the relevant discipline.",
    },
    {
      bg: "За опитен клубен екип и компетентни съдии. Не е шаблон за айкидо състезание и не определя спортни или медицински изисквания.",
      en: "For an experienced club team and qualified officials. This is not an Aikido competition template and does not define sporting or medical requirements.",
    },
    [
      task(
        "tournament-rules",
        -60,
        "planning",
        "Потвърдете дисциплината, правилника и разрешенията",
        "Confirm discipline, rules and permissions",
        "Изберете приложимия актуален правилник с компетентната организация. Уточнете изискваните разрешения, категории и отговорни лица.",
        "Select the current applicable rules with the responsible organization. Clarify required permissions, divisions and responsible officials.",
        "important",
      ),
      task(
        "tournament-venue",
        -45,
        "venue",
        "Осигурете състезателните и помощните зони",
        "Secure competition and support areas",
        "Проверете размера и безопасността на зоните, място за загряване и зрители. Потвърдете достъпа за екипа и необходимото оборудване.",
        "Check area dimensions and safety, warm-up space and spectators. Confirm team access and required equipment.",
        "important",
      ),
      task(
        "tournament-officials",
        -35,
        "people",
        "Потвърдете съдийския и организационния екип",
        "Confirm officials and the organizing team",
        "Уточнете квалификацията и наличността на съдиите по приложимите правила. Разпределете регистрация, резултати и координация.",
        "Confirm officials' qualifications and availability under the applicable rules. Allocate registration, results and coordination.",
      ),
      task(
        "tournament-assistance",
        -28,
        "safety",
        "Потвърдете изискваната медицинска и аварийна подкрепа",
        "Confirm required medical and emergency support",
        "С компетентните лица и домакина уточнете необходимото покритие и реда при инцидент. Не приемайте, че обикновена аптечка покрива изискванията за турнир.",
        "Agree required coverage and incident procedures with qualified personnel and the venue. Do not assume a basic first-aid kit meets tournament requirements.",
        "important",
      ),
      task(
        "tournament-entry",
        -25,
        "administration",
        "Публикувайте условията и отворете заявките",
        "Publish entry terms and open registration",
        "Посочете потвърдените правила, допустимост, такси и срокове. Уточнете необходимите декларации и ограничете достъпа до лични данни.",
        "Publish confirmed rules, eligibility, fees and deadlines. Clarify required declarations and restrict personal-data access.",
      ),
      task(
        "tournament-entries-check",
        -10,
        "administration",
        "Проверете заявките по приложимите категории",
        "Validate entries against the applicable divisions",
        "Нека компетентните лица проверят допустимостта и категориите. Уточнете корекциите с клубовете преди изготвяне на схемите.",
        "Have authorized officials check eligibility and divisions. Resolve corrections with clubs before preparing draws.",
      ),
      task(
        "tournament-draw",
        -5,
        "programme",
        "Потвърдете схемите и реда за промени",
        "Confirm draws and the change process",
        "Изгответе схемите чрез одобрения метод и ги проверете със съдиите. Посочете как се обработват отсъствия или корекции.",
        "Prepare draws using the approved method and check them with officials. Define how withdrawals or corrections are handled.",
      ),
      task(
        "tournament-brief",
        -3,
        "communication",
        "Изпратете графика и указанията до клубовете",
        "Send the schedule and instructions to clubs",
        "Потвърдете регистрацията на място, екипировката и контактите. Включете кантар или други процедури само ако правилникът ги изисква.",
        "Confirm onsite registration, equipment and contacts. Include weigh-in or other procedures only when required by the rules.",
      ),
      task(
        "tournament-equipment",
        -1,
        "venue",
        "Тествайте оборудването и записването на резултати",
        "Test equipment and results recording",
        "Проверете настилката, таблата, таймерите и резервния начин за запис. Потвърдете настройките с главния съдия.",
        "Check surfaces, scoreboards, timers and backup recording. Confirm settings with the chief official.",
      ),
      task(
        "tournament-opening",
        0,
        "safety",
        "Потвърдете готовността преди първата среща",
        "Confirm readiness before the first bout",
        "Проверете съдиите, медицинското покритие, зоните и комуникацията. Започнете само след потвърждение от отговорните лица.",
        "Check officials, medical coverage, areas and communication. Start only after responsible personnel confirm readiness.",
        "important",
      ),
      task(
        "tournament-close",
        2,
        "review",
        "Проверете резултатите и приключете турнира",
        "Verify results and close the tournament",
        "Потвърдете протоколите с главния съдия и начина за публикуване. Приключете договореностите със залата и запишете организационните изводи.",
        "Confirm records and publication arrangements with the chief official. Close venue arrangements and record organizational lessons.",
      ),
    ],
  ),
  template(
    "multi-club-workshop",
    "workshops",
    "standard",
    1,
    {
      bg: "Съвместна спортна работилница на няколко клуба",
      en: "Multi-club sports workshop",
    },
    {
      bg: "Обща подготовка за клубове с различни практики, нива и организационни навици.",
      en: "Shared preparation for clubs with different practices, levels and organizing habits.",
    },
    {
      bg: "За координатор между няколко клуба. Подходящ за обмен на опит без състезателен формат.",
      en: "For a coordinator connecting several clubs. Suitable for experience sharing without a competition format.",
    },
    [
      task(
        "club-contacts",
        -42,
        "people",
        "Определете координатор от всеки клуб",
        "Name a coordinator from each club",
        "Потвърдете общата цел и участващите клубове. Уточнете кой одобрява програмата и как се решават организационни промени.",
        "Confirm the shared purpose and participating clubs. Agree programme approval and how organizing changes are resolved.",
      ),
      task(
        "shared-programme",
        -28,
        "programme",
        "Съгласувайте съвместима програма",
        "Agree a compatible programme",
        "Уточнете нивата, водещите и ограниченията на всяка практика. Инструкторите определят безопасното участие в смесени групи.",
        "Agree levels, session leaders and practice limitations. Instructors determine safe participation in mixed groups.",
        "important",
      ),
      task(
        "shared-space",
        -21,
        "venue",
        "Потвърдете залата и оборудването за всички групи",
        "Confirm venue and equipment for all groups",
        "Проверете капацитета и отделните тренировъчни зони. Уточнете кое оборудване носи всеки клуб.",
        "Check capacity and separate practice areas. Agree which equipment each club brings.",
      ),
      task(
        "shared-entry",
        -14,
        "administration",
        "Съгласувайте записването и разпределението на разходите",
        "Agree registration and expense sharing",
        "Потвърдете условията и начина за отчитане между клубовете. Поискайте само необходимите данни за участниците.",
        "Confirm terms and accounting arrangements between clubs. Request only necessary participant information.",
      ),
      task(
        "shared-safety",
        -10,
        "safety",
        "Уточнете общите правила за безопасност",
        "Agree shared safety rules",
        "Потвърдете първата помощ и реда при инцидент. Обсъдете с инструкторите как се обясняват различията в етикета и практиката.",
        "Confirm first aid and incident procedures. Agree with instructors how differences in etiquette and practice are explained.",
        "important",
      ),
      task(
        "shared-brief",
        -5,
        "communication",
        "Изпратете обща информация чрез клубните координатори",
        "Send shared information through club coordinators",
        "Сверете програмата, адреса, екипировката и контактите. Нека всеки клуб потвърди, че участниците са получили актуалната версия.",
        "Check programme, address, equipment and contacts. Have each club confirm participants received the current version.",
      ),
      task(
        "shared-welcome",
        0,
        "people",
        "Посрещнете клубовете и потвърдете готовността",
        "Welcome clubs and confirm readiness",
        "Проверете присъствието на водещите и подредбата. Представете общите правила и контакт за организационни въпроси.",
        "Check session leaders and layout. Introduce shared rules and the contact for organizing questions.",
      ),
      task(
        "shared-review",
        2,
        "review",
        "Съберете обратна връзка от всеки клуб",
        "Gather feedback from each club",
        "Проверете връщането на общото оборудване и оставащите договорености. Обсъдете какво е помогнало за съвместната работа.",
        "Check shared equipment return and outstanding agreements. Discuss what helped the clubs work together.",
      ),
    ],
  ),
  template(
    "guest-speaker-workshop",
    "workshops",
    "beginner",
    1,
    {
      bg: "Образователна работилница с гост-лектор",
      en: "Educational workshop with a guest speaker",
    },
    {
      bg: "Достъпен план за малка практическа среща: ясна цел, материали и работеща техника.",
      en: "An accessible plan for a small practical session: a clear goal, materials and working equipment.",
    },
    {
      bg: "За начинаещ организатор в клуб или образователна общност. Подходящ за присъствена еднодневна работилница.",
      en: "For a new organizer in a club or learning community. Suitable for an in-person, one-day workshop.",
    },
    [
      task(
        "learning-goal",
        -28,
        "planning",
        "Съгласувайте целта и аудиторията с лектора",
        "Agree the learning goal and audience with the speaker",
        "Уточнете какво участниците ще упражнят и какви предварителни знания са нужни. Потвърдете наличността и условията на госта.",
        "Agree what participants will practise and any prior knowledge needed. Confirm guest availability and terms.",
        "important",
      ),
      task(
        "workshop-room",
        -21,
        "venue",
        "Потвърдете достъпна зала и нужната техника",
        "Confirm an accessible room and equipment",
        "Проверете местата, работните повърхности, достъпа и възможностите за представяне. Уточнете резервен вариант при отказ на техника.",
        "Check seating, work surfaces, access and presentation facilities. Agree a fallback for equipment failure.",
      ),
      task(
        "workshop-invite",
        -14,
        "communication",
        "Изпратете покана с очакваните резултати",
        "Send an invitation with expected learning outcomes",
        "Посочете целта, потвърдените условия и начина за записване. Уточнете какво носят участниците и как могат да заявят нужда от достъпност.",
        "State the purpose, confirmed terms and registration method. Clarify what participants bring and how to request accessibility support.",
      ),
      task(
        "workshop-materials",
        -7,
        "programme",
        "Проверете материалите и правото за използване",
        "Check materials and permission to use them",
        "С лектора прегледайте упражненията и нужните копия. Потвърдете разрешението за споделяне; не разпространявайте чужди материали без основание.",
        "Review activities and required copies with the speaker. Confirm sharing permission; do not distribute others' materials without authorization.",
      ),
      task(
        "workshop-rehearsal",
        -3,
        "venue",
        "Тествайте представянето и резервния вариант",
        "Test the presentation and fallback",
        "Проверете звук, картина и нужните файлове с лектора. Подгответе договорения вариант при проблем с интернет или техника.",
        "Check sound, visuals and required files with the speaker. Prepare the agreed fallback for internet or equipment problems.",
      ),
      task(
        "workshop-welcome",
        0,
        "people",
        "Подгответе залата и посрещнете участниците",
        "Prepare the room and welcome participants",
        "Проверете материалите, достъпа и свободните изходи. Уточнете програмата, почивките и начина за въпроси с госта.",
        "Check materials, access and clear exits. Confirm programme, breaks and questions with the guest.",
      ),
      task(
        "workshop-follow-up",
        2,
        "review",
        "Споделете разрешените материали и поискайте обратна връзка",
        "Share permitted materials and request feedback",
        "Изпратете само материалите, одобрени за споделяне, на пожелалите ги участници. Попитайте кои упражнения са били полезни и какво е останало неясно.",
        "Send only approved materials to participants who requested them. Ask which activities helped and what remained unclear.",
      ),
    ],
  ),
  template(
    "two-day-training-course",
    "courses",
    "standard",
    2,
    { bg: "Двудневен обучителен курс", en: "Two-day training course" },
    {
      bg: "Свързана двудневна програма с упражнения, материали и преглед на наученото.",
      en: "A connected two-day programme with activities, materials and a learning review.",
    },
    {
      bg: "За организатор и обучител, които водят практическо обучение. Не предполага акредитация или право за издаване на квалификация.",
      en: "For an organizer and trainer running practical learning. It assumes neither accreditation nor authority to award qualifications.",
    },
    [
      task(
        "course-outcomes",
        -42,
        "planning",
        "Уточнете резултатите и началното ниво",
        "Agree outcomes and entry level",
        "Потвърдете какви умения се упражняват и за кого е курсът. Уточнете условията с обучителя преди обявяване.",
        "Confirm the skills practised and intended participants. Agree terms with the trainer before announcement.",
        "important",
      ),
      task(
        "course-space",
        -28,
        "venue",
        "Осигурете залата и оборудването за двата дни",
        "Secure the room and equipment for both days",
        "Проверете достъпността, капацитета и съхраняването на материали между дните. Потвърдете часовете за достъп с домакина.",
        "Check accessibility, capacity and storage between days. Confirm access windows with the host.",
      ),
      task(
        "course-sequence",
        -21,
        "programme",
        "Подредете упражненията в двудневна последователност",
        "Sequence activities across the two days",
        "С обучителя свържете основите от първия ден с практиката през втория. Включете почивки и време за въпроси.",
        "Connect day-one foundations with day-two practice with the trainer. Include breaks and time for questions.",
      ),
      task(
        "course-enrolment",
        -18,
        "administration",
        "Потвърдете записването и условията",
        "Confirm enrolment and terms",
        "Посочете реалните такси, срокове, отказ и предварителна подготовка. Обяснете точно какъв документ за участие се предлага, ако има такъв.",
        "State actual fees, deadlines, cancellation and preparation. Explain precisely any attendance document offered.",
      ),
      task(
        "course-materials",
        -10,
        "programme",
        "Проверете материалите и нужната предварителна работа",
        "Check materials and preparation work",
        "Потвърдете правата за ползване и споделяне на материалите. Изпратете необходимата подготовка достатъчно рано за участниците.",
        "Confirm rights to use and share materials. Send required preparation early enough for participants.",
      ),
      task(
        "course-ready",
        -3,
        "people",
        "Потвърдете екипа и окончателните указания",
        "Confirm the team and final joining instructions",
        "Сверете присъствието на обучителя, помощниците и нуждите за достъпност. Изпратете адрес, програма, оборудване и контакт за промени.",
        "Check trainer and helper attendance and accessibility needs. Send address, programme, equipment and a change contact.",
      ),
      task(
        "course-day-one",
        0,
        "venue",
        "Проверете готовността и открийте първия ден",
        "Check readiness and open day one",
        "Тествайте оборудването, материалите и безопасния достъп. Уточнете с обучителя как се събират въпроси за втория ден.",
        "Test equipment, materials and safe access. Agree with the trainer how questions are collected for day two.",
      ),
      task(
        "course-day-two",
        1,
        "programme",
        "Прегледайте въпросите и подгответе втория ден",
        "Review questions and prepare day two",
        "С обучителя прегледайте въпросите от първия ден и проверете нужните материали. При промяна на продължителността адаптирайте тази задача.",
        "Review day-one questions and required materials with the trainer. Adapt this task if the course duration changes.",
      ),
      task(
        "course-review",
        3,
        "review",
        "Приключете курса и поискайте обратна връзка",
        "Close the course and request feedback",
        "Споделете разрешените ресурси и договорените документи за участие. Проверете връщането на оборудване и обсъдете постигнатото с обучителя.",
        "Share permitted resources and agreed attendance documents. Check equipment return and review outcomes with the trainer.",
      ),
    ],
  ),
];

export const curatedIdPattern = /^curated-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export function validateCuratedCatalog(catalog: readonly CuratedTemplate[]) {
  const ids = new Set<string>();
  for (const entry of catalog) {
    if (
      !curatedIdPattern.test(entry.id) ||
      entry.id.length > 100 ||
      ids.has(entry.id) ||
      entry.version !== 1 ||
      entry.items.length < 6 ||
      entry.items.length > 50 ||
      !["beginner", "standard", "advanced"].includes(entry.difficulty) ||
      ![
        "aikido",
        "examinations",
        "camps",
        "community",
        "logistics",
        "tournaments",
        "workshops",
        "courses",
      ].includes(entry.category) ||
      (entry.durationDays !== null &&
        (!Number.isSafeInteger(entry.durationDays) ||
          entry.durationDays < 1 ||
          entry.durationDays > 31))
    )
      throw Error("Invalid curated template metadata");
    ids.add(entry.id);
    for (const field of [entry.name, entry.description, entry.audience]) {
      if (
        !field.bg.trim() ||
        !/[А-Яа-я]/u.test(field.bg) ||
        !field.en.trim() ||
        field.bg === field.en ||
        field.bg.length > 2000 ||
        field.en.length > 2000
      )
        throw Error("Incomplete curated localization");
    }
    const itemIds = new Set<string>();
    for (const item of entry.items) {
      if (
        !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(item.id) ||
        item.id.length > 100 ||
        itemIds.has(item.id) ||
        !Number.isSafeInteger(item.dayOffset) ||
        Math.abs(item.dayOffset) > 3660 ||
        item.reminderOffsets.length ||
        item.text.bg.title === item.text.en.title ||
        !/[А-Яа-я]/u.test(item.text.bg.context)
      )
        throw Error("Invalid curated item");
      itemIds.add(item.id);
      for (const language of ["bg", "en"] as const) {
        const text = item.text[language];
        if (!text.category.trim() || text.context.trim().length < 40)
          throw Error("Incomplete curated item text");
        parseTaskAuthoring({
          ...text,
          priority: item.priority,
          deadline: "2026-11-20",
          deadlineTime: item.deadlineTime,
          reminderOffsets: [],
          assignedMemberId: null,
        });
      }
    }
  }
}
validateCuratedCatalog(CURATED_TEMPLATES);
function freeze(value: object) {
  for (const child of Object.values(value))
    if (child && typeof child === "object") freeze(child);
  Object.freeze(value);
}
freeze(CURATED_TEMPLATES);
export function curatedBlueprint(id: string) {
  return CURATED_TEMPLATES.find((entry) => entry.id === id);
}
export function curatedCatalogResponse() {
  return {
    catalogVersion: 1,
    templates: CURATED_TEMPLATES.map((entry) => ({
      ...entry,
      itemCount: entry.items.length,
    })),
  };
}

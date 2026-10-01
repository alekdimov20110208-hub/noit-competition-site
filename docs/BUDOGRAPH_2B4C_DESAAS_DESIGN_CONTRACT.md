# PHASE 2B.4C DESIGN CONTRACT

**Human-Led Dashboard + Tasks De-SaaS Design Contract**

> Repository persistence — 2026-10-02: The human-approved contract below is
> reproduced in full, with four explicitly requested implementation guardrails.
> Its read-only/no-file-change/no-commit statements describe the original design
> phase. This documentation-only persistence step does not authorize implementation.

Договор за бъдеща визуална реализация. **Няма започната реализация или файлови промени.**

Проверен baseline: `7d816583df6b0539707c7322875a877795f4ec5e` — `fix(app): align BudoGraph interface language`. Четирите предоставени screenshots са човешката визуална основа. Изводите са от тях и текущия код; няма ново браузърно или потребителско тестване.

## A. DESIGN PROBLEM

Проблемът е **съвместното действие на иначе допустими елементи**.

Dashboard натрупва presentation grammar: голяма обобщаваща карта, kicker, състояния, заглавие, подзаглавие, икони, разделители, progress bar и равностойни показатели. След нея секциите повтарят сходна визуална последователност. Това отслабва разликата между контекст, непосредствено решение, подготовка във времето и реакция при промяна.

Tasks има добра основна структура. Общото усещане идва предимно от независимите слоеве над регистъра: заглавие, обяснение, минитабло с показатели и отделна лента с филтри.

**Човешката оценка се приема като основание за този договор.** Не се предлага нова палитра, шрифт, навигация или продуктова идея.

Прочетени са изцяло [master prompt](/C:/NOIT/noit-competition-site/docs/NOIT_MASTER_PROMPT.md), [Team design contract](/C:/NOIT/noit-competition-site/docs/BUDOGRAPH_TEAM_2B3_DESIGN_CONTRACT.md) и 30-те страници на регламента: :codex-file-citation{path="C:/NOIT/noit-competition-site/docs/NOIT_REGULATIONS_2025_2026.pdf" purpose="source"}.

- **Потвърдено за 2025–2026:** самостоятелен завършен продукт, код, документация, лицензи/GPLv3, онлайн достъп и тестови акаунти за наличните роли; оценяване на архитектура, UI/UX и доказателства.
- **За следваща година:** категориите, допустимостта, сроковете, лицензните условия, периодът на достъпност, форматът на документацията и оценяването изискват нова проверка. Такава проверка не е извършвана тук.
- **Вътрешни решения:** този визуален договор, заключването на Team и срокът 15.09.2026 не са официални правила на НОИТ.

## B. SUBJECT

**Dashboard показва какво изисква намеса в подготовката на конкретния семинар, какво предстои и кой носи отговорност за реакцията. Tasks е работният регистър на тази подготовка.**

Предметната специфика идва от отношенията между реалните данни:

- пристигане на инструктора, трансфер и настаняване;
- достъп до залата, татами и тренировъчна програма;
- инструкции за участниците и регистрация на място;
- възложена и приета отговорност;
- промяна, засегната работа, отговорник и следваща проверка.

Team служи за пример как структурата следва оперативния въпрос. **Неговият roster/detail layout не се пренася в Dashboard или Tasks.**

Класификация:

- **KEEP:** структурата има ясна информационна функция.
- **REFINE:** функцията и структурата остават; променят се тежест, подравняване или плътност.
- **RECOMPOSE:** самата композиция създава проблема; същата информация получава различни отношения.

## C. DASHBOARD NEW COMPOSITION

**Класификация: REFINE общата композиция; без пренаписване на страницата.**

**CURRENT:** пет оперативни предмета, но прекалено сходна рамка на секциите и доминиращ Event Overview.

**PROBLEM:** визуалната равнопоставеност прикрива различната им употреба. Portability test: същата обвивка лесно би обслужвала CRM dashboard.

**NEW RULE:** запазва се редът, но всеки предмет получава собствен начин на четене:

| Предмет              | Нова визуална роля                                         |
| -------------------- | ---------------------------------------------------------- |
| Event Overview       | Компактен оперативен контекст                              |
| Decision Queue       | Най-силен непосредствен фокус; водеща е конкретната задача |
| Preparation Timeline | По-тиха последователност, организирана около дати          |
| Operational Changes  | Запис на промяна и текуща реакция                          |
| Team Pressure        | Кратък списък на основанията да бъде прегледан човек       |

Запазва се съществуващата desktop двойка queue/timeline и нейното съотношение `1.08fr / 0.92fr`. Няма нужда от ново съотношение само за визуална различност. Разликата идва от йерархията и вътрешната организация. Не се изравняват височините и броят на видимите редове.

**WHY IT IS SPECIFIC TO BUDOGRAPH:** организаторът първо установява семинара, после намира необходимото решение, проверява предстоящата подготовка и проследява реакцията при промяна.

**WHAT MUST NOT CHANGE:** петте предмета, техният ред, данните, selectors, breakpoint за подреждане в една колона и всички действия.

## D. EVENT OVERVIEW

**Класификация: RECOMPOSE.**

**CURRENT:** тъмна hero карта с горен златен кант, kicker, state labels, голямо заглавие, subtitle, icon metadata, progress bar и пет равни KPI клетки.

**PROBLEM:** композицията представя семинара като продуктова витрина. Portability test: структурата може да бъде използвана за клиентски акаунт или търговска кампания само със смяна на текстовете.

**NEW RULE:**

1. Event Overview става **плосък readout върху canvas**, с един долен разделител. Отпадат отделният повдигнат фон, сянката, заоблената външна рамка и горният акцент.
2. Първи ред: пълно име на събитието и съществуващото **Review all tasks**.
3. Непосредствено под името: гост-инструктор, event status и Fictional demo като поддържащ контекст. Премахва се „Organizer command center“, защото не добавя факт.
4. Следват датите, пълното място и броят организатори/помощници. Те се четат като свързани факти, без задължителна икона пред всеки.
5. Task progress и броячите се събират в компактна отчетна област:

   **Completed 3 / Total tasks 16 · Task progress 19%**\
   **Active 12 · Blocked 1 · Overdue 1**

   Това е пример от предоставения snapshot; стойностите остават изчислявани.

6. Progress bar остава, но е къс поддържащ индикатор до completion факта — приблизително 160–220 CSS px на широк екран, без самостоятелна широка колона.
7. Няма пет равни клетки, вертикални разделители или увеличен размер на всяка цифра.

**Implementation guardrail — Event Overview**

The event status and Fictional demo context must be rendered as supporting text.
Do NOT turn them into:

- pills;
- chips;
- badges;
- segmented controls.

**WHY IT IS SPECIFIC TO BUDOGRAPH:** свързва периода, мястото и хората на семинара с фактическото състояние на подготовката. Completion и total са видимо свързани с процента.

**WHAT MUST NOT CHANGE:** име, гост, event status, fictional disclosure, дати, venue, team count, петте брояча, формулата и достъпното означение на progress bar, Review all tasks и неговият маршрут. Процентът остава напредък по задачи; не се представя като оценка за готовност или безопасност.

## E. DECISION QUEUE

**Класификация: RECOMPOSE вътрешната йерархия; KEEP логиката.**

**CURRENT:** accent line → kicker → heading → explanation; после номерирани редове с action label, силен priority label, заглавие, причини и metadata.

**PROBLEM:** `01/02/03`, цветният приоритет и оцветената площ конкурират самото решение. Portability test: визуално това е общ списък с аларми или support escalations.

**NEW RULE:**

1. Един видим heading: **Requires your attention / Изисква внимание**. Отпадат отделният kicker и общото обяснение над списъка.
2. Първият визуален ред във всяка задача е нейното **пълно заглавие**.
3. Съществуващият action label следва непосредствено под него като кратко указание.
4. Всички канонични причини остават заедно и видими. `blockedBy` се запазва, когато присъства.
5. Owner, Due/Was due и Priority образуват поддържащ metadata ред. Приоритетът повече не стои като отделен силен сигнал вдясно отгоре.
6. Отпадат видимите поредни номера. Подреденият списък и действителният ред се запазват.
7. Редовете използват общ регион и леки разделители. За blocked/overdue остава тесен маркер; отпадат постоянният оцветен блок и усиленият горен border на целия ред.
8. Не се добавя lifecycle badge към queue. Текущата реализация показва lifecycle чрез приложимите причини; няма основание за ново повторение.

**Implementation guardrail — Decision Queue**

The action label under each task title is utility text.
Do NOT turn it into:

- a badge;
- a kicker;
- a pill;
- a second competing headline.

The task title remains the first and strongest line.

**WHY IT IS SPECIFIC TO BUDOGRAPH:** първо се вижда коя реална подготовка изисква действие, после какво действие е необходимо, защо и при кого е отговорността.

**WHAT MUST NOT CHANGE:** `getAttentionTasks`, comparator, всички reasons, action selection, priority values, owner, deadline, whole-row task anchor, първите пет задачи, Show more/less и Dashboard return context.

„Accept task“ продължава да отваря задачата. Не става нов inline бутон за приемане.

## F. PREPARATION TIMELINE

**Класификация: RECOMPOSE представянето; KEEP времевия модел.**

**CURRENT:** повтарящ се section header, обяснение, вертикални релси и точки; за всеки запис — дата, kind, title, owner и отделен status.

**PROBLEM:** релсите и повтореният component shell доминират над подготовката. Portability test: това е лесно преносим project timeline.

**NEW RULE:**

1. Един heading: **Seminar preparation / Подготовка на семинара**, със съществуващото View tasks.
2. Запазват се групите **Today, Next 7 days, Later** и наличната в кода **Current or missed** за незавършени минали milestones.
3. Всеки запис използва компактна дата вляво и съдържание вдясно. Отпадат вертикалната релса и точката.
4. Заглавието е първо в съдържанието; под него са kind, owner и lifecycle в един естествено пренасящ се ред.
5. Milestone остава изрично означен с текст и получава малко повече пространство пред себе си. Няма task owner или кликаемост, ако такива не съществуват.
6. Датите се показват за всеки запис, включително при повторение. Не се създават нови групи, които могат да разкъсат disclosures или sorting.
7. Реалните заглавия за arrival, accommodation, venue, tatami, schedule и check-in носят предметната специфика. Няма нови „етапи“, извлечени от ключови думи.

**WHY IT IS SPECIFIC TO BUDOGRAPH:** съпоставя конкретната подготовка с датите и семинарните milestones. Task означава възложена работа; milestone означава организационен ориентир. Тази разлика получава пространство, вместо декоративна точка.

**WHAT MUST NOT CHANGE:** membership, ordering, dates, task/milestone distinction, owners, lifecycle, links и preview limits: current `2`, today `3`, near `4`, later `4`. Всички disclosures остават.

Хронологията не означава причинна зависимост. Не се рисуват стрелки между arrival, accommodation и schedule.

## G. OPERATIONAL CHANGE RECORD

**Класификация: RECOMPOSE.**

**CURRENT:** голяма оградена повърхност, червен ляв кант, два оцветени етикета, описание, metadata, двуколонни details и отделен checkpoint footer.

**PROBLEM:** информацията е силна, но преминаването през многото визуални слоеве забавя прочита. Portability test: обвивката е стандартна incident card.

**NEW RULE:** всяка промяна става плосък запис с четири последователни отношения:

| Въпрос              | Съдържание и йерархия                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Какво се промени?   | Заглавие, severity и пълно съществуващо описание                                           |
| Какво засяга?       | Брой засегнати задачи и всички `affectedAreas` в компактен списък                          |
| Кой води реакцията? | Response owner, response status и reported date/time                                       |
| Какво следва?       | Пълният current response; непосредствено след него — съществуващият checkpoint link и срок |

Допълнителни правила:

- Запазва се semantic `article`, но отпада отделната card обвивка.
- Един неутрален разделител разграничава съседни записи.
- Severity използва съществуващия semantic цвят. Response status се означава независимо; той не наследява автоматично червено от severity.
- Полетата са подравнени като label/value отношения. Няма равни вложени панели.
- Checkpoint остава до текста за реакцията, с ляво подравняване; повече не е далечен десен footer.
- Всички описания се пренасят изцяло. Не се заменят с генерирани резюмета.

**Implementation guardrail — Operational Change Record**

Severity and response status remain separate semantic concepts.
Do NOT render both as adjacent strong pills/badges.
At least one should use plain semantic text or another restrained treatment.
The record must remain readable as information, not as a collection of status components.

**WHY IT IS SPECIFIC TO BUDOGRAPH:** реалният запис за променено пристигане свързва засегнатите подготовка и график с отговорника и точната следваща задача.

**WHAT MUST NOT CHANGE:** всички показвани факти, `affectedTaskIds`, `affectedAreas`, severity, response status, reported time, response text, checkpoint selection, неговият маршрут, active-change filtering, първият видим запис и disclosure за останалите.

**Change Consequence Path остава извън реализацията.**

## H. TEAM PRESSURE

**Класификация: REFINE.**

**CURRENT:** initials tile, име/роля, централен сигнал и отдалечени вдясно броячи.

**PROBLEM:** четирите визуални острова напомнят admin workload row. Името и основанието за проверка са прекалено отделени.

**NEW RULE:**

- Отпада initials tile само в Dashboard TeamPressure.
- Остават две свързани области: **име + пълна роля** и **сигнал + неговите броячи**.
- Сигналът и числата стоят един до друг или едно под друго, вместо в две далечни колони.
- Отпадат постоянните оцветени фонове и кантове на person редовете. Рискът остава в означения с текст сигнал.
- Запазват се всички текущи blocked/overdue/active стойности, включително нулите.
- Обяснението за обхвата на секцията остава: то пояснява защо някои хора не са в основния списък.

**WHY IT IS SPECIFIC TO BUDOGRAPH:** ролята обяснява коя част от семинара е при човека, а непосредствено до нея стои основанието той да бъде прегледан.

**WHAT MUST NOT CHANGE:** pressure membership, ordering, threshold `active ≥ 4`, preview `3`, quiet disclosure, empty states и View team.

Person редовете остават некликаеми. Не се добавя selection handoff към Team или нова оценка на хората.

## I. TASKS NEW COMPOSITION

**Класификация: RECOMPOSE рамката; KEEP работните контроли.**

**CURRENT:** Tasks + общ subtitle, четири показателя вдясно, отделно оградена filter лента и след нея самостоятелно ограден регистър.

**PROBLEM:** структурата е почти директно преносима към leads, tickets или inventory. Заглавната част представя управление на общ набор записи.

**NEW RULE:**

1. H1 остава **Tasks / Задачи**, в съответствие с навигацията.
2. Subtitle става конкретен контекст:\
   **Seminar preparation register · {event.name}**\
   **Регистър за подготовката на семинара · {event.name}**
3. Total, Active, Blocked и Overdue се преместват под този контекст като един текстов отчетен ред. Няма четири равни клетки, uppercase labels над големи числа или вертикални граници.
4. Тези стойности остават за **целия event**, независимо от филтрите.
5. Search, filters, grouping, result count и регистърът се композират като един работен регион. Между controls и първия table header няма декоративен разрив.
6. Отпадат двойните хоризонтални borders около filter лентата и декоративният цветен cap над регистъра. Табличната повърхност и редовите разделители остават.
7. BudoSelect controls запазват собствените си граници, размери и interaction states. Контролите не трябва да изглеждат като обикновен текст.
8. Result count остава до работните контроли със съществуващите responsive позиции. Той е обратна връзка за текущия изглед, а не пети показател.

**Implementation guardrail — Tasks Totals**

Total / Active / Blocked / Overdue must form one textual operational summary.
Do NOT recreate the current mini-dashboard through:

- four boxes;
- four cards;
- four equal columns with borders;
- large standalone KPI numerals;
- pseudo-stat tiles.

**WHY IT IS SPECIFIC TO BUDOGRAPH:** семинарът задава обхвата; отчетният ред описва подготовката; филтрите работят непосредствено върху регистъра на задачи, отговорности, приемане и срокове.

**WHAT MUST NOT CHANGE:** search, трите filters, options, clear behavior, grouping, result count/`aria-live`, empty/invalid states и lifecycle на локалното състояние. Няма нов default filter или owner URL parameter.

## J. TASKS REGISTER

**Класификация: KEEP информационната архитектура; REFINE приоритета.**

**CURRENT:** TASK / RESPONSIBILITY / DEADLINE / STATUS; task category и priority badge, owner initials, acceptance icon, lifecycle badge и chevron.

**PROBLEM:** натрупването на priority и lifecycle pills създава повече маркери от необходимото. Самата таблична структура работи.

**NEW RULE:**

- Четирите колони и относителната им организация остават.
- Important/Critical priority става **компактен текст до category**, със съществуващия semantic цвят, без pill фон, outline и повтаряща се alert икона.
- Lifecycle badge остава: той е стабилен scan сигнал в отделната Status колона.
- Owner initials остават: в регистъра подпомагат повторяемото разпознаване на отговорника.
- Acceptance icon и текст остават: приемането е отделно от lifecycle.
- Chevron остава на размерите, на които сега се показва: подсказва отваряне на детайла.
- Съществуващите blocked/overdue маркери и selected/focus states остават.

**WHY IT IS SPECIFIC TO BUDOGRAPH:** reusable table структурата тук има основание — разграничението между възложен човек, приета отговорност, срок и изпълнение е съществено за подготовката на семинара.

**WHAT MUST NOT CHANGE:** titles, categories, owner, acceptance, dates, updated/overdue behavior, lifecycle, sorting, grouping, table semantics, stretched row anchor, task route и responsive modes.

Portability test е **YES за табличния примитив**, но това не налага премахването му. Различимостта се подобрява в рамката и отношенията между данните; регистърът се защитава.

## K. SURFACE RULES

**Класификация: REFINE; конкретните промени са ограничени до C–J.**

**CURRENT:** няколко слоя borders, повърхности и цветни линии означават едновременно разделяне, важност и принадлежност.

**PROBLEM:** контейнерите започват да изглеждат като повтарящ се стилов шаблон.

**NEW RULE:**

| Повърхност             | Информационно основание                                              |
| ---------------------- | -------------------------------------------------------------------- |
| Event readout          | Контекст; достатъчни са групиране и долен разделител                 |
| Decision queue         | Подредени решения; общ списък, леки разделители                      |
| Preparation sequence   | Хронология; дати и времеви групи                                     |
| Change record          | Един запис; semantic article и отделяне от следващия                 |
| Team pressure          | Бърз прочит на хора и основания; плоски редове                       |
| Tasks register         | Стабилно сравняване по колони; общата table surface остава           |
| Controls/popups/drawer | Реално взаимодействие или припокриване; запазват граници и elevation |

**WHY IT IS SPECIFIC TO BUDOGRAPH:** визуалните граници разграничават подготовка, решение и реакция, вместо всеки компонент да получава еднакъв контейнер.

**WHAT MUST NOT CHANGE:** глобалните tokens, dark/light identity, sidebar, popup/drawer surfaces и Team CSS.

Това не е обща забрана на cards, radius, borders или icons.

## L. TYPOGRAPHY RULES

**Класификация: REFINE, само page-scoped.**

**CURRENT:** display title и повтарящи се uppercase kickers дават presentation тежест; utility labels често конкурират task titles.

**PROBLEM:** важността се определя от шаблона на компонента.

**NEW RULE:**

- Desktop Event title и Tasks H1: **28–32 CSS px**, приблизително weight `700`, естествено пренасяне.
- Decision Queue heading: **22–24 px**.
- Preparation и Team Pressure headings: **18–20 px**.
- Operational Changes heading: **20–22 px**; заглавието на отделния запис остава подчинено.
- Task titles запазват текущата си четимост и тежест.
- Utility текстът не се смалява за постигане на плътност.
- KPI цифрите стават inline факти, с умерено усилване; не display typography.
- Uppercase column headers в Tasks остават полезни като индекс на колоните.
- Запазват се tabular numerals за сравними числа и дати.

**WHY IT IS SPECIFIC TO BUDOGRAPH:** конкретната задача получава най-силен локален акцент; подготовката във времето и персоналният контекст са поддържащи.

**WHAT MUST NOT CHANGE:** font family/fallback, кирилица, localization, semantic heading levels и текущите compact text sizes. Няма глобални `h1/h2` промени.

## M. MARKER / BADGE RULES

**Класификация: REFINE.**

**CURRENT:** едновременно присъстват декоративни и функционални маркери.

**PROBLEM:** отделните сигнали са допустими, но съвпадението им размива йерархията.

**NEW RULE:**

| Маркер                                      | Решение                       | Основание                                      |
| ------------------------------------------- | ----------------------------- | ---------------------------------------------- |
| Event metadata icons                        | REFINE: премахване от readout | Фактите вече са еднозначни                     |
| Queue `01/02/03`                            | REFINE: премахване визуално   | Не са ID или оперативен ранг                   |
| Queue priority                              | REFINE: тих metadata текст    | Запазва impact без конкуренция с причината     |
| Queue risk edge                             | KEEP                          | Бърз сигнал за blocked/overdue                 |
| Timeline dots/rails                         | REFINE: премахване            | Датите и редът дават последователността        |
| Task/Milestone labels                       | KEEP, по-компактно            | Различават два вида информация                 |
| Change severity/status                      | REFINE: независими означения  | Severity и response progress са различни       |
| Dashboard initials                          | REFINE: премахване            | Името и ролята са достатъчни                   |
| Register priority pill                      | REFINE: текст                 | Намалява конкуренцията с lifecycle             |
| Register status/acceptance/initials/chevron | KEEP                          | Всеки има отделна scan или interaction функция |

**WHY IT IS SPECIFIC TO BUDOGRAPH:** различават се риск, приоритет, приемане, изпълнение и вид организационен запис.

**WHAT MUST NOT CHANGE:** текстовите значения, semantic palette и разпознаването без зависимост само от цвят.

## N. SPACING / DENSITY

**Класификация: REFINE.**

**CURRENT:** голям Event Overview и сходен spacing cadence между различни видове съдържание.

**PROBLEM:** свързани факти се отделят прекалено, докато независими секции изглеждат еднакво важни.

**NEW RULE:**

- Свързани metadata: **4–8 px**.
- Title → reason/context: **6–10 px**.
- Decision rows: **12–16 px** вертикален padding, с естествен растеж.
- Timeline rows: **10–12 px**; между времеви групи **20–24 px**.
- Event readout → queue/timeline: **20–28 px**.
- Между основните долни предмети: **32–40 px**, **24–28 px** в compact layout.
- Tasks framing → controls: **12–16 px**.
- Controls → table header: **0–8 px**, с една смислена граница.
- Размерите и padding на основните Tasks rows се запазват.

**WHY IT IS SPECIFIC TO BUDOGRAPH:** по-тясното разстояние свързва задача с причина и отговорник; по-голямото отделя различен оперативен въпрос.

**WHAT MUST NOT CHANGE:** shell gutters, ширината на страниците, readable wrapping, touch targets и свободата редът да расте. Няма фиксирани височини за изравняване на секции.

## O. MOBILE BEHAVIOR

**Класификация: KEEP режимите; REFINE новата композиция вътре в тях.**

**CURRENT:** Dashboard преминава в една колона при `≤1280px`; Tasks използва content-width compact mode и отделен phone layout.

**PROBLEM:** новите desktop правила могат неволно да нарушат вече решените responsive зависимости.

**NEW RULE:**

- Dashboard запазва реда Event → Queue → Timeline → Changes → Pressure.
- Facts и totals се пренасят като свързани текстови групи; не се възстановяват KPI tiles.
- Queue няма number gutter; reasons и metadata използват освободената ширина.
- Timeline остава дата + съдържание; kind/owner/state се пренасят под заглавието.
- Change record се чете последователно по четирите въпроса.
- Pressure identity, signal и counts се подреждат един под друг.
- Tasks запазва `#task-results` container и границата `50rem`.
- Phone Tasks запазва title → status → responsibility/deadline.
- Filter layout запазва текущите преходи при `1280`, `800`, `600`, `420` и `360px`. Няма нов filter drawer.

**WHY IT IS SPECIFIC TO BUDOGRAPH:** на тесен екран остават видими задачата, отговорността и срокът, без да се възпроизвежда desktop аналитично табло.

**WHAT MUST NOT CHANGE:** navigation, safe areas, focus visibility, drawer behavior и съществуващите правила за видимост.

Конкретно: при `≤520px` Event Overview вече скрива guest subtitle и Review all tasks; този договор не променя това поведение. Наличният View tasks остава. При `≤600px` Tasks вече скрива non-overdue updated metadata; то не се премахва от данните или детайла.

## P. INTERACTION / MOTION

**Класификация: KEEP.**

**CURRENT:** task anchors, disclosure controls, row feedback и canonical TaskDrawer.

**PROBLEM:** визуално опростяване може да премахне affordance или да промени DOM hooks, използвани за връщане на фокуса.

**NEW RULE:** композицията се променя около съществуващите interactions. Няма нова motion система. Запазват се текущите hover/focus feedback, disclosure semantics и reduced-motion behavior.

Не се добавят animated counters, timeline reveal, автоматично пренареждане с движение или hover elevation.

**WHY IT IS SPECIFIC TO BUDOGRAPH:** потребителят трябва да отвори конкретна задача, да прегледа или промени състоянието ѝ и да се върне в оперативния контекст без прекъсване.

**WHAT MUST NOT CHANGE:** anchors, modifier-click/new tab, keyboard behavior, popup Escape handling, drawer focus trap, close behavior, scroll/focus restoration и историята.

## Q. PROTECTED BEHAVIOR

**Класификация: KEEP.**

Следните условия са задължителни за бъдещата реализация:

| Област             | Защитен договор                                                                      |
| ------------------ | ------------------------------------------------------------------------------------ |
| Attention          | Completed не влиза в queue; запазват се всички канонични причини и comparator        |
| Counts             | Active = not-started + in-progress; blocked е отделно; overdue може да се припокрива |
| Progress           | Completed / total, със съществуващото закръгляне и zero-total поведение              |
| Acceptance         | Независима от lifecycle; не се извежда от owner или updated time                     |
| Timeline           | Текущите task/milestone правила, sorting, windows и preview limits                   |
| Changes            | Active filtering, affected-task resolution, checkpoint selection                     |
| Pressure           | Съществуващите membership, ordering, threshold и quiet semantics                     |
| Tasks              | Search normalization, filters, sorting, grouping, clear и result count               |
| Navigation         | `/tasks?task=<encoded-id>`, direct-link fallback и invalid/wrong-event handling      |
| Focus hooks        | `focus:…`, `timeline:…`, `change:…:checkpoint:…`, `task-list:…`                      |
| Dashboard history  | `budographDashboard`, queue expansion и return origin                                |
| Native disclosures | Съществуващото поведение и fallback към видим summary при затворен disclosure        |
| Localization       | Typed BG/EN catalog, pluralization, Intl и localized demo content                    |
| Data               | Фиксираната demo reference date, fixtures, storage schema и reducers                 |
| Team               | Цялата страница, member sheet, selectors, styles, navigation и focus behavior        |

Не се обещава ново запазване на всички filters/disclosures между remounts. Запазва се настоящият договор, включително fallback поведението.

## R. EXPLICIT EXCLUSIONS

Извън обхвата са:

- Team redesign и промяна на основната продуктова идея;
- sidebar, routes, navigation shell и preferences;
- palette, fonts, нови assets или dependencies;
- backend, database, authentication и реални акаунти;
- промени в task/Dashboard semantics или demo data;
- Change Consequence Path, dependency graph и stage inference;
- нови KPI, readiness score, capacity score или автоматични препоръки;
- Kanban, Gantt, нови filters или owner deep links;
- inline task editing извън наличния drawer;
- Plan B/Templates redesign;
- глобално премахване на badges, icons, cards или borders.

Тази фаза не променя документация, CSS, source, logs или test evidence. Не са изпълнявани tests, format, build или server startup. Няма commit/push.

Предварително съществуващият untracked `docs/market-research/docs - Shortcut.lnk` е оставен непокътнат.

## FINAL IMPLEMENTATION MAP

Посоченият риск е рискът при бъдеща реализация, не установен дефект.

### DASHBOARD

| Компонент                                                                                             | Scope     | Точна промяна                                              | Риск                                              |
| ----------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------- | ------------------------------------------------- |
| [EventOverview.tsx](/C:/NOIT/noit-competition-site/src/pages/dashboard/EventOverview.tsx)             | RECOMPOSE | Readout hierarchy, facts, inline counts и compact progress | MEDIUM — responsive видимост и пълнота на фактите |
| [OperationalFocus.tsx](/C:/NOIT/noit-competition-site/src/pages/dashboard/OperationalFocus.tsx)       | RECOMPOSE | Title-first редове, без номера, priority в metadata        | MEDIUM — anchors, reasons и focus hooks           |
| [PreparationTimeline.tsx](/C:/NOIT/noit-competition-site/src/pages/dashboard/PreparationTimeline.tsx) | RECOMPOSE | Без rails; date-led редове, компактни kind/owner/state     | MEDIUM — windows, disclosures и link origins      |
| [ChangeImpact.tsx](/C:/NOIT/noit-competition-site/src/pages/dashboard/ChangeImpact.tsx)               | RECOMPOSE | Плосък запис с четирите информационни отношения            | MEDIUM — загуба на поле или checkpoint context    |
| [TeamPressure.tsx](/C:/NOIT/noit-competition-site/src/pages/dashboard/TeamPressure.tsx)               | REFINE    | Без initials; signal и counts непосредствено заедно        | LOW                                               |
| [DashboardPage.tsx](/C:/NOIT/noit-competition-site/src/pages/DashboardPage.tsx)                       | KEEP      | Не изисква промяна на orchestration или selectors          | LOW при запазване                                 |

### TASKS

| Компонент                                                                                 | Scope     | Точна промяна                                                            | Риск                             |
| ----------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------ | -------------------------------- |
| `TasksPage` в [TasksPage.tsx](/C:/NOIT/noit-competition-site/src/pages/TasksPage.tsx:188) | RECOMPOSE | Event-specific subtitle, inline totals, свързана controls/register рамка | MEDIUM — reflow и popup clipping |
| `TaskList` в същия файл                                                                   | REFINE    | Priority като текст; останалите marker роли се запазват                  | LOW                              |
| `PageHeader` usage                                                                        | REFINE    | Tasks totals извън десния actions слот; без промяна на shared компонента | LOW                              |

Нов общ wrapper е допустим само за свързване на controls и results. Той не трябва да въвежда `overflow: hidden`, който да отрязва BudoSelect, или да замества `#task-results`.

### SHARED CSS / LOCALIZATION

| Файл                                                               | Допустима промяна                                                    | Риск   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- | ------ |
| [styles.css](/C:/NOIT/noit-competition-site/src/styles.css)        | Само Dashboard/Tasks selectors и съответните им responsive overrides | MEDIUM |
| [messages.ts](/C:/NOIT/noit-competition-site/src/i18n/messages.ts) | Само необходимите Dashboard/Tasks copy промени в BG и EN             | LOW    |

Не е необходим нов shared design primitive. Съществуващият CSS файл е мястото на стиловете, но това **не разрешава глобална промяна** на `.avatar`, `.status-badge`, `.budo-select`, `.page-header`, typography или tokens.

### UNCHANGED

| Защитени компоненти/модули                                                                | Риск при неволна промяна |
| ----------------------------------------------------------------------------------------- | ------------------------ |
| `TeamPage`, `MemberDetail`, `MemberSheet`, `pages/team/team.css`, Team helpers/navigation | HIGH                     |
| `App`, `routes`, `dashboardNavigation`, `navigationFocus`, `AppLink`                      | HIGH                     |
| `TaskDrawer`, `BudoSelect`, `budoSelectState`                                             | HIGH                     |
| Domain types, workspace, taskAttention, taskTiming, Dashboard/Tasks helpers               | HIGH                     |
| Demo fixtures, demoTime, persistence, localization architecture                           | HIGH                     |
| `AppShell`, preferences, `PageHeader`, `StatusBadge`, `DashboardDisclosure`, `EmptyState` | MEDIUM                   |
| `ChangesPage`, `TemplatesPage`                                                            | MEDIUM                   |

## IMPLEMENTATION — THREE COHERENT GROUPS

Това е карта за последваща одобрена реализация, не разрешение за започване в тази фаза.

1. **Dashboard context and immediate work**\
   EventOverview, OperationalFocus, PreparationTimeline и техните scoped styles/copy. Проверка на фактическата пълнота, queue ordering, четирите timeline windows, disclosures и task return.

2. **Dashboard response and people**\
   ChangeImpact и TeamPressure. Проверка на всички change fields, checkpoint link, pressure membership/counts и липса на промени в Team.

3. **Tasks framing and final regression**\
   Tasks header/totals/filter integration и priority refinement. Проверка на search/filter/group/clear, BudoSelect, register modes, drawer и history/focus.

След всяка група: релевантните tests и работещо приложение. Преди приемане: repository `format:check`, lint, typecheck, tests, build и приложимите browser regressions.

Бъдещият визуален преглед трябва да покрие BG/EN × Light/Dark при 1440, 1024, 768, 390 и 320 CSS px, breakpoint границите, дълги заглавия, празни резултати, отворени disclosures и връщане от task drawer.

**Критерият за визуално приемане:** Event Overview вече не доминира като hero; queue и timeline се различават по информационна функция; change record дава четирите отговора без card слоеве; Tasks controls принадлежат към регистъра. Team остава визуално непроменен.

Това са критерии за бъдеща проверка, а не отчетени PASS резултати.

## FINAL VERDICT

Следващите YES означават „адресирано от договора“, без твърдение за реализиран или визуално проверен резултат.

DASHBOARD HUMAN-OBSERVED AI/SaaS SLOP ADDRESSED BY CONTRACT: **YES**

TASKS HUMAN-OBSERVED AI/SaaS SLOP ADDRESSED BY CONTRACT: **YES**

TEAM REMAINS LOCKED: **YES**

FUNCTIONAL ARCHITECTURE PRESERVED: **YES**

BACKEND REQUIRED: **NO**

IMPLEMENTATION STARTED: **NO**

**READ ONLY.**\
**NO FILE CHANGES.**\
**NO COMMIT.**\
**NO PUSH.**

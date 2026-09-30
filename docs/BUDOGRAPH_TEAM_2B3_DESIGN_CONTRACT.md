# BudoGraph — Team 2B.3 Design Contract

Дата: 2026-09-30. Phase 2B.3A. **Предложение, готово за одобрение; не е реализация и не е одобрение за започване на Team 2B.3.** Единният източник за следващата Team фаза е този документ. Dashboard и Tasks остават заключени по дизайн и семантика.

## 1. Проверена основа и граници на доказателствата

- Branch: `main`. След успешен `git fetch origin`, `HEAD` и `origin/main` са `d230be00670d30e40fb55710c313a71926104bcf` — `fix(app): preserve dashboard disclosure context`; ahead/behind: **0/0**. Началният `git status --porcelain` е празен.
- Проверени чрез Git ancestry, променени файлове, текущ код и исторически записи в `TEST_EVIDENCE.md`: **2B.2.2** — `c87fb9a`; **2B.2.3B** — `5c6dfc8`; **2B.2.3C** — `729ab3e`; **2B.2.3D** — `d230be0`. И четирите са предци на HEAD (exit 0).
- Заключването е проектен договор, а не Git защита: `KNOWN_LIMITATIONS.md`, Phase 2B.2/2B.2.3D документацията и текущото задание запазват Dashboard/Tasks. Няма основание тази фаза да променя техния дизайн, CSS, semantics, demo seed или редактора на задачи.
- Прочетени изцяло `NOIT_MASTER_PROMPT.md` и 30-те страници на `NOIT_REGULATIONS_2025_2026.pdf`; визуално проверена таблицата за „Софтуерни приложения“, стр. 26. Регламентът за **2025–2026** потвърждава VIII–X, до двама автори, самостоятелен завършен продукт, изходен код, документация/ръководство, лицензи/GPLv3, онлайн достъп и тестови акаунти за съществуващите роли. Общите изисквания на стр. 11 задават достъп поне седмица преди областния и месец след финалния кръг; не се свеждат само до деня на защитата.
- **За по-късна състезателна година се проверяват отново** категориите, допустимостта, лицензното изискване, сроковете, достъпността, акаунтите, декларациите, форматът на документацията (стр. 17) и оценяването 20/25/35/20. Тук не е проверен нов регламент. Вътрешният 15.09.2026 е изминал проектен срок, не нов официален срок. AI log и този design gate са вътрешна политика; не са обявени за отделни официални NOIT критерии.
- Извършени са source/browser **наблюдения на съществуващия продукт**, не тестове на бъдещата реализация. Няма нови потребителски интервюта, резултати за ефективност, сертификация за достъпност или изпълнен Team 2B.3 test suite.

### Текущ Team: факти от кода

| Област               | Проверено поведение / ограничение                                                                                                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Модел                | `TeamMember` съдържа само `id`, `name`, свободен текст `role`, `isOrganizer`. Няма user account, event membership, permission role, покана или контакт.                                                                                                              |
| Собственост          | `Task.ownerId` сочи човек; `Task.eventId` ограничава задачите до `currentEventId`. Списъкът `teamMembers` е общ за prototype workspace; не доказва членство в конкретно събитие.                                                                                     |
| Selection            | `TeamPage` избира първия `isOrganizer`, иначе първия член. Локален `useState`; бутон с `aria-pressed` и `aria-controls` обновява долния panel. Няма Team history context, преместване на фокуса или scroll към detail. При remount кодът отново избира организатора. |
| Броячи               | `assigned` включва завършените; `completed` е lifecycle count; `active` е **not-started + in-progress**, включително далечни срокове, но без blocked. `atRisk` е union от open blocked/overdue, по веднъж на задача.                                                 |
| Представяне          | Пет карти в ред при 1440; три колони при 1024; две при 768; една при 390/320. Идентични avatar/метрики/бутон, после отделен detail. Completion заема същото място като текущия риск.                                                                                 |
| Задачи на човек      | Всички негови задачи, сортирани лексикографски по ISO deadline; completed може да е първа. Показват title, едноредово отрязано context, date/Overdue, lifecycle badge. Няма Accepted, priority, attention reasons, task anchor или Open Tasks.                       |
| Неподкрепени етикети | `High active workload`, `Steady workload`, `Available capacity` / „Свободен капацитет“ са изведени от брой, не от налично време. Последният не се появи в fresh seed, но кодът го показва при active < 2 и atRisk = 0.                                               |
| TeamPressure         | Dashboard използва същия `getTeamWorkload`, сортира по atRisk, active, assigned, после име; отделя blocked/overdue/active ≥ 4 от quiet. Само общият бутон води към `/team`; отделните хора нямат линк и selection handoff. Quiet може да има неприети задачи.        |
| Навигация            | `createTaskHref`, `AppLink`, `openTask`/`closeTask`, `TaskDrawer` вече съществуват. `/tasks?task=<encoded-id>` се разрешава само за текущото събитие. Owner filter в Tasks е локален, **няма owner query contract**.                                                 |
| BG/EN                | Typed catalog и `Intl`; `localizeWorkspace` превежда познатия synthetic seed по ID. Имената/ID са неизменни; произволният role текст не се превежда автоматично.                                                                                                     |
| Време                | App подава една фиксирана demo дата **07.09.2026**, local noon; updated/reported се форматират за Europe/Sofia. Team не трябва да използва реалния днешен ден.                                                                                                       |

Основни source опори: `src/pages/TeamPage.tsx`, `src/domain/{types,workspace,taskTiming,taskAttention}.ts`, `src/pages/dashboard/TeamPressure.tsx`, `src/pages/dashboard/helpers.ts`, `src/pages/DashboardPage.tsx`, `src/pages/tasks/helpers.ts`, `src/{App.tsx,routes.ts,dashboardNavigation.ts,navigationFocus.ts}`, `src/components/{AppLink,TaskDrawer}.tsx`, `src/i18n/{messages,localizeWorkspace}.ts`, `src/styles.css`.

### Реален браузър: прочит на текущото състояние

Vite dev server, Codex in-app Chromium, fresh origin `http://127.0.0.1:5187/team`. Старият origin на 5173 съдържаше предишни запазени дати; не е reset-ван или редактиран. На 5187 са сменяни само език, тема и избран човек, без task mutations. Височините са CSS px, измерени приблизително от началото на документа; screenshot review е в тази сесия, без нови image файлове в repository.

| Viewport / режим     | Наблюдение                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1440 × 1000 EN Light | Пет еднакво доминиращи карти; detail започва около y=569. Организаторът е избран, първата му задача е завършена.                                                                                           |
| 1440 × 1000 EN Dark  | Избран Anton; вижда се Blocked, но не Not accepted. Burgundy selection и risk red имат различни роли; dark surfaces остават различими.                                                                     |
| 1024 × 900 EN Light  | 3+2 карти; detail около y=887, практически извън първия екран.                                                                                                                                             |
| 768 × 1024 EN Light  | 2+2+1 карти и долна навигация; detail около y=1220. Големите карти раздалечават избора и резултата.                                                                                                        |
| 390 × 844 BG Light   | Пет последователни карти; detail около y=1894. След избор на Lina фокусът остава на бутона, detail още е под екрана; ръчното скролиране показва Completed преди Overdue. Контекстът е отрязан до един ред. |
| 320 × 740 BG Dark    | Отново detail около y=1894; дългите роли се пренасят, но голямата повторена структура остава. Проверени горният roster и долният detail.                                                                   |

Нито една конфигурация не показа document-level horizontal overflow (`scrollWidth ≤ innerWidth`); това не доказва липса на отрязано съдържание — context е нарочно clamp-нат. Captured application console warnings/errors: **0** в инспектираната fresh-origin сесия. Това е dev-browser наблюдение, не production/cross-browser test pass.

## 2. BudoGraph decision sheet

### SUBJECT

**BudoGraph помага на организатора на семинар по бойни изкуства да свърже всяка промяна в пристигането на инструктора или готовността за първата тренировка с конкретната задача и човека, който трябва да поеме отговорността за реакцията.**

### GROUND

Десет предметни опори за навигация, роли и съдържание: (1) пристигане на гост-инструктора; (2) трансфер от летище/гара; (3) настаняване и късен check-in; (4) достъп до залата; (5) количество, подредба и готовност на татамито; (6) тренировъчна програма и начало на първата тренировка; (7) пристигане и инструкции за участниците; (8) регистрация на място; (9) предаване и приемане на конкретна отговорност; (10) собственик на резервната реакция при промяна.

Те определят role/task/context текста; не са декоративни мотиви или нови фиктивни полета. Изключени са дракони, юмруци, фалшива японска калиграфия, случайни kanji, stock combat photography и орнаментални dojo клишета.

### PALETTE

**Запазва се съществуващата палитра и semantic tokens**, без нови глобални цветове. Light използва топъл canvas `#f4f1eb`, white operational surface; Dark — `#0b111a`, surface `#111a25`. Те позволяват четене на задачи сред подготовка, без фонът да конкурира решенията.

| Роля                | Light / Dark token value | Правило за Team                                                                                                                                                  |
| ------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STRUCTURE / navy    | `#132033` / `#111c29`    | Навигация и стабилна рамка. Няма нов тъмен hero.                                                                                                                 |
| DECISION / burgundy | `#8d2f44` / `#d16e86`    | Избран човек, основно действие; никога оценка на човек.                                                                                                          |
| TIME / gold         | `#b78039` / `#d0a15d`    | Дати, етапи и организационни ориентири; за малък текст използвай подходящия четим ink/warning token, не злато на всяка дата.                                     |
| RISK / red          | `#a9363d` / `#ed8790`    | Blocked/Overdue и конкретни последици. Critical priority запазва съществуващата означена с текст treatment, без да оцветява целия човек или да го прави at risk. |
| COMPLETE / green    | `#227052` / `#73c8a1`    | Completed или Accepted, винаги с различни текстови етикети; acceptance не е completion.                                                                          |
| PROCESS / blue      | `#386589` / `#82b7db`    | In progress, информация и focus ring; avatar не означава lifecycle.                                                                                              |

Light/Dark ролите са последователни в tokens и наблюдаваните screenshots. Реалният semantic проблем е inference за capacity и агрегирането без обяснение, не палитрата. Not accepted само по себе си използва текст и сдържан акцент, без автоматичен червен critical surface. Risk се означава и с думи; selection има маркер + `aria-pressed`, keyboard focus е отделен. Контрастът на бъдещите комбинации трябва да се измери, не се счита за сертифициран от този преглед.

### TYPE

Запазва се наличният `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`. Няма доставян външен Inter файл; наличието му зависи от устройството. Не се добавя font dependency за визуална разлика. Проверка с реалния fallback и кирилица е задължителна.

| Роля           | Предложен диапазон / употреба                                                                                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DISPLAY        | Page title 28–36 px desktop, 26–30 mobile, weight 700–780, line-height 1.1–1.2; member heading 20–24 px. Само за ориентация, не гигантски имена.                                                                                                |
| INTERFACE      | Task/person 14–16 px, weight 600–700; role/context 13–14 px, weight 400–500; line-height 1.35–1.5. Sentence case и естествено пренасяне на BG.                                                                                                  |
| UTILITY / DATA | Dates/counts/status 12–13 px, weight 500–650, line-height 1.35–1.45; tabular numerals за сравними броячи/дати. Броячите са вдясно в подравнени колони само когато има реално сравнение; имената и текстът са вляво. Без отделен monospace font. |

Датите остават locale-formatted, с изписана година когато е нужна за еднозначност. Статусите са думи, не uppercase шум. Един kicker е допустим само ако добавя контекст, който title не казва; „Selected teammate“ над вече избран човек и повторени section eyebrows отпадат в Team. Не се въвежда глобална забрана на eyebrows.

### SPACE

Три различими регистъра: **Operational** — 6–8 px между свързани metadata, 8–12 px вертикален row padding, 12–16 px между колони; **Context** — 16–24 px padding/gaps за role, обяснение и summary; **Major transition** — 28–40 px между roster/detail или отделни смислови региони, 24–32 px на mobile. Диапазоните са проектна политика и могат да се коригират след проверка на текста.

Roster ред около 72–96 px, с естествен растеж при дълги роли; task rows нямат фиксирана височина. Touch target минимум 44 × 44 CSS px като вътрешна цел. Page gutters около 24–32 px desktop, 12–16 px mobile. Не се свива текстът, за да се постигне фиксиран card размер. Mobile променя взаимодействието, не просто броя колони.

### SHAPE

Flat roster/task rows в общ регион, с тонално разделяне или един слаб divider; не всяка задача в собствена card. Един context surface за идентичност/отговорности е оправдан. Selected row: мек burgundy фон и тесен маркер, без силна сянка. Истинският critical callout е рядък и съдържа конкретен blocker/последица, не оцветен профил.

Reuse radius scale: controls 6–8 px, context surfaces 10 px, floating dialog corners до 14 px; full-screen sheet е edge-to-edge с 0 radius по ръбовете на екрана. Pills остават за малки състояния, без всеки count да е badge. Strong elevation се пази за реално припокриване — sheet/drawer; бордърът на контрол и focus outline имат причина да останат. Lucide е подходящ за действие/състояние, но не е задължителна плочка пред всяко заглавие.

### MOTION

House budget: 100–160 ms за hover/pressed/state feedback; 180–220 ms за влизане/излизане на sheet, с кратко движение за пространствена ориентация; immediate focus/scroll restoration. Existing drawer 160 ms backdrop / 210 ms panel е съвместим ориентир, не глобален refactor.

Selection сменя съдържанието без page transition. Няма hover lift, bouncing, безсмислено pulsing, fade-up на всеки блок, animated counters или анимация на roster ranking. `prefers-reduced-motion` премахва движение и smooth scroll; информацията/фокусът не чакат animation end. Не се променя съществуващото reduced-motion правило за заключените страници.

### SIGNATURE

| Ранг по продуктова връзка | Кандидат                                                                                                                                             | Решение                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1                         | **CHANGE CONSEQUENCE PATH**: промяна в пристигането → трансфер → настаняване → начало/програма → отговорни задачи/хора → Accepted → резервна реакция | Избраната бъдеща посока: показва защо конкретният човек/задача е нужен. Няма реализация в 2B.3.                          |
| 2                         | **Responsibility handoff**: задача → собственик → Accepted → следваща зависима отговорност                                                           | Най-близка до Team; четимият owner/acceptance/task flow я подкрепя без нов widget. Реален handoff workflow остава бъдещ. |
| 3                         | **Seminar-day checkpoints**: достъп → tatami → пристигане → check-in → първа тренировка                                                              | Полезна ориентация, но по-слабо отличима и лесно дублира Timeline. Не се добавя втори timeline в Team.                   |

Няма signature чрез gradient/glow/лого/снимки/kanji/tatami pattern/анимирани броячи. `blockedBy` и `blocks` сега са prose, а не graph edges; `affectedTaskIds` са наличните точни връзки на промяната. Не се рисува измислена dependency graph и не се твърди автоматична propagation.

## 3. Team job и архитектура

Team трябва бързо да отговори: кой за какво отговаря; кой има конкретна задача за внимание; какво не е Accepted; какво е overdue/blocked; коя е следващата релевантна задача; кой точен task link води до действие. Това е operational review за организатора, не HR directory, social profile, performance review, ranking или capacity software.

### Desktop: над 960 px

Съществуващият 252 px sidebar остава. В наличната ширина на Team: roster **36–40%**, detail **60–64%**, gap 24–32 px при 1440 и 16–20 px при 1024. При 1024 остават приблизително 700 px за съдържание: около 250 px roster и 430 px detail. Metadata се пренася, вместо да възпроизвежда широка Tasks таблица. Ако реалният Team container е под приблизително 660 px (zoom/embedding), се използва compact mode независимо от viewport.

- Header: „Екип / Team“, кратко „Отговорности и задачи за подготовката на семинара / Seminar responsibilities and preparation tasks“. Demo disclosure остава видим.
- Roster: semantic list с един selection button на човек; име, operational role, кратък ред от **непразни** сигнали като „1 просрочена · 1 неприета“. Показва overdue, blocked, not accepted, critical today/near deadline и при липсата им in-progress/next deadline. До две водещи причини + текстово „още N“, пълното обяснение е в detail. Няма completion cards, rank numbers, medal icons или пет metric tiles.
- Detail: (1) име + цял role + реални категории на възложените задачи; (2) компактно текстово factual summary; (3) **Needs attention**; (4) **Upcoming work**; (5) по-тиха достъпна връзка към останалата/завършената работа и `/tasks`. Неприетата отговорност е видима в attention реда, не се дублира в трета паралелна task queue.
- Desktop entry без запазен context избира първия човек в operational ordering. След ръчен избор не сменя избрания човек при пренареждане/редакция. Възстановен валиден ID има предимство. При липса на хора — празен roster и ясно empty state, без фалшив selection.
- Selection остава на бутона за бърза смяна между хора. `aria-pressed`/`aria-controls`, видим focus и кратък polite announcement за сменения човек; достъпен „Към задачите на {name} / Go to {name}'s tasks“ премества фокуса към detail heading. Без автоматично прочитане на целия task списък.

### Mobile/transition: 960 px и надолу

Compact roster, **tap → full-screen member sheet**, включително при 768. Това използва наличния drawer interaction pattern (dialog label, Escape, focus trap, body scroll lock), но не монтира `TaskDrawer` с фалшива Task и не изисква нова библиотека. Отделен read-only MemberDetail body се използва inline и в sheet. Bottom sheet с частична височина оставя твърде малко място за BG task titles; нов `/team/:id` route не е нужен за този prototype scope.

Roster е единствената начална Team област; не се отваря sheet автоматично при ново посещение. Името, цялата role и текущите сигнали се четат без хоризонтално движение. Sheet има `role=dialog`, `aria-modal`, `aria-labelledby` към име/„Задачи на…“, видим Close и контроли ≥44 px. Само body на sheet скролира; topbar е opaque, има safe-area padding; основният shell и долната навигация са inert зад него. Първоначален focus е heading (`tabindex=-1`), следва Close/links; Tab/Shift+Tab остават в sheet. Няма nested drawers, drag-only close или нов mobile navigation bar.

При resize/rotation selected ID се запазва; inline detail става sheet само ако потребителят вече преглежда detail. Sheet → desktop дава inline detail без останал trap/body lock. Само един detail tree е интерактивен. History не се увеличава само заради resize. BG strings се пренасят естествено, не се режат смисловите Accepted/Overdue/Blocked етикети.

## 4. Семантика и factual workload

| Понятие         | Задължителен договор                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| STATUS          | Само `not-started`, `in-progress`, `blocked`, `completed`. Upcoming/Overdue/Accepted не са lifecycle.                                                                                                  |
| PRIORITY        | `normal`, `important`, `critical`: въздействие/последица, не заместител на deadline.                                                                                                                   |
| TIMING          | Общият `taskTiming`: overdue преди reference day; today = 0; near = 1–7 calendar days включително; later > 7; invalid е отделен safe fallback. Completed не става overdue.                             |
| NEEDS ATTENTION | Общият `getAttentionReasons`: open task с blocked, overdue, not accepted или critical deadline today/near; всички приложими причини са видими, task се брои веднъж.                                    |
| ACCEPTED        | `acknowledged` е отделното приемане на отговорност. Не е completion, approval или change acknowledgement. Read-only в Team; променя се единствено в Tasks.                                             |
| AT RISK         | Open blocked **или** overdue, union по task ID. Само not accepted / near critical не увеличава този count. `blockedBy` prose не прави lifecycle blocked.                                               |
| QUIET           | В Dashboard: без неговите pressure flags; в Team използвай точния текст „Няма задачи за внимание“, само когато attention е празен. Не означава свободен капацитет, малко работа или добро представяне. |

Основен quantity: **„Незавършени задачи / Open tasks“ = всички non-completed**, включително blocked и далечни not-started. Това е inventory count, **не current-load figure**. Не го преименувай на shared `active`, чиято съществуваща формула остава неизменна.

Първичният оперативен сигнал е „Задачи за внимание / Needs attention“, не размерът на backlog. Допълващите факти са overdue, blocked, not accepted и следващ срок; те се припокриват и не трябва да се събират в total. Далечни **accepted not-started** задачи са в Upcoming/Later, извън primary attention. Далечна **not accepted** задача остава attention по каноничното правило; далечна in-progress не става „неактивна“ само по дата. Completed е тих count/disclosure. Забранени: проценти за заетост, workload score, часове, remaining effort, utilization, efficiency и оценки на хора.

## 5. Подредба и task list limits

### Roster: кого да прегледа организаторът първо

Обяснима lexicographic подредба, без additive score:

1. Хора с blocked/overdue задача (една обща operational-failure група).
2. Останалите хора с поне една canonical attention задача — включително not accepted/near critical.
3. Хора без attention, но с open задачи.
4. Хора без open задачи; zero-task и completed-only получават различен фактически текст.

В групи 1/2 представителната задача е първата по `compareAttentionTasks`; сравни представителните задачи със същия comparator. Така blocked не надделява винаги над overdue; deadline, брой причини, acceptance и priority имат точно общия ред. В група 3: най-ранен валиден open deadline, invalid последно. При пълно равенство: стабилен source member order, после ID; не locale-зависим човешки рейтинг. Seed очакване: Lina пред Anton по failure deadlines; останалите са според собствените си задачи, не произволно организаторът първи. Без числа 1–5 до имената. Кратко обяснение: „Първо хората със задачи за внимание / People with tasks needing attention first“.

Dashboard TeamPressure **не се преподрежда**: неговата по-тясна pressure membership/съществуващата сортировка остават. Team показва повече причини (например неприета отговорност), без да ги преименува на at risk. Общите counts за един и същ човек/event/reference date трябва да съвпадат.

### Задачи в detail

- **Needs attention**: owner + current event + `getAttentionReasons().length > 0`; `compareAttentionTasks` без Team urgency model. Blocked/overdue споделят най-силния клас; после deadline; равен deadline → повече reasons → not accepted → priority → ID. Показвай всички reasons като четим текст, не badge за всяка дума.
- **Upcoming work**: open + `isUpcomingTask`, **без** вече показаните attention задачи; deadline ascending чрез `compareDeadlineDates`, после ID. Today / Next 7 days / Later са timing пояснения, не нов status. Канонично upcoming включва и later, не само седмицата.
- По подразбиране **до 5 различни задачи общо**: до 3 attention и до 2 upcoming; свободните места се дават първо на attention, после upcoming. При 5 attention и 0 upcoming → 5; при 0 attention и много upcoming → 5. Counts винаги са за целия набор.
- Всяка секция с остатък има „Покажи още N / Show N more“, разкриващ всички нейни редове, и „Покажи по-малко / Show less“. State и позиция се пазят при task return; no duplicated rows. Не режи списък без count/достъп до остатъка.
- Completed задачите са в отделно затворено native disclosure с count, по deadline descending и ID; никога пред attention. Completed + Not accepted остава честно означено при разкриване, без да създава attention.
- Open задачи с invalid deadline и без друга attention причина са в тихо „Други незавършени задачи / Other open tasks“ disclosure, по ID и с „Невалиден срок / Invalid deadline“. Не се губят или представят като upcoming. Нормалният storage validator не допуска такива дати; това е defensive boundary.
- Всеки ред: title anchor, category при нужда, deadline/timing, lifecycle, отделно Accepted/Not accepted; attention редът добавя причините и съществуващ `blockedBy` context. Priority се показва когато е important/critical, без да измества срока. Пълният title и причините се пренасят; дълъг supporting context може да остане в canonical drawer.
- Постоянен **„Отвори Задачи / Open Tasks“ → `/tasks`**, ясно пояснен като пълния регистър за събитието, с всички хора. **Не обещава „всички задачи на този човек“**, не изпраща неработещ `?owner=`. Локалното Show more показва всички негови задачи; owner-filter deep linking е извън заключения Tasks scope.

## 6. Навигация, history, focus и scroll

**Team member → real anchor `/tasks?task=<encoded-id>` → canonical Tasks drawer → Back/Close/Escape → същия Team контекст.** Няма втори task editor. `AppLink` запазва Ctrl/Cmd/middle-click, href и open-in-new-tab; новият tab има direct-link fallback, не измислен Team origin.

Приложи урока от 2B.2.3D: transient UI context принадлежи на **конкретния browser history entry**, не на `budograph.workspace.v1` или `budograph.preferences.v1`. Предложен namespaced `budographTeam`: event ID, selected member ID, detail-open flag, expanded sections за този човек, page/roster/detail scroll offsets и originating task/focus key. Валидирай неизвестното history state и ID спрямо текущите данни; merge-вай unrelated state. Не записвай person/task текстове, HTML или viewport-derived оценка.

| Действие                     | History и focus договор                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Нов `/team`                  | Fresh context: desktop първият operational member; compact roster без sheet; disclosures затворени. Explicit nav към текущ `/team` също е fresh entry context.                                                                                                                                               |
| Desktop selection/disclosure | `replaceState` на Team entry; не добавя Back стъпки за всеки избор. Персоналните disclosures се reset-ват при избор на друг човек; връщането от задача пази текущите.                                                                                                                                        |
| Compact tap member           | Запазва roster offset/trigger в базовия Team entry, после `pushState` на същия `/team` с typed member-detail marker. Това дава на Back предвидима стъпка sheet → roster.                                                                                                                                     |
| Sheet Close/Escape           | При доказан in-app detail marker: Back към roster; при възстановен/невалиден контекст без такъв marker: replace със затворен Team context, без излизане от приложението. Възстановява roster scroll и видимия member button.                                                                                 |
| Task click от inline/sheet   | Replace на текущия Team entry с актуалния selection/disclosure/scroll/origin, после **един** push на task URL с existing task-detail marker. Team sheet се unmount-ва преди task drawer; няма два modal слоя или останал body lock.                                                                          |
| Task Close/Escape/Back       | Existing task-detail marker връща Team entry; първо restore member + disclosures + sheet ако е compact, после scroll и exact task focus. Forward отново отваря задачата; нов Back възстановява същия entry. Escape в Tasks popup първо затваря popup, следващ Escape drawer, както досега.                   |
| Reload / direct task URL     | Team state оцелява в същия history entry, ако браузърът го пази; malformed/missing state използва fresh defaults. Direct task URL без marker затваря към `/tasks` с replace, не Back извън приложението. Unknown/wrong-event/malformed task handling остава съществуващото.                                  |
| Премахнат/променен origin    | Exact visible link → същата задача в друга видима секция → originating disclosure summary → member heading (sheet) / selected roster control (inline) → main content. Не focus-вай hidden/closed disclosure descendants. Ако member/event е изчезнал, safe roster/default selection, без чужд event context. |

Запазеният scroll се clamp-ва към текущите размери и се възстановява без анимация/`preventScroll` focus; минимално доизместване само ако header/bottom navigation скрива target. Sheet пази собствен scroll независимо от locked document. Roster Back/Forward и resize не създават history цикли: при inline presentation на бивш sheet entry Back използва реалната предишна стъпка, без автоматичен push/reopen. Close cleanup не трябва да открадва фокуса от вече монтирания TaskDrawer. Това изисква малка Team-specific integration в App/history и отделни тестове; **не е вече налична функционалност**.

## 7. Семинарен контекст и backend-safe граница

Съдържанието отличава Team: guest logistics role с itinerary/hotel задачи; venue role с достъп/tatami; registration role с arrival brief/check-in; contingency role с резервни отговорности. Category/context/blocks prose са достатъчни; не измисляй автоматично stage membership, графови зависимости, контакти или готовност на залата. Role summary е role + реални категории на задачите, не AI описание на човек.

Domain selectors приемат `tasks`, `members`, `currentEventId`, `now`, без зависимост от UI/localization. ID е идентичност, role е display text; `isOrganizer` не дава permissions. Counts се извеждат, не се записват в бъдещата база. Current prototype остава local, fictional, editable само през наличните task controls.

Бъдещи `User`, `EventMembership`, `acceptedBy`, `acceptedAt`, invitations, permissions и multiple events са **бъдещи модели**, не полета за имитация сега. Не приемай `updatedAt` за `acceptedAt`, `ownerId` за доказан `acceptedBy`, seed member за реален user, или общия member list за event access policy. Accepted показва локално записаното boolean състояние, не identity-verified audit. Избягвай „поканен“, „онлайн“, „видяно от“, „прието от {name} в {time}“, „администраторски достъп“, live sync и notification promises. Read-only задачите без съвпадащ owner не се приписват на произволен човек; остават достъпни през Tasks.

## 8. Deliberate self-critique и окончателни корекции

| Подозрение                                                                | Преценка и финална корекция                                                                                                                                                |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Пет profile cards + еднакви метрики + повторени avatars/eyebrows          | Съвпадението е наследена directory композиция: забавя reaching detail, особено mobile. Заменя се с roster/detail; не защото radius или Lucide са забранени.                |
| Icon tile + heading + badge във всеки ред                                 | Иконата повтаря lifecycle и изразходва място за task title. Махни задължителната tile; запази икони с конкретна функция и lifecycle badge когато подпомага разпознаването. |
| Snapshot се превръща в mini dashboard                                     | Без KPI cards, completion percentage или пет равностойни totals. Един ред open/attention факти, точните причини са до задачите.                                            |
| Симетрия 50/50 / еднакви вътрешни cards                                   | 36–40/60–64 следва нуждата задачите да имат повече място; секциите не се принуждават да имат еднаква височина.                                                             |
| Отделен Not accepted списък дублира attention                             | Премахнат; acceptance остава на всеки task, всички причини на attention реда.                                                                                              |
| Брой „current work“ скрива far-future/in-progress или звучи като capacity | Заменен с точно дефинирани Open tasks и Needs attention; Later остава видим отделен timing контекст.                                                                       |
| Show all обещава неработещ owner filter                                   | Local Show more за човека + честен Open Tasks за целия event; без нов route параметър.                                                                                     |
| Signature като декоративен diagram                                        | Избран е продуктово смислен consequence path, но implementation е изключена, защото текстовите зависимости не са истински graph.                                           |
| Sheet „reuse“ без проверка на interaction ownership                       | Reuse на proven pattern, отделен MemberDetail и явен history contract; не широка преработка на TaskDrawer. Background inert/focus/scroll се проверяват конкретно.          |

Остава design хипотеза, че roster/detail ускорява operational review; настоящото доказателство е по-малко отделяне на selection от task action, не измерен organizer outcome. Визуалният преглед на реализацията трябва отново да пита „защо това е подходящо за подготовка на семинар?“.

## 9. Точен Team 2B.3 implementation boundary

**След изрично одобрение:** Team-only roster/detail layout и responsive sheet; factual labels/counts; pure member/task selectors; canonical attention/timing reuse; bounded previews/disclosures/empty states; real task anchors и Open Tasks; Team-specific history/focus/scroll integration; BG/EN copy, Light/Dark tokens, keyboard/reduced-motion behavior; релевантни unit/browser regression tests и актуализирани evidence/user/AI записи.

Допустимата минимална integration surface включва Team components/helpers/tests, Team-scoped CSS, нови Team i18n keys и App/отделен Team navigation context. Shared focus helpers могат да се разширят само при доказана нужда и regression evidence; Dashboard history key/behavior и Tasks public contracts се запазват. Няма промяна на shared `active`, `atRisk`, attention comparator, demo date, source fixtures или storage schema. Не започвай глобално извличане на modal framework.

**Изрично извън scope:** backend/database/migrations, auth, реални users, invites, permissions, member create/edit, reassignment, capacity management, performance scoring, notifications, email/chat, comments, presence, real-time sync, budget, AI, Kanban/Gantt, new dependencies/fonts, лого, нова палитра, signature implementation, graph/stage inference, Dashboard/Tasks redesign, Plan B/Templates redesign, owner-filter URL extension, generic „AI slop cleanup“. Няма commit/push в тази design фаза.

## 10. Implementation acceptance / review contract (НЕИЗПЪЛНЕН)

Всички следващи критерии са за бъдещата реализация; не са PASS резултати от 2B.3A.

| Област                | Необходимо доказателство за приемане                                                                                                                                                                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Матрица               | 1440, 1024, 768, 390, 320 CSS px × BG/EN × Light/Dark; записани височини и screenshots на roster, избран detail, overflow и task return. 1440/1024 split; 768/390/320 compact sheet; 960/961 boundary и content fallback без загуба на selection.                                                                                      |
| Domain                | Table-driven unit cases за всяка attention причина и комбинации; blocked+overdue се брои веднъж; Completed не е overdue/attention; Today/7/8 days/invalid; acceptance независимо от status; event isolation; stable tie order. Shared Dashboard/Tasks outputs непроменени.                                                             |
| Workload              | Far-future accepted not-started не е current attention; far-future not-accepted е attention; blocked влиза в Open tasks, без промяна на shared active. Zero-task, completed-only и open-no-attention имат различни честни empty states.                                                                                                |
| Content stress        | Дълго BG име/role/title, непрекъсната дума, всички attention reasons, >5 tasks и поне 100 tasks за човек, много членове. Full titles/reasons достъпни; no horizontal overflow в document/roster/sheet; няма скрит остатък след preview. Synthetic fixtures само в тестове.                                                             |
| Selection / keyboard  | Enter/Space на roster; явни selected/focus състояния; skip-to-detail; Tab/Shift+Tab trap в sheet, heading announcement, Close/Escape; focus не е под sticky header/nav; background inert. Screen-reader spot review отделно от автоматичната проверка.                                                                                 |
| History               | Inline/compact → task → Back → Forward → Back; Close/Escape; sheet → roster Back и Forward; reload на Team/task entry; explicit new Team resets; disclosures и двата scroll контекста се възстановяват. Няма nested dialogs/history loops.                                                                                             |
| Origin changes        | Завършване/приемане в canonical Tasks премахва attention row; return остава при същия човек с видим fallback. Removed task/member, event change, closed disclosure, malformed history, resize while sheet/task open не водят до hidden focus или чужди данни.                                                                          |
| Deep links            | Direct load/reload, encoded ID, modifier-click/new tab; missing/blank/duplicate/malformed/unknown/wrong-event query; close без marker остава безопасно `/tasks`. Open Tasks не твърди owner filtering.                                                                                                                                 |
| Visual/a11y           | BG/EN wrapping, numeric alignment, Light/Dark contrast measurement с цел WCAG AA (без claim за сертификация), visible focus, 44 px targets, reduced motion, opaque overlays, safe areas и 200% zoom/reflow без clipping.                                                                                                               |
| Runtime               | Clean application console; без application warnings/errors; local storage failure fallback остава; никакви неочаквани requests/auth/service promises. Не се добавят fake loaders при синхронни local data; съществуващите load/error notices се запазват.                                                                              |
| Regression / evidence | Relevant unit tests след значимите промени; repository format/lint/typecheck/test/build и релевантните съществуващи browser checks преди приемане. Dashboard 2B.2.3D return/disclosures и Tasks dropdown/drawer 2B.2.3C surfaces проверени. Actual results/commands/limitations в `TEST_EVIDENCE.md`; човешкият преглед не се измисля. |

Малки runnable етапи за бъдещата работа: selectors/семантика → desktop Team → compact sheet/history → regression и review. Gate за завършеност: работещ member → exact task → restored member loop, всичко от горната матрица с реални доказателства, без промяна на заключения продукт или скрити unfinished controls.

## 11. Предаване

2B.3A променя само този spec и append-only `AI_ASSISTANCE_LOG.md`. Не са стартирани implementation tests, не е променян application source/CSS, няма dependency/commit/push. Design review: **READY за одобрение**, Team implementation: **не е започната**.

Препоръка: **GPT-6 Astra (`gpt-6-astra`), Extra High**. Моделът е наличен в текущия Codex tool catalog; [официалното OpenAI guidance за reasoning](https://developers.openai.com/api/docs/guides/reasoning) го препоръчва за reasoning workloads. Extra High е преценка за тази задача: history/focus/scroll state, responsive modal ownership и locked-page regressions изискват внимателна интеграция; това не е измерен benchmark или гаранция за резултат.

**Единствена следваща задача:** преглед и изрично одобрение на този Team 2B.3 design contract.

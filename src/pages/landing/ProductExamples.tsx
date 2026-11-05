import {
  CalendarDays,
  Check,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  ListChecks,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useI18n } from "../../i18n/index.ts";

type Module =
  "tasks" | "kanban" | "calendar" | "team" | "templates" | "changes";

const TASKS = [
  {
    name: "landing.exampleTask1",
    date: "landing.exampleDate1",
    owner: "landing.exampleOwnerMira",
    status: "landing.exampleComplete",
  },
  {
    name: "landing.exampleTask2",
    date: "landing.exampleDate2",
    owner: "landing.exampleOwnerAlex",
    status: "landing.exampleInProgress",
  },
  {
    name: "landing.exampleTask3",
    date: "landing.exampleDate3",
    owner: "landing.exampleOwnerMira",
    status: "landing.exampleToDo",
  },
] as const;

export function WorkspaceExample() {
  const { t } = useI18n();
  return (
    <figure className="landing-workspace">
      <figcaption className="landing-workspace-caption">
        <span className="landing-example-dot" aria-hidden="true" />
        {t("landing.example")}
      </figcaption>
      <div className="landing-workspace-frame">
        <div className="landing-workspace-rail" aria-hidden="true">
          <LayoutDashboard />
          <ClipboardList />
          <CalendarDays />
          <Users />
          <ShieldAlert />
        </div>
        <div className="landing-workspace-main">
          <div className="landing-workspace-heading">
            <div>
              <p>{t("nav.dashboard")}</p>
              <strong>{t("landing.exampleEvent")}</strong>
            </div>
            <span>
              <CalendarDays size={15} aria-hidden="true" />
              {t("landing.exampleDate")}
            </span>
          </div>
          <div className="landing-workspace-agenda">
            <p>{t("landing.exampleNext")}</p>
            <ul>
              {TASKS.slice(1).map(({ name, date, owner }) => (
                <li key={name}>
                  <span className="landing-workspace-date">{t(date)}</span>
                  <span>
                    <strong>{t(name)}</strong>
                    <small>{t(owner)}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="landing-workspace-change">
            <ShieldAlert size={19} aria-hidden="true" />
            <div>
              <strong>{t("landing.exampleChange")}</strong>
              <p>{t("landing.exampleChangeDetail")}</p>
              <small>
                {t("landing.exampleChangeOwner")} ·{" "}
                {t("landing.exampleOwnerMira")}
              </small>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

export function FeatureExample({ module }: { module: Module }) {
  const { t } = useI18n();
  switch (module) {
    case "tasks":
      return (
        <ul className="landing-sample-list">
          {TASKS.map(({ name, date, owner }, index) => (
            <li key={name}>
              {index === 0 ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Clock3 size={16} aria-hidden="true" />
              )}
              <span>
                <strong>{t(name)}</strong>
                <small>{t(owner)}</small>
              </span>
              <time dateTime={`04-${14 + 2 * index}`}>{t(date)}</time>
            </li>
          ))}
        </ul>
      );
    case "kanban":
      return (
        <div className="landing-sample-board">
          {[...TASKS].reverse().map(({ name, owner, status }) => (
            <div key={status}>
              <span className="landing-sample-column-title">{t(status)}</span>
              <div className="landing-sample-board-task">
                <strong>{t(name)}</strong>
                <small>{t(owner)}</small>
              </div>
            </div>
          ))}
        </div>
      );
    case "calendar":
      return (
        <div className="landing-sample-calendar">
          <p>
            <CalendarDays size={16} aria-hidden="true" />
            {t("landing.exampleMonth")}{" "}
            <span>{t("landing.exampleSchedule")}</span>
          </p>
          <ol start={14}>
            {Array.from({ length: 7 }, (_, index) => {
              const task =
                index === 0
                  ? TASKS[0]
                  : index === 2
                    ? TASKS[1]
                    : index === 4
                      ? TASKS[2]
                      : undefined;
              return (
                <li key={index} data-event-day={index === 4 || undefined}>
                  <time dateTime={`04-${14 + index}`}>{14 + index}</time>
                  {task && (
                    <span className="landing-calendar-task">
                      <span className="sr-only">{t(task.name)}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      );
    case "team":
      return (
        <div className="landing-sample-team">
          <p>{t("landing.exampleEventTeam")}</p>
          <ul>
            <li>
              <span aria-hidden="true">M</span>
              <span>
                <strong>{t("landing.exampleOwnerMira")}</strong>
                <small>{t("landing.exampleMiraDuty")}</small>
              </span>
              <small>{t("landing.exampleOrganizer")}</small>
            </li>
            <li>
              <span aria-hidden="true">A</span>
              <span>
                <strong>{t("landing.exampleOwnerAlex")}</strong>
                <small>{t("landing.exampleAlexDuty")}</small>
              </span>
              <small>{t("landing.exampleMember")}</small>
            </li>
          </ul>
        </div>
      );
    case "templates":
      return (
        <ul className="landing-sample-list">
          {(
            ["landing.exampleTemplate1", "landing.exampleTemplate2"] as const
          ).map((name) => (
            <li key={name}>
              <ListChecks size={17} aria-hidden="true" />
              <span>
                <strong>{t(name)}</strong>
                <small>{t("landing.examplePreview")}</small>
              </span>
            </li>
          ))}
        </ul>
      );
    case "changes":
      return (
        <div className="landing-sample-change">
          <p>
            <ShieldAlert size={17} aria-hidden="true" />
            {t("landing.exampleChange")}
          </p>
          <dl>
            <div>
              <dt>{t("landing.exampleDecision")}</dt>
              <dd>{t("landing.exampleDecisionText")}</dd>
            </div>
            <div>
              <dt>{t("landing.exampleResponse")}</dt>
              <dd>{t("landing.exampleResponseText")}</dd>
            </div>
            <div>
              <dt>{t("landing.examplePlan")}</dt>
              <dd>{t("landing.examplePlanText")}</dd>
            </div>
          </dl>
        </div>
      );
  }
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceView } from "../services/workspaceViews.ts";
import { useI18n } from "../i18n/index.ts";
import type { MessageKey } from "../i18n/messages.ts";
import { isVisibleFocusTarget, revealFocusTarget } from "../navigationFocus.ts";
import { createTaskHref, eventHref, parseAppLocation } from "../routes.ts";
import {
  closeMemberContext,
  readTeamContext,
  selectMemberContext,
  withTeamContext,
  type TeamNavigationContext,
  type TeamSection,
} from "../teamNavigation.ts";
import {
  getTeamRoster,
  selectTeamMember,
  type MemberSummary,
} from "./team/helpers.ts";
import { MemberDetail } from "./team/MemberDetail.tsx";
import { MemberSheet } from "./team/MemberSheet.tsx";
import "./team/team.css";

interface TeamPageProps {
  now: Date;
  state: WorkspaceView;
  onOpenTask: (taskId: string) => void;
  onNavigate: (href: string) => void;
}

export function TeamPage({
  state,
  now,
  onOpenTask,
  onNavigate,
}: TeamPageProps) {
  const { t, formatDate, formatNumber } = useI18n();
  const roster = useMemo(() => getTeamRoster(state, now), [state, now]);
  const [context, setContext] = useState(() => {
    const saved = readTeamContext(window.history.state, state.currentEventId);
    return saved.memberId &&
      !roster.some(({ member }) => member.id === saved.memberId)
      ? {
          ...closeMemberContext(saved),
          memberId: null,
          expanded: [],
          detailScrollTop: 0,
        }
      : saved;
  });
  const contextRef = useRef<TeamNavigationContext>(context);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(window.innerWidth <= 960);
  const selected = selectTeamMember(roster, context.memberId);
  const selectedId = selected?.member.id ?? null;
  const sheetOpen = compact && context.detailOpen && !!selected;

  function save(next: TeamNavigationContext, push = false, render = true) {
    contextRef.current = next;
    const history = withTeamContext(window.history.state, next);
    if (push)
      window.history.pushState(
        history,
        "",
        parseAppLocation(window.location.pathname, "").eventId
          ? eventHref(state.currentEventId, "/team")
          : "/team",
      );
    else window.history.replaceState(history, "");
    if (render) setContext(next);
  }

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    function measure() {
      setCompact(
        window.innerWidth <= 960 ||
          workspace!.getBoundingClientRect().width < 660,
      );
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(workspace);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    function recordScroll() {
      if (
        parseAppLocation(window.location.pathname, "").path !== "/team" ||
        sheetOpen
      )
        return;
      const next = { ...contextRef.current, pageScrollY: window.scrollY };
      contextRef.current = next;
      window.history.replaceState(
        withTeamContext(window.history.state, next),
        "",
      );
    }
    window.addEventListener("scroll", recordScroll, { passive: true });
    return () => window.removeEventListener("scroll", recordScroll);
  }, [sheetOpen]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = contextRef.current;
      const detail = document.getElementById("team-member-detail");
      const rosterButton = [
        ...document.querySelectorAll<HTMLElement>("[data-team-member]"),
      ].find((element) => element.dataset.teamMember === selectedId);
      window.scrollTo({ top: saved.pageScrollY, behavior: "instant" });
      if (sheetScrollRef.current)
        sheetScrollRef.current.scrollTop = saved.detailScrollTop;
      let target: HTMLElement | null | undefined;
      if (saved.origin && detail) {
        const origin = saved.origin;
        target =
          [
            ...detail.querySelectorAll<HTMLElement>("[data-task-focus-key]"),
          ].find(
            (element) =>
              element.dataset.taskFocusKey === origin.focusKey &&
              isVisibleFocusTarget(element),
          ) ??
          [...detail.querySelectorAll<HTMLAnchorElement>("a[href]")].find(
            (element) =>
              element.getAttribute("href") ===
                createTaskHref(
                  origin.taskId,
                  parseAppLocation(window.location.pathname, "").eventId ??
                    undefined,
                ) && isVisibleFocusTarget(element),
          ) ??
          [
            ...detail.querySelectorAll<HTMLElement>("[data-team-disclosure]"),
          ].find(
            (element) =>
              element.dataset.teamDisclosure === origin.section &&
              isVisibleFocusTarget(element),
          ) ??
          (sheetOpen
            ? document.getElementById("team-member-heading")
            : rosterButton);
      } else if (sheetOpen)
        target = document.getElementById("team-member-heading");
      else if (saved.returnToRoster)
        target = rosterButton ?? document.getElementById("main-content");
      else if (
        document.activeElement === document.body &&
        saved.detailOpen &&
        !compact
      )
        target = document.getElementById("team-member-heading");
      target?.focus({ preventScroll: true });
      if (target && sheetScrollRef.current) {
        const body = sheetScrollRef.current.getBoundingClientRect();
        const rect = target.getBoundingClientRect();
        if (rect.top < body.top + 12)
          sheetScrollRef.current.scrollTop += rect.top - body.top - 12;
        else if (rect.bottom > body.bottom - 12)
          sheetScrollRef.current.scrollTop += rect.bottom - body.bottom + 12;
      } else if (target) revealFocusTarget(target);
    });
    return () => cancelAnimationFrame(frame);
  }, [compact, sheetOpen, selectedId]);

  function selectMember(memberId: string) {
    const base = {
      ...contextRef.current,
      memberId: selectedId,
      pageScrollY: window.scrollY,
      origin: undefined,
    };
    // A sheet gets one same-route history entry; Back returns to its roster row.
    const next = selectMemberContext(base, memberId, compact);
    if (compact) save(closeMemberContext(next), false, false);
    save(next, compact);
  }
  function closeSheet() {
    if (contextRef.current.sheetEntry) window.history.back();
    else save(closeMemberContext(contextRef.current));
  }
  function capture() {
    return {
      ...contextRef.current,
      memberId: selectedId,
      pageScrollY: sheetOpen ? contextRef.current.pageScrollY : window.scrollY,
      detailScrollTop:
        sheetScrollRef.current?.scrollTop ?? contextRef.current.detailScrollTop,
    };
  }
  function expand(section: TeamSection, open: boolean) {
    const saved = capture();
    save({
      ...saved,
      expanded: open
        ? [...new Set([...saved.expanded, section])]
        : saved.expanded.filter((value) => value !== section),
    });
  }
  function signal(summary: MemberSummary) {
    const reasons: [MessageKey, number][] = [
      ["team.workspace.overdueSignal", summary.overdue],
      ["team.workspace.blockedSignal", summary.blocked],
      ["team.workspace.notAcceptedSignal", summary.notAccepted],
      ["team.workspace.criticalSignal", summary.criticalDeadline],
    ];
    const present = reasons.filter(([, count]) => count > 0);
    if (present.length)
      return [
        ...present
          .slice(0, 2)
          .map(([key, count]) => t(key, { count: formatNumber(count) })),
        ...(present.length > 2
          ? [
              t("team.workspace.moreSignals", {
                count: formatNumber(present.length - 2),
              }),
            ]
          : []),
      ].join(" · ");
    return summary.inProgress
      ? t("team.workspace.progressSignal", {
          count: formatNumber(summary.inProgress),
        })
      : summary.open
        ? t("team.workspace.openSignal", { count: formatNumber(summary.open) })
        : summary.completed.length
          ? t("team.workspace.completedSignal", {
              count: formatNumber(summary.completed.length),
            })
          : t("team.workspace.noTasks");
  }
  const detail = selected && (
    <MemberDetail
      summary={selected}
      now={now}
      expanded={context.expanded}
      onExpand={expand}
      onEngage={() => {
        if (!contextRef.current.detailOpen)
          save({ ...capture(), detailOpen: true });
      }}
      onOpenTask={(taskId, section, focusKey) => {
        save(
          {
            ...capture(),
            detailOpen: true,
            returnToRoster: false,
            origin: { taskId, section, focusKey },
          },
          false,
          false,
        );
        onOpenTask(taskId);
      }}
      onNavigate={(href) => {
        save(capture(), false, false);
        onNavigate(href);
      }}
    />
  );

  return (
    <div className="page team-page">
      <header className="team-page__heading">
        <h1>{t("team.title")}</h1>
        <p>{t("team.workspace.description")}</p>
      </header>
      <div className="team-workspace" data-compact={compact} ref={workspaceRef}>
        <section className="team-roster" aria-label={t("team.listLabel")}>
          <p className="team-roster__order">{t("team.workspace.order")}</p>
          {roster.length ? (
            <ul className="team-roster__list">
              {roster.map((summary) => (
                <li key={summary.member.id}>
                  <button
                    type="button"
                    className="team-roster__member"
                    data-team-member={summary.member.id}
                    aria-pressed={selectedId === summary.member.id}
                    aria-controls={
                      !compact || sheetOpen ? "team-member-detail" : undefined
                    }
                    aria-haspopup={compact ? "dialog" : undefined}
                    onClick={() => selectMember(summary.member.id)}
                  >
                    <span className="team-roster__name">
                      {summary.member.name}
                      {selectedId === summary.member.id && (
                        <small>{t("team.workspace.selected")}</small>
                      )}
                    </span>
                    <span className="team-roster__role">
                      {summary.member.role}
                    </span>
                    <span
                      className={`team-roster__signal ${summary.atRisk ? "team-roster__signal--risk" : ""}`}
                    >
                      {signal(summary)}
                    </span>
                    {summary.attention.length === 0 && summary.upcoming[0] && (
                      <span className="team-roster__deadline">
                        {t("team.workspace.nextDeadline", {
                          date: formatDate(summary.upcoming[0].deadline),
                        })}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="team-empty-copy">
              {t("team.workspace.noMembers")}
              <small>{t("team.workspace.noMembersDescription")}</small>
            </p>
          )}
          {!compact && selected && (
            <button
              className="team-roster__skip"
              type="button"
              onClick={() => {
                save({ ...capture(), detailOpen: true, origin: undefined });
                const heading = document.getElementById("team-member-heading");
                heading?.focus({ preventScroll: true });
                if (heading) revealFocusTarget(heading);
              }}
            >
              {t("team.workspace.goToDetail", { name: selected.member.name })}
            </button>
          )}
        </section>
        {!compact && detail}
      </div>
      <div className="sr-only" role="status">
        {selected &&
          t("team.workspace.announcement", { name: selected.member.name })}
      </div>
      {sheetOpen && (
        <MemberSheet
          onClose={closeSheet}
          scrollRef={sheetScrollRef}
          onScroll={() => save(capture(), false, false)}
        >
          {detail}
        </MemberSheet>
      )}
    </div>
  );
}

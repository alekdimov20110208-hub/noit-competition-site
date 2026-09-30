export const TEAM_SECTIONS = [
  "attention",
  "upcoming",
  "completed",
  "other",
] as const;
export type TeamSection = (typeof TEAM_SECTIONS)[number];
export interface TeamOrigin {
  taskId: string;
  focusKey: string;
  section: TeamSection;
}
export interface TeamNavigationContext {
  eventId: string;
  memberId: string | null;
  detailOpen: boolean;
  sheetEntry: boolean;
  expanded: TeamSection[];
  pageScrollY: number;
  detailScrollTop: number;
  returnToRoster: boolean;
  origin?: TeamOrigin;
}
export function freshTeamContext(eventId: string): TeamNavigationContext {
  return {
    eventId,
    memberId: null,
    detailOpen: false,
    sheetEntry: false,
    expanded: [],
    pageScrollY: 0,
    detailScrollTop: 0,
    returnToRoster: false,
  };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function offset(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}
function isSection(value: unknown): value is TeamSection {
  return (
    typeof value === "string" &&
    TEAM_SECTIONS.some((section) => section === value)
  );
}
export function readTeamContext(
  state: unknown,
  eventId: string,
): TeamNavigationContext {
  const fallback = freshTeamContext(eventId);
  const value = record(state) ? state.budographTeam : null;
  if (
    !record(value) ||
    value.eventId !== eventId ||
    !(value.memberId === null || typeof value.memberId === "string") ||
    typeof value.detailOpen !== "boolean"
  )
    return fallback;
  const origin = value.origin;
  return {
    ...fallback,
    memberId: value.memberId,
    detailOpen: value.detailOpen,
    sheetEntry: value.sheetEntry === true && value.detailOpen,
    expanded: Array.isArray(value.expanded)
      ? [...new Set(value.expanded.filter(isSection))]
      : [],
    pageScrollY: offset(value.pageScrollY),
    detailScrollTop: offset(value.detailScrollTop),
    returnToRoster: value.returnToRoster === true,
    ...(record(origin) &&
    typeof origin.taskId === "string" &&
    origin.taskId.length > 0 &&
    typeof origin.focusKey === "string" &&
    isSection(origin.section)
      ? {
          origin: {
            taskId: origin.taskId,
            focusKey: origin.focusKey,
            section: origin.section,
          },
        }
      : {}),
  };
}
export function withTeamContext(
  state: unknown,
  context: TeamNavigationContext,
) {
  return { ...(record(state) ? state : {}), budographTeam: context };
}
export function selectMemberContext(
  context: TeamNavigationContext,
  memberId: string,
  sheet: boolean,
): TeamNavigationContext {
  return {
    ...context,
    memberId,
    detailOpen: true,
    sheetEntry: sheet,
    expanded: memberId === context.memberId ? context.expanded : [],
    detailScrollTop: 0,
    returnToRoster: false,
    origin: undefined,
  };
}
export function closeMemberContext(
  context: TeamNavigationContext,
): TeamNavigationContext {
  return {
    ...context,
    detailOpen: false,
    sheetEntry: false,
    returnToRoster: true,
    origin: undefined,
  };
}

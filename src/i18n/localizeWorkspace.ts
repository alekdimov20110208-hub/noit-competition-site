import { DEMO_SEED_LABEL } from "../data/demo.ts";
import type { WorkspaceState } from "../domain/types.ts";
import type { Language } from "../preferences/types.ts";
import { translate, type MessageKey } from "./messages.ts";

const EVENT_ID = "event-varna-aikido-2026";

const MILESTONE_KEYS: Readonly<Record<string, MessageKey>> = {
  "milestone-venue-confirmed": "demo.milestone.venueConfirmed",
  "milestone-travel-lock": "demo.milestone.travelLock",
  "milestone-registration-brief": "demo.milestone.registrationBrief",
  "milestone-final-check": "demo.milestone.finalCheck",
};

const MEMBER_ROLE_KEYS: Readonly<Record<string, MessageKey>> = {
  "member-mira-velin": "demo.role.leadOrganizer",
  "member-anton-ravin": "demo.role.guestLogistics",
  "member-lina-moreva": "demo.role.venueEquipment",
  "member-petar-zoren": "demo.role.registrationCommunications",
  "member-daria-kamen": "demo.role.volunteerContingency",
};

interface TaskCopyKeys {
  title: MessageKey;
  category: MessageKey;
  context: MessageKey;
  blockedBy?: MessageKey;
  blocks?: MessageKey;
}

const TASK_KEYS: Readonly<Record<string, TaskCopyKeys>> = {
  "task-venue-agreement": {
    title: "demo.task.venueAgreement.title",
    category: "demo.category.venue",
    context: "demo.task.venueAgreement.context",
    blocks: "demo.task.venueAgreement.blocks",
  },
  "task-tatami-inventory": {
    title: "demo.task.tatamiInventory.title",
    category: "demo.category.equipment",
    context: "demo.task.tatamiInventory.context",
  },
  "task-guest-itinerary": {
    title: "demo.task.guestItinerary.title",
    category: "demo.category.travel",
    context: "demo.task.guestItinerary.context",
    blockedBy: "demo.task.guestItinerary.blockedBy",
    blocks: "demo.task.guestItinerary.blocks",
  },
  "task-airport-transfer": {
    title: "demo.task.airportTransfer.title",
    category: "demo.category.travel",
    context: "demo.task.airportTransfer.context",
    blockedBy: "demo.task.airportTransfer.blockedBy",
    blocks: "demo.task.airportTransfer.blocks",
  },
  "task-hotel-rooming": {
    title: "demo.task.hotelRooming.title",
    category: "demo.category.accommodation",
    context: "demo.task.hotelRooming.context",
  },
  "task-registration-form": {
    title: "demo.task.registrationForm.title",
    category: "demo.category.registration",
    context: "demo.task.registrationForm.context",
  },
  "task-accessibility-route": {
    title: "demo.task.accessibilityRoute.title",
    category: "demo.category.venue",
    context: "demo.task.accessibilityRoute.context",
    blocks: "demo.task.accessibilityRoute.blocks",
  },
  "task-first-aid-cover": {
    title: "demo.task.firstAidCover.title",
    category: "demo.category.safety",
    context: "demo.task.firstAidCover.context",
    blocks: "demo.task.firstAidCover.blocks",
  },
  "task-program-draft": {
    title: "demo.task.programDraft.title",
    category: "demo.category.schedule",
    context: "demo.task.programDraft.context",
    blockedBy: "demo.task.programDraft.blockedBy",
    blocks: "demo.task.programDraft.blocks",
  },
  "task-catering-breaks": {
    title: "demo.task.cateringBreaks.title",
    category: "demo.category.hospitality",
    context: "demo.task.cateringBreaks.context",
  },
  "task-volunteer-rota": {
    title: "demo.task.volunteerRota.title",
    category: "demo.category.team",
    context: "demo.task.volunteerRota.context",
    blockedBy: "demo.task.volunteerRota.blockedBy",
  },
  "task-participant-brief": {
    title: "demo.task.participantBrief.title",
    category: "demo.category.communication",
    context: "demo.task.participantBrief.context",
    blockedBy: "demo.task.participantBrief.blockedBy",
    blocks: "demo.task.participantBrief.blocks",
  },
  "task-checkin-kit": {
    title: "demo.task.checkinKit.title",
    category: "demo.category.registration",
    context: "demo.task.checkinKit.context",
  },
  "task-signage": {
    title: "demo.task.signage.title",
    category: "demo.category.communication",
    context: "demo.task.signage.context",
  },
  "task-sound-check": {
    title: "demo.task.soundCheck.title",
    category: "demo.category.venue",
    context: "demo.task.soundCheck.context",
  },
  "task-final-walkthrough": {
    title: "demo.task.finalWalkthrough.title",
    category: "demo.category.contingency",
    context: "demo.task.finalWalkthrough.context",
    blockedBy: "demo.task.finalWalkthrough.blockedBy",
    blocks: "demo.task.finalWalkthrough.blocks",
  },
};

const CHANGE_AREA_KEYS: readonly MessageKey[] = [
  "demo.change.flightArrival.area.guestTravel",
  "demo.change.flightArrival.area.airportPickup",
  "demo.change.flightArrival.area.accommodation",
  "demo.change.flightArrival.area.fridaySchedule",
];

interface TemplateAreaKeys {
  name: MessageKey;
  items: readonly MessageKey[];
}

const TEMPLATE_AREA_KEYS: readonly TemplateAreaKeys[] = [
  {
    name: "demo.template.area.venue",
    items: [
      "demo.template.item.accessHours",
      "demo.template.item.trainingLayout",
      "demo.template.item.accessibleRoute",
    ],
  },
  {
    name: "demo.template.area.visitingInstructor",
    items: [
      "demo.template.item.expectations",
      "demo.template.item.teachingSchedule",
      "demo.template.item.hostResponsibilities",
    ],
  },
  {
    name: "demo.template.area.travel",
    items: [
      "demo.template.item.arrivalConfirmation",
      "demo.template.item.pickupOwner",
      "demo.template.item.backupTransport",
    ],
  },
  {
    name: "demo.template.area.accommodation",
    items: [
      "demo.template.item.roomingNote",
      "demo.template.item.checkinWindow",
      "demo.template.item.contingency",
    ],
  },
  {
    name: "demo.template.area.schedule",
    items: [
      "demo.template.item.sessionPlan",
      "demo.template.item.breaks",
      "demo.template.item.changeThreshold",
    ],
  },
  {
    name: "demo.template.area.team",
    items: [
      "demo.template.item.roleOwners",
      "demo.template.item.shiftRota",
      "demo.template.item.acknowledgements",
    ],
  },
  {
    name: "demo.template.area.registration",
    items: [
      "demo.template.item.registrationFlow",
      "demo.template.item.checkinList",
      "demo.template.item.offlineFallback",
    ],
  },
  {
    name: "demo.template.area.communication",
    items: [
      "demo.template.item.participantBrief",
      "demo.template.item.venueSigns",
      "demo.template.item.urgentContactPath",
    ],
  },
  {
    name: "demo.template.area.equipment",
    items: [
      "demo.template.item.tatami",
      "demo.template.item.deskKit",
      "demo.template.item.announcements",
    ],
  },
  {
    name: "demo.template.area.contingency",
    items: [
      "demo.template.item.travelChange",
      "demo.template.item.venueIssue",
      "demo.template.item.criticalOwnerAbsence",
    ],
  },
];

/**
 * Produces a Bulgarian presentation view for the immutable fictional seed.
 * IDs, workflow fields, personal names, and the source state remain unchanged.
 */
export function localizeWorkspace(
  state: WorkspaceState,
  language: Language,
): WorkspaceState {
  if (language === "en" || state.demoLabel !== DEMO_SEED_LABEL) return state;

  return {
    ...state,
    events: state.events.map((event) =>
      event.id === EVENT_ID
        ? {
            ...event,
            name: translate(language, "demo.event.name"),
            location: translate(language, "demo.event.location"),
            guestInstructor: translate(language, "demo.event.guestInstructor"),
            milestones: event.milestones.map((milestone) => {
              const titleKey = MILESTONE_KEYS[milestone.id];
              return titleKey
                ? { ...milestone, title: translate(language, titleKey) }
                : milestone;
            }),
          }
        : event,
    ),
    teamMembers: state.teamMembers.map((member) => {
      const roleKey = MEMBER_ROLE_KEYS[member.id];
      return roleKey
        ? { ...member, role: translate(language, roleKey) }
        : member;
    }),
    tasks: state.tasks.map((task) => {
      const keys = TASK_KEYS[task.id];
      if (!keys) return task;
      return {
        ...task,
        title: translate(language, keys.title),
        category: translate(language, keys.category),
        context: translate(language, keys.context),
        ...(keys.blockedBy
          ? { blockedBy: translate(language, keys.blockedBy) }
          : {}),
        ...(keys.blocks ? { blocks: translate(language, keys.blocks) } : {}),
      };
    }),
    changes: state.changes.map((change) =>
      change.id === "change-flight-arrival-2026-08-03"
        ? {
            ...change,
            title: translate(language, "demo.change.flightArrival.title"),
            description: translate(
              language,
              "demo.change.flightArrival.description",
            ),
            affectedAreas: change.affectedAreas.map((area, index) => {
              const areaKey = CHANGE_AREA_KEYS[index];
              return areaKey ? translate(language, areaKey) : area;
            }),
            response: translate(language, "demo.change.flightArrival.response"),
            escalationRecommendation: translate(
              language,
              "demo.change.flightArrival.escalation",
            ),
          }
        : change,
    ),
    templates: state.templates.map((template) =>
      template.id === "template-weekend-seminar-v1"
        ? {
            ...template,
            name: translate(language, "demo.template.name"),
            description: translate(language, "demo.template.description"),
            areas: template.areas.map((area, areaIndex) => {
              const areaKeys = TEMPLATE_AREA_KEYS[areaIndex];
              if (!areaKeys) return area;
              return {
                ...area,
                name: translate(language, areaKeys.name),
                items: area.items.map((item, itemIndex) => {
                  const itemKey = areaKeys.items[itemIndex];
                  return itemKey ? translate(language, itemKey) : item;
                }),
              };
            }),
          }
        : template,
    ),
  };
}

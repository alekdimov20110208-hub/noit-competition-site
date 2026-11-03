import type { Pool } from "pg";
import type { AppOptions } from "./app.ts";
import {
  createAuth,
  trustedApplicationOrigins,
  type AuthOptions,
} from "./auth/auth.ts";
import type { ServerConfig } from "./config/env.ts";
import {
  createTransactionalEmailService,
  type EmailKind,
} from "./email/service.ts";
import { createTaskService } from "./tasks/service.ts";
import { createTemplateApplicationService } from "./templates/service.ts";
import { createPersonalTemplateService } from "./templates/library.ts";
import { createEventService } from "./events/service.ts";
import { createInvitationService } from "./invitations/service.ts";
import { createChangeService } from "./changes/service.ts";
import { createNotificationService } from "./notifications/service.ts";
import { verificationCallback } from "./routes/auth.ts";
import { createSharedControls } from "./operations/limits.ts";
import { createEmailOutbox } from "./email/outbox.ts";
import { localSignupIdentity } from "./auth/signup.ts";

// Shared composition only. No listener, timer, signal handler, environment load,
// provisioning or migration execution belongs in this module.
export function createApplicationServices(
  database: Pool,
  config: ServerConfig,
  emailTasks: NonNullable<AuthOptions["emailTasks"]>,
  safeEmailLog: (kind: EmailKind | "outbox") => void,
  trustedClientIp = true,
): Pick<
  AppOptions,
  | "personalTemplates"
  | "templates"
  | "email"
  | "changes"
  | "tasks"
  | "notifications"
  | "events"
  | "invitations"
  | "authentication"
  | "checkDatabase"
> & {
  emailOperations?: {
    dispatch(): Promise<unknown>;
    cleanup(): Promise<unknown>;
  };
} {
  if (config.nodeEnv === "production" && !config.operations)
    throw new Error("Production operational controls are required.");
  const controls = config.operations
    ? createSharedControls(database, config.operations.hmacKey, trustedClientIp)
    : undefined;
  const email =
    config.operations && config.emailMode === "resend"
      ? createEmailOutbox(
          database,
          {
            ...config,
            operations: config.operations,
            emailFrom: config.emailFrom!,
            resendApiKey: config.resendApiKey!,
          },
          controls!,
          () => safeEmailLog("outbox"),
        )
      : createTransactionalEmailService(config, safeEmailLog);
  const registration = createAuth(database, config, {
    invitationRegistration: true,
    email,
    emailTasks,
    sharedControls: controls,
    onMailEnqueueFailure: () => safeEmailLog("outbox"),
  });
  const signupIdentity = localSignupIdentity(config);
  if (
    signupIdentity &&
    (!controls || !email.enabled || !email.enqueue || !email.reserve)
  )
    throw new Error(
      "Local public signup requires durable email and shared controls.",
    );
  return {
    ...(email.dispatch && controls
      ? {
          emailOperations: {
            dispatch: () => email.dispatch!(),
            cleanup: () => controls.cleanup(),
          },
        }
      : {}),
    personalTemplates: createPersonalTemplateService(database),
    templates: createTemplateApplicationService(database),
    email,
    changes: createChangeService(database),
    tasks: createTaskService(database),
    notifications: createNotificationService(database),
    events: createEventService(database),
    invitations: createInvitationService(
      database,
      async (fields, locale, returnTo, transaction) => {
        if (!transaction) throw new Error("Registration transaction required.");
        return registration.registration.withinTransaction(
          transaction,
          fields,
          locale ?? "bg",
          verificationCallback(config.publicAppUrl, returnTo, locale ?? "bg"),
        );
      },
      email.enabled,
      registration.registration.prepare,
      email.enqueue
        ? (tx, result, locale) =>
            email.enqueue!(tx, {
              kind: "invitation",
              to: result.invitation.email,
              url: new URL(`/invite/${result.token}`, config.publicAppUrl).href,
              locale: locale ?? "bg",
              eventName: result.eventName,
              expiresAt: result.invitation.expiresAt,
            })
        : undefined,
    ),
    authentication: {
      auth: createAuth(database, config, {
        email,
        emailTasks,
        sharedControls: controls,
        onMailEnqueueFailure: () => safeEmailLog("outbox"),
      }),
      baseURL: config.betterAuthUrl,
      taskMutationOrigins: trustedApplicationOrigins(config),
      publicAppUrl: config.publicAppUrl,
      emailEnabled: email.enabled,
      developmentInviteLinks: config.nodeEnv !== "production",
      controls,
      ...(signupIdentity
        ? {
            publicSignup: (fields, locale, callbackURL) =>
              registration.registration.publicSignup(
                fields,
                locale,
                callbackURL,
                signupIdentity,
              ),
          }
        : {}),
    },
    checkDatabase: async () => {
      const query = { text: "SELECT 1", query_timeout: 5_000 };
      await database.query(query);
    },
  };
}

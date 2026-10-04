import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createDatabasePool } from "../src/db/pool.ts";
import { readDatabaseEnv } from "../src/config/env.ts";
import {
  createPostgresFixture,
  rollbackCommandPool,
} from "./postgres-fixture.ts";
import { createInvitationService } from "../src/invitations/service.ts";
import {
  InvitationError,
  hashInvitationToken,
} from "../src/invitations/model.ts";
import { UnauthorizedError } from "../src/auth/session.ts";
const denied = (status: number, code?: string) => (error: unknown) =>
  error instanceof InvitationError &&
  error.statusCode === status &&
  (!code || error.code === code);
test(
  "PostgreSQL invitation integrity, transactions, privacy and membership (rollback-only)",
  { skip: process.env.RUN_DATABASE_INTEGRATION !== "1", timeout: 120_000 },
  async (t) => {
    const config = readDatabaseEnv();
    assert.notEqual(config.nodeEnv, "production");
    const pool = createDatabasePool(config, () => {}),
      client = await pool.connect();
    try {
      await client.query("BEGIN");
      const f = await createPostgresFixture(client),
        boundary = {
          ...rollbackCommandPool(client),
          query: (sql: string, values?: unknown[]) => client.query(sql, values),
        };
      const registered: { email: string; name: string; password: string }[] =
        [];
      const service = createInvitationService(boundary, async (fields) => {
        registered.push(fields);
      });
      const user = (id: string) => ({
        id,
        name: "Disposable",
        email: `${id}@example.invalid`,
      });
      const org = user(f.organizerUser),
        member = user(f.memberUser),
        foreign = user(f.foreignUser);
      const recipient = user(`${f.prefix}-new`);
      await client.query(
        `INSERT INTO public."user" (id,name,email,"emailVerified",active,"createdAt","updatedAt") VALUES ($1,'Disposable',$2,FALSE,TRUE,now(),now())`,
        [recipient.id, recipient.email],
      );
      let first: Awaited<ReturnType<typeof service.create>>;
      const rows = async () =>
        (
          await client.query(
            "SELECT * FROM public.event_invitation WHERE event_id=$1",
            [f.eventId],
          )
        ).rows;
      await t.test(
        "Organizer creates normalized seven-day invitation with hash only and server activity",
        async () => {
          first = await service.create(org, f.eventId, {
            email: `  ${recipient.email.toUpperCase()}  `,
          });
          const row = (await rows())[0];
          assert.equal(row.token_hash, hashInvitationToken(first.token));
          assert.equal(JSON.stringify(row).includes(first.token), false);
          assert.equal(row.invited_email, recipient.email);
          assert.equal(row.inviter_user_id, org.id);
          assert.equal(row.accepted_at, null);
          assert.equal(row.revoked_at, null);
          assert.ok(
            Math.abs((row.expires_at - row.created_at) / 1000 - 604800) < 2,
          );
          const history = (
            await client.query(
              "SELECT * FROM public.activity_entry WHERE target_id=$1",
              [first.invitation.id],
            )
          ).rows;
          assert.equal(history.length, 1);
          assert.equal(history[0].actor_member_id, f.organizerId);
          assert.equal(JSON.stringify(history).includes(first.token), false);
          assert.equal(JSON.stringify(history).includes(row.token_hash), false);
        },
      );
      await t.test(
        "Member/foreign/guessed scopes and active/inactive members fail closed; duplicates serialize",
        async () => {
          await assert.rejects(
            service.create(member, f.eventId, {
              email: "other@example.invalid",
            }),
            denied(403),
          );
          await assert.rejects(
            service.create(org, f.foreignEventId, {
              email: "other@example.invalid",
            }),
            denied(404),
          );
          await assert.rejects(service.list(org, randomUUID()), denied(404));
          await assert.rejects(service.list(member, f.eventId), denied(403));
          await assert.rejects(
            service.create(org, f.eventId, { email: member.email }),
            denied(409, "ALREADY_MEMBER"),
          );
          await assert.rejects(
            service.create(org, f.eventId, { email: foreign.email }),
            denied(409, "INACTIVE_MEMBER"),
          );
          await assert.rejects(
            service.create(org, f.eventId, { email: recipient.email }),
            denied(409, "ALREADY_PENDING"),
          );
          assert.equal((await rows()).length, 1);
        },
      );
      await t.test(
        "public lookup/list are minimized; invalid guessed tokens do not enumerate",
        async () => {
          assert.deepEqual(
            Object.keys(await service.lookup(first.token)).sort(),
            ["email", "eventName", "expiresAt", "state"],
          );
          assert.deepEqual(
            Object.keys((await service.list(org, f.eventId))[0]!).sort(),
            ["createdAt", "email", "expiresAt", "id", "state"],
          );
          await assert.rejects(service.lookup("guessed"), denied(404));
        },
      );
      await t.test(
        "registration fixes email, rejects forged inputs, does not consume invitation",
        async () => {
          await assert.rejects(
            service.register(first.token, {
              name: "Disposable",
              password: "abcdefgh",
              email: "forged@example.com",
            }),
            denied(400),
          );
          await service.register(first.token, {
            name: "Disposable",
            password: "abcdefgh",
          });
          assert.equal(registered[0]!.email, recipient.email);
          assert.equal((await rows())[0].accepted_at, null);
          assert.equal(
            (
              await client.query(
                "SELECT id FROM public.event_member WHERE event_id=$1 AND user_id=$2",
                [f.eventId, recipient.id],
              )
            ).rows.length,
            0,
          );
        },
      );
      await t.test(
        "wrong account denied; matching canonical stored email creates only MEMBER atomically",
        async () => {
          await assert.rejects(
            service.accept(member, first.token, {}),
            denied(403, "WRONG_ACCOUNT"),
          );
          await assert.rejects(
            service.accept(recipient, first.token, { accessRole: "ORGANIZER" }),
            denied(400),
          );
          const result = await service.accept(
            { ...recipient, email: "forged-session-display@example.invalid" },
            first.token,
            {},
          );
          assert.equal(result.eventId, f.eventId);
          const memberships = (
            await client.query(
              "SELECT * FROM public.event_member WHERE event_id=$1 AND user_id=$2",
              [f.eventId, recipient.id],
            )
          ).rows;
          assert.equal(memberships.length, 1);
          assert.equal(memberships[0].access_role, "MEMBER");
          assert.equal(memberships[0].operational_role, "");
          assert.equal(memberships[0].active, true);
          const row = (await rows())[0];
          assert.equal(row.accepted_user_id, recipient.id);
          assert.ok(row.accepted_at);
          assert.equal(
            (await service.accept(recipient, first.token, {})).status,
            "already_accepted",
          );
          assert.equal(
            (
              await client.query(
                "SELECT id FROM public.activity_entry WHERE target_id=$1 AND action_type='invitation.accepted'",
                [first.invitation.id],
              )
            ).rows.length,
            1,
          );
          await assert.rejects(
            service.revoke(org, f.eventId, first.invitation.id, {}),
            denied(409),
          );
        },
      );
      await t.test(
        "revocation scoped and terminal; replacement permitted after revoke/expiry",
        async () => {
          const inv = await service.create(org, f.eventId, {
            email: "revoked@example.invalid",
          });
          await assert.rejects(
            service.revoke(member, f.eventId, inv.invitation.id, {}),
            denied(403),
          );
          await assert.rejects(
            service.revoke(org, f.eventId, randomUUID(), {}),
            denied(404),
          );
          await assert.rejects(
            service.revoke(org, f.foreignEventId, inv.invitation.id, {}),
            denied(404),
          );
          await service.revoke(org, f.eventId, inv.invitation.id, {});
          assert.deepEqual(await service.lookup(inv.token), {
            state: "revoked",
          });
          await assert.rejects(
            service.register(inv.token, {
              name: "Disposable",
              password: "abcdefgh",
            }),
            denied(410),
          );
          await assert.rejects(
            service.accept(member, inv.token, {}),
            denied(403),
          );
          const replacement = await service.create(org, f.eventId, {
            email: "revoked@example.invalid",
          });
          await client.query(
            "UPDATE public.event_invitation SET created_at=clock_timestamp()-interval '8 days',expires_at=clock_timestamp()-interval '1 day' WHERE id=$1",
            [replacement.invitation.id],
          );
          assert.deepEqual(await service.lookup(replacement.token), {
            state: "expired",
          });
          await assert.rejects(
            service.register(replacement.token, {
              name: "Disposable",
              password: "abcdefgh",
            }),
            denied(410),
          );
          await service.create(org, f.eventId, {
            email: "revoked@example.invalid",
          });
        },
      );
      await t.test(
        "matching accounts cannot use revoked/expired links, archived Events or inactive identities/memberships",
        async () => {
          const guarded = user(`${f.prefix}-guarded`);
          await client.query(
            `INSERT INTO public."user" (id,name,email,"emailVerified",active,"createdAt","updatedAt") VALUES ($1,'Disposable',$2,FALSE,TRUE,now(),now())`,
            [guarded.id, guarded.email],
          );
          const revoked = await service.create(org, f.eventId, {
            email: guarded.email,
          });
          await service.revoke(org, f.eventId, revoked.invitation.id, {});
          await assert.rejects(
            service.accept(guarded, revoked.token, {}),
            denied(410, "INVITATION_REVOKED"),
          );
          const pending = await service.create(org, f.eventId, {
            email: guarded.email,
          });
          await client.query("SAVEPOINT guarded_state");
          await client.query(
            "UPDATE public.event_invitation SET created_at=clock_timestamp()-interval '8 days',expires_at=clock_timestamp()-interval '1 day' WHERE id=$1",
            [pending.invitation.id],
          );
          await assert.rejects(
            service.accept(guarded, pending.token, {}),
            denied(410, "INVITATION_EXPIRED"),
          );
          await client.query("ROLLBACK TO SAVEPOINT guarded_state");
          await client.query(
            "UPDATE public.event SET archived_at=clock_timestamp() WHERE id=$1",
            [f.eventId],
          );
          assert.deepEqual(await service.lookup(pending.token), {
            state: "unavailable",
          });
          await assert.rejects(
            service.accept(guarded, pending.token, {}),
            denied(410),
          );
          await assert.rejects(
            service.register(pending.token, {
              name: "Disposable",
              password: "abcdefgh",
            }),
            denied(410),
          );
          await assert.rejects(
            service.create(org, f.eventId, {
              email: "archive@example.invalid",
            }),
            denied(403, "EVENT_ARCHIVED"),
          );
          await assert.rejects(
            service.revoke(org, f.eventId, pending.invitation.id, {}),
            denied(403, "EVENT_ARCHIVED"),
          );
          await client.query("ROLLBACK TO SAVEPOINT guarded_state");
          await client.query(
            'UPDATE public."user" SET active=FALSE WHERE id=$1',
            [guarded.id],
          );
          await assert.rejects(
            service.accept(guarded, pending.token, {}),
            UnauthorizedError,
          );
          await client.query("ROLLBACK TO SAVEPOINT guarded_state");
          await client.query(
            "INSERT INTO public.event_member (id,event_id,user_id,access_role,operational_role,active,deactivated_at) VALUES ($1,$2,$3,'MEMBER','',FALSE,clock_timestamp())",
            [randomUUID(), f.eventId, guarded.id],
          );
          await assert.rejects(
            service.accept(guarded, pending.token, {}),
            denied(409, "INACTIVE_MEMBER"),
          );
          await client.query("ROLLBACK TO SAVEPOINT guarded_state");
          await client.query("RELEASE SAVEPOINT guarded_state");
          assert.equal((await service.lookup(pending.token)).state, "pending");
          assert.equal(
            (
              await client.query(
                "SELECT id FROM public.event_member WHERE event_id=$1 AND user_id=$2",
                [f.eventId, guarded.id],
              )
            ).rows.length,
            0,
          );
        },
      );
      await t.test(
        "inactive Organizer identity or membership cannot create, list or revoke invitations",
        async () => {
          const pending = await service.create(org, f.eventId, {
            email: "organizer-guard@example.invalid",
          });
          await client.query("SAVEPOINT organizer_state");
          for (const [sql, values] of [
            ['UPDATE public."user" SET active=FALSE WHERE id=$1', [org.id]],
            [
              "UPDATE public.event_member SET active=FALSE,deactivated_at=clock_timestamp() WHERE user_id=$1 AND event_id=$2",
              [org.id, f.eventId],
            ],
          ] as const) {
            await client.query(sql, [...values]);
            await assert.rejects(
              service.create(org, f.eventId, {
                email: "denied@example.invalid",
              }),
              denied(404),
            );
            await assert.rejects(service.list(org, f.eventId), denied(404));
            await assert.rejects(
              service.revoke(org, f.eventId, pending.invitation.id, {}),
              denied(404),
            );
            await client.query("ROLLBACK TO SAVEPOINT organizer_state");
          }
          await client.query("RELEASE SAVEPOINT organizer_state");
          assert.equal((await service.lookup(pending.token)).state, "pending");
        },
      );
      await t.test(
        "real invitation constraints enforce digest uniqueness/format, normalization, acceptance pairing and same-Event membership",
        async () => {
          const assertConstraint = async (
            sql: string,
            values: unknown[],
            code: string,
          ) => {
            await client.query("SAVEPOINT invitation_constraint");
            await assert.rejects(
              client.query(sql, values),
              (error: unknown) => (error as { code?: string }).code === code,
            );
            await client.query("ROLLBACK TO SAVEPOINT invitation_constraint");
            await client.query("RELEASE SAVEPOINT invitation_constraint");
          };
          await assertConstraint(
            "INSERT INTO public.event_invitation (id,event_id,invited_email,inviter_user_id,token_hash,expires_at) VALUES ($1,$2,$3,$4,$5,clock_timestamp()+interval '7 days')",
            [
              randomUUID(),
              f.eventId,
              "digest@example.invalid",
              org.id,
              hashInvitationToken(first.token),
            ],
            "23505",
          );
          await assertConstraint(
            "UPDATE public.event_invitation SET token_hash=$1 WHERE id=$2",
            ["invalid", first.invitation.id],
            "23514",
          );
          await assertConstraint(
            "UPDATE public.event_invitation SET invited_email=$1 WHERE id=$2",
            ["UPPER@example.invalid", first.invitation.id],
            "23514",
          );
          await assertConstraint(
            "UPDATE public.event_invitation SET accepted_user_id=NULL WHERE id=$1",
            [first.invitation.id],
            "23514",
          );
          await assertConstraint(
            "UPDATE public.event_invitation SET revoked_at=clock_timestamp() WHERE id=$1",
            [first.invitation.id],
            "23514",
          );
          await assertConstraint(
            "UPDATE public.event_invitation SET accepted_user_id=$1 WHERE id=$2",
            [`${f.prefix}-guarded`, first.invitation.id],
            "23503",
          );
        },
      );
      await t.test(
        "failed activity rolls back invitation; failed acceptance leaves no phantom membership",
        async () => {
          const before = (await rows()).length;
          await client.query("SAVEPOINT failure_test");
          await client.query(
            "ALTER TABLE public.activity_entry ADD CONSTRAINT p2c_force_failure CHECK (action_type NOT LIKE 'invitation.%') NOT VALID",
          );
          await assert.rejects(
            service.create(org, f.eventId, {
              email: "rollback@example.invalid",
            }),
          );
          assert.equal((await rows()).length, before);
          await client.query("ROLLBACK TO SAVEPOINT failure_test");
          const inv = await service.create(org, f.eventId, {
            email: `${f.prefix}-retry@example.invalid`,
          });
          const retry = user(`${f.prefix}-retry`);
          await client.query(
            `INSERT INTO public."user" (id,name,email,"emailVerified",active,"createdAt","updatedAt") VALUES ($1,'Disposable',$2,FALSE,TRUE,now(),now())`,
            [retry.id, retry.email],
          );
          await client.query("SAVEPOINT failure_acceptance");
          await client.query(
            "ALTER TABLE public.activity_entry ADD CONSTRAINT p2c_force_failure CHECK (action_type <> 'invitation.accepted') NOT VALID",
          );
          await assert.rejects(service.accept(retry, inv.token, {}));
          assert.equal(
            (
              await client.query(
                "SELECT id FROM public.event_member WHERE user_id=$1",
                [retry.id],
              )
            ).rows.length,
            0,
          );
          assert.equal((await service.lookup(inv.token)).state, "pending");
          await client.query("ROLLBACK TO SAVEPOINT failure_acceptance");
          await service.accept(retry, inv.token, {});
        },
      );
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      if (typeof code === "string" && /^[A-Z0-9]{5}$/.test(code)) {
        throw new Error(
          `PostgreSQL invitation fixture failed (${code}); database details omitted.`,
        );
      }
      throw error;
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
      await pool.end();
    }
  },
);

export const INVITATION_EN_MESSAGES = {
  "invite.manage": "Invite member",
  "invite.email": "Email",
  "invite.create": "Create invitation",
  "invite.creating": "Please wait…",
  "invite.pending": "Pending invitations",
  "invite.empty": "No pending invitations.",
  "invite.revoke": "Revoke",
  "invite.expires": "Expires {date}",
  "invite.expired": "Expired",
  "invite.development":
    "Development invitation link — email delivery is not configured. Share this link with the invited person. It is shown once; keep it private.",
  "invite.copy": "Copy development invitation link",
  "invite.copied": "Link copied.",
  "invite.copyFailed": "Copy failed. Select and copy the link manually.",
  "invite.link": "Development invitation link",
  "invite.cancel": "Cancel",
  "invite.retry": "Retry",
  "invite.title": "Event invitation",
  "invite.join": "Join Event",
  "invite.joined": "Open joined Event",
  "invite.context": "Join {name} as a Member.",
  "invite.for": "Invitation for {email}",
  "invite.signIn": "Sign in",
  "invite.register": "Create account",
  "invite.new": "New to BudoGraph? Create an account using this invitation.",
  "invite.name": "Name",
  "invite.password": "Password (8–128 characters)",
  "invite.wrong":
    "This invitation belongs to another email address. Sign out and use the invited account.",
  "invite.signOut": "Sign out and use invited account",
  "invite.state.expired":
    "This invitation has expired. Ask the Organizer for a new invitation.",
  "invite.state.revoked":
    "This invitation has been revoked. Ask the Organizer for a new invitation.",
  "invite.state.accepted":
    "This invitation has already been accepted. Sign in with the invited account to open the Event.",
  "invite.state.unavailable": "This invitation is unavailable.",
  "invite.loading": "Checking invitation…",
  "invite.error.invalid": "The invitation or input is invalid or unavailable.",
  "invite.error.unavailable":
    "The server is unavailable. Retry to check the current state before creating another invitation.",
  "invite.error.unauthenticated": "Please sign in to continue.",
  "invite.error.forbidden": "This action is unavailable for your account.",
  "invite.error.wrong-account": "This invitation belongs to another account.",
  "invite.error.already-member":
    "This email already belongs to a member of this Event.",
  "invite.error.inactive-member":
    "This membership is inactive. Reactivation is not available yet.",
  "invite.error.already-pending":
    "A valid pending invitation already exists for this email.",
  "invite.error.expired": "This invitation has expired.",
  "invite.error.revoked": "This invitation has been revoked.",
  "invite.error.registration":
    "Account creation or sign-in could not be completed. If you have an account, use Sign in. Joining remains a separate step.",
  "invite.error.rate-limited":
    "Too many attempts. Please wait a minute and retry.",
} as const;
export const INVITATION_BG_MESSAGES = {
  "invite.manage": "Покани участник",
  "invite.email": "Имейл",
  "invite.create": "Създай покана",
  "invite.creating": "Моля, изчакай…",
  "invite.pending": "Чакащи покани",
  "invite.empty": "Няма чакащи покани.",
  "invite.revoke": "Отмени",
  "invite.expires": "Изтича на {date}",
  "invite.expired": "Изтекла",
  "invite.development":
    "Тестов линк за покана — изпращането по имейл не е настроено. Сподели линка с поканения човек. Показва се само веднъж; пази го поверителен.",
  "invite.copy": "Копирай тестовия линк за покана",
  "invite.copied": "Линкът е копиран.",
  "invite.copyFailed": "Копирането не успя. Маркирай и копирай линка ръчно.",
  "invite.link": "Тестов линк за покана",
  "invite.cancel": "Отказ",
  "invite.retry": "Опитай отново",
  "invite.title": "Покана за събитие",
  "invite.join": "Присъедини се",
  "invite.joined": "Отвори събитието",
  "invite.context": "Присъедини се към {name} като участник.",
  "invite.for": "Покана за {email}",
  "invite.signIn": "Вход",
  "invite.register": "Създай акаунт",
  "invite.new": "Нов потребител? Създай акаунт чрез тази покана.",
  "invite.name": "Име",
  "invite.password": "Парола (8–128 знака)",
  "invite.wrong":
    "Тази покана е за друг имейл адрес. Излез и влез с поканения акаунт.",
  "invite.signOut": "Излез и използвай поканения акаунт",
  "invite.state.expired":
    "Поканата е изтекла. Поискай нова покана от организатора.",
  "invite.state.revoked":
    "Поканата е отменена. Поискай нова покана от организатора.",
  "invite.state.accepted":
    "Поканата вече е приета. Влез с поканения акаунт, за да отвориш събитието.",
  "invite.state.unavailable": "Тази покана не е достъпна.",
  "invite.loading": "Проверка на поканата…",
  "invite.error.invalid":
    "Поканата или въведените данни са невалидни или недостъпни.",
  "invite.error.unavailable":
    "Сървърът не е достъпен. Опитай отново, за да провериш състоянието, преди да създадеш нова покана.",
  "invite.error.unauthenticated": "Влез, за да продължиш.",
  "invite.error.forbidden": "Това действие не е достъпно за твоя акаунт.",
  "invite.error.wrong-account": "Тази покана е за друг акаунт.",
  "invite.error.already-member":
    "Този имейл вече принадлежи на участник в събитието.",
  "invite.error.inactive-member":
    "Участието е неактивно. Повторното активиране още не е достъпно.",
  "invite.error.already-pending":
    "Вече има валидна чакаща покана за този имейл.",
  "invite.error.expired": "Поканата е изтекла.",
  "invite.error.revoked": "Поканата е отменена.",
  "invite.error.registration":
    "Създаването на акаунт или входът не успя. Ако имаш акаунт, използвай Вход. Присъединяването остава отделна стъпка.",
  "invite.error.rate-limited":
    "Твърде много опити. Изчакай минута и опитай отново.",
} satisfies Record<keyof typeof INVITATION_EN_MESSAGES, string>;

export const PROFILE_EN_MESSAGES = {
  "profile.title": "My Profile",
  "profile.description": "Your personal account, security and preferences.",
  "profile.personal": "Personal information",
  "profile.personalDetail":
    "Your display name identifies you across your workspaces.",
  "profile.name": "Display name",
  "profile.nameHint":
    "Use 1–100 characters. Initials use the first and last words.",
  "profile.email": "Email address",
  "profile.emailHint":
    "Email changes require a verified ownership flow and are not available yet.",
  "profile.avatarHint":
    "Your avatar uses initials. Photo uploads are not available yet.",
  "profile.save": "Save changes",
  "profile.saving": "Saving…",
  "profile.saved": "Your display name is saved.",
  "profile.security": "Security",
  "profile.securityDetail":
    "Change your password using your current password. Forgotten-password recovery is a separate email flow.",
  "profile.currentPassword": "Current password",
  "profile.newPassword": "New password",
  "profile.confirmPassword": "Confirm new password",
  "profile.passwordHint":
    "Use 8–128 characters. Passwords are never saved in browser storage.",
  "profile.sessionPolicy":
    "Changing your password signs out all previous sessions. This browser receives a new session and stays signed in.",
  "profile.changePassword": "Change password",
  "profile.passwordSaved":
    "Your password is changed. Previous sessions have been signed out.",
  "profile.preferences": "Preferences",
  "profile.preferencesDetail":
    "Language and theme apply immediately and are saved in this browser when storage is available.",
  "profile.notifications": "Notifications",
  "profile.notificationsDetail":
    "In-app task reminders appear in the notification bell for the current Event. Delivery preferences, email, SMS and push notifications are not available.",
  "profile.invalidName":
    "Enter a name of 1–100 characters without control characters or angle brackets.",
  "profile.invalidPassword":
    "Enter your current password and a new password of 8–128 characters.",
  "profile.mismatch": "The new passwords do not match.",
  "profile.wrongPassword": "The current password is incorrect. Try again.",
  "profile.expired": "Your session ended. Sign in again to continue.",
  "profile.reauthenticate":
    "Sign out and sign in again, then retry the password change.",
  "profile.limited": "Too many requests. Please wait before trying again.",
  "profile.unavailable":
    "The server could not confirm the change. Check your connection and reload your account before trying again.",
  "profile.refresh":
    "The change was saved, but your account identity could not be refreshed. Reload your account to confirm it.",
  "profile.failed":
    "The change could not be confirmed. Reload your account and try again.",
  "profile.busy": "An account change is already in progress.",
  "profile.reload": "Reload account",
} as const;

export const PROFILE_BG_MESSAGES = {
  "profile.title": "Моят профил",
  "profile.description": "Вашият личен акаунт, сигурност и предпочитания.",
  "profile.personal": "Лична информация",
  "profile.personalDetail":
    "Екранното име ви представя в работните пространства.",
  "profile.name": "Екранно име",
  "profile.nameHint":
    "Използвайте 1–100 знака. Инициалите са от първата и последната дума.",
  "profile.email": "Имейл адрес",
  "profile.emailHint":
    "Промяната на имейл изисква потвърждаване на собствеността и все още не е налична.",
  "profile.avatarHint":
    "Аватарът използва инициали. Качването на снимки все още не е налично.",
  "profile.save": "Запази промените",
  "profile.saving": "Запазване…",
  "profile.saved": "Екранното име е запазено.",
  "profile.security": "Сигурност",
  "profile.securityDetail":
    "Променете паролата с текущата си парола. Възстановяването на забравена парола е отделен процес чрез имейл.",
  "profile.currentPassword": "Текуща парола",
  "profile.newPassword": "Нова парола",
  "profile.confirmPassword": "Потвърдете новата парола",
  "profile.passwordHint":
    "Използвайте 8–128 знака. Паролите не се запазват в хранилището на браузъра.",
  "profile.sessionPolicy":
    "Промяната на парола прекратява всички предишни сесии. Този браузър получава нова сесия и остава вписан.",
  "profile.changePassword": "Промени паролата",
  "profile.passwordSaved":
    "Паролата е променена. Предишните сесии са прекратени.",
  "profile.preferences": "Предпочитания",
  "profile.preferencesDetail":
    "Езикът и темата се прилагат веднага и се запазват в този браузър, когато хранилището е достъпно.",
  "profile.notifications": "Известия",
  "profile.notificationsDetail":
    "Напомнянията за задачи се показват в камбанката за текущото събитие. Настройки за доставка, имейл, SMS и push известия не са налични.",
  "profile.invalidName":
    "Въведете име от 1–100 знака без контролни знаци или ъглови скоби.",
  "profile.invalidPassword":
    "Въведете текущата си парола и нова парола от 8–128 знака.",
  "profile.mismatch": "Новите пароли не съвпадат.",
  "profile.wrongPassword": "Текущата парола е грешна. Опитайте отново.",
  "profile.expired": "Сесията приключи. Влезте отново, за да продължите.",
  "profile.reauthenticate":
    "Излезте и влезте отново, след което опитайте промяната на парола.",
  "profile.limited": "Твърде много заявки. Изчакайте, преди да опитате отново.",
  "profile.unavailable":
    "Сървърът не потвърди промяната. Проверете връзката и презаредете акаунта, преди да опитате отново.",
  "profile.refresh":
    "Промяната е запазена, но данните на акаунта не са обновени. Презаредете акаунта за потвърждение.",
  "profile.failed":
    "Промяната не е потвърдена. Презаредете акаунта и опитайте отново.",
  "profile.busy": "Вече се изпълнява промяна на акаунта.",
  "profile.reload": "Презареди акаунта",
} satisfies Record<keyof typeof PROFILE_EN_MESSAGES, string>;
